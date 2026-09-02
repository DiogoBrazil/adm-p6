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
    DesignacaoMatrizFiltro, MapPeriodRequest, MapPrintRequest, MapRow, ReportFilter,
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

/// Dá ao processo um prazo inicial que vence daqui a `dias` (negativo = vencido).
///
/// O vencimento é coluna gerada (`data_inicio + dias`) e `ck_prazo_dias` exige
/// `dias > 0`, então quem anda para trás é a data de início — um prazo vencido
/// é um prazo de 30 dias que começou há mais de 30.
///
/// A fixture de processo não cria linha em `processo_prazos`; quem cria é o
/// `save` do repositório. É isso que permite testar o balde "sem prazo": o
/// processo sem esta chamada é um apuratório cuja data de recebimento nunca foi
/// informada, que é o estado real de boa parte do acervo.
async fn prazo_vencendo_em(pool: &PgPool, processo_id: &str, dias: i64) {
    const DURACAO: i64 = 30;
    let inicio = chrono::Utc::now().date_naive() + chrono::Duration::days(dias - DURACAO);
    sqlx::query(
        "INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias)
         VALUES ($1::uuid, 0, $2, $3)",
    )
    .bind(processo_id)
    .bind(inicio)
    .bind(i32::try_from(DURACAO).unwrap())
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

        let responsaveis = repository::by_responsible(
            &pool,
            &ReportFilter {
                apuratorio_ids: None,
                ano: Some(2026),
                limit: None,
            },
        )
        .await
        .unwrap();
        assert_eq!(responsaveis[0].rotulo, "TST PM 100000001 PM UM");
    })
    .await;
}

/// A ordem do mapa vem do **dado**, não do código.
///
/// O documento emitido precisa abrir por SR, IPM e PADS quando eles estão no
/// escopo. Isso podia ter virado uma lista de siglas no `ORDER BY` — e teria
/// quebrado em silêncio no dia em que o administrador renomeasse uma delas,
/// porque sigla é apresentação (princípio 2). Virou `apuratorios.ordem`, coluna
/// administrável semeada uma vez pela 0019.
///
/// O teste não menciona SR nem IPM: ele grava a ordem nas espécies da fixtura e
/// exige que ela vença a sigla. É o mecanismo que está sob prova, e é ele que
/// continuaria valendo se as três siglas mudassem de nome amanhã.
///
/// A segunda metade prova o outro lado: com `ordem` igual, o desempate continua
/// sendo alfabético — que é o comportamento de antes da coluna existir, e o que
/// mantém "o resto em qualquer ordem" previsível.
#[tokio::test]
async fn ordem_do_mapa_sai_da_coluna_e_desempata_pela_sigla() {
    util::com_banco_descartavel("mapa_ordem", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // Um processo em cada espécie, no mesmo período.
        processo(&pool, &m, &m.apuratorio, "001", data(2026, 3, 5), None).await;
        processo(
            &pool,
            &m,
            &m.apuratorio_livre,
            "002",
            data(2026, 3, 6),
            None,
        )
        .await;
        processo(&pool, &m, &m.apuratorio_cp, "003", data(2026, 3, 7), None).await;

        let pedido = MapPeriodRequest {
            periodo_inicio: data(2026, 1, 1),
            periodo_fim: data(2026, 12, 31),
            apuratorio_ids: None,
        };

        // Sem ninguém nomeado, todos ficam no `DEFAULT 100` da 0019: alfabético.
        let siglas = |linhas: &[MapRow]| {
            linhas
                .iter()
                .map(|l| l.apuratorio_sigla.clone())
                .collect::<Vec<_>>()
        };
        let padrao = repository::map_rows(&pool, &pedido).await.unwrap();
        assert_eq!(
            siglas(&padrao),
            vec!["TST-A", "TST-B", "TST-C"],
            "sem ordem declarada, o desempate por sigla mantém o de antes"
        );

        // Agora a ordem é declarada, e ela inverte o alfabeto de propósito.
        sqlx::query("UPDATE apuratorios SET ordem = $2 WHERE id = $1::uuid")
            .bind(&m.apuratorio_cp)
            .bind(1_i32)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("UPDATE apuratorios SET ordem = $2 WHERE id = $1::uuid")
            .bind(&m.apuratorio_livre)
            .bind(2_i32)
            .execute(&pool)
            .await
            .unwrap();

        let declarada = repository::map_rows(&pool, &pedido).await.unwrap();
        assert_eq!(
            siglas(&declarada),
            vec!["TST-C", "TST-B", "TST-A"],
            "a coluna vence a sigla, e quem não foi nomeado vai para o fim"
        );
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
        assert_eq!(um.situacao.total, 3);
        // Duas colunas: TST-A com 2 e TST-B com 1.
        assert_eq!(um.celulas.len(), 2);
        let a = um.celulas.iter().find(|c| c.rotulo == "TST-A").unwrap();
        assert_eq!(a.situacao.total, 2);

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
        assert_eq!(so_escrivao[0].situacao.total, 1);
    })
    .await;
}

/// Os quatro baldes da situação, e por que são quatro.
///
/// "Em andamento" sozinho não responde à pergunta que a Seção faz — o que ela
/// precisa saber é quanto está **no prazo** e quanto está **vencido**. E existe
/// um quarto estado que não é nenhum dos três: o apuratório em andamento cuja
/// data de recebimento nunca foi informada não tem prazo nenhum, e somá-lo a
/// "no prazo" afirmaria um prazo que não há.
#[tokio::test]
async fn matriz_separa_concluido_no_prazo_vencido_e_sem_prazo() {
    util::com_banco_descartavel("rel_matriz_situacao", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let concluido = processo(
            &pool,
            &m,
            &m.apuratorio,
            "001",
            data(2026, 1, 5),
            Some(data(2026, 2, 5)),
        )
        .await;
        let no_prazo = processo(&pool, &m, &m.apuratorio, "002", data(2026, 1, 6), None).await;
        let vencido = processo(&pool, &m, &m.apuratorio, "003", data(2026, 1, 7), None).await;
        // Sem chamada a `prazo_vencendo_em`: é o quarto balde.
        let sem_prazo = processo(&pool, &m, &m.apuratorio, "004", data(2026, 1, 8), None).await;

        prazo_vencendo_em(&pool, &concluido, 30).await;
        prazo_vencendo_em(&pool, &no_prazo, 30).await;
        prazo_vencendo_em(&pool, &vencido, -1).await;

        for p in [&concluido, &no_prazo, &vencido, &sem_prazo] {
            designar(&pool, p, &m.pm_um, &m.papel_encarregado).await;
        }

        let linhas = repository::designations_matrix(&pool, &DesignacaoMatrizFiltro::default())
            .await
            .unwrap();
        assert_eq!(linhas.len(), 1);
        let s = linhas[0].situacao;
        assert_eq!(s.concluidos, 1, "concluído sai do controle de prazo");
        assert_eq!(s.no_prazo, 1);
        assert_eq!(s.vencidos, 1, "vencimento anterior a hoje");
        assert_eq!(s.sem_prazo, 1, "recebimento nunca informado");
        assert_eq!(
            s.total,
            s.concluidos + s.no_prazo + s.vencidos + s.sem_prazo,
            "os quatro baldes são exclusivos e somam o total"
        );

        // A célula do apuratório carrega a mesma quebra, para a ficha do militar
        // conseguir dizer em que espécie o atraso está.
        assert_eq!(linhas[0].celulas.len(), 1);
        assert_eq!(linhas[0].celulas[0].situacao.vencidos, 1);
    })
    .await;
}

/// O recorte por balde e as duas datas — e por que elas saem do conjunto
/// **já filtrado**.
///
/// A pergunta que motivou isto é "entre os encarregados de SR, qual concluiu por
/// último". Ela só tem resposta se a maior `data_conclusao` for calculada depois
/// do recorte: com as datas do conjunto inteiro, filtrar por "vencidos" ainda
/// devolveria a conclusão de um processo que o filtro acabou de excluir.
#[tokio::test]
async fn recorte_por_situacao_leva_as_datas_junto() {
    util::com_banco_descartavel("rel_situacao_datas", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // `processo` grava `data_recebimento = data_instauracao`.
        let antigo = processo(
            &pool,
            &m,
            &m.apuratorio,
            "001",
            data(2026, 1, 10),
            Some(data(2026, 2, 10)),
        )
        .await;
        let recente = processo(
            &pool,
            &m,
            &m.apuratorio,
            "002",
            data(2026, 3, 20),
            Some(data(2026, 4, 20)),
        )
        .await;
        let vencido = processo(&pool, &m, &m.apuratorio, "003", data(2026, 2, 1), None).await;
        prazo_vencendo_em(&pool, &vencido, -5).await;

        for p in [&antigo, &recente, &vencido] {
            designar(&pool, p, &m.pm_um, &m.papel_encarregado).await;
        }

        let tudo = repository::designations_matrix(&pool, &DesignacaoMatrizFiltro::default())
            .await
            .unwrap();
        assert_eq!(tudo[0].situacao.total, 3);
        assert_eq!(tudo[0].situacao.ultima_conclusao, Some(data(2026, 4, 20)));
        assert_eq!(tudo[0].situacao.ultimo_recebimento, Some(data(2026, 3, 20)));

        let so_vencidos = repository::designations_matrix(
            &pool,
            &DesignacaoMatrizFiltro {
                situacao: Some("vencidos".to_string()),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(so_vencidos[0].situacao.total, 1);
        assert_eq!(
            so_vencidos[0].situacao.concluidos, 0,
            "o balde recorta o que é contado"
        );
        assert_eq!(
            so_vencidos[0].situacao.ultima_conclusao, None,
            "vencido não tem conclusão, e a data não pode vir do que ficou de fora"
        );
        assert_eq!(
            so_vencidos[0].situacao.ultimo_recebimento,
            Some(data(2026, 2, 1))
        );

        let so_concluidos = repository::designations_matrix(
            &pool,
            &DesignacaoMatrizFiltro {
                situacao: Some("concluidos".to_string()),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(so_concluidos[0].situacao.total, 2);
        assert_eq!(
            so_concluidos[0].situacao.ultima_conclusao,
            Some(data(2026, 4, 20))
        );

        // A célula do apuratório carrega as mesmas datas do conjunto dela.
        assert_eq!(
            so_concluidos[0].celulas[0].situacao.ultima_conclusao,
            Some(data(2026, 4, 20))
        );
    })
    .await;
}

/// O recorte "em andamento", que é união de dois baldes — e não um quinto.
///
/// A Seção precisa perguntar "quanto este militar tem em mão", sem escolher
/// entre no prazo e vencido. A união mora no filtro, não no `BALDE`: os quatro
/// continuam exclusivos e somando o total, e é isso que este teste trava junto.
///
/// E ela deixa `sem_prazo` **de fora**, por decisão. O apuratório sem
/// recebimento informado está em andamento, mas não tem prazo para estar no
/// prazo ou vencido, e o recorte existe para acompanhar prazo. A consequência é
/// que "em andamento" devolve **menos** que `total - concluídos` quando há algum
/// deles — o que este teste afirma de propósito, para que a diferença seja uma
/// escolha registrada e não uma surpresa no dia em que ela aparecer.
#[tokio::test]
async fn em_andamento_soma_no_prazo_e_vencido_e_deixa_sem_prazo_de_fora() {
    util::com_banco_descartavel("rel_em_andamento", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let concluido = processo(
            &pool,
            &m,
            &m.apuratorio,
            "001",
            data(2026, 1, 5),
            Some(data(2026, 2, 5)),
        )
        .await;
        let no_prazo = processo(&pool, &m, &m.apuratorio, "002", data(2026, 1, 6), None).await;
        let vencido = processo(&pool, &m, &m.apuratorio, "003", data(2026, 1, 7), None).await;
        // Sem `prazo_vencendo_em`: é o balde que a união não alcança.
        let sem_prazo = processo(&pool, &m, &m.apuratorio, "004", data(2026, 1, 8), None).await;

        prazo_vencendo_em(&pool, &concluido, 30).await;
        prazo_vencendo_em(&pool, &no_prazo, 30).await;
        prazo_vencendo_em(&pool, &vencido, -1).await;

        for p in [&concluido, &no_prazo, &vencido, &sem_prazo] {
            designar(&pool, p, &m.pm_um, &m.papel_encarregado).await;
        }

        let andamento = repository::designations_matrix(
            &pool,
            &DesignacaoMatrizFiltro {
                situacao: Some("em_andamento".to_string()),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(andamento.len(), 1);
        let s = andamento[0].situacao;
        assert_eq!(s.no_prazo, 1);
        assert_eq!(s.vencidos, 1);
        assert_eq!(s.total, 2, "a união conta os dois baldes com prazo");
        assert_eq!(s.concluidos, 0, "o recorte vale para o que é contado");
        assert_eq!(
            s.sem_prazo, 0,
            "recebimento nunca informado não entra: não há prazo a acompanhar"
        );

        // O total sem recorte é 4, então a união devolve **menos** que
        // `total - concluídos`. É a consequência aceita da decisão, e está aqui
        // para que mudá-la exija mudar um teste que diz o porquê.
        let tudo = repository::designations_matrix(&pool, &DesignacaoMatrizFiltro::default())
            .await
            .unwrap();
        assert_eq!(tudo[0].situacao.total, 4);
        assert_eq!(
            tudo[0].situacao.total - tudo[0].situacao.concluidos,
            3,
            "três não concluídos, contra os dois que a união recorta"
        );

        // A célula do apuratório carrega a mesma união.
        assert_eq!(andamento[0].celulas.len(), 1);
        assert_eq!(andamento[0].celulas[0].situacao.total, 2);
    })
    .await;
}

/// A ordenação por data, e quem não tem data.
///
/// Militar que nunca concluiu nada não é "o que concluiu há mais tempo": é o que
/// não concluiu. Nas duas direções ele vai para o fim — do contrário a lista
/// crescente abriria justamente com quem não responde à pergunta.
#[tokio::test]
async fn ordenacao_por_data_manda_quem_nao_tem_para_o_fim() {
    util::com_banco_descartavel("rel_ordenacao", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let cedo = processo(
            &pool,
            &m,
            &m.apuratorio,
            "001",
            data(2026, 1, 5),
            Some(data(2026, 2, 5)),
        )
        .await;
        let tarde = processo(
            &pool,
            &m,
            &m.apuratorio,
            "002",
            data(2026, 6, 5),
            Some(data(2026, 7, 5)),
        )
        .await;
        // O terceiro militar tem dois apuratórios e nenhuma conclusão: fica em
        // primeiro por total, e em último por data de conclusão.
        let aberto_um = processo(&pool, &m, &m.apuratorio, "003", data(2026, 3, 5), None).await;
        let aberto_dois = processo(&pool, &m, &m.apuratorio, "004", data(2026, 4, 5), None).await;

        designar(&pool, &cedo, &m.pm_um, &m.papel_encarregado).await;
        designar(&pool, &tarde, &m.pm_dois, &m.papel_encarregado).await;
        designar(&pool, &aberto_um, &m.pm_tres, &m.papel_encarregado).await;
        designar(&pool, &aberto_dois, &m.pm_tres, &m.papel_encarregado).await;

        let ordenado = |ordem: &str| {
            let filtro = DesignacaoMatrizFiltro {
                ordenacao: Some(ordem.to_string()),
                ..Default::default()
            };
            let pool = pool.clone();
            async move {
                repository::designations_matrix(&pool, &filtro)
                    .await
                    .unwrap()
                    .into_iter()
                    .map(|l| l.policial_militar_id)
                    .collect::<Vec<_>>()
            }
        };

        // Padrão: por total. O pm_tres tem dois.
        assert_eq!(ordenado("total").await[0], m.pm_tres);
        // Valor desconhecido cai no padrão, e não em lista vazia.
        assert_eq!(ordenado("ordem-que-nao-existe").await[0], m.pm_tres);

        let recente = ordenado("conclusao_recente").await;
        assert_eq!(recente[0], m.pm_dois, "concluiu em julho");
        assert_eq!(recente[1], m.pm_um, "concluiu em fevereiro");
        assert_eq!(recente[2], m.pm_tres, "não concluiu nada: vai para o fim");

        let antiga = ordenado("conclusao_antiga").await;
        assert_eq!(antiga[0], m.pm_um);
        assert_eq!(antiga[1], m.pm_dois);
        assert_eq!(
            antiga[2], m.pm_tres,
            "no crescente também vai para o fim, e não para a frente"
        );

        let receb = ordenado("recebimento_recente").await;
        assert_eq!(receb[0], m.pm_dois, "recebeu em junho");
        assert_eq!(receb[1], m.pm_tres, "recebeu em abril");
        assert_eq!(receb[2], m.pm_um, "recebeu em janeiro");
    })
    .await;
}

/// O recorte por militar e o alternador de vínculo.
///
/// São duas perguntas diferentes: "o que ele já tocou" conta a designação
/// encerrada por substituição, "o que ele tem hoje na mão" não. O padrão
/// continua sendo a primeira, que é o que a matriz sempre respondeu.
#[tokio::test]
async fn matriz_recorta_por_militar_e_por_vinculo_vigente() {
    util::com_banco_descartavel("rel_matriz_militar", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let p1 = processo(&pool, &m, &m.apuratorio, "001", data(2026, 1, 5), None).await;
        let p2 = processo(&pool, &m, &m.apuratorio, "002", data(2026, 1, 6), None).await;
        prazo_vencendo_em(&pool, &p1, 30).await;
        prazo_vencendo_em(&pool, &p2, 30).await;

        designar(&pool, &p1, &m.pm_um, &m.papel_encarregado).await;
        designar(&pool, &p2, &m.pm_um, &m.papel_encarregado).await;
        designar(&pool, &p1, &m.pm_dois, &m.papel_escrivao).await;

        let todos = repository::designations_matrix(&pool, &DesignacaoMatrizFiltro::default())
            .await
            .unwrap();
        assert_eq!(todos.len(), 2);

        let so_um = repository::designations_matrix(
            &pool,
            &DesignacaoMatrizFiltro {
                policial_militar_id: Some(m.pm_um.clone()),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(so_um.len(), 1, "o recorte devolve uma linha só");
        assert_eq!(so_um[0].policial_militar_id, m.pm_um);
        let na_matriz_inteira = todos
            .iter()
            .find(|l| l.policial_militar_id == m.pm_um)
            .unwrap();
        assert_eq!(
            so_um[0].situacao.total, na_matriz_inteira.situacao.total,
            "recortar num militar não pode mudar os números dele"
        );

        // O primeiro processo troca de encarregado: a designação do pm_um
        // termina, mas o trabalho que ele teve continua registrado.
        sqlx::query(
            "UPDATE processo_designacoes SET data_fim = data_inicio + 1
              WHERE processo_id = $1::uuid AND policial_militar_id = $2::uuid",
        )
        .bind(&p1)
        .bind(&m.pm_um)
        .execute(&pool)
        .await
        .unwrap();

        let historico = repository::designations_matrix(
            &pool,
            &DesignacaoMatrizFiltro {
                policial_militar_id: Some(m.pm_um.clone()),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(
            historico[0].situacao.total, 2,
            "o padrão conta também a designação encerrada"
        );

        let vigentes = repository::designations_matrix(
            &pool,
            &DesignacaoMatrizFiltro {
                policial_militar_id: Some(m.pm_um.clone()),
                somente_vigentes: Some(true),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(
            vigentes[0].situacao.total, 1,
            "somente_vigentes responde o que ele tem hoje na mão"
        );
    })
    .await;
}

/// As quebras que saíram de `dashboard_summary` respeitam o escopo — e a série
/// por ano ignora o filtro de ano de propósito, porque o ano é o eixo dela.
#[tokio::test]
async fn quebras_do_acervo_respeitam_o_escopo() {
    util::com_banco_descartavel("rel_quebras", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let a1 = processo(&pool, &m, &m.apuratorio, "001", data(2026, 1, 5), None).await;
        processo(&pool, &m, &m.apuratorio, "002", data(2025, 3, 5), None).await;
        processo(
            &pool,
            &m,
            &m.apuratorio_livre,
            "003",
            data(2026, 4, 5),
            None,
        )
        .await;

        // Leitura de registro existente não filtra `ativo`: o apuratório de 2026
        // continua contando pela unidade desativada depois.
        sqlx::query(
            "UPDATE processos_procedimentos SET unidade_origem_id = $2::uuid WHERE id = $1::uuid",
        )
        .bind(&a1)
        .bind(&m.unidade_deprecada)
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("UPDATE unidades_pm SET ativo = false WHERE id = $1::uuid")
            .bind(&m.unidade_deprecada)
            .execute(&pool)
            .await
            .unwrap();

        let unidades = repository::by_unit(&pool, &ReportFilter::default())
            .await
            .unwrap();
        let deprecada = unidades
            .iter()
            .find(|c| c.rotulo == "Unidade Deprecada")
            .expect("unidade desativada continua rotulando o que já foi registrado");
        assert_eq!(deprecada.total, 1);

        let unidades_2025 = repository::by_unit(
            &pool,
            &ReportFilter {
                ano: Some(2025),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(unidades_2025.iter().map(|c| c.total).sum::<i64>(), 1);

        let anos = repository::by_year(&pool, &ReportFilter::default())
            .await
            .unwrap();
        assert_eq!(anos.len(), 2);
        assert_eq!(anos.iter().find(|c| c.rotulo == "2026").unwrap().total, 2);

        // O ano é o eixo da série: filtrá-lo reduziria o gráfico a uma barra.
        let anos_filtrados = repository::by_year(
            &pool,
            &ReportFilter {
                ano: Some(2025),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(
            anos_filtrados.len(),
            2,
            "by_year ignora filter.ano, e isso é deliberado"
        );

        // Escopo de apuratórios, esse sim, vale nas duas.
        let so_livre = repository::by_year(
            &pool,
            &ReportFilter {
                apuratorio_ids: Some(vec![m.apuratorio_livre.clone()]),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(so_livre.len(), 1);
        assert_eq!(so_livre[0].rotulo, "2026");
        assert_eq!(so_livre[0].total, 1);

        // Lista vazia continua significando "todos", não "nenhum".
        let vazia = repository::by_unit(
            &pool,
            &ReportFilter {
                apuratorio_ids: Some(vec![]),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(vazia.iter().map(|c| c.total).sum::<i64>(), 3);
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
        let autor = fixtures::conta_militar(&pool, &m.pm_um, "mapa@teste.com").await;
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
            Some("TST PM 100000001 PM UM"),
            "o militar vinculado a conta sai qualificado"
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

/// No mapa e no ranking de condutores, o envolvido ainda não identificado
/// aparece por extenso como "À apurar" — e não como um posto vazio seguido de
/// nome nenhum, que era o efeito de listar o PM fictício.
#[tokio::test]
async fn mapa_escreve_a_apurar_por_extenso_e_o_ranking_ignora_o_nao_identificado() {
    util::com_banco_descartavel("mapa_a_apurar", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = processo(
            &pool,
            &m,
            &m.apuratorio_livre,
            "A-APURAR",
            data(2026, 4, 2),
            None,
        )
        .await;
        envolvido(&pool, &m, &id, &m.pm_um, 1).await;
        fixtures::envolvido_a_apurar(&pool, &m, &id, 2).await;

        let linhas = repository::map_rows(
            &pool,
            &MapPeriodRequest {
                periodo_inicio: data(2026, 4, 1),
                periodo_fim: data(2026, 4, 30),
                apuratorio_ids: None,
            },
        )
        .await
        .unwrap();

        let linha = linhas
            .iter()
            .find(|l| l.processo_id == id)
            .expect("o processo está no período");
        let lista = linha.envolvidos.as_deref().unwrap_or_default();
        assert!(lista.contains("À apurar"), "lista de envolvidos: {lista}");
        // O LEFT JOIN não pode engolir o identificado nem devolver a linha nula.
        assert!(
            lista.contains("TST PM 100000001 PM UM"),
            "lista de envolvidos: {lista}"
        );

        // Estatística de pessoa não conta quem ainda não é pessoa identificada.
        // A trava é do schema (`ck_envolvido_condutor_identificado`), mas o
        // ranking também precisa continuar montado por INNER JOIN.
        let ranking = repository::driver_ranking(
            &pool,
            &ReportFilter {
                apuratorio_ids: None,
                ano: None,
                limit: None,
            },
        )
        .await
        .unwrap();
        assert!(ranking.iter().all(|r| !r.nome.is_empty()));
    })
    .await;
}
