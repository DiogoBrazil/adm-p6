use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserListItem {
    pub id: String,
    pub nome: String,
    pub matricula: String,
    pub posto_graduacao: String,
    pub tipo_usuario: String,
    pub email: Option<String>,
    pub perfil: Option<String>,
    pub is_encarregado: Option<bool>,
    pub is_operador: Option<bool>,
    pub ativo: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct UserFormSchema {
    pub title: &'static str,
    pub admin_only: bool,
    pub fields: Vec<&'static str>,
    pub validations: Vec<&'static str>,
}

#[derive(Debug, Deserialize)]
pub struct SaveUserRequest {
    pub id: Option<String>,
    pub tipo_usuario: String,
    pub posto_graduacao: String,
    pub nome: String,
    pub matricula: String,
    pub is_encarregado: bool,
    pub is_operador: bool,
    pub email: Option<String>,
    pub perfil: Option<String>,
    pub senha: Option<String>,
}

impl SaveUserRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.nome.trim().is_empty() {
            return Err("nome e obrigatorio".to_string());
        }
        if self.matricula.trim().is_empty() {
            return Err("matricula e obrigatoria".to_string());
        }
        if self.is_operador {
            if self.email.as_deref().unwrap_or("").trim().is_empty() {
                return Err("email e obrigatorio para operador".to_string());
            }
            if self.perfil.as_deref().unwrap_or("").trim().is_empty() {
                return Err("perfil e obrigatorio para operador".to_string());
            }
            if self.id.is_none() && self.senha.as_deref().unwrap_or("").len() < 4 {
                return Err("senha minima de 4 caracteres para operador".to_string());
            }
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
pub struct SaveUserResult {
    pub id: String,
}

#[derive(Debug, Serialize)]
pub struct UserListResult {
    pub items: Vec<UserListItem>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Serialize)]
pub struct UserStatistics {
    pub encarregado_sindicancia: i64,
    pub encarregado_pads: i64,
    pub encarregado_ipm: i64,
    pub encarregado_feito_preliminar: i64,
    pub encarregado_cp: i64,
    pub encarregado_pad: i64,
    pub encarregado_pade: i64,
    pub encarregado_cd: i64,
    pub encarregado_cj: i64,
    pub escrivao: i64,
    pub envolvido_sindicado: i64,
    pub envolvido_acusado: i64,
    pub envolvido_indiciado: i64,
    pub envolvido_investigado: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserProcessItem {
    pub id: String,
    pub tipo_geral: Option<String>,
    pub tipo_detalhe: Option<String>,
    pub numero: Option<String>,
    pub resumo_fatos: Option<String>,
    pub data_instauracao: Option<NaiveDate>,
    pub data_conclusao: Option<NaiveDate>,
    pub concluido: Option<bool>,
}
