//! Aplica as migrations do zero num banco descartável e confere o schema resultante.
//!
//! É a rede mínima contra o modo de falha que produziu 62 queries quebradas no
//! schema anterior: nada, no `cargo build`, olha para o SQL. Este teste olha.
//!
//! Precisa de um PostgreSQL acessível. Configure `DATABASE_URL` (o `.env.example`
//! traz a URL que o `docker-compose.yml` deste repositório sobe). Sem a variável,
//! o teste é ignorado com aviso.

use sqlx::{Connection, Executor, PgConnection, Row};

/// Devolve (url_de_manutencao, url_do_banco_de_teste, nome_do_banco).
fn urls() -> Option<(String, String, String)> {
    let _ = dotenvy::from_filename("../.env");
    let base = std::env::var("DATABASE_URL").ok()?;
    let (prefix, _) = base.rsplit_once('/')?;
    let nome = format!("adm_p6_test_{}", std::process::id());
    Some((
        format!("{prefix}/postgres"),
        format!("{prefix}/{nome}"),
        nome,
    ))
}

#[tokio::test]
async fn migrations_aplicam_do_zero_e_produzem_o_schema_esperado() {
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
        .expect("descartar banco de teste anterior");
    admin
        .execute(&*format!(r#"CREATE DATABASE "{nome}""#))
        .await
        .expect("criar banco de teste");

    let resultado = verificar(&teste).await;

    admin
        .execute(&*format!(
            r#"DROP DATABASE IF EXISTS "{nome}" WITH (FORCE)"#
        ))
        .await
        .expect("remover banco de teste");

    resultado.unwrap();
}

async fn verificar(url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let mut conn = PgConnection::connect(url).await?;

    sqlx::migrate!("./migrations").run(&mut conn).await?;
    // Reaplicar tem de ser inócuo: é o que acontece a cada startup do app.
    sqlx::migrate!("./migrations").run(&mut conn).await?;

    // O hub e as tabelas por espécie não podem ressuscitar.
    for extinta in [
        "historico_processo_procedimentos",
        "sindicancia_regular",
        "inquerito_policial_militar",
        "processo_apuratorio_disciplinar_sumario",
        "conselho_disciplina",
        "carta_precatoria",
        "pm_envolvido_crimes_militares",
        "pm_envolvido_crimes_comuns",
        "infracoes_estatuto_art29",
        "infracoes_estatuto_art32",
        "tipos_prazo",
        "crimes_contravencoes",
    ] {
        let existe: bool = sqlx::query_scalar("SELECT to_regclass($1) IS NOT NULL")
            .bind(format!("public.{extinta}"))
            .fetch_one(&mut conn)
            .await?;
        assert!(!existe, "tabela {extinta} deveria ter sido eliminada");
    }

    // Toda FK precisa de ON DELETE explícito. No schema anterior as 111 FKs
    // ficavam todas em NO ACTION por omissão.
    let sem_acao: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM pg_constraint
          WHERE connamespace = 'public'::regnamespace
            AND contype = 'f' AND confdeltype = 'a'",
    )
    .fetch_one(&mut conn)
    .await?;
    assert_eq!(sem_acao, 0, "ha FK sem ON DELETE explicito");

    // JSONB só nas duas colunas justificadas: snapshot de mapa e diff de auditoria.
    let jsonb: Vec<(String, String)> = sqlx::query(
        "SELECT table_name::text, column_name::text
           FROM information_schema.columns
          WHERE table_schema = 'public' AND data_type = 'jsonb'
          ORDER BY 1, 2",
    )
    .fetch_all(&mut conn)
    .await?
    .into_iter()
    .map(|r| (r.get(0), r.get(1)))
    .collect();
    assert_eq!(
        jsonb,
        vec![
            ("auditoria".to_string(), "alteracoes".to_string()),
            ("mapas_salvos".to_string(), "dados_mapa".to_string()),
        ],
        "JSONB inesperado no schema"
    );

    // As duas constraint triggers de configuração existem.
    let triggers: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal
          AND tgname IN ('tg_max_envolvidos', 'tg_max_ocupantes')",
    )
    .fetch_one(&mut conn)
    .await?;
    assert_eq!(triggers, 2, "constraint triggers de configuracao ausentes");

    // Seed técnico: uma conta administrativa, sem policial associado.
    let admins: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM usuarios u
           JOIN perfis_acesso p ON p.id = u.perfil_id
          WHERE p.pode_administrar AND u.ativo AND u.policial_militar_id IS NULL",
    )
    .fetch_one(&mut conn)
    .await?;
    assert_eq!(admins, 1, "esperado exatamente um administrador tecnico");

    // Nenhum catálogo de negócio pode vir semeado.
    for vazio in [
        "apuratorios",
        "tipos_documento",
        "policiais_militares",
        "postos_graduacoes",
        "circulos_hierarquicos",
        "naturezas_fato",
        "naturezas_transgressao",
        "tipos_penalidade",
        "tipos_solucao_decidida",
        "tipos_solucao_sugerida",
        "status_envolvido",
        "categorias_indicio",
        "municipios_distritos",
        "unidades_pm",
        "transgressoes",
        "infracoes_penais",
        "infracoes_estatuto",
        "dispositivos_legais",
        "papeis_processo",
        "tipos_andamento",
    ] {
        let n: i64 = sqlx::query_scalar(&format!("SELECT count(*) FROM {vazio}"))
            .fetch_one(&mut conn)
            .await?;
        assert_eq!(n, 0, "catalogo de negocio {vazio} nao deveria vir semeado");
    }

    Ok(())
}
