use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::time::Duration;

/// O pool, dimensionado para um banco que está do outro lado da internet.
///
/// Enquanto o banco era o docker-compose da própria máquina, os padrões do sqlx
/// não custavam nada: cada ida e volta levava 0,2 ms, e reciclar conexão ou
/// pingar antes de usar era invisível. Com o Postgres em nuvem (~224 ms de
/// round-trip, medidos daqui) cada uma dessas escolhas passou a aparecer na
/// tela, e por isso todas estão declaradas — quem mexer aqui está mexendo em
/// tempo de tela, não em detalhe de configuração.
pub async fn connect(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(5)
        // Zero, e declarado. É tentador manter uma conexão quente para não
        // pagar o handshake TLS (~1,1 s), mas conexão aberta conta como
        // atividade para um Postgres serverless: ele nunca suspenderia, e o
        // consumo passaria a correr 24 h por dia em vez de nos minutos de uso.
        .min_connections(0)
        // Menor que o corte de ociosidade do servidor, de propósito: assim quem
        // descarta a conexão parada somos nós, e não o servidor pelas costas do
        // pool.
        .idle_timeout(Some(Duration::from_secs(240)))
        .max_lifetime(Some(Duration::from_secs(600)))
        // Cabe o pior caso honesto: acordar um compute suspenso mais o
        // handshake. Estourar isto é erro de verdade, e chega à tela como tal.
        .acquire_timeout(Duration::from_secs(30))
        .connect(database_url)
        .await
}

// `test_before_acquire` fica no padrão (ligado): é o que impede entregar a uma
// consulta um socket que o servidor já derrubou. Ele custa um ping de ida e
// volta por `acquire`, e a resposta a esse custo não é desligá-lo — é pedir
// menos conexões: quem faz muitas consultas seguidas tira **uma** conexão e a
// reusa (`proceedings::repository::get`, `maps_reports::repository::map_print_data`).
//
// `statement_timeout` também não é declarado aqui. Ele viajaria no parâmetro
// `options` do startup, que num Postgres serverless costuma ser usado para
// rotear a conexão até o endpoint certo — sobrescrevê-lo troca um problema de
// tempo por um de conectividade. O limite de espera que o usuário enxerga mora
// no comando, em `maps_reports::commands`.
