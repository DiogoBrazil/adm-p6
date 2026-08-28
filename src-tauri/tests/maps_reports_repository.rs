//! Mapas e relatórios de escopo configurável.
//!
//! Dois motivos para este arquivo. O primeiro é a regra do período do mapa:
//! `map_rows` filtrava por `data_instauracao BETWEEN`, o que escondia
//! exatamente o processo antigo que continua pendente — que é o que a Seção
//! abre o mapa para ver. O segundo é que os sete relatórios novos substituem
//! consultas que traziam a sigla escrita no SQL; se o escopo voltar a ser
//! literal, estes testes deixam de passar.

use adm_p6_tauri_lib::db::paginacao::Recorte;
use adm_p6_tauri_lib::maps_reports::domain::{
    DesignacaoMatrizFiltro, MapPeriodRequest, MapPrintRequest, ReportFilter,
};
use adm_p6_tauri_lib::maps_reports::repository;
use base64::Engine;
use chrono::NaiveDate;
use sqlx::PgPool;

mod util;
use util::fixtures::{self, envolvido, processo};

fn data(ano: i32, mes: u32, dia: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(ano, mes, dia).unwrap()
}

/// Designa um militar num processo, no papel indicado. Local: só a matriz de
/// designações precisa disto.
async fn designar(pool: &PgPool, processo_id: &str, pm: &str, papel: &str) {
    sqlx::query(
        "INSERT INTO processo_designacoes
             (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio)
         SELECT $1::uuid, p.apuratorio_id, $2::uuid, $3::uuid, p.data_instauracao
           FROM processos_procedimentos p WHERE p.id = $1::uuid",
    )
    .bind(processo_id)
    .bind(pm)
    .bind(papel)
    .execute(pool)
    .await
    .unwrap();
}

/// Um artigo qualquer do RDPM semeado pela 0003 — o relatório precisa de dado
/// legal real, e a fixture só cobre os catálogos operacionais.
async fn alguma_transgressao(pool: &PgPool) -> String {
    sqlx::query_scalar("SELECT id::text FROM transgressoes ORDER BY inciso LIMIT 1")
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn alguma_infracao_penal(pool: &PgPool) -> String {
    sqlx::query_scalar("SELECT id::text FROM infracoes_penais ORDER BY artigo LIMIT 1")
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn esfera(pool: &PgPool, ordem: &str) -> String {
    sqlx::query_scalar(&format!(
        "SELECT id::text FROM esferas_penais ORDER BY nome {ordem} LIMIT 1"
    ))
    .fetch_one(pool)
    .await
    .unwrap()
}

// =============================================================================

/// A regra do mapa não é "instaurado no período".
///
/// O mapa de março responde "o que a Seção tinha em mãos em março": tudo que
/// ainda estava aberto naquela data, inclusive de anos anteriores, mais o que
/// foi concluído dentro do mês.
#[tokio::test]
async fn mapa_acumula_o_que_estava_aberto_no_periodo() {
    util::com_banco_descartavel("mapa_periodo", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // Instaurado em 2019 e nunca concluído: é o caso que o filtro antigo
        // escondia, e o motivo desta correção.
        processo(&pool, &m, &m.apuratorio, "001", data(2019, 1, 10), None).await;
        // Concluído dentro do período.
        processo(
            &pool,
            &m,
            &m.apuratorio,
            "002",
            data(2026, 3, 5),
            Some(data(2026, 3, 20)),
        )
        .await;
        // Concluído ANTES do período: já não estava em mãos em março.
        processo(
            &pool,
            &m,
            &m.apuratorio,
            "003",
            data(2026, 1, 5),
            Some(data(2026, 2, 10)),
        )
        .await;
        // Instaurado DEPOIS do fim do período.
        processo(&pool, &m, &m.apuratorio, "004", data(2026, 5, 1), None).await;

        let linhas = repository::map_rows(
            &pool,
            &MapPeriodRequest {
                periodo_inicio: data(2026, 3, 1),
                periodo_fim: data(2026, 3, 31),
                apuratorio_ids: None,
            },
        )
        .await
        .unwrap();

        let numeros: Vec<&str> = linhas
            .iter()
            .map(|l| {
                l.rotulo
                    .split(" nº ")
                    .nth(1)
                    .unwrap()
                    .split('/')
                    .next()
                    .unwrap()
            })
            .collect();
        assert!(
            numeros.contains(&"001"),
            "o aberto desde 2019 tem de aparecer"
        );
        assert!(
            numeros.contains(&"002"),
            "o concluído no mês tem de aparecer"
        );
        assert!(
            !numeros.contains(&"003"),
            "concluído antes do período não entra"
        );
        assert!(
            !numeros.contains(&"004"),
            "instaurado depois do período não entra"
        );
        assert_eq!(linhas.len(), 2);
    })
    .await;
}

#[tokio::test]
async fn mapa_e_csv_exibem_a_origem_com_subunidade() {
    util::com_banco_descartavel("mapa_subunidade", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = processo(&pool, &m, &m.apuratorio, "SUB-001", data(2026, 3, 5), None).await;
        sqlx::query(
            "UPDATE processos_procedimentos
                SET subunidade_secao_origem_id = $2::uuid
              WHERE id = $1::uuid",
        )
        .bind(&id)
        .bind(&m.subunidade)
        .execute(&pool)
        .await
        .unwrap();

        let pedido = MapPeriodRequest {
            periodo_inicio: data(2026, 3, 1),
            periodo_fim: data(2026, 3, 31),
            apuratorio_ids: None,
        };
        let linhas = repository::map_rows(&pool, &pedido).await.unwrap();
        assert_eq!(linhas[0].unidade_origem, "Unidade Teste");
        assert_eq!(
            linhas[0].subunidade_secao_origem.as_deref(),
            Some("1ª CIA Teste")
        );
        assert_eq!(
            linhas[0].rotulo,
            "TST-A nº SUB-001/2026/Unidade Teste/1ª CIA Teste"
        );

        let exportado = repository::export_csv(&pool, &pedido).await.unwrap();
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(exportado.conteudo)
            .unwrap();
        let csv = String::from_utf8(bytes).unwrap();
        assert!(csv.contains("Unidade Teste / 1ª CIA Teste"), "{csv}");
    })
    .await;
}

/// A impressão não recebe um id solto: a ficha só pode sair se estiver no
/// mesmo recorte mensal e no mesmo escopo que o usuário acabou de gerar.
#[tokio::test]
async fn impressao_do_mapa_respeita_periodo_escopo_e_selecao() {
    util::com_banco_descartavel("mapa_impressao_escopo", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let incluido = processo(&pool, &m, &m.apuratorio, "PDF-001", data(2025, 1, 10), None).await;
        let outro_apuratorio = processo(
            &pool,
            &m,
            &m.apuratorio_livre,
            "PDF-002",
            data(2026, 3, 4),
            None,
        )
        .await;
        let encerrado_antes = processo(
            &pool,
            &m,
            &m.apuratorio,
            "PDF-003",
            data(2026, 1, 4),
            Some(data(2026, 2, 20)),
        )
        .await;

        let pedido = |processo_id: Option<String>| MapPrintRequest {
            periodo_inicio: data(2026, 3, 1),
            periodo_fim: data(2026, 3, 31),
            apuratorio_ids: Some(vec![m.apuratorio.clone()]),
            processo_id,
        };

        let completo = repository::map_print_data(&pool, &pedido(None))
            .await
            .unwrap();
        assert_eq!(completo.len(), 1);
        assert_eq!(completo[0].processo.cabecalho.id, incluido);
        assert!(!completo[0].permite_remessa_comissao);

        let individual = repository::map_print_data(&pool, &pedido(Some(incluido.clone())))
            .await
            .unwrap();
        assert_eq!(individual.len(), 1);
        assert_eq!(individual[0].processo.cabecalho.id, incluido);

        for fora_do_recorte in [outro_apuratorio, encerrado_antes] {
            let erro = repository::map_print_data(&pool, &pedido(Some(fora_do_recorte)))
                .await
                .unwrap_err();
            assert!(erro.message().contains("não pertence"), "{erro}");
        }

        let erro = repository::map_print_data(
            &pool,
            &MapPrintRequest {
                periodo_inicio: data(2026, 4, 1),
                periodo_fim: data(2026, 3, 31),
                apuratorio_ids: None,
                processo_id: None,
            },
        )
        .await
        .unwrap_err();
        assert!(erro.message().contains("data final"), "{erro}");
    })
    .await;
}

/// A ficha é composta pelas fontes do detalhe, não pela linha resumida do
/// mapa. Este cenário protege especialmente envolvidos, designações, prazo e
/// andamento, que seriam fáceis de esquecer numa consulta nova.
#[tokio::test]
async fn impressao_do_mapa_reune_os_dados_detalhados() {
    util::com_banco_descartavel("mapa_impressao_detalhe", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = processo(
            &pool,
            &m,
            &m.apuratorio,
            "PDF-DETALHE",
            data(2026, 3, 5),
            None,
        )
        .await;
        sqlx::query("UPDATE apuratorios SET permite_remessa_comissao = true WHERE id = $1::uuid")
            .bind(&m.apuratorio)
            .execute(&pool)
            .await
            .unwrap();
        envolvido(&pool, &m, &id, &m.pm_um, 1).await;
        designar(&pool, &id, &m.pm_um, &m.papel_encarregado).await;
        sqlx::query(
            "INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias)
             VALUES ($1::uuid, 0, '2026-03-05', 30)",
        )
        .bind(&id)
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO processo_andamentos
                 (processo_id, tipo_andamento_id, descricao, ocorrido_em)
             VALUES ($1::uuid, $2::uuid, 'Diligência registrada para o PDF',
                     '2026-03-12T14:30:00Z')",
        )
        .bind(&id)
        .bind(&m.tipo_andamento)
        .execute(&pool)
        .await
        .unwrap();

        let itens = repository::map_print_data(
            &pool,
            &MapPrintRequest {
                periodo_inicio: data(2026, 3, 1),
                periodo_fim: data(2026, 3, 31),
                apuratorio_ids: None,
                processo_id: Some(id.clone()),
            },
        )
        .await
        .unwrap();

        assert_eq!(itens.len(), 1);
        let item = &itens[0];
        assert_eq!(item.processo.cabecalho.id, id);
        assert!(item.permite_remessa_comissao);
        assert_eq!(item.processo.envolvidos.len(), 1);
        assert_eq!(item.processo.designacoes.len(), 1);
        assert_eq!(item.prazos.len(), 1);
        assert_eq!(item.andamentos.len(), 1);
        assert_eq!(
            item.andamentos[0].descricao,
            "Diligência registrada para o PDF"
        );
        assert_eq!(item.enquadramentos.len(), 1);
    })
    .await;
}

/// Escopo vazio quer dizer "todos". `= ANY('{}')` é falso para toda linha, e
/// sem normalizar a lista o operador que não filtra nada não vê nada.
#[tokio::test]
async fn escopo_vazio_significa_todos() {
    util::com_banco_descartavel("mapa_escopo", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        processo(&pool, &m, &m.apuratorio, "001", data(2026, 3, 5), None).await;

        let pedido = |ids| MapPeriodRequest {
            periodo_inicio: data(2026, 1, 1),
            periodo_fim: data(2026, 12, 31),
            apuratorio_ids: ids,
        };

        let vazio = repository::map_rows(&pool, &pedido(Some(vec![])))
            .await
            .unwrap();
        let nulo = repository::map_rows(&pool, &pedido(None)).await.unwrap();
        assert_eq!(vazio.len(), 1, "lista vazia não pode zerar o mapa");
        assert_eq!(vazio.len(), nulo.len());

        // Já um escopo preenchido filtra de verdade.
        let outro = repository::map_rows(&pool, &pedido(Some(vec![m.apuratorio_livre.clone()])))
            .await
            .unwrap();
        assert!(outro.is_empty());
    })
    .await;
}

#[tokio::test]
async fn status_por_apuratorio_separa_andamento_de_concluido() {
    util::com_banco_descartavel("rel_status", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        processo(&pool, &m, &m.apuratorio, "001", data(2026, 1, 10), None).await;
        processo(&pool, &m, &m.apuratorio, "002", data(2026, 2, 10), None).await;
        processo(
            &pool,
            &m,
            &m.apuratorio,
            "003",
            data(2026, 3, 10),
            Some(data(2026, 4, 1)),
        )
        .await;
        processo(
            &pool,
            &m,
            &m.apuratorio_livre,
            "004",
            data(2026, 3, 10),
            None,
        )
        .await;
        // Ano anterior: o filtro de ano tem de deixá-lo de fora.
        processo(&pool, &m, &m.apuratorio, "005", data(2025, 3, 10), None).await;

        let linhas = repository::status_by_apuratorio(
            &pool,
            &ReportFilter {
                ano: Some(2026),
                ..Default::default()
            },
        )
        .await
        .unwrap();

        let a = linhas.iter().find(|l| l.sigla == "TST-A").unwrap();
        assert_eq!((a.em_andamento, a.concluidos, a.total), (2, 1, 3));
        let b = linhas.iter().find(|l| l.sigla == "TST-B").unwrap();
        assert_eq!((b.em_andamento, b.concluidos, b.total), (1, 0, 1));
        // O tipo vem junto, para a tela agrupar sem conhecer sigla nenhuma.
        assert_eq!(a.tipo_apuratorio_nome, "procedimento");
    })
    .await;
}

/// A esfera penal é escolhida no vínculo (art. 9º do CPM), então a mesma
/// infração aparece uma vez por esfera. Era isso que os dois comandos separados
/// `common_crimes_stats` e `military_crimes_stats` não conseguiam expressar.
#[tokio::test]
async fn infracao_penal_conta_por_esfera_do_vinculo() {
    util::com_banco_descartavel("rel_penal", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let infracao = alguma_infracao_penal(&pool).await;
        let militar = esfera(&pool, "ASC").await;
        let comum = esfera(&pool, "DESC").await;
        assert_ne!(militar, comum, "a 0003 semeia duas esferas");

        let p = processo(
            &pool,
            &m,
            &m.apuratorio_livre,
            "001",
            data(2026, 2, 1),
            None,
        )
        .await;
        let e1 = envolvido(&pool, &m, &p, &m.pm_um, 1).await;
        let e2 = envolvido(&pool, &m, &p, &m.pm_dois, 2).await;

        for (env, esf) in [(&e1, &militar), (&e2, &comum)] {
            sqlx::query(
                "INSERT INTO envolvido_infracoes_penais
                     (envolvido_id, infracao_penal_id, esfera_penal_id)
                 VALUES ($1::uuid, $2::uuid, $3::uuid)",
            )
            .bind(env)
            .bind(&infracao)
            .bind(esf)
            .execute(&pool)
            .await
            .unwrap();
        }

        let linhas = repository::infracoes_penais(&pool, &ReportFilter::default())
            .await
            .unwrap();
        assert_eq!(linhas.len(), 2, "uma linha por esfera, não uma só somada");
        assert!(linhas.iter().all(|l| l.total == 1));
        let classificacoes: Vec<&str> = linhas
            .iter()
            .map(|l| l.classificacao.as_deref().unwrap())
            .collect();
        assert_ne!(classificacoes[0], classificacoes[1]);
        // A classificação vem de JOIN, nunca de literal no SQL.
        assert!(classificacoes.iter().all(|c| c.contains(" · ")));
    })
    .await;
}

/// Relatório lê registro existente, não lista opções: o catálogo desativado
/// continua contando. Espelha
/// `processo_antigo_continua_exibindo_catalogo_desativado`.
#[tokio::test]
async fn relatorio_continua_contando_catalogo_desativado() {
    util::com_banco_descartavel("rel_desativado", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let transgressao = alguma_transgressao(&pool).await;

        let p = processo(&pool, &m, &m.apuratorio, "001", data(2019, 5, 1), None).await;
        let env = envolvido(&pool, &m, &p, &m.pm_um, 1).await;
        sqlx::query(
            "INSERT INTO envolvido_transgressoes (envolvido_id, transgressao_id)
             VALUES ($1::uuid, $2::uuid)",
        )
        .bind(&env)
        .bind(&transgressao)
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("UPDATE transgressoes SET ativo = false WHERE id = $1::uuid")
            .bind(&transgressao)
            .execute(&pool)
            .await
            .unwrap();

        let linhas = repository::transgressoes(&pool, &ReportFilter::default())
            .await
            .unwrap();
        assert_eq!(
            linhas.len(),
            1,
            "desativar o artigo não apaga o que já foi imputado"
        );
        assert_eq!(linhas[0].total, 1);
        assert!(linhas[0].rotulo.contains("inc."));
        assert!(
            linhas[0].classificacao.is_some(),
            "a gravidade vem do artigo"
        );
    })
    .await;
}

/// A quebra por papel é parâmetro. O legado lia colunas fixas (`escrivao_id`,
/// `presidente_id`) e, quando saíram do schema, a informação sumiu junto.
#[tokio::test]
async fn matriz_de_designacoes_isola_o_papel() {
    util::com_banco_descartavel("rel_matriz", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let p1 = processo(&pool, &m, &m.apuratorio, "001", data(2026, 1, 5), None).await;
        let p2 = processo(&pool, &m, &m.apuratorio, "002", data(2026, 2, 5), None).await;
        let p3 = processo(
            &pool,
            &m,
            &m.apuratorio_livre,
            "003",
            data(2026, 3, 5),
            None,
        )
        .await;

        designar(&pool, &p1, &m.pm_um, &m.papel_encarregado).await;
        designar(&pool, &p2, &m.pm_um, &m.papel_encarregado).await;
        designar(&pool, &p3, &m.pm_um, &m.papel_encarregado).await;
        // O mesmo militar, como escrivão, num dos processos.
        designar(&pool, &p1, &m.pm_dois, &m.papel_escrivao).await;

        let todos = repository::designations_matrix(&pool, &DesignacaoMatrizFiltro::default())
            .await
            .unwrap();
        assert_eq!(todos.len(), 2, "dois militares designados");
        let um = todos
            .iter()
            .find(|l| l.policial_militar_id == m.pm_um)
            .unwrap();
        assert_eq!(um.total, 3);
        // Duas colunas: TST-A com 2 e TST-B com 1.
        assert_eq!(um.celulas.len(), 2);
        let a = um.celulas.iter().find(|c| c.rotulo == "TST-A").unwrap();
        assert_eq!(a.total, 2);

        // Filtrado pelo papel de escrivão sobra só o segundo militar.
        let so_escrivao = repository::designations_matrix(
            &pool,
            &DesignacaoMatrizFiltro {
                papel_ids: Some(vec![m.papel_escrivao.clone()]),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(so_escrivao.len(), 1);
        assert_eq!(so_escrivao[0].policial_militar_id, m.pm_dois);
        assert_eq!(so_escrivao[0].total, 1);
    })
    .await;
}

/// Sugerida e decidida são catálogos distintos, e o relatório não pode fundi-los:
/// o encarregado sugere, a autoridade decide.
#[tokio::test]
async fn solucoes_sugeridas_e_decididas_sao_contadas_em_separado() {
    util::com_banco_descartavel("rel_solucao", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p = processo(
            &pool,
            &m,
            &m.apuratorio_livre,
            "001",
            data(2026, 2, 1),
            None,
        )
        .await;
        let e1 = envolvido(&pool, &m, &p, &m.pm_um, 1).await;
        let e2 = envolvido(&pool, &m, &p, &m.pm_dois, 2).await;

        sqlx::query(
            "UPDATE processo_envolvidos
                SET solucao_sugerida_id = $2::uuid, solucao_decidida_id = $3::uuid
              WHERE id = $1::uuid",
        )
        .bind(&e1)
        .bind(&m.solucao_sugerida)
        .bind(&m.solucao_punido)
        .execute(&pool)
        .await
        .unwrap();
        // O segundo só tem sugestão: a autoridade ainda não decidiu.
        sqlx::query(
            "UPDATE processo_envolvidos SET solucao_sugerida_id = $2::uuid WHERE id = $1::uuid",
        )
        .bind(&e2)
        .bind(&m.solucao_sugerida)
        .execute(&pool)
        .await
        .unwrap();

        let resumo = repository::by_solution(&pool, &ReportFilter::default())
            .await
            .unwrap();
        assert_eq!(resumo.sugeridas.len(), 1);
        assert_eq!(resumo.sugeridas[0].total, 2);
        assert_eq!(resumo.decididas.len(), 1);
        assert_eq!(resumo.decididas[0].total, 1, "só um teve decisão");
        assert_eq!(resumo.decididas[0].rotulo, "Punido Teste");
    })
    .await;
}

/// As categorias vêm do catálogo. Antes eram quatro strings procuradas dentro
/// de um array JSONB.
#[tokio::test]
async fn categorias_de_indicio_saem_do_catalogo() {
    util::com_banco_descartavel("rel_categoria", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p = processo(
            &pool,
            &m,
            &m.apuratorio_livre,
            "001",
            data(2026, 2, 1),
            None,
        )
        .await;
        let env = envolvido(&pool, &m, &p, &m.pm_um, 1).await;
        sqlx::query(
            "INSERT INTO envolvido_categorias_indicio (envolvido_id, categoria_indicio_id)
             VALUES ($1::uuid, $2::uuid)",
        )
        .bind(&env)
        .bind(&m.categoria_indicio)
        .execute(&pool)
        .await
        .unwrap();

        let linhas = repository::by_evidence_category(&pool, &ReportFilter::default())
            .await
            .unwrap();
        assert_eq!(linhas.len(), 1);
        assert_eq!(linhas[0].rotulo, "Sem Indicios Teste");
        assert_eq!(linhas[0].total, 1);

        // Fora do escopo, some.
        let outro = repository::by_evidence_category(
            &pool,
            &ReportFilter {
                apuratorio_ids: Some(vec![m.apuratorio.clone()]),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert!(outro.is_empty());
    })
    .await;
}

// ── Mapas salvos ─────────────────────────────────────────────────────────────
//
// O mapa salvo é a única coluna JSONB de domínio do schema, e é justificada:
// recalcular hoje daria outro resultado, e preservar exatamente o que foi
// emitido é a razão de o mapa ser salvo. Estas três consultas montam SQL em
// tempo de execução (`SAVED_MAP_COLS`, `SAVED_MAP_JOINS`), então só executá-las
// as valida — é o que `sql_prepare.rs` cobra.

use adm_p6_tauri_lib::maps_reports::domain::SaveMapRequest;
use serde_json::json;
use util::fixtures::conta_admin;

#[tokio::test]
async fn mapa_salvo_preserva_o_snapshot_e_o_autor() {
    util::com_banco_descartavel("mapa_salvo", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let autor = conta_admin(&pool).await;
        let snapshot = json!([{ "rotulo": "TST-A nº 001", "responsavel_nome": "PM UM" }]);

        let mut tx = pool.begin().await.unwrap();
        let id = repository::save_map(
            &mut tx,
            &SaveMapRequest {
                titulo: "Mapa de Março/2026".into(),
                apuratorio_id: Some(m.apuratorio.clone()),
                periodo_inicio: data(2026, 3, 1),
                periodo_fim: data(2026, 3, 31),
                total_processos: 1,
                total_concluidos: 0,
                total_andamento: 1,
                dados_mapa: snapshot.clone(),
            },
            &autor,
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        let lista = repository::list_saved_maps(&pool, Recorte::default())
            .await
            .unwrap()
            .items;
        assert_eq!(lista.len(), 1);
        assert_eq!(lista[0].id, id);
        assert_eq!(lista[0].titulo, "Mapa de Março/2026");
        assert_eq!(lista[0].apuratorio_sigla.as_deref(), Some("TST-A"));
        assert_eq!(lista[0].total_processos, 1);
        assert_eq!(
            lista[0].gerado_por.as_deref(),
            Some("ADMINISTRADOR DO SISTEMA"),
            "o autor e a conta que gerou"
        );

        let completo = repository::get_saved_map(&pool, &id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(completo.dados_mapa, snapshot, "o snapshot volta intacto");
        assert_eq!(completo.cabecalho.titulo, "Mapa de Março/2026");

        // Mudar o mundo depois NÃO reescreve o mapa emitido.
        sqlx::query("UPDATE apuratorios SET sigla = 'TST-Z' WHERE id = $1::uuid")
            .bind(&m.apuratorio)
            .execute(&pool)
            .await
            .unwrap();
        let depois = repository::get_saved_map(&pool, &id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(depois.dados_mapa, snapshot, "o snapshot e imutavel");
    })
    .await;
}

/// Mapa sem apuratório é o "completo": todas as espécies num documento só.
#[tokio::test]
async fn mapa_completo_nao_aponta_para_apuratorio_nenhum() {
    util::com_banco_descartavel("mapa_completo", |pool| async move {
        fixtures::mundo_configurado(&pool).await;
        let autor = conta_admin(&pool).await;

        let mut tx = pool.begin().await.unwrap();
        let id = repository::save_map(
            &mut tx,
            &SaveMapRequest {
                titulo: "Mapa completo".into(),
                apuratorio_id: None,
                periodo_inicio: data(2026, 3, 1),
                periodo_fim: data(2026, 3, 31),
                total_processos: 0,
                total_concluidos: 0,
                total_andamento: 0,
                dados_mapa: json!([]),
            },
            &autor,
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        let lista = repository::list_saved_maps(&pool, Recorte::default())
            .await
            .unwrap()
            .items;
        assert!(lista[0].apuratorio_id.is_none());
        assert!(
            lista[0].apuratorio_sigla.is_none(),
            "o LEFT JOIN aceita a ausencia"
        );

        // "Excluir" é exclusão lógica: o mapa sai da lista, mas a linha fica.
        let mut tx = pool.begin().await.unwrap();
        repository::delete_saved_map(&mut tx, &id).await.unwrap();
        tx.commit().await.unwrap();
        assert!(repository::list_saved_maps(&pool, Recorte::default())
            .await
            .unwrap()
            .items
            .is_empty());

        // E `get_saved_map` NÃO filtra `ativo`, então ainda alcança o excluído
        // por id. A §9 do guia deixava a assimetria em aberto; foi decidida
        // pelo princípio 6 — lista de opções filtra, leitura de registro
        // existente não —, e um mapa é documento já emitido. Fica assim.
        assert!(repository::get_saved_map(&pool, &id)
            .await
            .unwrap()
            .is_some());

        // Excluir de novo não é erro: o UPDATE afeta a mesma linha.
        let mut tx = pool.begin().await.unwrap();
        assert!(repository::delete_saved_map(&mut tx, &id).await.is_ok());
        tx.commit().await.unwrap();

        // Id inexistente, esse sim, é recusado com regra legível.
        let mut tx = pool.begin().await.unwrap();
        let erro = repository::delete_saved_map(&mut tx, "00000000-0000-4000-8000-000000000000")
            .await
            .expect_err("id inexistente");
        assert!(
            erro.message().contains("Este mapa não existe mais"),
            "{erro}"
        );
    })
    .await;
}

/// A lista de mapas salvos pagina, do mais recente para o mais antigo, e o
/// total conta só o que a lista mostra.
///
/// O mapa excluído é exclusão **lógica** (princípio 6): ele sai da lista sem
/// sumir do banco. Se a contagem não filtrasse `ativo` igual à página, o
/// rodapé prometeria uma página que não existe.
#[tokio::test]
async fn mapas_salvos_paginam_do_mais_recente() {
    util::com_banco_descartavel("mapas_pagina", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let autor = conta_admin(&pool).await;
        const QUANTOS: i32 = 25;

        let mut ids = Vec::new();
        for n in 0..QUANTOS {
            let mut tx = pool.begin().await.unwrap();
            let id = repository::save_map(
                &mut tx,
                &SaveMapRequest {
                    titulo: format!("Mapa {n:02}"),
                    apuratorio_id: Some(m.apuratorio.clone()),
                    periodo_inicio: data(2026, 3, 1),
                    periodo_fim: data(2026, 3, 31),
                    total_processos: 0,
                    total_concluidos: 0,
                    total_andamento: 0,
                    dados_mapa: json!([]),
                },
                &autor,
            )
            .await
            .unwrap();
            tx.commit().await.unwrap();
            ids.push(id);
        }

        // O mais recente encabeça: é o último salvo.
        let primeira = repository::list_saved_maps(&pool, Recorte::novo(Some(1), Some(10)))
            .await
            .unwrap();
        assert_eq!(primeira.items.len(), 10);
        assert_eq!(primeira.total, QUANTOS as i64);
        assert_eq!(primeira.per_page, 10);
        assert_eq!(primeira.items[0].id, *ids.last().unwrap());

        let segunda = repository::list_saved_maps(&pool, Recorte::novo(Some(2), Some(10)))
            .await
            .unwrap();
        assert_eq!(segunda.page, 2);
        for item in &primeira.items {
            assert!(
                !segunda.items.iter().any(|s| s.id == item.id),
                "a mesma linha caiu em duas paginas"
            );
        }

        // Excluir tira da página **e** do total, nos dois na mesma medida.
        let mut tx = pool.begin().await.unwrap();
        repository::delete_saved_map(&mut tx, ids.last().unwrap())
            .await
            .unwrap();
        tx.commit().await.unwrap();

        let depois = repository::list_saved_maps(&pool, Recorte::novo(Some(1), Some(10)))
            .await
            .unwrap();
        assert_eq!(depois.total, QUANTOS as i64 - 1, "o excluido sai do total");
        assert!(
            !depois.items.iter().any(|i| i.id == *ids.last().unwrap()),
            "e sai da pagina"
        );

        // Página além do fim é vazia, não erro.
        let longe = repository::list_saved_maps(&pool, Recorte::novo(Some(99), Some(10)))
            .await
            .unwrap();
        assert!(longe.items.is_empty());
        assert_eq!(longe.total, QUANTOS as i64 - 1);
    })
    .await;
}
