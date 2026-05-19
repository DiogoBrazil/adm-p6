use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct AddMovementRequest {
    pub processo_id: String,
    pub texto: String,
}

impl AddMovementRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.texto.trim().is_empty() {
            return Err("Texto do andamento e obrigatorio".to_string());
        }
        Ok(())
    }
}
