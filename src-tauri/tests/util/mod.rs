//! Infra comum dos testes de integração: cria um banco descartável, aplica as
//! migrations e o remove ao final.
//!
//! Precisa de `DATABASE_URL` (o `.env.example` traz a URL que o
//! `docker-compose.yml` deste repositório sobe). Sem ela, o teste é ignorado.

pub mod fixtures;

use sqlx::{Connection, Executor, PgConnection, PgPool};

fn urls(sufixo: &str) -> Option<(String, String, String)> {
    let _ = dotenvy::from_filename("../.env");
    let base = std::env::var("DATABASE_URL").ok()?;
    let (prefix, _) = base.rsplit_once('/')?;
    let nome = format!("adm_p6_{}_{}", sufixo, std::process::id());
    Some((
        format!("{prefix}/postgres"),
        format!("{prefix}/{nome}"),
        nome,
    ))
}

// Cada arquivo de teste compila `util` por conta própria, então uma das duas
// variantes fica sem uso em cada um.
#[allow(dead_code)]
pub async fn com_banco_descartavel<F, Fut>(sufixo: &str, corpo: F)
where
    F: FnOnce(PgPool) -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    com_banco_descartavel_com_url(sufixo, |pool, _url| corpo(pool)).await
}

/// Igual, mas entrega também a URL do banco descartável. O teste de IPC precisa
/// dela para montar um `AppState` apontando para o mesmo banco.
#[allow(dead_code)]
pub async fn com_banco_descartavel_com_url<F, Fut>(sufixo: &str, corpo: F)
where
    F: FnOnce(PgPool, String) -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    let Some((manutencao, teste, nome)) = urls(sufixo) else {
        eprintln!("DATABASE_URL ausente: teste ignorado");
        return;
    };

    let mut admin = PgConnection::connect(&manutencao)
        .await
        .expect("conectar ao banco de manutencao");
    admin
        .execute(&*format!(
            r#"DROP DATABASE IF EXISTS "{nome}" WITH (FORCE)"#
        ))
        .await
        .expect("descartar banco anterior");
    admin
        .execute(&*format!(r#"CREATE DATABASE "{nome}""#))
        .await
        .expect("criar banco de teste");

    let pool = PgPool::connect(&teste)
        .await
        .expect("conectar ao banco de teste");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("aplicar migrations");

    // O corpo roda isolado para que uma falha ainda derrube o banco de teste.
    let resultado = futures_util::FutureExt::catch_unwind(std::panic::AssertUnwindSafe(corpo(
        pool.clone(),
        teste.clone(),
    )))
    .await;
    pool.close().await;

    admin
        .execute(&*format!(
            r#"DROP DATABASE IF EXISTS "{nome}" WITH (FORCE)"#
        ))
        .await
        .expect("remover banco de teste");

    if let Err(panico) = resultado {
        std::panic::resume_unwind(panico);
    }
}
