use serde::Deserialize;

const TIPOS_VALIDOS: &[&str] = &[
    "Despacho",
    "Distribuição",
    "Juntada",
    "Remessa",
    "Retorno",
    "Decisão",
    "Notificação",
    "Citação",
    "Prorrogação",
    "Conclusão",
    "Outros",
];

#[derive(Debug, Deserialize)]
pub struct AddMovementRequest {
    pub processo_id: String,
    pub tipo: Option<String>,
    pub texto: String,
    pub usuario: Option<String>,
}

impl AddMovementRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.texto.trim().is_empty() {
            return Err("Texto do andamento e obrigatorio".to_string());
        }
        if let Some(tipo) = &self.tipo {
            if !TIPOS_VALIDOS.contains(&tipo.as_str()) {
                return Err(format!(
                    "Tipo de andamento invalido. Permitidos: {}",
                    TIPOS_VALIDOS.join(", ")
                ));
            }
        }
        Ok(())
    }
}
