//! A quem o aviso vai, e o que ele diz — sem tocar em SMTP.
//!
//! O envio propriamente dito fica fora daqui de propósito. Um teste que
//! conectasse num servidor de verdade seria lento, dependeria de rede e, pior,
//! **mandaria e-mail** para o endereço que estivesse na fixtura. O que este
//! arquivo prende são as decisões que precedem o envio: quem recebe, e as três
//! faltas que precisam de frase própria.

use adm_p6_tauri_lib::email::domain::TipoAviso;
use adm_p6_tauri_lib::email::repository;
use adm_p6_tauri_lib::proceedings::domain::{DesignacaoRequest, SaveProceedingRequest};
use adm_p6_tauri_lib::proceedings::repository as proceedings;
use chrono::NaiveDate;
use sqlx::PgPool;

mod util;
use util::fixtures::{self, Mundo};

// `.err().expect(...)` e não `.expect_err(...)`: aquele exige `Debug` no tipo de
// sucesso, e `ConfiguracaoSmtp` carrega a SENHA do servidor. Derivar `Debug` ali
// poria o segredo ao alcance de qualquer panic ou log — é a mesma razão pela
// qual `ConnectionInput` também não o deriva.

/// Um apuratório com encarregado designado, para haver a quem avisar.
///
/// Monta a requisição aqui em vez de reaproveitar a de
/// `proceedings_repository.rs`: aquela é privada do arquivo, e exportá-la
/// acoplaria dois testes que hoje não se conhecem.
async fn processo_com_encarregado(pool: &PgPool, m: &Mundo) -> String {
    let req = SaveProceedingRequest {
        id: None,
        apuratorio_id: m.apuratorio.clone(),
        documento_iniciador_id: m.documento.clone(),
        numero_documento: "EMAIL-1".to_string(),
        numero_controle: None,
        processo_sei: None,
        numero_rgf: None,
        unidade_origem_id: m.unidade.clone(),
        subunidade_secao_origem_id: None,
        municipio_fato_id: m.municipio.clone(),
        natureza_fato_id: Some(m.natureza.clone()),
        data_instauracao: NaiveDate::from_ymd_opt(2026, 1, 10).unwrap(),
        data_recebimento: None,
        resumo_fatos: None,
        envolvidos: vec![],
        designacoes: vec![DesignacaoRequest {
            id: None,
            policial_militar_id: m.pm_um.clone(),
            papel_id: m.papel_encarregado.clone(),
        }],
        pessoas: vec![],
        vitimas: vec![],
        carta_precatoria: None,
    };
    let mut tx = pool.begin().await.unwrap();
    let id = proceedings::save(&mut tx, &req).await.expect("grava");
    tx.commit().await.unwrap();
    id
}

async fn definir_email_pm(pool: &PgPool, pm: &str, email: Option<&str>) {
    sqlx::query("UPDATE policiais_militares SET email = $2 WHERE id = $1::uuid")
        .bind(pm)
        .bind(email)
        .execute(pool)
        .await
        .unwrap();
}

/// O e-mail do PM vence; sem ele vale o da conta; sem os dois, recusa.
///
/// São quatro combinações e cada uma tem uma saída diferente — testá-las juntas
/// é o que prova que o `COALESCE` da consulta escolhe na ordem certa, e não que
/// ele simplesmente devolve *algum* endereço.
#[tokio::test]
async fn o_email_do_militar_vence_o_da_conta_e_a_falta_dos_dois_e_recusada() {
    util::com_banco_descartavel("email_destinatario", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = processo_com_encarregado(&pool, &m).await;

        // (1) sem nenhum dos dois: recusa dizendo ONDE cadastrar.
        definir_email_pm(&pool, &m.pm_um, None).await;
        let erro = repository::destinatario(&pool, &id)
            .await
            .err()
            .expect("sem e-mail nenhum")
            .message();
        assert!(
            erro.contains("não tem e-mail cadastrado") && erro.contains("Usuários"),
            "{erro}"
        );

        // (2) só o da conta: é a rede, e ela pega.
        sqlx::query(
            "INSERT INTO usuarios (policial_militar_id, email, senha_hash, perfil_id)
             SELECT $1::uuid, 'conta@7bpm.test', 'x', id FROM perfis_acesso LIMIT 1",
        )
        .bind(&m.pm_um)
        .execute(&pool)
        .await
        .unwrap();
        let d = repository::destinatario(&pool, &id).await.expect("conta");
        assert_eq!(d.email, "conta@7bpm.test");

        // (3) os dois: o de notificação vence — é o campo específico do aviso.
        definir_email_pm(&pool, &m.pm_um, Some("aviso@7bpm.test")).await;
        let d = repository::destinatario(&pool, &id).await.expect("pm");
        assert_eq!(
            d.email, "aviso@7bpm.test",
            "o do PM tem de vencer o da conta"
        );

        // (4) só o do PM, sem conta ativa: continua valendo.
        sqlx::query("UPDATE usuarios SET ativo = false WHERE policial_militar_id = $1::uuid")
            .bind(&m.pm_um)
            .execute(&pool)
            .await
            .unwrap();
        let d = repository::destinatario(&pool, &id).await.expect("só pm");
        assert_eq!(d.email, "aviso@7bpm.test");
    })
    .await;
}

/// Sem encarregado não há a quem avisar — e essa falta é DIFERENTE de não ter
/// e-mail: uma se resolve designando, a outra cadastrando o endereço. Duas
/// mensagens porque são duas saídas.
#[tokio::test]
async fn apuratorio_sem_encarregado_diz_para_designar_e_nao_para_cadastrar_email() {
    util::com_banco_descartavel("email_sem_encarregado", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = processo_com_encarregado(&pool, &m).await;

        // Encerra a designação vigente: o apuratório fica sem responsável.
        sqlx::query(
            "UPDATE processo_designacoes SET data_fim = now() WHERE processo_id = $1::uuid",
        )
        .bind(&id)
        .execute(&pool)
        .await
        .unwrap();

        let erro = repository::destinatario(&pool, &id)
            .await
            .err()
            .expect("sem responsável")
            .message();
        assert!(erro.contains("não tem encarregado designado"), "{erro}");
        assert!(
            !erro.contains("e-mail cadastrado"),
            "confundiu falta de designação com falta de e-mail: {erro}"
        );
    })
    .await;
}

/// As três mensagens nascem na migration, e desativar uma tira-a de uso sem
/// apagá-la (princípio 6). O envio precisa dizer isso, não falhar em silêncio.
#[tokio::test]
async fn mensagem_desativada_deixa_de_servir_e_a_recusa_diz_onde_cadastrar() {
    util::com_banco_descartavel("email_mensagem", |pool| async move {
        for tipo in [
            TipoAviso::Designacao,
            TipoAviso::PrazoVencendo,
            TipoAviso::PrazoVencido,
        ] {
            repository::mensagem(&pool, tipo).await.unwrap_or_else(|e| {
                panic!("a migration semeia {}: {}", tipo.codigo(), e.message())
            });
        }

        sqlx::query("UPDATE mensagens_email SET ativo = false WHERE codigo = 'designacao'")
            .execute(&pool)
            .await
            .unwrap();

        let erro = repository::mensagem(&pool, TipoAviso::Designacao)
            .await
            .err()
            .expect("desativada")
            .message();
        assert!(erro.contains("Mensagens de e-mail"), "{erro}");

        // As outras duas não são afetadas: o código é por tipo.
        assert!(repository::mensagem(&pool, TipoAviso::PrazoVencido)
            .await
            .is_ok());
    })
    .await;
}

/// Sem servidor configurado o envio não tem para onde ir, e a frase manda ao
/// lugar certo em vez de dizer "erro ao enviar".
#[tokio::test]
async fn sem_configuracao_de_servidor_a_recusa_aponta_a_tela_de_configuracao() {
    util::com_banco_descartavel("email_config", |pool| async move {
        let erro = repository::configuracao(&pool)
            .await
            .err()
            .expect("banco novo não tem configuração")
            .message();
        assert!(erro.contains("Configuração de e-mail"), "{erro}");

        sqlx::query(
            "INSERT INTO configuracao_email (id, host, porta, usuario, senha, remetente)
             VALUES (1, 'smtp.gmail.com', 587, 'u@x.test', 'senha', 'Seção <u@x.test>')",
        )
        .execute(&pool)
        .await
        .unwrap();

        let c = repository::configuracao(&pool).await.expect("configurado");
        assert_eq!((c.host.as_str(), c.porta), ("smtp.gmail.com", 587));
    })
    .await;
}
