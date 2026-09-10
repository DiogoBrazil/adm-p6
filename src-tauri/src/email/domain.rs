//! O que se manda, e para quem — sem tocar em rede.
//!
//! A montagem do texto mora aqui, separada do envio, porque é a única parte
//! deste módulo que um teste alcança sem servidor SMTP. `repository.rs` lê o
//! banco, `commands.rs` fala com a tela, e o envio propriamente dito fica atrás
//! de um trait — mesmo desenho de `database_config.rs::SetupBackend`.

use serde::{Deserialize, Serialize};

/// Qual dos três avisos. É o `codigo` da tabela `mensagens_email`, e não o nome:
/// nome é apresentação e o administrador pode renomeá-lo (princípio 2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TipoAviso {
    Designacao,
    PrazoVencendo,
    PrazoVencido,
}

impl TipoAviso {
    pub fn codigo(self) -> &'static str {
        match self {
            Self::Designacao => "designacao",
            Self::PrazoVencendo => "prazo_vencendo",
            Self::PrazoVencido => "prazo_vencido",
        }
    }
}

/// Os dados do apuratório que os marcadores podem citar.
///
/// Campos vazios viram "não informado" em vez de sumirem: um aviso que diz
/// "Prazo de vencimento:" seguido de nada parece defeito do sistema para quem
/// recebe, e não é — é apuratório sem recebimento informado, que existe.
#[derive(Debug, Clone, Default)]
pub struct DadosDoAviso {
    pub encarregado: String,
    pub apuratorio: String,
    pub numero_documento: String,
    pub unidade: String,
    pub data_instauracao: String,
    pub prazo_vencimento: Option<String>,
}

const NAO_INFORMADO: &str = "não informado";

/// Os marcadores que a montagem conhece. É a mesma lista que o `efeito` da
/// coluna `corpo` mostra ao administrador — se uma mudar, a outra muda junto.
pub const MARCADORES: [&str; 6] = [
    "encarregado",
    "apuratorio",
    "numero_documento",
    "unidade",
    "data_instauracao",
    "prazo_vencimento",
];

/// Substitui os marcadores conhecidos. O desconhecido fica **literal**.
///
/// Deixar literal é deliberado, e a alternativa é pior: apagar o que não se
/// reconhece sumiria com o erro de digitação do administrador sem que ninguém
/// visse, e o e-mail sairia com uma frase truncada. Ficando à vista, a prévia o
/// denuncia antes do envio — que é a razão de a prévia existir.
///
/// Uma passada só, sobre o texto original: substituir em cadeia faria o valor de
/// um marcador ser reinterpretado como marcador se o nome do encarregado
/// contivesse chaves.
pub fn aplicar_marcadores(texto: &str, dados: &DadosDoAviso) -> String {
    let valor = |nome: &str| -> Option<String> {
        Some(match nome {
            "encarregado" => vazio_vira_padrao(&dados.encarregado),
            "apuratorio" => vazio_vira_padrao(&dados.apuratorio),
            "numero_documento" => vazio_vira_padrao(&dados.numero_documento),
            "unidade" => vazio_vira_padrao(&dados.unidade),
            "data_instauracao" => vazio_vira_padrao(&dados.data_instauracao),
            "prazo_vencimento" => dados
                .prazo_vencimento
                .as_deref()
                .map(vazio_vira_padrao)
                .unwrap_or_else(|| NAO_INFORMADO.to_string()),
            _ => return None,
        })
    };

    let mut saida = String::with_capacity(texto.len());
    let mut resto = texto;
    while let Some(inicio) = resto.find('{') {
        saida.push_str(&resto[..inicio]);
        let depois = &resto[inicio + 1..];
        match depois.find('}') {
            Some(fim) => {
                let nome = &depois[..fim];
                match valor(nome) {
                    Some(v) => saida.push_str(&v),
                    // Desconhecido: devolve as chaves como estavam.
                    None => {
                        saida.push('{');
                        saida.push_str(nome);
                        saida.push('}');
                    }
                }
                resto = &depois[fim + 1..];
            }
            // Chave aberta e nunca fechada — texto comum, não marcador.
            None => {
                saida.push('{');
                resto = depois;
            }
        }
    }
    saida.push_str(resto);
    saida
}

fn vazio_vira_padrao(valor: &str) -> String {
    if valor.trim().is_empty() {
        NAO_INFORMADO.to_string()
    } else {
        valor.trim().to_string()
    }
}

/// O e-mail pronto, como a prévia mostra e como o envio manda. São os mesmos
/// campos nos dois caminhos de propósito: o que a pessoa aprova é o que sai.
#[derive(Debug, Clone, Serialize)]
pub struct AvisoMontado {
    pub destinatario: String,
    pub destinatario_nome: String,
    pub assunto: String,
    pub corpo: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dados() -> DadosDoAviso {
        DadosDoAviso {
            encarregado: "TEN PM JOÃO".into(),
            apuratorio: "Sindicância Regular".into(),
            numero_documento: "012/2026".into(),
            unidade: "7º BPM".into(),
            data_instauracao: "10/03/2026".into(),
            prazo_vencimento: Some("09/04/2026".into()),
        }
    }

    #[test]
    fn substitui_os_marcadores_conhecidos() {
        let texto = "{encarregado}, o {apuratorio} {numero_documento} de {unidade} \
                     instaurado em {data_instauracao} vence em {prazo_vencimento}.";
        assert_eq!(
            aplicar_marcadores(texto, &dados()),
            "TEN PM JOÃO, o Sindicância Regular 012/2026 de 7º BPM \
             instaurado em 10/03/2026 vence em 09/04/2026."
        );
    }

    /// Apagar o que não se reconhece esconderia o erro de digitação do
    /// administrador; deixando à vista, a prévia o mostra antes do envio.
    #[test]
    fn marcador_desconhecido_fica_literal() {
        let saida = aplicar_marcadores("Olá {encarregado}, veja {inventado}.", &dados());
        assert_eq!(saida, "Olá TEN PM JOÃO, veja {inventado}.");
    }

    #[test]
    fn chave_solta_nao_e_marcador() {
        assert_eq!(
            aplicar_marcadores("Use { com cuidado } e {encarregado}", &dados()),
            "Use { com cuidado } e TEN PM JOÃO"
        );
    }

    /// Sem recebimento informado não há linha em `processo_prazos`, e isso é
    /// estado válido — não é falha. Some do texto seria pior que dizer.
    #[test]
    fn prazo_ausente_vira_frase_e_nao_vazio() {
        let mut d = dados();
        d.prazo_vencimento = None;
        let saida = aplicar_marcadores("Vence em {prazo_vencimento}.", &d);
        assert_eq!(saida, "Vence em não informado.");
    }

    /// O valor substituído não pode ser relido como marcador.
    #[test]
    fn valor_com_chaves_nao_e_reinterpretado() {
        let mut d = dados();
        d.encarregado = "{apuratorio}".into();
        assert_eq!(
            aplicar_marcadores("{encarregado}", &d),
            "{apuratorio}",
            "o valor foi reinterpretado como marcador"
        );
    }

    #[test]
    fn os_codigos_batem_com_o_check_da_migration() {
        assert_eq!(TipoAviso::Designacao.codigo(), "designacao");
        assert_eq!(TipoAviso::PrazoVencendo.codigo(), "prazo_vencendo");
        assert_eq!(TipoAviso::PrazoVencido.codigo(), "prazo_vencido");
    }
}
