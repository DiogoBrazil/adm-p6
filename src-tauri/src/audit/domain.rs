use chrono::NaiveDate;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditDetailItem {
    pub id: String,
    pub tabela: Option<String>,
    pub registro_id: Option<String>,
    pub operacao: Option<String>,
    pub usuario_id: Option<String>,
    pub usuario_nome: Option<String>,
    pub usuario_posto: Option<String>,
    pub timestamp: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditOperationStat {
    pub operacao: String,
    pub total: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditTableStat {
    pub tabela: String,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct AuditStatistics {
    pub total: i64,
    pub por_operacao: Vec<AuditOperationStat>,
    pub por_tabela: Vec<AuditTableStat>,
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
