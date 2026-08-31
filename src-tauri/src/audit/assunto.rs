//! De onde sai o "sobre o quê" da trilha de auditoria.
//!
//! Cada função devolve o rótulo de UM registro, como ele se chama **agora** —
//! e quem chama grava esse texto em `auditoria.assunto`, congelando-o. Por isso
//! toda leitura acontece na mesma transação da ação, e **antes** dela quando a
//! ação apaga a linha de verdade: depois do `DELETE` não há de onde ler.
//!
//! Devolver `Option` em vez de erro é deliberado. Auditoria não pode derrubar a
//! operação que ela registra: se o rótulo não vier, a trilha fica sem o assunto
//! daquela linha, e a gravação do usuário segue. O contrário — perder a
//! gravação porque a auditoria não soube nomeá-la — seria pior.
//!
//! As consultas estão escritas **inteiras em cada função**, e não passadas a um
//! helper comum, de propósito: `tests/sql_prepare.rs` só enxerga o SQL que é
//! literal no argumento de `sqlx::query*`. Concentrá-las num `fn escalar(sql)`
//! deixaria as nove fora da análise do PostgreSQL, que é justamente a rede que
//! pega erro de digitação em nome de coluna.

use sqlx::{Postgres, Transaction};

use crate::legal_catalogs::domain::Catalogo;

/// O apuratório, pelo `rotulo` que a view já monta: `IPM nº 1/2026/7ºBPM`.
///
/// A leitura **não** filtra `ativo`: um apuratório excluído logicamente precisa
/// continuar nomeado na trilha, e é justamente a exclusão que se quer ler.
pub async fn de_apuratorio(tx: &mut Transaction<'_, Postgres>, id: &str) -> Option<String> {
    sqlx::query_scalar("SELECT v.rotulo FROM v_processos_detalhados v WHERE v.id = $1::uuid")
        .bind(id)
        .fetch_optional(&mut **tx)
        .await
        .ok()
        .flatten()
}

// ── Os cinco filhos de apuratório, nomeados pelo pai ─────────────────────────
//
// "Removeu uma prorrogação de prazo — IPM nº 1/2026" é o que se quer ler; o
// UUID do prazo não diz nada a ninguém.

pub async fn de_envolvido(tx: &mut Transaction<'_, Postgres>, id: &str) -> Option<String> {
    sqlx::query_scalar(
        "SELECT v.rotulo FROM processo_envolvidos e
           JOIN v_processos_detalhados v ON v.id = e.processo_id
          WHERE e.id = $1::uuid",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
    .ok()
    .flatten()
}

pub async fn de_designacao(tx: &mut Transaction<'_, Postgres>, id: &str) -> Option<String> {
    sqlx::query_scalar(
        "SELECT v.rotulo FROM processo_designacoes d
           JOIN v_processos_detalhados v ON v.id = d.processo_id
          WHERE d.id = $1::uuid",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
    .ok()
    .flatten()
}

pub async fn de_prazo(tx: &mut Transaction<'_, Postgres>, id: &str) -> Option<String> {
    sqlx::query_scalar(
        "SELECT v.rotulo FROM processo_prazos p
           JOIN v_processos_detalhados v ON v.id = p.processo_id
          WHERE p.id = $1::uuid",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
    .ok()
    .flatten()
}

pub async fn de_andamento(tx: &mut Transaction<'_, Postgres>, id: &str) -> Option<String> {
    sqlx::query_scalar(
        "SELECT v.rotulo FROM processo_andamentos m
           JOIN v_processos_detalhados v ON v.id = m.processo_id
          WHERE m.id = $1::uuid",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
    .ok()
    .flatten()
}

pub async fn de_anexo(tx: &mut Transaction<'_, Postgres>, id: &str) -> Option<String> {
    sqlx::query_scalar(
        "SELECT v.rotulo FROM processo_anexos x
           JOIN v_processos_detalhados v ON v.id = x.processo_id
          WHERE x.id = $1::uuid",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
    .ok()
    .flatten()
}

/// O militar na qualificação de sempre: `CB PM 100012345 FULANO DE TAL`. É o
/// mesmo arranjo de `dom.ts::formatarQualificacaoMilitar`.
pub async fn de_militar(tx: &mut Transaction<'_, Postgres>, id: &str) -> Option<String> {
    sqlx::query_scalar(
        "SELECT pg.sigla || ' ' || pm.matricula || ' ' || pm.nome
           FROM policiais_militares pm
           JOIN postos_graduacoes pg ON pg.id = pm.posto_graduacao_id
          WHERE pm.id = $1::uuid",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
    .ok()
    .flatten()
}

pub async fn de_mapa(tx: &mut Transaction<'_, Postgres>, id: &str) -> Option<String> {
    sqlx::query_scalar("SELECT titulo FROM mapas_salvos WHERE id = $1::uuid")
        .bind(id)
        .fetch_optional(&mut **tx)
        .await
        .ok()
        .flatten()
}

// ── Configuração de apuratórios ──────────────────────────────────────────────
//
// As duas tabelas têm PK composta, e é por isso que
// `apuratorio_config/commands.rs::registro` concatena o par em `registro_id`.
// Aqui os dois ids chegam separados, que é como o comando os tem.

/// `IPM — Encarregado`.
pub async fn de_papel_do_apuratorio(
    tx: &mut Transaction<'_, Postgres>,
    apuratorio_id: &str,
    papel_id: &str,
) -> Option<String> {
    sqlx::query_scalar(
        "SELECT a.sigla || ' — ' || p.nome
           FROM apuratorios a, papeis_processo p
          WHERE a.id = $1::uuid AND p.id = $2::uuid",
    )
    .bind(apuratorio_id)
    .bind(papel_id)
    .fetch_optional(&mut **tx)
    .await
    .ok()
    .flatten()
}

/// `IPM — Portaria`.
pub async fn de_documento_do_apuratorio(
    tx: &mut Transaction<'_, Postgres>,
    apuratorio_id: &str,
    tipo_documento_id: &str,
) -> Option<String> {
    sqlx::query_scalar(
        "SELECT a.sigla || ' — ' || d.nome
           FROM apuratorios a, tipos_documento d
          WHERE a.id = $1::uuid AND d.id = $2::uuid",
    )
    .bind(apuratorio_id)
    .bind(tipo_documento_id)
    .fetch_optional(&mut **tx)
    .await
    .ok()
    .flatten()
}

/// Um item de catálogo, pelo `assunto_sql` declarado na própria entrada de
/// `CATALOGOS`.
///
/// Único ponto deste módulo em que o SQL não é literal — vem da tabela de
/// metadados, nunca de um parâmetro de requisição, que é a mesma regra que
/// `legal_catalogs::repository` observa. Como `sql_prepare.rs` não alcança
/// SQL vindo de variável, quem garante as 26 consultas é
/// `tests/legal_catalogs_repository.rs::todo_catalogo_sabe_dizer_o_assunto_de_uma_linha`.
pub async fn de_catalogo(
    tx: &mut Transaction<'_, Postgres>,
    catalogo: &Catalogo,
    id: &str,
) -> Option<String> {
    sqlx::query_scalar(catalogo.assunto_sql)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await
        .ok()
        .flatten()
}
