//! Configuração de um apuratório: quais documentos podem iniciá-lo e quais
//! papéis ele usa.
//!
//! Estas duas tabelas não estão em `legal_catalogs::CATALOGOS` porque não são
//! catálogos: são associações com PK composta `(apuratorio_id, …)`, sem coluna
//! `id` e sem coluna `nome`, e o CRUD genérico pressupõe as duas. São, ainda
//! assim, o ponto em que o comportamento do sistema é configurado — sem uma
//! linha em `apuratorio_documentos_iniciadores` a FK composta de
//! `processos_procedimentos` recusa qualquer processo, e sem uma linha em
//! `apuratorio_papeis` nenhuma designação é possível.

use serde::{Deserialize, Serialize};

/// Além das duas associações, este comando entrega os **atributos de
/// comportamento** do apuratório — o que o formulário de processo precisa saber
/// para decidir quais campos existem naquela espécie.
///
/// POR QUE AQUI, E NÃO NO CATÁLOGO
///
/// A tela lia esses atributos de `legal_catalogs_list("apuratorios")`, e isso
/// se mostrou frágil: aquele comando projeta **só as colunas declaradas no
/// registro de administração**. Quando a decisão 29 tirou `codigo_extensao` do
/// registro — de propósito, para sumir do formulário de cadastro do apuratório
/// —, a tela de processo parou de enxergá-lo junto, e o bloco de carta
/// precatória deixou de renderizar. O backend continuava exigindo deprecante,
/// então a espécie ficou impossível de cadastrar, sem erro que apontasse a
/// causa.
///
/// A separação que faltava: o **registro** governa o que o administrador edita;
/// **este comando** entrega o que o formulário precisa saber. São perguntas
/// diferentes, e não podiam depender da mesma lista.
#[derive(Debug, Serialize)]
pub struct ApuratorioConfig {
    pub apuratorio_id: String,
    pub sigla: String,
    pub nome: String,
    /// Prazo herdado por um documento iniciador que não declare o seu.
    pub prazo_base_dias: i32,

    /// Em branco = sem limite de envolvidos.
    pub max_envolvidos: Option<i32>,
    /// A rubrica do fato é obrigatória nesta espécie.
    pub exige_natureza_fato: bool,
    /// A espécie é julgada: revela a data de julgamento.
    pub permite_julgamento: bool,
    /// Da espécie pode resultar punição: revela penalidade e dias no envolvido.
    /// Vale **junto** com `tipos_solucao_decidida.permite_penalidade`, não no
    /// lugar dele — um diz se a espécie pune, o outro se aquele desfecho pune.
    pub permite_punicao: bool,
    /// A espécie tramita por comissão: revela a data de remessa à comissão.
    pub permite_remessa_comissao: bool,
    /// O único código técnico do schema (§5.3). Dirige a extensão de formulário
    /// — hoje só `carta_precatoria`. Fica fora do registro de administração de
    /// propósito: acrescentar extensão é mudança de código, não operação de
    /// administrador.
    pub codigo_extensao: Option<String>,

    pub documentos: Vec<DocumentoIniciadorItem>,
    pub papeis: Vec<PapelItem>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DocumentoIniciadorItem {
    pub tipo_documento_id: String,
    pub tipo_documento: String,
    /// NULL = herda o prazo do apuratório.
    pub prazo_base_dias: Option<i32>,
    /// O `COALESCE` já resolvido: é este o prazo que o processo vai receber.
    pub prazo_efetivo_dias: i32,
    pub padrao: bool,
    pub ativo: bool,
    /// Já existe processo com este par. Desativar continua permitido; apagar não.
    pub em_uso: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PapelItem {
    pub papel_id: String,
    pub papel: String,
    pub obrigatorio: bool,
    pub max_ocupantes: i32,
    pub e_responsavel: bool,
    pub ativo: bool,
    pub em_uso: bool,
}

#[derive(Debug, Deserialize)]
pub struct SaveDocumentoIniciadorRequest {
    pub apuratorio_id: String,
    pub tipo_documento_id: String,
    pub prazo_base_dias: Option<i32>,
    #[serde(default)]
    pub padrao: bool,
    #[serde(default = "verdadeiro")]
    pub ativo: bool,
}

#[derive(Debug, Deserialize)]
pub struct SavePapelRequest {
    pub apuratorio_id: String,
    pub papel_id: String,
    #[serde(default)]
    pub obrigatorio: bool,
    pub max_ocupantes: i32,
    #[serde(default)]
    pub e_responsavel: bool,
    #[serde(default = "verdadeiro")]
    pub ativo: bool,
}

fn verdadeiro() -> bool {
    true
}

impl SaveDocumentoIniciadorRequest {
    /// Espelha os CHECKs do schema para que o usuário receba a regra em
    /// português, e não uma violação de constraint do PostgreSQL.
    pub fn validate(&self) -> Result<(), String> {
        if self.prazo_base_dias.is_some_and(|d| d <= 0) {
            return Err("O prazo do documento iniciador precisa ser maior que zero.".to_string());
        }
        if self.padrao && !self.ativo {
            return Err(
                "Um documento desativado não pode ser o padrão do apuratório. Reative-o ou escolha outro."
                    .to_string(),
            );
        }
        Ok(())
    }
}

impl SavePapelRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.max_ocupantes <= 0 {
            return Err("O número máximo de ocupantes precisa ser maior que zero.".to_string());
        }
        if self.e_responsavel && !self.ativo {
            return Err(
                "o papel que responde pelo apuratorio nao pode ficar desativado".to_string(),
            );
        }
        // Sem responsável ativo, o processo aparece sem responsável na listagem,
        // no dashboard e nos relatórios — todos resolvem por `e_responsavel`.
        if self.e_responsavel && !self.obrigatorio {
            return Err(
                "A função que responde pelo apuratório precisa ser obrigatória.".to_string(),
            );
        }
        Ok(())
    }
}
