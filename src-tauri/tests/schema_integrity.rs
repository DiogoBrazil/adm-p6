//! Executa `tests/schema_integrity.sql` contra um banco recém-migrado e exige que
//! nenhum caso tenha falhado.
//!
//! Cada caso do script tenta gravar um estado impossível no domínio. Se o banco
//! aceitar, a regra deixou de ser garantida pelo PostgreSQL e passou a depender do
//! código da aplicação — que foi exatamente como o schema anterior se degradou.

use sqlx::{Connection, Executor, PgConnection, Row};

fn urls() -> Option<(String, String, String)> {
    let _ = dotenvy::from_filename("../.env");
    let base = std::env::var("DATABASE_URL").ok()?;
    let (prefix, _) = base.rsplit_once('/')?;
    let nome = format!("adm_p6_integridade_{}", std::process::id());
    Some((
        format!("{prefix}/postgres"),
        format!("{prefix}/{nome}"),
        nome,
    ))
}

#[tokio::test]
async fn banco_recusa_todos_os_estados_impossiveis() {
    let Some((manutencao, teste, nome)) = urls() else {
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

    let resultado = rodar(&teste).await;

    admin
        .execute(&*format!(
            r#"DROP DATABASE IF EXISTS "{nome}" WITH (FORCE)"#
        ))
        .await
        .expect("remover banco de teste");

    match resultado {
        Ok(linhas) => {
            let falhas: Vec<&String> = linhas.iter().filter(|l| l.starts_with("FALHOU")).collect();
            for linha in &linhas {
                println!("{linha}");
            }
            assert!(
                falhas.is_empty(),
                "{} caso(s) que o banco deveria ter recusado passaram",
                falhas.len()
            );
            assert!(
                linhas.len() >= 38,
                "esperado ao menos 38 casos, executados {}",
                linhas.len()
            );
        }
        Err(e) => panic!("falha ao executar os testes de integridade: {e}"),
    }
}

async fn rodar(url: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let mut conn = PgConnection::connect(url).await?;
    sqlx::migrate!("./migrations").run(&mut conn).await?;

    let script = include_str!("schema_integrity.sql");
    conn.execute(script).await?;

    let linhas = sqlx::query("SELECT linha FROM pg_temp.resultado_integridade ORDER BY ordem")
        .fetch_all(&mut conn)
        .await?
        .into_iter()
        .map(|r| r.get::<String, _>(0))
        .collect();
    Ok(linhas)
}
