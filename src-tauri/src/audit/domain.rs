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

#[derive(Debug, Serialize)]
pub struct AuditPageResult {
    pub items: Vec<AuditDetailItem>,
    pub total: i64,
}

#[derive(Debug, Deserialize, Default)]
pub struct AuditStatisticsFilter {
    pub data_inicio: Option<NaiveDate>,
    pub data_fim: Option<NaiveDate>,
}
