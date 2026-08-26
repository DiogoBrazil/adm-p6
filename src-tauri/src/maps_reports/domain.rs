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

/// Envelope da lista de mapas salvos. Mesmo contrato de `UserListResult`.
#[derive(Debug, Serialize)]
pub struct SavedMapListResult {
    pub items: Vec<SavedMapListItem>,
    /// Total do **escopo ativo**, não da página.
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
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

/// Situação dos processos de um apuratório no escopo do filtro.
///
/// Substitui `proceedings_in_progress_stats`, que agrupava por `tipo_detalhe` —
/// uma coluna de texto. O tipo vem junto para a tela agrupar processo ×
/// procedimento sem conhecer sigla nenhuma.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StatusPorApuratorio {
    pub apuratorio_id: String,
    pub sigla: String,
    pub nome: String,
    pub tipo_apuratorio_id: String,
    pub tipo_apuratorio_nome: String,
    pub em_andamento: i64,
    pub concluidos: i64,
    pub total: i64,
}

/// O que o encarregado sugeriu e o que a autoridade decidiu, lado a lado.
/// São catálogos distintos por decisão de negócio — ver seção 2 do guia.
#[derive(Debug, Serialize)]
pub struct SolucoesResumo {
    pub sugeridas: Vec<ContagemRotulada>,
    pub decididas: Vec<ContagemRotulada>,
}

/// Contagem de um enquadramento imputado a envolvidos.
///
/// `classificacao` sempre vem de JOIN — esfera penal escolhida no vínculo,
/// espécie do artigo (Crime/Contravenção) ou natureza do artigo do RDPM.
/// Nunca de literal no SQL: era exatamente isso que `common_crimes_stats`
/// fazia com `CASE WHEN ti.codigo = 'Crime' THEN ...`.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EnquadramentoContagem {
    pub id: String,
    pub rotulo: String,
    pub descricao: String,
    pub classificacao: Option<String>,
    pub total: i64,
}

/// Filtro da matriz de designações. Estende `ReportFilter` com os papéis,
/// para a tela isolar "como escrivão" sem que o nome do papel apareça no SQL.
#[derive(Debug, Deserialize, Default)]
pub struct DesignacaoMatrizFiltro {
    pub apuratorio_ids: Option<Vec<String>>,
    pub papel_ids: Option<Vec<String>>,
    pub ano: Option<i32>,
    pub limit: Option<i64>,
}

/// Linha da matriz militar × apuratório. `celulas` traz uma entrada por
/// apuratório em que o militar foi designado (`id` = apuratório, `rotulo` =
/// sigla); a tela monta as colunas a partir do catálogo, não daqui.
#[derive(Debug, Serialize)]
pub struct DesignacaoMatrizLinha {
    pub policial_militar_id: String,
    pub nome: String,
    pub matricula: String,
    pub posto_graduacao: String,
    pub celulas: Vec<ContagemRotulada>,
    pub total: i64,
}
