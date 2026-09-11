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

/// Escapa o que vai para dentro do HTML do e-mail.
///
/// Não é zelo teórico: o corpo é texto que o administrador digita na tela de
/// catálogos e o nome do militar vem do banco. Um `<` solto em qualquer um dos
/// dois quebraria a marcação no cliente de quem recebe, e um `<script>` digitado
/// por engano viraria conteúdo ativo numa caixa de entrada alheia. Tudo o que é
/// variável passa por aqui; só a moldura é literal.
fn escapar(texto: &str) -> String {
    let mut saida = String::with_capacity(texto.len());
    for c in texto.chars() {
        match c {
            '&' => saida.push_str("&amp;"),
            '<' => saida.push_str("&lt;"),
            '>' => saida.push_str("&gt;"),
            '"' => saida.push_str("&quot;"),
            '\'' => saida.push_str("&#39;"),
            _ => saida.push(c),
        }
    }
    saida
}

/// A moldura HTML do aviso, a partir do MESMO texto puro que vai na outra parte.
///
/// POR QUE O ESTILO É INLINE
///
/// Gmail e Outlook descartam `<style>` de forma inconsistente; atributo `style`
/// é o que todos respeitam. Isso NÃO pode ser reaproveitado na prévia da tela: a
/// CSP do app é `style-src 'self'`, sem `unsafe-inline`, e recusaria o mesmo
/// HTML. A prévia mostra o texto — que é o que o administrador controla e o que
/// pode sair errado; a moldura é fixa.
///
/// POR QUE O ADMINISTRADOR NÃO ESCREVE HTML
///
/// Quem edita a mensagem é um sargento da Seção, não quem programa. Ele digita
/// texto puro, com linhas em branco separando parágrafos, e a moldura é
/// aplicada aqui. Uma convenção só, e tolerante: **parágrafo cujas linhas
/// começam com espaço vira o bloco destacado** — é o formato em que as três
/// mensagens semeadas listam os dados do apuratório. Tirar a indentação não
/// quebra nada: vira parágrafo comum.
pub fn montar_html(corpo: &str) -> String {
    let mut blocos = String::new();
    for paragrafo in corpo.replace("\r\n", "\n").split("\n\n") {
        let linhas: Vec<&str> = paragrafo.lines().filter(|l| !l.trim().is_empty()).collect();
        if linhas.is_empty() {
            continue;
        }
        let destacado = linhas
            .iter()
            .all(|l| l.starts_with(' ') || l.starts_with('\t'));
        let texto = linhas
            .iter()
            .map(|l| escapar(l.trim()))
            .collect::<Vec<_>>()
            .join("<br />");
        if destacado {
            blocos.push_str(&format!(
                "<div style=\"margin:16px 0;padding:12px 16px;background:#f8fafc;\
                 border-left:4px solid #10b981;border-radius:0 6px 6px 0;\
                 font-size:15px;line-height:1.7;color:#1f2937\">{texto}</div>"
            ));
        } else {
            blocos.push_str(&format!(
                "<p style=\"margin:0 0 14px;font-size:15px;line-height:1.65;\
                 color:#1f2937\">{texto}</p>"
            ));
        }
    }

    format!(
        "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\" />\
         <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" /></head>\
         <body style=\"margin:0;padding:24px 12px;background:#eef2f5;\
         font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif\">\
         <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" \
         style=\"margin:0 auto;max-width:640px;width:100%;background:#ffffff;\
         border-radius:10px;overflow:hidden;border:1px solid #d9e0e6\"><tr><td>\
         <div style=\"padding:18px 24px;background:#111827;color:#ffffff\">\
         <div style=\"font-size:16px;font-weight:600;letter-spacing:.02em\">\
         GESTÃO P6 / 7º BPM</div>\
         <div style=\"font-size:13px;color:#9fb0bf;margin-top:2px\">\
         Seção de Justiça e Disciplina</div></div>\
         <div style=\"padding:24px\">{blocos}</div>\
         <div style=\"padding:14px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;\
         font-size:12px;color:#6b7280;line-height:1.5\">\
         Mensagem automática do sistema GESTÃO P6/7º BPM. \
         Não responda a este e-mail &#8212; procure a Seção de Justiça e Disciplina.\
         </div></td></tr></table></body></html>"
    )
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

    /// O corpo vem da tela de catálogos e o nome do militar vem do banco: os
    /// dois são texto de terceiro dentro de HTML que vai para a caixa de
    /// entrada de outra pessoa. Sem escape, um `<` quebra a marcação e um
    /// `<script>` digitado por engano viraria conteúdo ativo lá.
    #[test]
    fn o_texto_de_quem_edita_e_escapado_no_html() {
        let html = montar_html("Fulano & Cia <script>alert(1)</script> \"aspas\"");
        assert!(html.contains("&amp;"), "e comercial cru: {html}");
        assert!(html.contains("&lt;script&gt;"), "tag crua no html");
        assert!(!html.contains("<script>"), "script ativo no e-mail");
        assert!(html.contains("&quot;"));
    }

    /// A convenção é uma só e é tolerante: parágrafo indentado vira o bloco
    /// destacado, e é assim que as três mensagens semeadas listam os dados.
    /// Tirar a indentação não quebra — vira parágrafo comum.
    #[test]
    fn paragrafo_indentado_vira_bloco_destacado_e_o_resto_vira_paragrafo() {
        let html =
            montar_html("Prezado,\n\n  Documento: 012/2026\n  Unidade: 7º BPM\n\nAtenciosamente.");
        assert_eq!(html.matches("border-left:4px solid").count(), 1);
        // As duas linhas do bloco ficam juntas, separadas por quebra.
        assert!(html.contains("Documento: 012/2026<br />Unidade: 7º BPM"));
        // Prezado e Atenciosamente são parágrafos comuns.
        assert_eq!(html.matches("<p style=").count(), 2);
    }

    #[test]
    fn sem_indentacao_nao_ha_bloco_destacado() {
        let html = montar_html("Linha um.\n\nLinha dois.");
        assert!(!html.contains("border-left:4px solid"));
        assert_eq!(html.matches("<p style=").count(), 2);
    }

    /// A moldura é fixa e o conteúdo é o que varia — mas o conteúdo precisa
    /// mesmo estar lá dentro, e não só a moldura.
    #[test]
    fn o_html_carrega_a_moldura_e_o_texto() {
        let html = montar_html("Comparecer à Seção.");
        assert!(html.starts_with("<!doctype html>"));
        assert!(html.contains("Seção de Justiça e Disciplina"));
        assert!(html.contains("Comparecer à Seção."));
        // Estilo inline, e não `<style>`: é o que Gmail e Outlook respeitam.
        assert!(
            !html.contains("<style"),
            "folha de estilo que o cliente descarta"
        );
    }

    #[test]
    fn os_codigos_batem_com_o_check_da_migration() {
        assert_eq!(TipoAviso::Designacao.codigo(), "designacao");
        assert_eq!(TipoAviso::PrazoVencendo.codigo(), "prazo_vencendo");
        assert_eq!(TipoAviso::PrazoVencido.codigo(), "prazo_vencido");
    }
}
