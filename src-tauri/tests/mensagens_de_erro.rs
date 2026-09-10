//! As mensagens de `AppError::Domain` seguem a mesma regra das outras — no `cargo test`.
//!
//! POR QUE ESTE TESTE EXISTE
//!
//! `error.rs` declara a regra da casa logo no cabeçalho: nada de vocabulário de
//! implementação na tela, e **toda mensagem diz o que fazer**. E a testa — em
//! `nenhuma_mensagem_publica_vaza_detalhe_tecnico` — para as duas fontes que
//! moram lá dentro: `mensagem_de_constraint` e `mensagem_de_categoria`.
//!
//! A terceira fonte é `AppError::Domain`, e é a maior das três: 82 mensagens
//! espalhadas por oito arquivos, cada uma indo **verbatim** para a tela, porque
//! `message()` devolve a `String` sem tocar nela. Essa nunca teve teste, e
//! derivou: 36 delas chegaram minúsculas e sem pontuação, 10 sem acento —
//! `apuratorio nao encontrado`, `registro nao encontrado`, `o anexo esta vazio`.
//! Uma de cada vez, durante rodadas, sem ninguém reler o conjunto.
//!
//! Regra testada em duas das três fontes é regra que deriva na terceira.
//!
//! POR QUE VARRENDO O FONTE
//!
//! As mensagens não são uma função que dê para chamar: são literais em 82
//! pontos de decisão, muitos dentro de `format!`. Alcançá-las de outro jeito
//! exigiria exercitar os 82 caminhos de erro. `tests/sql_prepare.rs` já resolve
//! o mesmo tipo de problema do mesmo jeito — ler o código-fonte e cobrar a
//! regra —, então isto não é técnica nova aqui.

use std::path::{Path, PathBuf};

/// Um literal encontrado, com a origem, para a falha dizer onde consertar.
struct Mensagem {
    arquivo: String,
    linha: usize,
    texto: String,
}

fn arquivos_rs(raiz: &Path, destino: &mut Vec<PathBuf>) {
    for entrada in std::fs::read_dir(raiz).expect("ler diretório de fontes") {
        let caminho = entrada.expect("entrada de diretório").path();
        if caminho.is_dir() {
            arquivos_rs(&caminho, destino);
        } else if caminho.extension().is_some_and(|e| e == "rs") {
            destino.push(caminho);
        }
    }
}

/// O literal que segue um `AppError::Domain(`, com ou sem `format!` no meio.
///
/// Só o **primeiro** literal interessa: é ele que carrega a frase. O que vem
/// depois num `format!` são os argumentos, que são expressões, não texto.
fn primeiro_literal(resto: &str) -> Option<String> {
    let mut chars = resto.char_indices().peekable();
    // Pula espaço, `format!(` e o que mais separe o parêntese da aspa.
    let inicio = loop {
        let (i, c) = *chars.peek()?;
        if c == '"' {
            break i + 1;
        }
        // Uma vírgula ou fechamento antes da aspa significa que o argumento não
        // é literal (uma variável, um `.into()` sobre expressão) — nada a cobrar.
        if c == ',' || c == ')' || c == ';' {
            return None;
        }
        chars.next();
    };
    let bytes = resto.as_bytes();
    let mut fim = inicio;
    while fim < bytes.len() {
        match bytes[fim] {
            b'\\' => fim += 2,
            b'"' => return Some(resto[inicio..fim].to_string()),
            _ => fim += 1,
        }
    }
    None
}

fn mensagens_de_dominio() -> Vec<Mensagem> {
    let raiz = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut arquivos = Vec::new();
    arquivos_rs(&raiz, &mut arquivos);
    arquivos.sort();

    let mut achadas = Vec::new();
    for arquivo in arquivos {
        let conteudo = std::fs::read_to_string(&arquivo).expect("ler fonte");
        let nome = arquivo
            .strip_prefix(&raiz)
            .unwrap_or(&arquivo)
            .display()
            .to_string();
        let mut cursor = 0;
        while let Some(pos) = conteudo[cursor..].find("AppError::Domain(") {
            let absoluto = cursor + pos + "AppError::Domain(".len();
            if let Some(texto) = primeiro_literal(&conteudo[absoluto..]) {
                achadas.push(Mensagem {
                    arquivo: nome.clone(),
                    linha: conteudo[..absoluto].matches('\n').count() + 1,
                    texto,
                });
            }
            cursor = absoluto;
        }
    }
    achadas
}

/// A varredura tem de estar achando as mensagens de verdade.
///
/// Sem este piso, um erro no reconhecimento do literal faria a lista vir vazia e
/// **todos** os outros testes deste arquivo passariam sem examinar nada — que é
/// o modo clássico de um teste de varredura mentir.
#[test]
fn a_varredura_alcanca_as_mensagens_de_dominio() {
    let mensagens = mensagens_de_dominio();
    assert!(
        mensagens.len() >= 70,
        "a varredura achou só {} mensagens de domínio; o reconhecimento do literal quebrou",
        mensagens.len()
    );
}

/// A forma: frase para gente, não linha de log.
#[test]
fn toda_mensagem_de_dominio_e_uma_frase() {
    let mut falhas = Vec::new();
    for m in mensagens_de_dominio() {
        // Frase que abre com um argumento de `format!` tem a primeira letra
        // decidida pelo valor — o nome de um militar, uma sigla —, e não pelo
        // literal. Cobrar maiúscula aqui reprovaria mensagem correta.
        let abre_com_argumento = m.texto.starts_with('{');
        let primeira = m.texto.chars().next();
        if !abre_com_argumento && !primeira.is_some_and(char::is_uppercase) {
            falhas.push(format!(
                "{}:{} não começa com maiúscula — {:?}",
                m.arquivo, m.linha, m.texto
            ));
        }
        if !m.texto.trim_end().ends_with(['.', '?', '!']) {
            falhas.push(format!(
                "{}:{} não termina em pontuação — {:?}",
                m.arquivo, m.linha, m.texto
            ));
        }
    }
    assert!(
        falhas.is_empty(),
        "{} mensagem(ns) de domínio fora do padrão de `error.rs`:\n{}",
        falhas.len(),
        falhas.join("\n")
    );
}

/// O acento não é enfeite: é o que separa texto escrito para o usuário de texto
/// escrito às pressas. Nenhuma destas é português correto como palavra inteira,
/// e todas apareceram de verdade nas mensagens que este teste veio corrigir.
#[test]
fn nenhuma_mensagem_de_dominio_perde_acento() {
    const SEM_ACENTO: [&str; 12] = [
        "nao",
        "apuratorio",
        "conteudo",
        "solucao",
        "periodo",
        "numero",
        "obrigatorio",
        "invalido",
        "usuario",
        "policia",
        "codigo",
        "orgao",
    ];
    let mut falhas = Vec::new();
    for m in mensagens_de_dominio() {
        let minuscula = m.texto.to_lowercase();
        for palavra in SEM_ACENTO {
            let acha = minuscula
                .split(|c: char| !c.is_alphanumeric())
                .any(|p| p == palavra);
            if acha {
                falhas.push(format!(
                    "{}:{} usa {:?} sem acento — {:?}",
                    m.arquivo, m.linha, palavra, m.texto
                ));
            }
        }
    }
    assert!(
        falhas.is_empty(),
        "{} ocorrência(s) sem acento:\n{}",
        falhas.len(),
        falhas.join("\n")
    );
}

/// A mesma lista de proibidos de `error.rs`, agora valendo para a terceira fonte.
#[test]
fn nenhuma_mensagem_de_dominio_vaza_detalhe_tecnico() {
    const PROIBIDOS: [&str; 14] = [
        "constraint",
        "sqlx",
        "postgres",
        "uq_",
        "ck_",
        "fk_",
        "ex_",
        "pkey",
        "bcrypt",
        "panic",
        "unwrap",
        "base64",
        "violates",
        "/home/",
    ];
    let mut falhas = Vec::new();
    for m in mensagens_de_dominio() {
        let minuscula = m.texto.to_lowercase();
        for proibido in PROIBIDOS {
            if minuscula.contains(proibido) {
                falhas.push(format!(
                    "{}:{} carrega {:?} — {:?}",
                    m.arquivo, m.linha, proibido, m.texto
                ));
            }
        }
    }
    assert!(
        falhas.is_empty(),
        "{} mensagem(ns) com vocabulário de implementação:\n{}",
        falhas.len(),
        falhas.join("\n")
    );
}
