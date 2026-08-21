use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MovementItem {
    pub id: String,
    pub descricao: String,
    pub ocorrido_em: DateTime<Utc>,
    pub tipo_andamento_id: Option<String>,
    pub tipo_andamento: Option<String>,
    /// Autor do andamento. O jsonb legado guardava o nome do usuário e a tabela
    /// que o substituiu havia perdido essa informação; aqui ela volta como FK.
    pub registrado_por_id: Option<String>,
    pub registrado_por: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddMovementRequest {
    pub processo_id: String,
    pub descricao: String,
    /// Classificação vinda do catálogo `tipos_andamento`. Opcional: um andamento
    /// pode ser só texto.
    pub tipo_andamento_id: Option<String>,
    pub ocorrido_em: Option<DateTime<Utc>>,
}

impl AddMovementRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.descricao.trim().is_empty() {
            return Err("descricao do andamento e obrigatoria".to_string());
        }
        Ok(())
    }
}
