use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserAuthRow {
    pub id: String,
    pub nome: String,
    pub email: Option<String>,
    pub senha: Option<String>,
    pub perfil: Option<String>,
    pub is_operador: Option<bool>,
    pub ativo: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionUser {
    pub id: String,
    pub nome: String,
    pub email: Option<String>,
    pub perfil: String,
    pub is_admin: bool,
}

impl From<UserAuthRow> for SessionUser {
    fn from(row: UserAuthRow) -> Self {
        let perfil = row.perfil.unwrap_or_else(|| "comum".to_string());
        let is_admin = perfil == "admin";

        Self {
            id: row.id,
            nome: row.nome,
            email: row.email,
            perfil,
            is_admin,
        }
    }
}
