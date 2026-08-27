//! A importação dos dados de produção, exercitada num recorte do banco legado.
//!
//! Os oito scripts de `importacao/` são de uso único, mas o schema não é: a
//! próxima migration que renomeie uma coluna quebra a importação em silêncio, e
//! só se descobre no dia da virada. Este teste roda as oito etapas de verdade,
//! na ordem, sobre `tests/fixtures/legado_amostra.sql` — 26 dos 128 processos,
//! escolhidos para cobrir cada caminho (ver o cabeçalho da fixture).
//!
//! As contagens NÃO são números mágicos: são comparadas contra o próprio
//! recorte. O que está fixado aqui são as DECISÕES — o colapso das trocas do
//! mesmo dia, o motivo suprido, a solução replicada e os enquadramentos de
//! art. 29 que ficam de fora por não haver analogia no legado.

use sqlx::{PgPool, Row};

mod util;

/// Os arquivos da importação, na ordem que as FKs impõem.
const ETAPAS: [&str; 8] = [
    "01_catalogos.sql",
    "02_config_apuratorio.sql",
    "03_policiais.sql",
    "04_processos.sql",
    "05_envolvidos.sql",
    "06_designacoes.sql",
    "07_prazos_andamentos.sql",
    "08_enquadramentos_anexos.sql",
];

async fn conta(pool: &PgPool, sql: &str) -> i64 {
    sqlx::query_scalar(sql)
        .fetch_one(pool)
        .await
        .unwrap_or_else(|e| panic!("consulta falhou: {sql}\n{e}"))
}

/// Carrega o recorte como schema `legado` e roda as oito etapas.
async fn importar(pool: &PgPool) {
    let amostra = std::fs::read_to_string("tests/fixtures/legado_amostra.sql")
        .expect("ler tests/fixtures/legado_amostra.sql");

    // Mesma técnica do roteiro de produção: o recorte chega com o nome de
    // schema que o pg_dump gravou e é renomeado depois — nenhuma linha do
    // arquivo é editada.
    let mut conn = pool.acquire().await.unwrap();
    for comando in [
        amostra.as_str(),
        "ALTER SCHEMA amostra RENAME TO legado;",
        // O pg_dump zera o `search_path` da conexão; sem restaurá-lo as etapas
        // não enxergariam as tabelas do schema novo.
        "SET search_path = public;",
    ] {
        sqlx::raw_sql(comando)
            .execute(&mut *conn)
            .await
            .expect("carregar o recorte legado");
    }

    for etapa in ETAPAS {
        let sql = std::fs::read_to_string(format!("importacao/{etapa}"))
            .unwrap_or_else(|e| panic!("ler importacao/{etapa}: {e}"));
        sqlx::raw_sql(&sql)
            .execute(&mut *conn)
            .await
            .unwrap_or_else(|e| panic!("etapa {etapa} falhou:\n{e}"));
    }
}

#[tokio::test]
async fn as_oito_etapas_reproduzem_o_legado_sem_perder_nada() {
    util::com_banco_descartavel("importacao", |pool| async move {
        importar(&pool).await;

        // ---------------------------------------------------- contagens ----
        // Cada uma comparada com o recorte, não com um número escrito aqui.
        for (novo, legado, o_que) in [
            (
                "SELECT count(*) FROM processos_procedimentos",
                "SELECT count(*) FROM legado.processos_procedimentos",
                "processos",
            ),
            (
                "SELECT count(*) FROM processo_prazos",
                "SELECT count(*) FROM legado.prazos_processo",
                "prazos",
            ),
            (
                "SELECT count(*) FROM policiais_militares",
                "SELECT count(*) FROM legado.usuarios WHERE matricula <> 'ADMIN001'",
                "policiais militares",
            ),
            (
                "SELECT count(*) FROM envolvido_infracoes_penais",
                "SELECT count(*) FROM legado.pm_envolvido_crimes",
                "infracoes penais",
            ),
            (
                // Duas fontes: a tabela `pm_envolvido_rdpm` dos procedimentos e
                // a coluna jsonb `transgressoes_ids` dos PADS.
                "SELECT count(*) FROM envolvido_transgressoes",
                "SELECT (SELECT count(*) FROM legado.pm_envolvido_rdpm)
                      + (SELECT count(*) FROM legado.processos_procedimentos l
                          CROSS JOIN LATERAL jsonb_array_elements(l.transgressoes_ids::jsonb) e
                         WHERE btrim(coalesce(l.transgressoes_ids,'')) NOT IN ('','[]')
                           AND e->>'tipo' = 'rdpm')",
                "transgressoes do RDPM",
            ),
            (
                "SELECT count(*) FROM envolvido_infracoes_estatuto",
                "SELECT count(*) FROM legado.processos_procedimentos l
                   CROSS JOIN LATERAL jsonb_array_elements(l.transgressoes_ids::jsonb) e
                  WHERE btrim(coalesce(l.transgressoes_ids,'')) NOT IN ('','[]')
                    AND e->>'tipo' = 'estatuto' AND e ? 'rdmp_analogia'",
                "infracoes estatutarias (as que trazem analogia)",
            ),
            (
                "SELECT count(*) FROM processo_andamentos",
                "SELECT coalesce(sum(jsonb_array_length(andamentos)), 0) FROM \
                 legado.processos_procedimentos WHERE jsonb_typeof(andamentos) = 'array'",
                "andamentos",
            ),
        ] {
            assert_eq!(
                conta(&pool, novo).await,
                conta(&pool, legado).await,
                "{o_que}: a contagem importada difere do recorte legado"
            );
        }

        // Envolvidos: os registrados MAIS os criados dos processos que os
        // guardavam em coluna (decisão 14). Nenhum a mais, nenhum a menos.
        assert_eq!(
            conta(&pool, "SELECT count(*) FROM processo_envolvidos").await,
            conta(
                &pool,
                "SELECT (SELECT count(*) FROM legado.procedimento_pms_envolvidos)
                      + (SELECT count(*) FROM legado.processos_procedimentos p
                          WHERE p.nome_pm_id IS NOT NULL
                            AND NOT EXISTS (SELECT 1 FROM legado.procedimento_pms_envolvidos e
                                             WHERE e.procedimento_id = p.id))"
            )
            .await,
            "envolvidos: os 'processos' sem envolvido registrado precisam ganhar o seu"
        );

        // ------------------------------------------------- invariantes -----
        for (sql, o_que) in [
            (
                "SELECT count(*) FROM processos_procedimentos p
                   JOIN legado.processos_procedimentos l ON l.id = p.id::text
                   JOIN apuratorios a ON a.id = p.apuratorio_id
                   JOIN unidades_pm u ON u.id = p.unidade_origem_id
                   JOIN municipios_distritos m ON m.id = p.municipio_fato_id
                  WHERE a.sigla <> l.tipo_detalhe
                     OR u.nome  <> l.local_origem
                     OR m.nome  <> regexp_replace(l.local_fatos, '\\s*\\([^)]*\\)\\s*$', '')",
                "processo perdeu especie, unidade ou municipio na traducao",
            ),
            (
                "SELECT count(*) FROM v_processos_detalhados WHERE responsavel_nome IS NULL",
                "processo sem responsavel vigente",
            ),
            (
                "SELECT count(*) FROM processo_designacoes d
                   JOIN apuratorio_papeis ap ON ap.apuratorio_id = d.apuratorio_id
                                            AND ap.papel_id = d.papel_id AND ap.e_responsavel
                   JOIN legado.processos_procedimentos l ON l.id = d.processo_id::text
                  WHERE d.data_fim IS NULL
                    AND d.policial_militar_id::text
                        IS DISTINCT FROM COALESCE(l.responsavel_id, l.presidente_id)",
                "responsavel vigente diferente do legado",
            ),
            (
                "SELECT count(*) FROM (SELECT processo_id, papel_id FROM processo_designacoes
                    WHERE data_fim IS NULL GROUP BY 1,2 HAVING count(*) > 1) x",
                "papel com dois ocupantes vigentes no mesmo processo",
            ),
            (
                "SELECT count(*) FROM (SELECT data_fim, lead(data_inicio)
                      OVER (PARTITION BY processo_id, papel_id ORDER BY data_inicio) prox
                    FROM processo_designacoes) x
                  WHERE data_fim IS NOT NULL AND prox IS DISTINCT FROM data_fim",
                "buraco ou sobreposicao entre designacoes do mesmo papel",
            ),
            (
                "SELECT count(*) FROM processo_prazos z
                   JOIN legado.prazos_processo l ON l.id = z.id::text
                  WHERE z.data_vencimento <> l.data_vencimento OR z.dias <> l.dias_adicionados",
                "vencimento ou dias do prazo divergente do legado",
            ),
            (
                "SELECT count(*) FROM (
                    SELECT DISTINCT ON (processo_id) id FROM processo_prazos
                     ORDER BY processo_id, ordem DESC) v
                   JOIN legado.prazos_processo l ON l.id = v.id::text
                  WHERE l.ativo IS DISTINCT FROM true",
                "prazo vigente diferente do que o legado marcava ativo",
            ),
            (
                "SELECT count(*) FROM processo_andamentos WHERE registrado_por_id IS NULL",
                "andamento sem autor",
            ),
            (
                "SELECT count(*) FROM processos_procedimentos p
                   JOIN apuratorios a ON a.id = p.apuratorio_id
                   JOIN legado.processos_procedimentos l ON l.id = p.id::text
                  WHERE (a.permite_remessa_comissao AND
                         (p.data_remessa_comissao IS DISTINCT FROM l.data_remessa_encarregado
                          OR p.data_remessa_encarregado IS NOT NULL))
                     OR (NOT a.permite_remessa_comissao AND
                         (p.data_remessa_encarregado IS DISTINCT FROM l.data_remessa_encarregado
                          OR p.data_remessa_comissao IS NOT NULL))",
                "remessa gravada na coluna errada para o rito",
            ),
            (
                "SELECT count(*) FROM processo_envolvidos x
                   JOIN legado.processos_procedimentos l ON l.id = x.processo_id::text
                  WHERE x.e_condutor
                    AND l.motorista_id IS DISTINCT FROM x.policial_militar_id::text",
                "condutor que nao era o motorista do legado",
            ),
            (
                "SELECT count(*) FROM legado.usuarios u
                  WHERE u.matricula <> 'ADMIN001'
                    AND NOT EXISTS (SELECT 1 FROM policiais_militares p WHERE p.id = u.id::uuid)",
                "militar do legado que nao entrou",
            ),
        ] {
            assert_eq!(conta(&pool, sql).await, 0, "invariante violada: {o_que}");
        }
    })
    .await;
}

#[tokio::test]
async fn as_decisoes_da_importacao_ficam_registradas_no_dado() {
    util::com_banco_descartavel("importacao_decisoes", |pool| async move {
        importar(&pool).await;

        // B1 — as prorrogações começam NO DIA do vencimento anterior, e o
        // EXCLUDE da 0005 as aceita. Se voltasse para `[]`, a etapa 07 nem
        // teria chegado até aqui; o que se confere é que a convenção do
        // legado sobreviveu, e não foi deslocada em um dia.
        assert!(
            conta(
                &pool,
                "SELECT count(*) FROM processo_prazos z
                   JOIN processo_prazos anterior
                     ON anterior.processo_id = z.processo_id AND anterior.ordem = z.ordem - 1
                  WHERE z.data_inicio = anterior.data_vencimento"
            )
            .await
                > 0,
            "nenhuma prorrogacao comecou no dia do vencimento anterior: \
             as datas do legado foram deslocadas"
        );
        assert_eq!(
            conta(
                &pool,
                "SELECT count(*) FROM processo_prazos z
                   JOIN legado.prazos_processo l ON l.id = z.id::text
                  WHERE z.data_inicio <> l.data_inicio"
            )
            .await,
            0,
            "alguma data de inicio de prazo foi reescrita"
        );

        // B2 — as prorrogações sem motivo recebem um texto reconhecível, e
        // nenhuma prorrogação fica sem motivo (o CHECK exige a partir da 1).
        let supridas = conta(
            &pool,
            "SELECT count(*) FROM processo_prazos
              WHERE motivo = 'Motivo não registrado no sistema anterior'",
        )
        .await;
        assert_eq!(
            supridas,
            conta(
                &pool,
                "SELECT count(*) FROM legado.prazos_processo
                  WHERE COALESCE(ordem_prorrogacao, 0) >= 1
                    AND COALESCE(btrim(motivo), '') = ''"
            )
            .await,
            "o motivo suprido tem de cobrir exatamente as prorrogacoes sem motivo no legado"
        );

        // B3 — as trocas do mesmo dia colapsam. A SR 20 tem TRÊS entradas no
        // jsonb, todas de 2026-01-13, e precisa virar UMA substituição: do
        // primeiro encarregado direto para o último.
        let sr20 = "980f1a82-3771-4193-b43b-37a09eadf0c5";
        let trechos: Vec<(String, Option<chrono::NaiveDate>)> = sqlx::query(
            "SELECT pm.nome, d.data_fim
               FROM processo_designacoes d
               JOIN policiais_militares pm ON pm.id = d.policial_militar_id
               JOIN apuratorio_papeis ap ON ap.apuratorio_id = d.apuratorio_id
                                        AND ap.papel_id = d.papel_id AND ap.e_responsavel
              WHERE d.processo_id = $1::uuid
              ORDER BY d.data_inicio",
        )
        .bind(sr20)
        .fetch_all(&pool)
        .await
        .unwrap()
        .into_iter()
        .map(|r| (r.get(0), r.get(1)))
        .collect();

        assert_eq!(
            trechos.len(),
            2,
            "as 3 trocas do mesmo dia da SR 20 tinham de colapsar em 1 substituicao, \
             sobrou: {trechos:?}"
        );
        assert_eq!(trechos[0].0, "LEANDRO JOSÉ BRISOLA NETO");
        assert_eq!(trechos[1].0, "FABIANA CAVALCANTE MIRANDA");
        assert!(trechos[1].1.is_none(), "o ultimo trecho e o vigente");

        // Consequência geral: uma substituição por dia, nunca mais de uma.
        assert_eq!(
            conta(
                &pool,
                "SELECT count(*) FROM processo_designacoes WHERE data_fim IS NOT NULL"
            )
            .await,
            conta(
                &pool,
                "SELECT count(*) FROM (
                    SELECT DISTINCT l.id, (e->>'data_substituicao')::date
                      FROM legado.processos_procedimentos l
                      CROSS JOIN LATERAL jsonb_array_elements(l.historico_encarregados) e
                     WHERE jsonb_typeof(l.historico_encarregados) = 'array') x"
            )
            .await,
            "o numero de substituicoes tem de ser o de DIAS de troca, nao o de entradas"
        );

        // B4 — a solução do processo alcança TODOS os envolvidos dele.
        assert_eq!(
            conta(
                &pool,
                "SELECT count(*) FROM processo_envolvidos e
                   JOIN legado.processos_procedimentos l ON l.id = e.processo_id::text
                  WHERE l.solucao_tipo IS NOT NULL
                    AND e.solucao_decidida_id IS NULL AND e.solucao_sugerida_id IS NULL"
            )
            .await,
            0,
            "envolvido de processo com solucao ficou sem solucao"
        );

        // B5 — a analogia com o RDPM é obrigatória (decisão 5), e o legado a
        // registrava em UMA das duas fontes só. O vínculo entra quando ela
        // existe (o jsonb dos PADS a traz) e fica de fora quando não existe
        // (`pm_envolvido_art29` nunca a teve). O recorte contém as duas
        // situações, então nenhum dos dois números abaixo é acidente da
        // amostra.
        assert!(
            conta(&pool, "SELECT count(*) FROM legado.pm_envolvido_art29").await > 0,
            "o recorte precisa conter art. 29 SEM analogia para a asserção significar algo"
        );
        assert_eq!(
            conta(
                &pool,
                "SELECT count(*) FROM legado.pm_envolvido_art29 x
                   JOIN legado.pm_envolvido_indicios i ON i.id = x.pm_indicios_id
                   JOIN processo_envolvidos e ON e.id = i.pm_envolvido_id::uuid
                   JOIN envolvido_infracoes_estatuto eie
                     ON eie.envolvido_id = e.id AND eie.infracao_estatuto_id = x.art29_id::uuid"
            )
            .await,
            0,
            "art. 29 vindo de pm_envolvido_art29 nao tem analogia e nao pode entrar"
        );

        // …e o que TEM analogia entra, com ela preenchida.
        let com_analogia = conta(
            &pool,
            "SELECT count(*) FROM legado.processos_procedimentos l
               CROSS JOIN LATERAL jsonb_array_elements(l.transgressoes_ids::jsonb) e
              WHERE btrim(coalesce(l.transgressoes_ids,'')) NOT IN ('','[]')
                AND e->>'tipo' = 'estatuto' AND e ? 'rdmp_analogia'",
        )
        .await;
        assert!(
            com_analogia > 0,
            "o recorte precisa conter infração estatutária COM analogia"
        );
        assert_eq!(
            conta(&pool, "SELECT count(*) FROM envolvido_infracoes_estatuto").await,
            com_analogia,
            "toda infração estatutária com analogia no legado tem de entrar"
        );

        // O enquadramento dos PADS vinha da segunda fonte, a coluna jsonb — e
        // é a maior parte do total. Se alguém apagar aquele bloco da etapa 08,
        // as contagens acima ainda passariam sem esta asserção.
        assert!(
            conta(
                &pool,
                "SELECT count(*) FROM envolvido_transgressoes et
                   JOIN processo_envolvidos e ON e.id = et.envolvido_id
                   JOIN processos_procedimentos p ON p.id = e.processo_id
                   JOIN apuratorios a ON a.id = p.apuratorio_id
                  WHERE lower(a.sigla) = 'pads'"
            )
            .await
                > 0,
            "o enquadramento dos PADS (coluna jsonb transgressoes_ids) nao foi importado"
        );

        // As 5 unidades do catálogo órfão do legado entram como opção, e a
        // grafia é normalizada para casar com as que estão em uso.
        assert_eq!(
            conta(
                &pool,
                "SELECT count(*) FROM unidades_pm WHERE nome IN ('1ºBPM','2ºBPM','BOPE','ROTAM','CG')"
            )
            .await,
            5,
            "as unidades do catalogo orfao do legado entram como opcao disponivel"
        );
        assert_eq!(
            conta(&pool, "SELECT count(*) FROM unidades_pm WHERE nome = 'CORREGEDORIA'").await,
            0,
            "CORREGEDORIA e a mesma unidade que CORREGEPOM, que ja entrou pelos processos"
        );

        // B6 — o militar fictício do sistema anterior não entra, e a conta
        // técnica do seed continua sendo a única sem militar vinculado.
        assert_eq!(
            conta(
                &pool,
                "SELECT count(*) FROM policiais_militares WHERE matricula = 'ADMIN001'"
            )
            .await,
            0,
            "ADMIN001 nao e um militar"
        );
        assert_eq!(
            conta(
                &pool,
                "SELECT count(*) FROM usuarios WHERE policial_militar_id IS NULL"
            )
            .await,
            1,
            "so a conta tecnica do seed fica sem militar vinculado"
        );

        // B7 — o prazo base de cada espécie vem do que o legado praticou, e o
        // Feito Preliminar carrega o seu no documento iniciador.
        assert_eq!(
            conta(
                &pool,
                "SELECT count(*) FROM apuratorios a
                   JOIN (SELECT l.tipo_detalhe,
                                mode() WITHIN GROUP (ORDER BY z.dias_adicionados) AS praticado
                           FROM legado.prazos_processo z
                           JOIN legado.processos_procedimentos l ON l.id = z.processo_id
                          WHERE COALESCE(z.ordem_prorrogacao, 0) = 0
                          GROUP BY l.tipo_detalhe) p ON lower(p.tipo_detalhe) = lower(a.sigla)
                  WHERE a.prazo_base_dias <> p.praticado"
            )
            .await,
            0,
            "o prazo base tem de ser o praticado pela especie"
        );
        assert_eq!(
            conta(
                &pool,
                "SELECT count(*) FROM apuratorio_documentos_iniciadores d
                   JOIN tipos_documento td ON td.id = d.tipo_documento_id
                  WHERE td.nome = 'Feito Preliminar' AND d.prazo_base_dias = 15"
            )
            .await,
            1,
            "o prazo do Feito Preliminar mora no documento iniciador"
        );

        // A configuração do apuratório sai do que o legado praticou, sem lista
        // de siglas: escrivão só onde houve escrivão, encarregado só onde
        // houve encarregado, e um único papel responsável por apuratório.
        assert_eq!(
            conta(
                &pool,
                "SELECT count(*) FROM apuratorios a
                  WHERE (SELECT count(*) FROM apuratorio_papeis ap
                          WHERE ap.apuratorio_id = a.id AND ap.e_responsavel) <> 1"
            )
            .await,
            0,
            "todo apuratorio precisa de exatamente um papel responsavel"
        );

        // O anexo entra, com nome e mime — os bytes da fixture são truncados.
        let anexo: (String, String) =
            sqlx::query_as("SELECT nome_arquivo, mime_type FROM processo_anexos")
                .fetch_one(&pool)
                .await
                .expect("o recorte tem exatamente um anexo");
        assert!(anexo.0.ends_with(".pdf"));
        assert_eq!(anexo.1, "application/pdf");
    })
    .await;
}

/// O relatório de conferência da amostra (`98_amostra_lado_a_lado.sql`) roda, e
/// nenhum dos 6 processos diverge do legado em campo nenhum.
///
/// O arquivo existe para ser LIDO por quem aceita a importação — mas um
/// relatório que ninguém executa envelhece calado: bastaria uma etapa mudar
/// para ele passar a comparar coisa errada, ou coisa nenhuma. Aqui ele roda
/// sobre o mesmo recorte das outras duas provas, e o teste cobra três coisas
/// diferentes:
///
///   1. que a consulta continue **válida** contra o schema — é a mesma razão
///      de `sql_prepare.rs` existir;
///   2. que os 6 processos da amostra estejam de fato no recorte, senão o
///      relatório sairia vazio e "sem divergência" não significaria nada;
///   3. que não haja divergência.
///
/// É por isso que o `98_` é uma instrução SQL só, sem `\echo` nem `\pset`: com
/// meta-comando de psql, `raw_sql` não conseguiria executá-lo (ver §10).
#[tokio::test]
async fn a_amostra_lado_a_lado_nao_acusa_divergencia() {
    util::com_banco_descartavel("amostra_lado_a_lado", |pool| async move {
        importar(&pool).await;

        let sql = std::fs::read_to_string("importacao/98_amostra_lado_a_lado.sql")
            .expect("ler importacao/98_amostra_lado_a_lado.sql");

        let linhas = sqlx::query(&sql)
            .fetch_all(&pool)
            .await
            .expect("o relatorio da amostra precisa ser SQL valido contra o schema");

        // Os 6 processos precisam estar no recorte. Se um sair da fixture, os
        // JOINs simplesmente não produzem linha para ele — e o relatório
        // passaria a dizer "tudo certo" sobre um processo que não conferiu.
        let processos: std::collections::BTreeSet<String> = linhas
            .iter()
            .map(|l| l.get::<String, _>("processo"))
            .collect();
        assert_eq!(
            processos.len(),
            6,
            "a amostra tem 6 processos e o recorte precisa conter todos; vieram {processos:?}"
        );

        // Um relatório de duas linhas também não acusaria nada. O número não é
        // meta: é piso, e existe para que esvaziar o arquivo quebre o teste.
        assert!(
            linhas.len() > 300,
            "o relatorio encolheu para {} comparacoes — algum aspecto parou de \
             produzir linha",
            linhas.len()
        );

        let divergencias: Vec<String> = linhas
            .iter()
            .filter(|l| !l.get::<bool, _>("igual"))
            .map(|l| {
                format!(
                    "  {} | {} | {} | legado={:?} | novo={:?}",
                    l.get::<String, _>("processo"),
                    l.get::<String, _>("aspecto"),
                    l.get::<String, _>("campo"),
                    l.get::<Option<String>, _>("legado"),
                    l.get::<Option<String>, _>("novo"),
                )
            })
            .collect();

        assert!(
            divergencias.is_empty(),
            "a amostra divergiu do legado em {} campo(s):\n{}",
            divergencias.len(),
            divergencias.join("\n")
        );
    })
    .await;
}
