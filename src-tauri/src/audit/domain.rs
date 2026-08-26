use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditDetailItem {
    pub id: String,
    pub entidade: String,
    pub registro_id: String,
    pub operacao: String,
    pub usuario_id: Option<String>,
    pub usuario_nome: Option<String>,
    pub usuario_posto: Option<String>,
    /// Diff da operação, quando registrado. Preenchido nas alterações de
    /// configuração, que mudam o comportamento futuro do sistema.
    pub alteracoes: Option<Value>,
    pub ocorrido_em: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditOperationStat {
    pub operacao: String,
    pub total: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditTableStat {
    pub entidade: String,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct AuditStatistics {
    pub total: i64,
    pub por_operacao: Vec<AuditOperationStat>,
    pub por_entidade: Vec<AuditTableStat>,
}

/// Envelope das listagens paginadas de auditoria.
///
/// `page` e `per_page` voltam junto porque o backend os corrige: pedir a página
/// 0 ou 3.000 por página não é erro, é pedido ajustado — e a tela precisa saber
/// o que de fato foi servido para desenhar o controle de página. É o mesmo
/// contrato de `UserListResult` e `ProceedingListResult`.
#[derive(Debug, Serialize)]
pub struct AuditPageResult {
    pub items: Vec<AuditDetailItem>,
    /// Total do **escopo filtrado**, não da página.
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize, Default)]
pub struct AuditStatisticsFilter {
    pub data_inicio: Option<NaiveDate>,
    pub data_fim: Option<NaiveDate>,
}
