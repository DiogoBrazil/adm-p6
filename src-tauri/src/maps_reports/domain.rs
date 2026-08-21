use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SavedMapListItem {
    pub id: String,
    pub titulo: String,
    pub apuratorio_id: Option<String>,
    pub apuratorio_sigla: Option<String>,
    pub periodo_inicio: NaiveDate,
    pub periodo_fim: NaiveDate,
    pub total_processos: i32,
    pub total_concluidos: i32,
    pub total_andamento: i32,
    pub gerado_por: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SavedMapFull {
    #[sqlx(flatten)]
    pub cabecalho: SavedMapListItem,
    /// Snapshot imutável do mapa como foi emitido. É o único JSONB de domínio do
    /// schema, e é justificado: recalcular hoje daria outro resultado — preservar
    /// exatamente o que foi publicado é a razão de o mapa ser salvo.
    pub dados_mapa: Value,
}

#[derive(Debug, Deserialize)]
pub struct MapPeriodRequest {
    pub periodo_inicio: NaiveDate,
    pub periodo_fim: NaiveDate,
    /// Espécies a incluir. Vazio = todas. Substitui o `tipo_processo` textual com
    /// o sentinela "TODOS" que existia antes.
    pub apuratorio_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct SaveMapRequest {
    pub titulo: String,
    pub apuratorio_id: Option<String>,
    pub periodo_inicio: NaiveDate,
    pub periodo_fim: NaiveDate,
    pub total_processos: i32,
    pub total_concluidos: i32,
    pub total_andamento: i32,
    pub dados_mapa: Value,
}

/// Linha do mapa mensal: um processo com o que a Seção precisa ver na folha.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MapRow {
    pub processo_id: String,
    pub apuratorio_sigla: String,
    pub rotulo: String,
    pub unidade_origem: String,
    pub natureza_fato: Option<String>,
    pub data_instauracao: NaiveDate,
    pub data_conclusao: Option<NaiveDate>,
    pub responsavel_nome: Option<String>,
    pub envolvidos: Option<String>,
    pub prazo_vencimento: Option<NaiveDate>,
    pub ultimo_andamento: Option<String>,
    pub ultimo_andamento_em: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ContagemRotulada {
    pub id: String,
    pub rotulo: String,
    pub total: i64,
}

/// Ranking de PMs condutores em processos cuja natureza exige condutor.
/// Antes era um `Ok(vec![])`: a coluna `motorista_id` do legado não tinha
/// destino no schema, e havia 15 registros reais.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DriverRankingItem {
    pub policial_militar_id: String,
    pub nome: String,
    pub matricula: String,
    pub posto_graduacao: String,
    pub total: i64,
}

#[derive(Debug, Deserialize, Default)]
pub struct ReportFilter {
    pub apuratorio_ids: Option<Vec<String>>,
    pub ano: Option<i32>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct CsvExport {
    pub nome_arquivo: String,
    /// CSV em base64, pronto para o frontend oferecer como download.
    pub conteudo: String,
}
