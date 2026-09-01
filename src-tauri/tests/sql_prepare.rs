//! Todo SQL literal do código é validado contra o schema — no `cargo test`.
//!
//! POR QUE ISTO, E NÃO `sqlx::query!`
//!
//! O item 8.3 do guia previa migrar as consultas estáticas para as macros do
//! sqlx, que verificam o SQL em tempo de compilação. Medido no código, isso
//! alcança **9 das 128 consultas**. O obstáculo não é o SQL dinâmico que o guia
//! antecipava: é o tipo do parâmetro. 79 das consultas literais ligam um id com
//! `$n::uuid`, e a macro então exige `uuid::Uuid` no lugar do `String` que a
//! aplicação carrega de ponta a ponta — os ids chegam do frontend como texto
//! JSON, atravessam os structs de request e as assinaturas dos repositórios
//! assim. Trocar isso é decisão de design, não trabalho mecânico.
//!
//! Este teste alcança as 88 literais, com uuid ou sem. Ele faz o mesmo que a
//! macro faria — pedir ao PostgreSQL que analise a consulta — só que no
//! `cargo test` em vez de no `cargo build`. Erro de digitação em nome de
//! coluna, tabela inexistente, parêntese solto ou tipo incompatível param aqui.
//!
//! **O que ele NÃO alcança:** as 40 consultas montadas em `format!` (o CRUD
//! genérico de catálogos e os filtros compostos). Essas só são exercidas
//! executando o código — é o que os outros arquivos de teste fazem, e o teste
//! `toda_consulta_dinamica_e_exercitada_por_algum_teste` cobra que continue
//! assim.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

mod util;

/// Uma consulta encontrada no código-fonte.
struct Consulta {
    arquivo: String,
    linha: usize,
    /// `Some` = SQL literal, analisável pelo PostgreSQL sem executar nada.
    /// `None` = montada em tempo de execução; só a execução a valida.
    sql: Option<String>,
    /// Função que contém a chamada, como `modulo::submodulo::nome`.
    funcao: String,
}

/// Extrai o SQL literal de cada `sqlx::query*(...)`.
///
/// Só reconhece literal — `format!(...)` e variável ficam de fora de propósito:
/// aquele SQL não existe até rodar, e é por isso que o outro teste deste
/// arquivo cobra cobertura de execução para ele.
fn consultas_do_arquivo(caminho: &Path) -> Vec<Consulta> {
    let texto = std::fs::read_to_string(caminho).expect("ler fonte");
    let bytes = texto.as_bytes();
    let modulo = caminho
        .strip_prefix("src")
        .unwrap_or(caminho)
        .with_extension("")
        .to_string_lossy()
        .trim_start_matches(['/', '\\'])
        .replace(['/', '\\'], "::");
    let mut achados = Vec::new();
    let mut i = 0;

    while let Some(pos) = texto[i..].find("sqlx::query") {
        let inicio = i + pos;
        i = inicio + "sqlx::query".len();

        // Pula o sufixo (`_as`, `_scalar`) e o turbofish, até o parêntese.
        let Some(abre) = texto[i..].find('(') else {
            break;
        };
        let entre = &texto[i..i + abre];
        if !entre
            .chars()
            .all(|c| c.is_alphanumeric() || "_:<>&,' ".contains(c))
        {
            continue; // não era uma chamada de consulta
        }
        let mut j = i + abre + 1;
        while bytes.get(j).is_some_and(|b| b.is_ascii_whitespace()) {
            j += 1;
        }

        let sql = if texto[j..].starts_with("r#\"") {
            let corpo = j + 3;
            let fim = texto[corpo..].find("\"#").map(|f| corpo + f);
            fim.map(|fim| texto[corpo..fim].to_string())
        } else if bytes.get(j) == Some(&b'"') {
            let mut k = j + 1;
            let mut buf = String::new();
            loop {
                match bytes.get(k) {
                    None => break,
                    Some(b'\\') => {
                        // Escape: mantém o caractere seguinte como está.
                        if let Some(&c) = bytes.get(k + 1) {
                            buf.push(c as char);
                        }
                        k += 2;
                    }
                    Some(b'"') => break,
                    Some(&c) => {
                        buf.push(c as char);
                        k += 1;
                    }
                }
            }
            Some(buf)
        } else {
            None // montada em tempo de execução
        };

        achados.push(Consulta {
            arquivo: caminho.display().to_string(),
            linha: texto[..inicio].matches('\n').count() + 1,
            sql,
            funcao: format!("{modulo}::{}", funcao_que_contem(&texto, inicio)),
        });
    }
    achados
}

/// Nome da função de MÓDULO que contém `posicao`.
///
/// Só considera declaração sem indentação: uma função aninhada dentro de outra
/// (`by_solution` tem uma `contar` interna) é atribuída à externa, que é a que
/// os testes chamam.
fn funcao_que_contem(texto: &str, posicao: usize) -> String {
    texto[..posicao]
        .lines()
        .rev()
        .find_map(|linha| {
            for prefixo in ["pub async fn ", "pub fn ", "async fn ", "fn "] {
                if let Some(resto) = linha.strip_prefix(prefixo) {
                    return resto.split(['(', '<']).next().map(str::to_string);
                }
            }
            None
        })
        .unwrap_or_else(|| "?".to_string())
}

fn fontes() -> Vec<PathBuf> {
    fn caminhar(dir: &Path, saida: &mut Vec<PathBuf>) {
        for entrada in std::fs::read_dir(dir).expect("ler diretorio").flatten() {
            let caminho = entrada.path();
            if caminho.is_dir() {
                caminhar(&caminho, saida);
            } else if caminho.extension().is_some_and(|e| e == "rs") {
                saida.push(caminho);
            }
        }
    }
    let mut saida = Vec::new();
    caminhar(Path::new("src"), &mut saida);
    saida.sort();
    saida
}

/// O PostgreSQL analisa cada consulta: nome de coluna, tabela, tipo de
/// parâmetro. É a mesma verificação que `sqlx::query!` faz, movida para cá.
#[tokio::test]
async fn todo_sql_literal_e_analisado_pelo_postgres() {
    util::com_banco_descartavel("sql_prepare", |pool| async move {
        let consultas: Vec<Consulta> = fontes()
            .iter()
            .flat_map(|f| consultas_do_arquivo(f))
            .filter(|c| c.sql.is_some())
            .collect();

        assert!(
            consultas.len() >= 80,
            "o extrator achou so {} consultas — se o codigo mudou de forma, \
             conserte o extrator em vez de deixar o teste passar vazio",
            consultas.len()
        );

        let mut falhas = Vec::new();
        for (n, consulta) in consultas.iter().enumerate() {
            let nome = format!("analise_{n}");
            let literal = consulta.sql.as_deref().expect("filtrado acima");
            let sql = format!("PREPARE {nome} AS {literal}");
            if let Err(erro) = sqlx::raw_sql(&sql).execute(&pool).await {
                let primeira = literal.trim().lines().next().unwrap_or("").trim();
                falhas.push(format!(
                    "  {}:{}\n    {}\n    → {erro}",
                    consulta.arquivo, consulta.linha, primeira
                ));
            }
        }

        assert!(
            falhas.is_empty(),
            "{} de {} consultas nao passam pelo PostgreSQL:\n{}",
            falhas.len(),
            consultas.len(),
            falhas.join("\n")
        );
    })
    .await;
}

/// O SQL montado em tempo de execução não existe até rodar, então a única
/// verificação possível é executá-lo. Este teste cobra que toda função que
/// monte SQL assim seja exercitada por algum teste — se alguém acrescentar uma
/// e esquecer, aparece aqui em vez de aparecer para o usuário.
///
/// A lista não é levantada por heurística de texto: vem do mesmo extrator que
/// alimenta o teste de PREPARE, que sabe exatamente quais chamadas não tinham
/// literal. Por isso o teste cobra os dois lados — função sem teste e entrada
/// que ficou para trás.
#[test]
fn toda_consulta_dinamica_e_exercitada_por_algum_teste() {
    /// Arquivo de teste → funções com SQL dinâmico que ele executa.
    const COBERTURA: &[(&str, &[&str])] = &[
        (
            "audit_repository",
            &[
                "audit::repository::list",
                "audit::repository::get_by_id",
                "audit::repository::list_by_record",
                "audit::repository::list_by_user",
                "audit::repository::statistics",
            ],
        ),
        (
            "deadlines_repository",
            &[
                "deadlines::repository::list",
                "deadlines::repository::dashboard",
                "deadlines::repository::report",
            ],
        ),
        (
            "evidence_repository",
            &[
                "evidence::repository::search_infracoes_penais",
                "evidence::repository::search_transgressoes",
                "evidence::repository::search_infracoes_estatuto",
                "evidence::repository::load_for_envolvido",
                "evidence::repository::save_acusacoes",
                "evidence::repository::remove_for_envolvido",
            ],
        ),
        (
            "legal_catalogs_repository",
            &[
                "legal_catalogs::repository::list",
                "legal_catalogs::repository::get",
                "legal_catalogs::repository::save",
                "legal_catalogs::repository::set_ativo",
                "legal_catalogs::repository::delete",
                "legal_catalogs::repository::search",
                // O SQL vem de `Catalogo::assunto_sql`, e não de um `format!` —
                // mas continua sendo string vinda de variável, e por isso o
                // `PREPARE` automático não o alcança. Quem cobre os 26 é
                // `todo_catalogo_sabe_dizer_o_assunto_de_uma_linha`.
                "audit::assunto::de_catalogo",
            ],
        ),
        (
            "maps_reports_repository",
            &[
                "maps_reports::repository::list_saved_maps",
                "maps_reports::repository::get_saved_map",
                "maps_reports::repository::status_by_apuratorio",
                "maps_reports::repository::by_solution",
                "maps_reports::repository::by_evidence_category",
                "maps_reports::repository::transgressoes",
                "maps_reports::repository::infracoes_estatuto",
                "maps_reports::repository::infracoes_penais",
                "maps_reports::repository::designations_matrix",
            ],
        ),
        (
            "proceedings_repository",
            &[
                "proceedings::repository::list",
                "proceedings::repository::get",
            ],
        ),
        (
            "users_repository",
            &[
                "users::repository::list_paginated",
                "users::repository::get_by_id",
                "users::repository::list_ativos",
                "users::repository::list_encarregados",
                "users::repository::proceedings_as_designated",
                "users::repository::proceedings_as_involved",
            ],
        ),
    ];

    let dinamicas: BTreeSet<String> = fontes()
        .iter()
        .flat_map(|f| consultas_do_arquivo(f))
        .filter(|c| c.sql.is_none())
        .map(|c| c.funcao)
        .collect();
    let listadas: BTreeSet<String> = COBERTURA
        .iter()
        .flat_map(|(_, funcoes)| funcoes.iter().map(|f| f.to_string()))
        .collect();

    let juntar = |itens: Vec<&String>| {
        itens
            .iter()
            .map(|f| f.as_str())
            .collect::<Vec<_>>()
            .join("\n  ")
    };

    let sem_teste: Vec<&String> = dinamicas.difference(&listadas).collect();
    assert!(
        sem_teste.is_empty(),
        "estas funcoes montam SQL em tempo de execucao e nao constam da lista de \
         cobertura. Escreva um teste que as execute e liste-as aqui:\n  {}",
        juntar(sem_teste)
    );

    let a_toa: Vec<&String> = listadas.difference(&dinamicas).collect();
    assert!(
        a_toa.is_empty(),
        "estas funcoes estao na lista mas nao montam mais SQL dinamico — \
         a lista ficou para tras:\n  {}",
        juntar(a_toa)
    );

    for (arquivo, _) in COBERTURA {
        let caminho = format!("tests/{arquivo}.rs");
        assert!(
            Path::new(&caminho).exists(),
            "{caminho} nao existe, mas e citado na lista de cobertura"
        );
    }
}
