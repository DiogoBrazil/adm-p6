use serde::Deserialize;
use serde_json::Value;

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

pub fn normalize_andamentos(list: Vec<Value>) -> Vec<Value> {
    list.into_iter().map(|v| {
        let Value::Object(mut obj) = v else { return v; };
        let missing_texto = obj.get("texto").map(|v| v.is_null()).unwrap_or(true);
        if missing_texto {
            let text = obj.get("descricao").cloned()
                .filter(|v| !v.is_null())
                .or_else(|| obj.get("descricao_andamento").cloned().filter(|v| !v.is_null()))
                .or_else(|| obj.get("observacoes").cloned().filter(|v| !v.is_null()))
                .unwrap_or_else(|| Value::String(String::new()));
            obj.insert("texto".to_string(), text);
        }
        let missing_usuario = obj.get("usuario").map(|v| v.is_null()).unwrap_or(true);
        if missing_usuario {
            let user = obj.get("usuario_nome").cloned()
                .filter(|v| !v.is_null())
                .unwrap_or_else(|| Value::String("Sistema".to_string()));
            obj.insert("usuario".to_string(), user);
        }
        Value::Object(obj)
    }).collect()
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
