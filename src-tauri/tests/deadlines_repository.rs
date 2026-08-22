//! Prazos: a aritmética e a cadeia de prorrogações.
//!
//! Duas coisas justificam este arquivo. A primeira é que o cálculo do
//! vencimento já divergiu entre dois módulos (`+dias` × `+dias-1`) sem ninguém
//! notar; hoje é coluna gerada e o teste trava isso. A segunda é o `EXCLUDE` de
//! período, que exige que a prorrogação comece no dia seguinte ao vencimento
//! anterior — regra que só aparece em runtime.

use adm_p6_tauri_lib::deadlines::domain::AddExtensionRequest;
use adm_p6_tauri_lib::deadlines::repository;
use chrono::NaiveDate;
use sqlx::PgPool;

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
async fn prorrogacao_comeca_no_dia_seguinte_ao_vencimento_anterior() {
    util::com_banco_descartavel("prazo_prorr", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = processo_com_prazo_inicial(&pool, &m, data(2026, 1, 10)).await;

        let prorrogar = |dias: i32| {
            let pool = pool.clone();
            let id = id.clone();
            async move {
                let request = AddExtensionRequest {
                    processo_id: id,
                    dias,
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

        prorrogar(15).await.expect("primeira prorrogacao");
        prorrogar(10).await.expect("segunda prorrogacao");

        let prazos = repository::list(&pool, &id).await.unwrap();
        assert_eq!(prazos.len(), 3);

        // ordem 0 = inicial; 1, 2… = prorrogações. Não existe coluna `ativo`:
        // a vigência é derivada da ordem, e o EXCLUDE garante que os períodos
        // nunca se sobrepõem.
        let ordens: Vec<i32> = prazos.iter().map(|p| p.ordem).collect();
        assert_eq!(ordens, vec![0, 1, 2]);

        assert_eq!(prazos[0].data_inicio, data(2026, 1, 10));
        assert_eq!(prazos[0].data_vencimento, data(2026, 2, 9)); // 10/01 + 30

        // Cada prorrogação começa no dia seguinte ao vencimento anterior — é o
        // que o EXCLUDE de intervalo fechado `[]` exige.
        assert_eq!(prazos[1].data_inicio, data(2026, 2, 10));
        assert_eq!(prazos[1].data_vencimento, data(2026, 2, 25)); // +15
        assert_eq!(prazos[2].data_inicio, data(2026, 2, 26));
        assert_eq!(prazos[2].data_vencimento, data(2026, 3, 8)); // +10

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
                dias: 10,
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
        let pedido = AddExtensionRequest {
            processo_id: processo_com_prazo_inicial(&pool, &m, data(2026, 1, 10)).await,
            dias: 10,
            motivo: "   ".to_string(),
            documento_autorizador_id: None,
            numero_documento: None,
            data_documento: None,
            autoridade_id: None,
        };
        assert!(pedido.validate().unwrap_err().contains("motivo"));

        let zero = AddExtensionRequest {
            dias: 0,
            motivo: "ok".to_string(),
            ..pedido
        };
        assert!(zero.validate().unwrap_err().contains("maior que zero"));
    })
    .await;
}
