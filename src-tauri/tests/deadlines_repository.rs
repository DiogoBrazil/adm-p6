//! Prazos: a aritmética e a cadeia de prorrogações.
//!
//! Duas coisas justificam este arquivo. A primeira é que o cálculo do
//! vencimento já divergiu entre dois módulos (`+dias` × `+dias-1`) sem ninguém
//! notar; hoje é coluna gerada e o teste trava isso. A segunda é o `EXCLUDE` de
//! período, que exige que a prorrogação comece no dia do vencimento
//! anterior — regra que só aparece em runtime.

use adm_p6_tauri_lib::deadlines::domain::{
    AddExtensionRequest, DeadlineReportFilter, UpdateExtensionRequest,
};
use adm_p6_tauri_lib::deadlines::repository;
use chrono::NaiveDate;
use sqlx::{Executor, PgPool};

mod util;
use util::fixtures::{self, Mundo, PRAZO_APURATORIO, PRAZO_DOCUMENTO_CURTO};

fn data(ano: i32, mes: u32, dia: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(ano, mes, dia).unwrap()
}

async fn processo_com_prazo_inicial(pool: &PgPool, m: &Mundo, inicio: NaiveDate) -> String {
    let id: String = sqlx::query_scalar(
        "INSERT INTO processos_procedimentos
             (apuratorio_id, documento_iniciador_id, numero_documento,
              unidade_origem_id, municipio_fato_id, natureza_fato_id,
              data_instauracao, data_recebimento)
         VALUES ($1::uuid, $2::uuid, '001', $3::uuid, $4::uuid, $5::uuid, $6, $6)
      RETURNING id::text",
    )
    .bind(&m.apuratorio)
    .bind(&m.documento)
    .bind(&m.unidade)
    .bind(&m.municipio)
    .bind(&m.natureza)
    .bind(inicio)
    .fetch_one(pool)
    .await
    .unwrap();

    let mut tx = pool.begin().await.unwrap();
    repository::create_initial(&mut tx, &id, inicio, PRAZO_APURATORIO)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    id
}

#[tokio::test]
async fn dias_base_vem_do_documento_e_cai_no_apuratorio() {
    util::com_banco_descartavel("prazo_base", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // O override que era `if documento == "Feito Preliminar" { 15 }` é dado:
        // `apuratorio_documentos_iniciadores.prazo_base_dias`.
        let (dias, do_documento) = repository::dias_base(&pool, &m.apuratorio, &m.documento_curto)
            .await
            .unwrap();
        assert_eq!(dias, PRAZO_DOCUMENTO_CURTO);
        assert!(do_documento, "o prazo veio do documento iniciador");

        let (dias, do_documento) = repository::dias_base(&pool, &m.apuratorio, &m.documento)
            .await
            .unwrap();
        assert_eq!(dias, PRAZO_APURATORIO);
        assert!(!do_documento, "herdou o prazo do apuratorio");
    })
    .await;
}

#[tokio::test]
async fn prorrogacao_comeca_no_dia_do_vencimento_anterior() {
    util::com_banco_descartavel("prazo_prorr", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = processo_com_prazo_inicial(&pool, &m, data(2026, 1, 10)).await;

        let prorrogar = |nova_data_vencimento: NaiveDate| {
            let pool = pool.clone();
            let id = id.clone();
            async move {
                let request = AddExtensionRequest {
                    processo_id: id,
                    nova_data_vencimento,
                    motivo: "diligencias pendentes".to_string(),
                    documento_autorizador_id: None,
                    numero_documento: None,
                    data_documento: None,
                    autoridade_id: None,
                };
                request.validate()?;
                let mut tx = pool.begin().await.unwrap();
                let r = repository::add_extension(&mut tx, &request)
                    .await
                    .map_err(|e| e.message());
                if r.is_ok() {
                    tx.commit().await.unwrap();
                }
                r.map(|_| ())
            }
        };

        // As duas datas já passaram em relação ao relógio do teste, mas são
        // posteriores ao vencimento vigente: lançamento histórico é válido.
        prorrogar(data(2026, 2, 24))
            .await
            .expect("primeira prorrogacao");
        prorrogar(data(2026, 3, 6))
            .await
            .expect("segunda prorrogacao");

        let prazos = repository::list(&pool, &id).await.unwrap();
        assert_eq!(prazos.len(), 3);

        // ordem 0 = inicial; 1, 2… = prorrogações. Não existe coluna `ativo`:
        // a vigência é derivada da ordem, e o EXCLUDE garante que os períodos
        // nunca se sobrepõem.
        let ordens: Vec<i32> = prazos.iter().map(|p| p.ordem).collect();
        assert_eq!(ordens, vec![0, 1, 2]);

        assert_eq!(prazos[0].data_inicio, data(2026, 1, 10));
        assert_eq!(prazos[0].data_vencimento, data(2026, 2, 9)); // 10/01 + 30

        // Cada prorrogação começa NO DIA do vencimento anterior — a convenção
        // que a Seção pratica (97/97 no histórico importado). O EXCLUDE da
        // migration 0005 a acomoda comparando a ocupação como `[inicio, fim)`,
        // sem que `data_vencimento` deixe de ser o último dia válido.
        assert_eq!(prazos[1].data_inicio, data(2026, 2, 9));
        assert_eq!(prazos[1].data_vencimento, data(2026, 2, 24)); // +15
        assert_eq!(prazos[2].data_inicio, data(2026, 2, 24));
        assert_eq!(prazos[2].data_vencimento, data(2026, 3, 6)); // +10

        // A coluna gerada é a única fonte da aritmética.
        for p in &prazos {
            assert_eq!(
                p.data_vencimento,
                p.data_inicio + chrono::Duration::days(p.dias as i64)
            );
        }
    })
    .await;
}

#[tokio::test]
async fn prorrogacao_exige_prazo_inicial_e_motivo() {
    util::com_banco_descartavel("prazo_regras", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let sem_prazo: String = sqlx::query_scalar(
            "INSERT INTO processos_procedimentos
                 (apuratorio_id, documento_iniciador_id, numero_documento,
                  unidade_origem_id, municipio_fato_id, natureza_fato_id, data_instauracao)
             VALUES ($1::uuid, $2::uuid, '777', $3::uuid, $4::uuid, $5::uuid, DATE '2026-01-10')
          RETURNING id::text",
        )
        .bind(&m.apuratorio)
        .bind(&m.documento)
        .bind(&m.unidade)
        .bind(&m.municipio)
        .bind(&m.natureza)
        .fetch_one(&pool)
        .await
        .unwrap();

        let mut tx = pool.begin().await.unwrap();
        let erro = repository::add_extension(
            &mut tx,
            &AddExtensionRequest {
                processo_id: sem_prazo,
                nova_data_vencimento: data(2026, 2, 20),
                motivo: "x".to_string(),
                documento_autorizador_id: None,
                numero_documento: None,
                data_documento: None,
                autoridade_id: None,
            },
        )
        .await
        .expect_err("nao ha prazo inicial para prorrogar");
        assert!(erro.message().contains("prazo inicial"));
        drop(tx);

        // Motivo é obrigatório a partir da ordem 1 — o schema tem CHECK, e o
        // domínio recusa antes para dar a mensagem certa.
        let processo = processo_com_prazo_inicial(&pool, &m, data(2026, 1, 10)).await;
        let pedido = AddExtensionRequest {
            processo_id: processo.clone(),
            nova_data_vencimento: data(2026, 2, 20),
            motivo: "   ".to_string(),
            documento_autorizador_id: None,
            numero_documento: None,
            data_documento: None,
            autoridade_id: None,
        };
        assert!(pedido.validate().unwrap_err().contains("motivo"));

        // O prazo inicial vence em 09/02. A data nova precisa avançar a cadeia;
        // igualdade e retrocesso recebem a mesma regra legível.
        for nova_data_vencimento in [data(2026, 2, 9), data(2026, 2, 8)] {
            let mut tx = pool.begin().await.unwrap();
            let erro = repository::add_extension(
                &mut tx,
                &AddExtensionRequest {
                    processo_id: processo.clone(),
                    nova_data_vencimento,
                    motivo: "retificação".to_string(),
                    documento_autorizador_id: None,
                    numero_documento: None,
                    data_documento: None,
                    autoridade_id: None,
                },
            )
            .await
            .expect_err("nova data precisa avancar o vencimento");
            let mensagem = erro.message();
            assert!(mensagem.contains("posterior"), "{mensagem}");
            assert!(mensagem.contains("09/02/2026"), "{mensagem}");
        }
    })
    .await;
}

#[tokio::test]
async fn somente_ultima_prorrogacao_pode_ser_editada_ou_excluida() {
    util::com_banco_descartavel("prazo_editar_excluir", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let processo = processo_com_prazo_inicial(&pool, &m, data(2026, 1, 10)).await;

        let adicionar = |nova_data_vencimento: NaiveDate, motivo: &'static str| {
            let pool = pool.clone();
            let processo = processo.clone();
            async move {
                let mut tx = pool.begin().await.unwrap();
                let id = repository::add_extension(
                    &mut tx,
                    &AddExtensionRequest {
                        processo_id: processo,
                        nova_data_vencimento,
                        motivo: motivo.to_string(),
                        documento_autorizador_id: None,
                        numero_documento: None,
                        data_documento: None,
                        autoridade_id: None,
                    },
                )
                .await
                .unwrap();
                tx.commit().await.unwrap();
                id
            }
        };

        let primeira = adicionar(data(2026, 2, 24), "primeira").await;
        let segunda = adicionar(data(2026, 3, 6), "segunda").await;

        // Uma prorrogação antiga não pode ser reescrita enquanto houver outra
        // depois dela.
        let mut tx = pool.begin().await.unwrap();
        let erro = repository::update_extension(
            &mut tx,
            &UpdateExtensionRequest {
                processo_id: processo.clone(),
                prazo_id: primeira.clone(),
                nova_data_vencimento: data(2026, 2, 25),
            },
        )
        .await
        .expect_err("nao edita prorrogacao antiga");
        assert!(erro.message().contains("última prorrogação"));
        drop(tx);

        // A última pode ser antecipada ou postergada em relação ao valor
        // salvo, desde que continue posterior ao vencimento anterior (24/02).
        for (vencimento, dias) in [(data(2026, 3, 1), 5), (data(2026, 3, 20), 24)] {
            let mut tx = pool.begin().await.unwrap();
            assert!(repository::update_extension(
                &mut tx,
                &UpdateExtensionRequest {
                    processo_id: processo.clone(),
                    prazo_id: segunda.clone(),
                    nova_data_vencimento: vencimento,
                },
            )
            .await
            .unwrap());
            tx.commit().await.unwrap();

            let prazos = repository::list(&pool, &processo).await.unwrap();
            let atual = prazos.last().unwrap();
            assert_eq!(atual.data_vencimento, vencimento);
            assert_eq!(atual.dias, dias);
            assert_eq!(atual.motivo.as_deref(), Some("segunda"));
        }

        for vencimento_invalido in [data(2026, 2, 24), data(2026, 2, 23)] {
            let mut tx = pool.begin().await.unwrap();
            let erro = repository::update_extension(
                &mut tx,
                &UpdateExtensionRequest {
                    processo_id: processo.clone(),
                    prazo_id: segunda.clone(),
                    nova_data_vencimento: vencimento_invalido,
                },
            )
            .await
            .expect_err("data precisa ficar depois do prazo anterior");
            let mensagem = erro.message();
            assert!(mensagem.contains("posterior"), "{mensagem}");
            assert!(mensagem.contains("24/02/2026"), "{mensagem}");
        }

        // Exclusão também percorre a cadeia de trás para frente.
        let mut tx = pool.begin().await.unwrap();
        let erro = repository::delete_extension(&mut tx, &processo, &primeira)
            .await
            .expect_err("nao exclui prorrogacao antiga");
        assert!(erro.message().contains("mais recentes"));
        drop(tx);

        let mut tx = pool.begin().await.unwrap();
        assert!(repository::delete_extension(&mut tx, &processo, &segunda)
            .await
            .unwrap());
        tx.commit().await.unwrap();
        let prazos = repository::list(&pool, &processo).await.unwrap();
        assert_eq!(prazos.len(), 2);
        assert!(prazos[1].vigente, "a primeira prorrogacao volta a vigorar");

        let mut tx = pool.begin().await.unwrap();
        assert!(repository::delete_extension(&mut tx, &processo, &primeira)
            .await
            .unwrap());
        tx.commit().await.unwrap();
        let prazos = repository::list(&pool, &processo).await.unwrap();
        assert_eq!(prazos.len(), 1);
        assert!(prazos[0].vigente, "o prazo inicial volta a vigorar");

        let mut tx = pool.begin().await.unwrap();
        let erro = repository::delete_extension(&mut tx, &processo, &prazos[0].id)
            .await
            .expect_err("prazo inicial nao e prorrogacao");
        assert!(erro.message().contains("prazo inicial"));
    })
    .await;
}

// ── O relatório de prazos ───────────────────────────────────────────────────
//
// `report` era a única consulta grande do módulo **sem teste nenhum**, e foi
// exatamente ali que a tela de Prazos mostrava o mesmo processo duas vezes.

/// Um processo em andamento cujo prazo vigente vence no dia pedido.
///
/// O vencimento é coluna gerada (`data_inicio + dias`), então o que se escolhe
/// aqui é o início — contado de trás para frente a partir do alvo. As datas
/// são relativas a `CURRENT_DATE` de propósito: é o que a consulta compara.
async fn processo_vencendo_em(pool: &PgPool, m: &Mundo, numero: i32, dias_ate: i64) -> String {
    let id: String = sqlx::query_scalar(
        "INSERT INTO processos_procedimentos
             (apuratorio_id, documento_iniciador_id, numero_documento,
              unidade_origem_id, municipio_fato_id, natureza_fato_id,
              data_instauracao, data_recebimento)
         VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::uuid, $6::uuid,
                 CURRENT_DATE + $7 - $8, CURRENT_DATE + $7 - $8)
      RETURNING id::text",
    )
    .bind(&m.apuratorio)
    .bind(&m.documento)
    .bind(numero.to_string())
    .bind(&m.unidade)
    .bind(&m.municipio)
    .bind(&m.natureza)
    .bind(dias_ate as i32)
    .bind(PRAZO_APURATORIO)
    .fetch_one(pool)
    .await
    .unwrap();

    pool.execute(
        sqlx::query(
            "INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias)
             VALUES ($1::uuid, 0, CURRENT_DATE + $2 - $3, $3)",
        )
        .bind(&id)
        .bind(dias_ate as i32)
        .bind(PRAZO_APURATORIO),
    )
    .await
    .unwrap();

    id
}

fn ids(resultado: &adm_p6_tauri_lib::deadlines::domain::DeadlineReportResult) -> Vec<String> {
    resultado
        .items
        .iter()
        .map(|i| i.processo_id.clone())
        .collect()
}

/// Os dois blocos da tela de Prazos não podem mostrar o mesmo processo.
///
/// A condição da janela era `prazo_vencimento <= CURRENT_DATE + N`, **sem
/// piso**: "vencendo em até 14 dias" trazia junto tudo que já havia vencido, e
/// cada processo vencido aparecia nas duas tabelas. O `dashboard` ao lado
/// sempre contou com o piso, então os cartões e as tabelas discordavam na
/// mesma tela — é esse par que este teste amarra.
#[tokio::test]
async fn blocos_de_prazo_sao_exclusivos() {
    util::com_banco_descartavel("prazo_blocos", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let ontem = processo_vencendo_em(&pool, &m, 1, -1).await;
        let hoje = processo_vencendo_em(&pool, &m, 2, 0).await;
        let dentro = processo_vencendo_em(&pool, &m, 3, 5).await;
        let fora = processo_vencendo_em(&pool, &m, 4, 30).await;

        let vencidos = repository::report(
            &pool,
            &DeadlineReportFilter {
                apenas_vencidos: Some(true),
                ..Default::default()
            },
        )
        .await
        .unwrap();

        let proximos = repository::report(
            &pool,
            &DeadlineReportFilter {
                dias_ate_vencer: Some(14),
                ..Default::default()
            },
        )
        .await
        .unwrap();

        assert_eq!(
            ids(&vencidos),
            vec![ontem.clone()],
            "vencido e so o de ontem"
        );
        assert_eq!(
            ids(&proximos),
            vec![hoje.clone(), dentro.clone()],
            "a janela vai de hoje ate hoje + 14, em ordem de vencimento"
        );

        // A interseção é o defeito: se um id estiver nos dois, a tela repete.
        for id in ids(&vencidos) {
            assert!(
                !ids(&proximos).contains(&id),
                "o processo {id} apareceu nos dois blocos"
            );
        }
        assert!(!ids(&proximos).contains(&fora), "fora da janela nao entra");

        // E os cartões de contagem da mesma tela têm de bater com as tabelas.
        let resumo = repository::dashboard(&pool, 14).await.unwrap();
        assert_eq!(resumo.vencidos, vencidos.total);
        assert_eq!(resumo.proximos, proximos.total);
        assert_eq!(resumo.total, 4, "os quatro tem prazo vigente");
    })
    .await;
}

/// Paginação do relatório: total do escopo, páginas disjuntas, e o teto que
/// corta.
///
/// Monta **mais processos que o teto** de propósito. Um teste de limite
/// montado sobre a fixture (3 militares, 1 processo) nunca exercita o clamp e
/// passa por acidente — foi assim que os seletores truncados em 200
/// atravessaram a migração inteira.
#[tokio::test]
async fn report_pagina_e_ordena() {
    util::com_banco_descartavel("prazo_pagina", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        const QUANTOS: i32 = 205;

        for n in 0..QUANTOS {
            processo_vencendo_em(&pool, &m, n, n as i64 + 1).await;
        }

        let filtro = |page, per_page| DeadlineReportFilter {
            page: Some(page),
            per_page: Some(per_page),
            ..Default::default()
        };

        // Acima do teto o pedido é corrigido, e `per_page` volta dizendo isso —
        // é o que impede a tela de desenhar um controle de página mentiroso.
        let demais = repository::report(&pool, &filtro(1, 500)).await.unwrap();
        assert_eq!(demais.items.len(), 200, "o teto corta");
        assert_eq!(demais.per_page, 200, "e o envelope conta que cortou");
        assert_eq!(demais.total, QUANTOS as i64, "o total e do escopo");

        let primeira = repository::report(&pool, &filtro(1, 3)).await.unwrap();
        let segunda = repository::report(&pool, &filtro(2, 3)).await.unwrap();
        assert_eq!(primeira.items.len(), 3);
        assert_eq!(primeira.total, QUANTOS as i64);
        assert_eq!(segunda.page, 2);
        for id in ids(&primeira) {
            assert!(!ids(&segunda).contains(&id), "paginas se repetiram");
        }

        // Ordem por vencimento: a segunda página continua de onde a primeira
        // parou, sem voltar no tempo.
        assert!(primeira.items.last().unwrap().data_vencimento <= segunda.items[0].data_vencimento);

        // Página além do fim é vazia, não erro — a tela recua sozinha.
        let longe = repository::report(&pool, &filtro(999, 10)).await.unwrap();
        assert!(longe.items.is_empty());
        assert_eq!(longe.total, QUANTOS as i64);
    })
    .await;
}
