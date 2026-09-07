use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::deadlines::domain::DeadlineItem;
use crate::evidence::domain::EnvolvidoComIndicios;
use crate::movements::domain::MovementItem;
use crate::proceedings::domain::ProceedingDetail;

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
    // Os dois flatten são obrigatórios e governam coisas diferentes: `sqlx`
    // monta o struct a partir da linha do banco, `serde` achata os campos no
    // JSON que a tela lê. Sem o segundo a resposta sai aninhada sob
    // `cabecalho`, e o detalhe do mapa salvo imprime "undefined a undefined ·
    // undefined no período" — sem erro nenhum, porque `types.ts` declara os
    // campos no topo e o TypeScript acredita na declaração.
    #[sqlx(flatten)]
    #[serde(flatten)]
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

/// Recorte do mapa mensal que será preparado para impressão detalhada.
///
/// O processo opcional não é uma leitura livre por id: o repositório primeiro
/// reaplica a regra do período e só então aceita a seleção. Assim o PDF de uma
/// ficha nunca escapa do mês e dos apuratórios que o operador escolheu.
#[derive(Debug, Deserialize)]
pub struct MapPrintRequest {
    pub periodo_inicio: NaiveDate,
    pub periodo_fim: NaiveDate,
    pub apuratorio_ids: Option<Vec<String>>,
    pub processo_id: Option<String>,
}

impl MapPrintRequest {
    pub fn periodo(&self) -> MapPeriodRequest {
        MapPeriodRequest {
            periodo_inicio: self.periodo_inicio,
            periodo_fim: self.periodo_fim,
            apuratorio_ids: self.apuratorio_ids.clone(),
        }
    }
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
    pub subunidade_secao_origem: Option<String>,
    pub natureza_fato: Option<String>,
    pub data_instauracao: NaiveDate,
    pub data_conclusao: Option<NaiveDate>,
    pub responsavel_nome: Option<String>,
    pub responsavel_matricula: Option<String>,
    pub responsavel_posto_graduacao: Option<String>,
    pub envolvidos: Option<String>,
    pub prazo_vencimento: Option<NaiveDate>,
    pub ultimo_andamento: Option<String>,
    pub ultimo_andamento_em: Option<DateTime<Utc>>,
}

/// Ficha completa de um processo do mapa mensal.
///
/// Reúne num único IPC as mesmas fontes usadas pela tela de detalhe. O PDF não
/// cria uma segunda interpretação dos fatos: cabeçalho, coleções, prazos,
/// andamentos e enquadramentos continuam vindo dos respectivos repositórios.
#[derive(Debug, Serialize)]
pub struct MapPrintItem {
    pub processo: ProceedingDetail,
    /// A apresentação da data segue a configuração administrável da espécie;
    /// o frontend nunca decide por sigla se a remessa se aplica.
    pub permite_remessa_comissao: bool,
    pub prazos: Vec<DeadlineItem>,
    pub andamentos: Vec<MovementItem>,
    pub enquadramentos: Vec<EnvolvidoComIndicios>,
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
    /// Recorta num militar só, para a ficha individual da tela.
    pub policial_militar_id: Option<String>,
    /// Recorta num dos quatro baldes — `concluidos`, `no_prazo`, `vencidos` ou
    /// `sem_prazo` — ou em `em_andamento`, que é a **união** de `no_prazo` e
    /// `vencidos`.
    ///
    /// `em_andamento` não é um quinto balde: os quatro continuam exclusivos e
    /// somando o total, e a união mora só no filtro. Ela deixa `sem_prazo` de
    /// fora de propósito — ver `repository::baldes_do_filtro`.
    ///
    /// O recorte vale para os **apuratórios contados**, não para os militares
    /// listados: filtrando "vencidos", cada linha traz quantos vencidos aquele
    /// militar tem, e as datas saem do conjunto filtrado — é o que faz "quem
    /// concluiu por último" ser uma pergunta respondível.
    pub situacao: Option<String>,
    /// `total` (padrão), `recebimento_recente`, `recebimento_antigo`,
    /// `conclusao_recente` ou `conclusao_antiga`.
    pub ordenacao: Option<String>,
    /// Só as designações ainda vigentes (`data_fim IS NULL`).
    ///
    /// O padrão é **todas**, inclusive as encerradas — é o que a matriz sempre
    /// contou, e o porquê está no cabeçalho de `designations_matrix`. As duas
    /// leituras são perguntas diferentes: "o que ele tem hoje na mão" e "o que
    /// ele já tocou". Quem escolhe é quem lê, na tela.
    pub somente_vigentes: Option<bool>,
    pub limit: Option<i64>,
}

/// Situação dos apuratórios de uma célula ou de uma linha da matriz.
///
/// Os quatro baldes são exclusivos e somam `total`. **`sem_prazo` existe porque
/// o estado existe**: apuratório em andamento cuja data de recebimento nunca
/// foi informada não tem linha em `processo_prazos`, e contá-lo como "no prazo"
/// afirmaria um prazo que não há. A tela só mostra a coluna quando ela é > 0.
#[derive(Debug, Serialize, Default, Clone, Copy)]
pub struct SituacaoDesignacao {
    pub concluidos: i64,
    pub no_prazo: i64,
    pub vencidos: i64,
    pub sem_prazo: i64,
    pub total: i64,
    /// A **maior** data de recebimento do conjunto, e a maior de conclusão.
    ///
    /// São o que responde "entre os encarregados de SR, qual recebeu ou
    /// concluiu por último". Vêm do conjunto já filtrado, então mudam com o
    /// escopo — inclusive com o filtro de situação. `None` quando nenhum
    /// apuratório do conjunto tem a data.
    pub ultimo_recebimento: Option<NaiveDate>,
    pub ultima_conclusao: Option<NaiveDate>,
}

impl SituacaoDesignacao {
    /// Acumula a situação de uma célula no total do militar.
    pub fn somar(&mut self, outra: &SituacaoDesignacao) {
        self.concluidos += outra.concluidos;
        self.no_prazo += outra.no_prazo;
        self.vencidos += outra.vencidos;
        self.sem_prazo += outra.sem_prazo;
        self.total += outra.total;
        self.ultimo_recebimento = self.ultimo_recebimento.max(outra.ultimo_recebimento);
        self.ultima_conclusao = self.ultima_conclusao.max(outra.ultima_conclusao);
    }
}

/// Célula da matriz: um apuratório em que o militar foi designado, com a
/// situação dos processos daquela espécie. `id` é o apuratório e `rotulo` a
/// sigla — a tela monta as colunas a partir do catálogo, não daqui.
#[derive(Debug, Serialize)]
pub struct DesignacaoCelula {
    pub id: String,
    pub rotulo: String,
    #[serde(flatten)]
    pub situacao: SituacaoDesignacao,
}

/// Linha da matriz militar × apuratório, com a situação consolidada do militar.
#[derive(Debug, Serialize)]
pub struct DesignacaoMatrizLinha {
    pub policial_militar_id: String,
    pub nome: String,
    pub matricula: String,
    pub posto_graduacao: String,
    pub celulas: Vec<DesignacaoCelula>,
    #[serde(flatten)]
    pub situacao: SituacaoDesignacao,
}
