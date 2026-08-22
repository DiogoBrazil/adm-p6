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

#[derive(Debug, Serialize)]
pub struct ApuratorioConfig {
    pub apuratorio_id: String,
    pub sigla: String,
    pub nome: String,
    /// Prazo herdado por um documento iniciador que não declare o seu.
    pub prazo_base_dias: i32,
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
            return Err("o prazo do documento iniciador deve ser maior que zero".to_string());
        }
        if self.padrao && !self.ativo {
            return Err("um documento desativado nao pode ser o padrao do apuratorio".to_string());
        }
        Ok(())
    }
}

impl SavePapelRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.max_ocupantes <= 0 {
            return Err("o numero maximo de ocupantes deve ser maior que zero".to_string());
        }
        if self.e_responsavel && !self.ativo {
            return Err(
                "o papel que responde pelo apuratorio nao pode ficar desativado".to_string(),
            );
        }
        // Sem responsável ativo, o processo aparece sem responsável na listagem,
        // no dashboard e nos relatórios — todos resolvem por `e_responsavel`.
        if self.e_responsavel && !self.obrigatorio {
            return Err("o papel que responde pelo apuratorio precisa ser obrigatorio".to_string());
        }
        Ok(())
    }
}
