use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserAuthRow {
    pub id: String,
    /// Nome de exibição da conta: vem do policial militar vinculado ou, quando a
    /// conta não representa um militar, do próprio `nome_exibicao`.
    pub nome: String,
    pub email: String,
    pub senha_hash: String,
    pub perfil: String,
    /// Autorização vem deste atributo semântico, nunca do nome do perfil — o
    /// administrador pode renomear "Administrador" sem perder o acesso.
    pub pode_administrar: bool,
    pub policial_militar_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionUser {
    pub id: String,
    pub nome: String,
    pub email: String,
    pub perfil: String,
    pub is_admin: bool,
    pub policial_militar_id: Option<String>,
}

impl From<UserAuthRow> for SessionUser {
    fn from(row: UserAuthRow) -> Self {
        Self {
            id: row.id,
            nome: row.nome,
            email: row.email,
            perfil: row.perfil,
            is_admin: row.pode_administrar,
            policial_militar_id: row.policial_militar_id,
        }
    }
}
