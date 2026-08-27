use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use crate::evidence::domain::AcusacoesRequest;

#[derive(Debug, Deserialize, Serialize)]
pub struct MilitarQualificado {
    pub posto_graduacao: String,
    pub matricula: String,
    pub nome: String,
}

/// Único código técnico do sistema. Identifica que um apuratório usa a tabela de
/// extensão `carta_precatoria_detalhes`. Vive em `apuratorios.codigo_extensao`,
/// separado de `sigla` e `nome`, que o administrador renomeia à vontade.
pub const EXTENSAO_CARTA_PRECATORIA: &str = "carta_precatoria";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProceedingListItem {
    pub id: String,
    pub apuratorio_id: String,
    pub apuratorio_sigla: String,
    pub apuratorio_nome: String,
    pub tipo_apuratorio: String,
    pub documento_iniciador_id: String,
    pub documento_iniciador: String,
    pub numero_documento: String,
    /// Número de controle efetivo: o informado ou, quando ausente, o do documento.
    pub numero_controle: String,
    pub processo_sei: Option<String>,
    /// Rótulo montado a partir do dado, no formato usado pela Seção:
    /// `SIGLA nº CONTROLE/UNIDADE/ANO`.
    pub rotulo: String,
    /// Os ids acompanham os rótulos porque o formulário de edição precisa
    /// repopular os selects. Resolver por nome falharia justamente no caso que
    /// o modelo protege: um catálogo desativado não aparece na lista de opções,
    /// e o processo antigo perderia o vínculo em silêncio.
    pub unidade_origem_id: String,
    pub unidade_origem: String,
    pub municipio_fato_id: String,
    pub municipio_fato: String,
    pub natureza_fato_id: Option<String>,
    pub natureza_fato: Option<String>,
    pub data_instauracao: NaiveDate,
    pub data_recebimento: Option<NaiveDate>,
    pub data_conclusao: Option<NaiveDate>,
    /// Derivado de `data_conclusao IS NOT NULL` — não existe coluna booleana.
    pub concluido: bool,
    pub resumo_fatos: Option<String>,
    /// Quem ocupa, neste apuratório, o papel configurado como responsável.
    pub responsavel_nome: Option<String>,
    pub responsavel_matricula: Option<String>,
    pub responsavel_posto_graduacao: Option<String>,
    pub responsavel_papel: Option<String>,
    pub total_envolvidos: i64,
    /// Qualificação resumida dos envolvidos, na ordem definida no processo.
    /// O detalhe continua expondo `envolvidos` com o contrato completo.
    pub envolvidos_resumo: sqlx::types::Json<Vec<MilitarQualificado>>,
    pub prazo_vencimento: Option<NaiveDate>,
    pub prazo_dias_restantes: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EnvolvidoItem {
    pub id: String,
    pub policial_militar_id: String,
    pub nome: String,
    pub matricula: String,
    pub posto_graduacao: String,
    pub status_envolvido_id: String,
    pub status_envolvido: String,
    pub ordem: i32,
    pub e_condutor: bool,
    pub solucao_sugerida_id: Option<String>,
    pub solucao_sugerida: Option<String>,
    pub solucao_decidida_id: Option<String>,
    pub solucao_decidida: Option<String>,
    pub penalidade_tipo_id: Option<String>,
    pub penalidade_tipo: Option<String>,
    pub penalidade_dias: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DesignacaoItem {
    pub id: String,
    pub papel_id: String,
    pub papel: String,
    pub e_responsavel: bool,
    /// Algumas relações apuratório × papel não citam documento em suas
    /// designações. É configuração, não comparação de sigla/nome na tela.
    pub usa_documento_designacao: bool,
    pub policial_militar_id: String,
    pub nome: String,
    pub posto_graduacao: String,
    /// A qualificação completa do militar é posto, matrícula e nome. A matrícula
    /// vinha faltando aqui, e só aqui: a listagem e os relatórios já a trazem.
    pub matricula: String,
    pub data_inicio: NaiveDate,
    /// Exclusiva: é o dia em que o sucessor assume. Nula = designação vigente.
    pub data_fim: Option<NaiveDate>,
    /// Acompanha o rótulo pelo mesmo motivo dos ids de `ProceedingListItem`: o
    /// formulário de substituição repopula o select, e resolver por nome
    /// perderia o vínculo com um tipo de documento desativado depois.
    pub documento_autorizador_id: Option<String>,
    pub documento_autorizador: Option<String>,
    pub numero_documento: Option<String>,
    pub motivo: Option<String>,
    /// A designação que esta sucedeu. Nula = designação inicial, ainda sem
    /// histórico — é a única que o cadastro do processo pode alterar ou remover.
    ///
    /// Combinada com `data_fim`, resolve as três situações da tela sem que
    /// nenhuma delas precise olhar para o processo inteiro:
    ///
    /// | `data_fim` | `designacao_anterior_id` | o que é |
    /// |---|---|---|
    /// | nula | nula | designação inicial vigente — editável no cadastro |
    /// | nula | preenchida | **última substituição da cadeia** — pode corrigir e desfazer |
    /// | preenchida | qualquer | histórico encerrado — só leitura |
    pub designacao_anterior_id: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PessoaItem {
    pub id: String,
    pub papel_pessoa_id: String,
    pub papel_pessoa: String,
    pub nome: String,
    pub ordem: i32,
}

/// Ofendido/Vítima. Não tem papel: quem decide se a espécie a registra é
/// `apuratorios.permite_cadastro_vitima`, e não uma linha de catálogo que
/// alguém precise ter cadastrado antes.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VitimaItem {
    pub id: String,
    pub nome: String,
    pub ordem: i32,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AnexoItem {
    pub id: String,
    pub nome_arquivo: String,
    pub mime_type: String,
    pub tamanho_bytes: i64,
    pub enviado_por: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CartaPrecatoriaDetalhes {
    pub deprecante: String,
    pub unidade_deprecada_id: String,
    pub unidade_deprecada: String,
}

#[derive(Debug, Serialize)]
pub struct ProceedingDetail {
    #[serde(flatten)]
    pub cabecalho: ProceedingListItem,
    pub numero_rgf: Option<String>,
    pub data_remessa_encarregado: Option<NaiveDate>,
    pub data_remessa_comissao: Option<NaiveDate>,
    pub data_julgamento: Option<NaiveDate>,
    pub envolvidos: Vec<EnvolvidoItem>,
    pub designacoes: Vec<DesignacaoItem>,
    pub pessoas: Vec<PessoaItem>,
    pub vitimas: Vec<VitimaItem>,
    pub anexos: Vec<AnexoItem>,
    pub carta_precatoria: Option<CartaPrecatoriaDetalhes>,
}

// ── Escrita ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct EnvolvidoRequest {
    pub policial_militar_id: String,
    pub status_envolvido_id: String,
    pub ordem: i32,
    #[serde(default)]
    pub e_condutor: bool,
    /// Ausente preserva o enquadramento atual. Presente sincroniza a acusacao
    /// inteira, inclusive quando vazia em um registro legado.
    pub acusacoes: Option<AcusacoesRequest>,
}

/// Uma designação **inicial**, lançada no cadastro do processo.
///
/// Carrega só o que o usuário escolhe. Início, documento autorizador, número e
/// motivo não estão aqui porque não são digitados: a designação inicial começa
/// na instauração e é autorizada pelo próprio documento que instaurou o
/// processo. Derivar em vez de repetir mantém a fonte de verdade única
/// (princípio 4) — e evita o modo de falha que apareceria se o formulário
/// mandasse `null` nesses campos a cada edição, apagando a portaria já
/// registrada. Documento e motivo próprios existem na SUBSTITUIÇÃO, que é onde
/// o usuário de fato os informa.
///
/// `id` presente = linha que já existe no banco e deve ser atualizada;
/// ausente = designação nova. É o que torna o cadastro capaz de **editar** uma
/// designação em vez de só acrescentar.
#[derive(Debug, Deserialize)]
pub struct DesignacaoRequest {
    pub id: Option<String>,
    pub policial_militar_id: String,
    pub papel_id: String,
}

/// Motivo gravado na designação inicial. É texto de apresentação, não regra:
/// nenhum código pergunta por ele para decidir coisa alguma — quem distingue a
/// inicial da substituição é `designacao_anterior_id`, não esta frase.
pub const MOTIVO_DESIGNACAO_INICIAL: &str = "Designação inicial";

#[derive(Debug, Deserialize)]
pub struct PessoaRequest {
    pub papel_pessoa_id: String,
    pub nome: String,
    pub ordem: i32,
}

#[derive(Debug, Deserialize)]
pub struct VitimaRequest {
    pub nome: String,
    pub ordem: i32,
}

#[derive(Debug, Deserialize)]
pub struct CartaPrecatoriaRequest {
    pub deprecante: String,
    pub unidade_deprecada_id: String,
}

/// Troca o ocupante de UMA designação vigente.
///
/// O alvo é `designacao_id`, não o papel. A diferença aparece assim que um papel
/// admite mais de um ocupante — a configuração de Escrivão prevê dois —, porque
/// aí "a designação vigente deste papel" é ambígua e a versão anterior encerrava
/// **todas** com um `UPDATE ... WHERE papel_id = $2 AND data_fim IS NULL`.
#[derive(Debug, Deserialize)]
pub struct SubstituirDesignacaoRequest {
    pub processo_id: String,
    /// A designação vigente que será encerrada.
    pub designacao_id: String,
    pub sucessor_id: String,
    /// Dia em que o sucessor assume. É também o fim (exclusivo) da designação
    /// anterior, então não há sobreposição nem lacuna.
    pub data_troca: NaiveDate,
    pub motivo: String,
    pub documento_autorizador_id: Option<String>,
    pub numero_documento: Option<String>,
}

/// Corrige a última substituição de uma cadeia: sucessor, data, motivo e
/// documento. O papel não entra — trocar a função não é corrigir uma
/// substituição, é outra designação.
#[derive(Debug, Deserialize)]
pub struct AtualizarSubstituicaoRequest {
    pub processo_id: String,
    /// A designação criada pela substituição que se quer corrigir.
    pub designacao_id: String,
    pub sucessor_id: String,
    pub data_troca: NaiveDate,
    pub motivo: String,
    pub documento_autorizador_id: Option<String>,
    pub numero_documento: Option<String>,
}

/// As regras que valem para criar e para corrigir uma substituição, escritas uma
/// vez. Só as que não dependem do banco: quem depende (a designação existe? está
/// vigente? o sucessor está ativo?) fica no repositório, com as linhas travadas.
fn validar_substituicao(
    data_troca: NaiveDate,
    motivo: &str,
    documento_autorizador_id: Option<&str>,
    numero_documento: Option<&str>,
) -> Result<(), String> {
    if motivo.trim().is_empty() {
        return Err("Informe o motivo da substituição.".to_string());
    }
    if data_troca > Utc::now().date_naive() {
        return Err("A data da substituição não pode ser futura.".to_string());
    }

    // Documento e número são um par: um documento autorizador sem número não
    // identifica o ato, e um número solto não diz de que documento é. Opcionais
    // juntos, obrigatórios juntos.
    let tem_documento = documento_autorizador_id.is_some_and(|d| !d.trim().is_empty());
    let tem_numero = numero_documento.is_some_and(|n| !n.trim().is_empty());
    match (tem_documento, tem_numero) {
        (true, false) => {
            Err("Informe o número do documento que autorizou a substituição.".to_string())
        }
        (false, true) => {
            Err("Escolha o tipo de documento que autorizou a substituição.".to_string())
        }
        _ => Ok(()),
    }
}

impl SubstituirDesignacaoRequest {
    pub fn validate(&self) -> Result<(), String> {
        validar_substituicao(
            self.data_troca,
            &self.motivo,
            self.documento_autorizador_id.as_deref(),
            self.numero_documento.as_deref(),
        )
    }
}

impl AtualizarSubstituicaoRequest {
    pub fn validate(&self) -> Result<(), String> {
        validar_substituicao(
            self.data_troca,
            &self.motivo,
            self.documento_autorizador_id.as_deref(),
            self.numero_documento.as_deref(),
        )
    }
}

#[derive(Debug, Deserialize)]
pub struct SaveProceedingRequest {
    pub id: Option<String>,
    pub apuratorio_id: String,
    pub documento_iniciador_id: String,
    pub numero_documento: String,
    /// Ausente = igual ao número do documento. É assim que o índice único trata.
    pub numero_controle: Option<String>,
    pub processo_sei: Option<String>,
    pub numero_rgf: Option<String>,
    pub unidade_origem_id: String,
    pub municipio_fato_id: String,
    pub natureza_fato_id: Option<String>,
    pub data_instauracao: NaiveDate,
    pub data_recebimento: Option<NaiveDate>,
    pub resumo_fatos: Option<String>,
    #[serde(default)]
    pub envolvidos: Vec<EnvolvidoRequest>,
    #[serde(default)]
    pub designacoes: Vec<DesignacaoRequest>,
    #[serde(default)]
    pub pessoas: Vec<PessoaRequest>,
    /// Vazio quando a espécie não registra ofendido — a tela não desenha a
    /// seção, e o backend recusa a lista não vazia (`validar_contra_configuracao`).
    #[serde(default)]
    pub vitimas: Vec<VitimaRequest>,
    pub carta_precatoria: Option<CartaPrecatoriaRequest>,
}

impl SaveProceedingRequest {
    /// Validações que não dependem do banco. As que dependem da configuração
    /// do apuratório (natureza obrigatória, condutor e papéis) ficam no
    /// repositório, que lê os atributos semânticos dos catálogos.
    pub fn validate(&self) -> Result<(), String> {
        let hoje = Utc::now().date_naive();
        if self.numero_documento.trim().is_empty() {
            return Err("Informe o número do documento que instaurou o processo.".to_string());
        }
        if self.data_instauracao > hoje {
            return Err("A data de instauração não pode ser futura.".to_string());
        }
        if self.data_recebimento.is_some_and(|d| d > hoje) {
            return Err("A data de recebimento não pode ser futura.".to_string());
        }

        let mut ordens: Vec<i32> = self.envolvidos.iter().map(|e| e.ordem).collect();
        ordens.sort_unstable();
        ordens.dedup();
        if ordens.len() != self.envolvidos.len() {
            return Err("Cada envolvido precisa de uma ordem diferente.".to_string());
        }
        if self.envolvidos.iter().filter(|e| e.e_condutor).count() > 1 {
            return Err("Só pode haver um condutor por processo.".to_string());
        }
        for pessoa in &self.pessoas {
            if pessoa.nome.trim().is_empty() {
                return Err("Informe o nome da pessoa, ou remova a linha.".to_string());
            }
        }

        for vitima in &self.vitimas {
            if vitima.nome.trim().is_empty() {
                return Err("Informe o nome do ofendido/vítima, ou remova a linha.".to_string());
            }
        }
        // `uq_vitima_ordem` também recusaria, mas com o texto cru do
        // PostgreSQL — e a decisão 38 exige mensagem de domínio para regra
        // previsível.
        let mut ordens_vitima: Vec<i32> = self.vitimas.iter().map(|v| v.ordem).collect();
        ordens_vitima.sort_unstable();
        ordens_vitima.dedup();
        if ordens_vitima.len() != self.vitimas.len() {
            return Err("Cada ofendido/vítima precisa de uma ordem diferente.".to_string());
        }

        // A mesma pessoa duas vezes no mesmo papel. O EXCLUDE do schema também
        // recusaria, mas com o texto cru do PostgreSQL: aqui a aplicação sabe
        // qual linha está errada e diz isso. O teto de ocupantes por papel
        // depende do cadastro e é checado no repositório, que o consulta.
        for (i, designacao) in self.designacoes.iter().enumerate() {
            let repetida = self.designacoes[..i].iter().any(|anterior| {
                anterior.papel_id == designacao.papel_id
                    && anterior.policial_militar_id == designacao.policial_militar_id
            });
            if repetida {
                return Err(
                    "O mesmo militar aparece duas vezes na mesma função. Remova a linha repetida."
                        .to_string(),
                );
            }
        }
        Ok(())
    }
}

/// Datas informadas somente depois que o processo já existe.
///
/// Elas ficam fora de `SaveProceedingRequest` para que uma correção nos dados
/// gerais nunca apague ou regrave, por acidente, fatos posteriores do fluxo.
#[derive(Debug, Deserialize)]
pub struct UpdateProceedingDatesRequest {
    pub processo_id: String,
    pub data_remessa_encarregado: Option<NaiveDate>,
    pub data_remessa_comissao: Option<NaiveDate>,
    pub data_julgamento: Option<NaiveDate>,
    pub data_conclusao: Option<NaiveDate>,
}

impl UpdateProceedingDatesRequest {
    pub fn validate(&self) -> Result<(), String> {
        let hoje = Utc::now().date_naive();
        if self.data_remessa_encarregado.is_some_and(|d| d > hoje) {
            return Err("A data de remessa do encarregado não pode ser futura.".to_string());
        }
        if self.data_remessa_comissao.is_some_and(|d| d > hoje) {
            return Err("A data de remessa à comissão não pode ser futura.".to_string());
        }
        if self.data_julgamento.is_some_and(|d| d > hoje) {
            return Err("A data de julgamento não pode ser futura.".to_string());
        }
        if self.data_conclusao.is_some_and(|d| d > hoje) {
            return Err("A data de conclusão não pode ser futura.".to_string());
        }
        Ok(())
    }
}

/// Resultado individual da apuração. Soluções e penalidade pertencem ao
/// envolvido, nunca ao processo como um todo.
#[derive(Debug, Deserialize)]
pub struct UpdateInvolvedOutcomeRequest {
    pub processo_id: String,
    pub envolvido_id: String,
    pub solucao_sugerida_id: Option<String>,
    pub solucao_decidida_id: Option<String>,
    pub penalidade_tipo_id: Option<String>,
    pub penalidade_dias: Option<i32>,
}

impl UpdateInvolvedOutcomeRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.penalidade_dias.is_some_and(|dias| dias <= 0) {
            return Err(
                "A quantidade de dias da penalidade precisa ser maior que zero.".to_string(),
            );
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize, Default)]
pub struct ProceedingFilter {
    pub busca: Option<String>,
    /// Espécies a incluir. Vazio = todas. Substitui os `IN (...)` de sigla.
    pub apuratorio_ids: Option<Vec<String>>,
    pub tipo_apuratorio_id: Option<String>,
    pub unidade_origem_id: Option<String>,
    pub natureza_fato_id: Option<String>,
    pub responsavel_id: Option<String>,
    pub ano: Option<i32>,
    pub concluido: Option<bool>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ProceedingListResult {
    pub items: Vec<ProceedingListItem>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct UploadAttachmentRequest {
    pub processo_id: String,
    pub nome_arquivo: String,
    pub mime_type: String,
    /// Conteúdo em base64.
    pub conteudo: String,
}

#[derive(Debug, Serialize)]
pub struct AttachmentContent {
    pub nome_arquivo: String,
    pub mime_type: String,
    pub conteudo: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ContagemRotulada {
    pub id: String,
    pub rotulo: String,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct DashboardSummary {
    pub total: i64,
    pub em_andamento: i64,
    pub concluidos: i64,
    pub prazos_vencidos: i64,
    pub por_apuratorio: Vec<ContagemRotulada>,
    pub por_natureza: Vec<ContagemRotulada>,
    pub por_unidade: Vec<ContagemRotulada>,
    pub por_ano: Vec<ContagemRotulada>,
}
