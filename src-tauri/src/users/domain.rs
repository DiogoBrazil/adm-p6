use chrono::NaiveDate;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

fn is_valid_email(email: &str) -> bool {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re =
        RE.get_or_init(|| Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap());
    re.is_match(email)
}

/// Um policial militar cadastrado. `conta_*` só vem preenchido para os poucos
/// militares que também operam o sistema — no banco legado eram 7 de 236.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserListItem {
    pub id: String,
    pub nome: String,
    pub matricula: String,
    pub posto_graduacao_id: String,
    pub posto_graduacao: String,
    pub posto_graduacao_sigla: String,
    pub circulo_hierarquico: String,
    pub is_encarregado: bool,
    pub ativo: bool,
    pub conta_id: Option<String>,
    pub conta_email: Option<String>,
    pub conta_perfil_id: Option<String>,
    pub conta_perfil: Option<String>,
    pub conta_ativa: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct UserFormSchema {
    pub title: &'static str,
    pub admin_only: bool,
    pub fields: Vec<&'static str>,
    pub validations: Vec<&'static str>,
}

/// Dados de acesso. Ausente = o militar não opera o sistema; presente = a conta é
/// criada ou atualizada junto, na mesma transação.
#[derive(Debug, Deserialize)]
pub struct SaveAccountRequest {
    pub email: String,
    pub perfil_id: String,
    /// Obrigatória ao criar a conta; ausente numa edição mantém a senha atual.
    pub senha: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SaveUserRequest {
    /// Identidade do policial militar. Ausente = cadastro novo.
    pub id: Option<String>,
    pub nome: String,
    pub matricula: String,
    /// Catálogo resolvido por id, nunca por nome — renomear um posto não pode
    /// quebrar o cadastro.
    pub posto_graduacao_id: String,
    pub is_encarregado: bool,
    pub conta: Option<SaveAccountRequest>,
}

impl SaveUserRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.nome.trim().is_empty() {
            return Err("Informe o nome do policial militar.".to_string());
        }
        // Formato administrativo da matrícula na PMRO. Fica na camada de domínio,
        // e não como CHECK, para não impedir a importação de registros históricos
        // que eventualmente não o sigam.
        let matricula = self.matricula.trim();
        if matricula.len() != 9 {
            return Err("A matrícula precisa ter exatamente 9 caracteres.".to_string());
        }
        if !matricula.starts_with("1000") && !matricula.starts_with("3000") {
            return Err("A matrícula precisa começar com 1000 ou 3000.".to_string());
        }
        if self.posto_graduacao_id.trim().is_empty() {
            return Err("Escolha o posto ou graduação do policial militar.".to_string());
        }
        if let Some(conta) = &self.conta {
            if !is_valid_email(conta.email.trim()) {
                return Err("Informe um e-mail válido para a conta de acesso.".to_string());
            }
            if conta.perfil_id.trim().is_empty() {
                return Err("Escolha o perfil de acesso da conta.".to_string());
            }
            if let Some(senha) = conta.senha.as_deref() {
                if !senha.is_empty() && senha.len() < 4 {
                    return Err("A senha precisa ter pelo menos 4 caracteres.".to_string());
                }
            }
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
pub struct SaveUserResult {
    pub id: String,
    pub conta_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserListResult {
    pub items: Vec<UserListItem>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

/// Contagem rotulada. Substitui os 14 contadores fixos da versão anterior
/// (`encarregado_sindicancia`, `encarregado_pads`, ...), que só funcionavam
/// enquanto os apuratórios fossem exatamente aqueles dez.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ContagemRotulada {
    pub id: String,
    pub rotulo: String,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct UserStatistics {
    /// Quantas designações o militar teve em cada papel (encarregado, escrivão…).
    pub designacoes_por_papel: Vec<ContagemRotulada>,
    /// Quantas designações em cada espécie de apuratório.
    pub designacoes_por_apuratorio: Vec<ContagemRotulada>,
    /// Em quantos processos figurou com cada status de envolvido.
    pub envolvimentos_por_status: Vec<ContagemRotulada>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserProcessItem {
    pub id: String,
    pub apuratorio_id: String,
    pub apuratorio_sigla: String,
    pub apuratorio_nome: String,
    pub tipo_apuratorio: String,
    pub numero_documento: String,
    pub numero_controle: String,
    pub resumo_fatos: Option<String>,
    pub data_instauracao: NaiveDate,
    pub data_conclusao: Option<NaiveDate>,
    /// Papel exercido, quando a listagem é de designações.
    pub papel: Option<String>,
    /// Status no processo, quando a listagem é de envolvimentos.
    pub status_envolvido: Option<String>,
}
