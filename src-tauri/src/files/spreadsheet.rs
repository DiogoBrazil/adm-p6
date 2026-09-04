//! Geração centralizada das planilhas dos relatórios.
//!
//! CSV não carrega largura, tipo, aba, filtro, congelamento nem cor. As telas
//! montam um modelo declarativo pequeno e este módulo produz o XLSX com uma
//! convenção só. Texto é sempre escrito por `write_string_with_format`: além
//! de preservar matrícula e número com zeros, isto impede que um valor vindo
//! do banco e iniciado por `=`, `+`, `-` ou `@` vire fórmula ao abrir no Excel.

use std::collections::HashSet;

use chrono::{DateTime, FixedOffset, NaiveDate, NaiveDateTime};
use rust_xlsxwriter::{Color, Format, FormatAlign, FormatBorder, Workbook, Worksheet};
use serde_json::Value;

use crate::error::AppError;
use crate::files::domain::{
    SpreadsheetAlignment, SpreadsheetColumn, SpreadsheetColumnType, SpreadsheetRequest,
    SpreadsheetSheet, SpreadsheetTone,
};

const MAX_ABAS: usize = 32;
const MAX_COLUNAS: usize = 128;
const MAX_LINHAS: usize = 5_000;

const AZUL_MARINHO: &str = "#0B1F3A";
const BORDA: &str = "#CFD6DF";
const FAIXA: &str = "#F4F6F8";

pub fn gerar(request: &SpreadsheetRequest) -> Result<Vec<u8>, AppError> {
    validar(request)?;

    let mut workbook = Workbook::new();
    workbook.use_excel_2023_theme().map_err(erro_xlsx)?;

    for aba in &request.abas {
        escrever_aba(workbook.add_worksheet(), aba).map_err(erro_xlsx)?;
    }

    workbook.save_to_buffer().map_err(erro_xlsx)
}

pub fn nome_xlsx(nome: &str) -> Result<String, AppError> {
    let nome = nome.trim();
    if nome.is_empty() || nome.contains(['/', '\\']) {
        return Err(AppError::Interno(
            "nome sugerido invalido para a planilha".to_string(),
        ));
    }
    if nome.to_ascii_lowercase().ends_with(".xlsx") {
        Ok(nome.to_string())
    } else {
        let base = nome.rsplit_once('.').map(|(base, _)| base).unwrap_or(nome);
        Ok(format!("{base}.xlsx"))
    }
}

fn validar(request: &SpreadsheetRequest) -> Result<(), AppError> {
    nome_xlsx(&request.nome_sugerido)?;
    if request.abas.is_empty() || request.abas.len() > MAX_ABAS {
        return Err(invalida("quantidade de abas fora do limite"));
    }

    let mut nomes = HashSet::new();
    for aba in &request.abas {
        let nome = aba.nome.trim();
        if nome.is_empty()
            || nome.chars().count() > 31
            || nome.contains(['[', ']', ':', '*', '?', '/', '\\'])
            || !nomes.insert(nome.to_lowercase())
        {
            return Err(invalida("nome de aba invalido ou repetido"));
        }
        if aba.titulo.trim().is_empty() {
            return Err(invalida("titulo de aba vazio"));
        }
        if aba.colunas.is_empty() || aba.colunas.len() > MAX_COLUNAS {
            return Err(invalida("quantidade de colunas fora do limite"));
        }
        if aba.linhas.len() > MAX_LINHAS {
            return Err(invalida("quantidade de linhas fora do limite"));
        }
        if aba.congelar_colunas as usize > aba.colunas.len() {
            return Err(invalida("congelamento maior que a quantidade de colunas"));
        }
        if aba
            .colunas
            .iter()
            .any(|coluna| coluna.rotulo.trim().is_empty() || !coluna.largura.is_finite())
        {
            return Err(invalida("coluna sem rotulo ou largura valida"));
        }
        if aba
            .linhas
            .iter()
            .any(|linha| linha.celulas.len() != aba.colunas.len())
        {
            return Err(invalida(
                "linha com quantidade de celulas diferente do cabecalho",
            ));
        }
    }
    Ok(())
}

fn escrever_aba(
    worksheet: &mut Worksheet,
    aba: &SpreadsheetSheet,
) -> Result<(), rust_xlsxwriter::XlsxError> {
    worksheet.set_name(aba.nome.trim())?;

    let ultima_coluna = (aba.colunas.len() - 1) as u16;
    let titulo = Format::new()
        .set_font_name("Segoe UI")
        .set_font_size(16)
        .set_bold()
        .set_font_color(AZUL_MARINHO)
        .set_align(FormatAlign::VerticalCenter);
    if ultima_coluna == 0 {
        worksheet.write_string_with_format(0, 0, aba.titulo.trim(), &titulo)?;
    } else {
        worksheet.merge_range(0, 0, 0, ultima_coluna, aba.titulo.trim(), &titulo)?;
    }
    worksheet.set_row_height(0, 25)?;

    let rotulo_meta = Format::new()
        .set_font_name("Segoe UI")
        .set_bold()
        .set_font_color(AZUL_MARINHO);
    let valor_meta = Format::new()
        .set_font_name("Segoe UI")
        .set_font_color("#526074");
    let mut linha_atual = 1_u32;
    for metadado in &aba.metadados {
        if ultima_coluna == 0 {
            worksheet.write_string_with_format(
                linha_atual,
                0,
                format!("{}: {}", metadado.rotulo, metadado.valor),
                &valor_meta,
            )?;
        } else if ultima_coluna == 1 {
            worksheet.write_string_with_format(linha_atual, 0, &metadado.rotulo, &rotulo_meta)?;
            worksheet.write_string_with_format(linha_atual, 1, &metadado.valor, &valor_meta)?;
        } else {
            worksheet.write_string_with_format(linha_atual, 0, &metadado.rotulo, &rotulo_meta)?;
            worksheet.merge_range(
                linha_atual,
                1,
                linha_atual,
                ultima_coluna,
                &metadado.valor,
                &valor_meta,
            )?;
        }
        linha_atual += 1;
    }
    if !aba.metadados.is_empty() {
        linha_atual += 1;
    }
    let linha_cabecalho = linha_atual;

    for (indice, coluna) in aba.colunas.iter().enumerate() {
        let formato = formato_cabecalho(coluna);
        worksheet.write_string_with_format(
            linha_cabecalho,
            indice as u16,
            &coluna.rotulo,
            &formato,
        )?;
        worksheet.set_column_width(indice as u16, coluna.largura.clamp(6.0, 80.0))?;
    }
    worksheet.set_row_height(linha_cabecalho, 24)?;

    for (indice_linha, linha) in aba.linhas.iter().enumerate() {
        let numero_linha = linha_cabecalho + 1 + indice_linha as u32;
        let alternada = indice_linha % 2 == 1;
        let mut altura = 18.0_f64;
        for (indice_coluna, valor) in linha.celulas.iter().enumerate() {
            let coluna = &aba.colunas[indice_coluna];
            let formato = formato_celula(coluna, linha.tom, alternada);
            escrever_valor(
                worksheet,
                numero_linha,
                indice_coluna as u16,
                valor,
                coluna.tipo,
                &formato,
            )?;
            altura = altura.max(altura_estimada(valor, coluna.largura));
        }
        worksheet.set_row_height(numero_linha, altura.min(60.0))?;
    }

    let ultima_linha = linha_cabecalho + aba.linhas.len() as u32;
    worksheet.autofilter(linha_cabecalho, 0, ultima_linha, ultima_coluna)?;
    worksheet.set_freeze_panes(linha_cabecalho + 1, aba.congelar_colunas)?;
    Ok(())
}

fn escrever_valor(
    worksheet: &mut Worksheet,
    row: u32,
    col: u16,
    valor: &Value,
    tipo: SpreadsheetColumnType,
    formato: &Format,
) -> Result<(), rust_xlsxwriter::XlsxError> {
    if valor.is_null() {
        worksheet.write_blank(row, col, formato)?;
        return Ok(());
    }

    match tipo {
        SpreadsheetColumnType::Texto => {
            worksheet.write_string_with_format(row, col, &valor_como_texto(valor), formato)?;
        }
        SpreadsheetColumnType::Inteiro => {
            if let Some(numero) = valor.as_i64() {
                worksheet.write_number_with_format(row, col, numero as f64, formato)?;
            } else if let Some(numero) = valor.as_u64() {
                worksheet.write_number_with_format(row, col, numero as f64, formato)?;
            } else if let Some(numero) = valor.as_f64() {
                worksheet.write_number_with_format(row, col, numero, formato)?;
            } else if let Ok(numero) = valor_como_texto(valor).parse::<f64>() {
                worksheet.write_number_with_format(row, col, numero, formato)?;
            } else {
                worksheet.write_string_with_format(row, col, &valor_como_texto(valor), formato)?;
            }
        }
        SpreadsheetColumnType::Data => {
            let texto = valor_como_texto(valor);
            if let Some(data) = parse_data(&texto) {
                worksheet.write_date_with_format(row, col, data, formato)?;
            } else {
                worksheet.write_string_with_format(row, col, &texto, formato)?;
            }
        }
        SpreadsheetColumnType::DataHora => {
            let texto = valor_como_texto(valor);
            if let Some(data) = parse_data_hora(&texto) {
                worksheet.write_datetime_with_format(row, col, data, formato)?;
            } else {
                worksheet.write_string_with_format(row, col, &texto, formato)?;
            }
        }
    }
    Ok(())
}

fn parse_data(valor: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(valor, "%Y-%m-%d")
        .or_else(|_| NaiveDate::parse_from_str(valor, "%d/%m/%Y"))
        .ok()
}

fn parse_data_hora(valor: &str) -> Option<NaiveDateTime> {
    if let Ok(data) = DateTime::parse_from_rfc3339(valor) {
        let fuso = FixedOffset::west_opt(4 * 60 * 60)?;
        return Some(data.with_timezone(&fuso).naive_local());
    }
    ["%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S"]
        .iter()
        .find_map(|formato| NaiveDateTime::parse_from_str(valor, formato).ok())
}

fn valor_como_texto(valor: &Value) -> String {
    match valor {
        Value::String(texto) => texto.clone(),
        Value::Bool(true) => "Sim".to_string(),
        Value::Bool(false) => "Não".to_string(),
        Value::Number(numero) => numero.to_string(),
        Value::Null => String::new(),
        outro => outro.to_string(),
    }
}

fn formato_cabecalho(coluna: &SpreadsheetColumn) -> Format {
    Format::new()
        .set_font_name("Segoe UI")
        .set_bold()
        .set_font_color(Color::White)
        .set_background_color(cor_forte(coluna.tom))
        .set_border(FormatBorder::Thin)
        .set_border_color(BORDA)
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
        .set_text_wrap()
}

fn formato_celula(
    coluna: &SpreadsheetColumn,
    tom_linha: Option<SpreadsheetTone>,
    alternada: bool,
) -> Format {
    let tom = tom_linha.or(coluna.tom);
    let mut formato = Format::new()
        .set_font_name("Segoe UI")
        .set_font_color(cor_texto(tom))
        .set_background_color(cor_suave(tom, alternada))
        .set_border(FormatBorder::Thin)
        .set_border_color(BORDA)
        .set_align(FormatAlign::Top)
        .set_text_wrap();

    formato = formato.set_align(match coluna.alinhamento {
        SpreadsheetAlignment::Esquerda => FormatAlign::Left,
        SpreadsheetAlignment::Centro => FormatAlign::Center,
        SpreadsheetAlignment::Direita => FormatAlign::Right,
    });
    match coluna.tipo {
        SpreadsheetColumnType::Data => formato.set_num_format("dd/mm/yyyy"),
        SpreadsheetColumnType::DataHora => formato.set_num_format("dd/mm/yyyy hh:mm"),
        SpreadsheetColumnType::Inteiro => formato.set_num_format("0"),
        SpreadsheetColumnType::Texto => formato,
    }
}

fn cor_forte(tom: Option<SpreadsheetTone>) -> &'static str {
    match tom {
        Some(SpreadsheetTone::Informacao) => "#173B67",
        Some(SpreadsheetTone::Sucesso) => "#2F6B4F",
        Some(SpreadsheetTone::Atencao) => "#9A741F",
        Some(SpreadsheetTone::Perigo) => "#9B2C2C",
        Some(SpreadsheetTone::Inativo) => "#526074",
        None => AZUL_MARINHO,
    }
}

fn cor_suave(tom: Option<SpreadsheetTone>, alternada: bool) -> &'static str {
    match tom {
        Some(SpreadsheetTone::Informacao) => "#E8EEF5",
        Some(SpreadsheetTone::Sucesso) => "#E8F3ED",
        Some(SpreadsheetTone::Atencao) => "#FBF4DF",
        Some(SpreadsheetTone::Perigo) => "#FBEAEA",
        Some(SpreadsheetTone::Inativo) => "#E9EDF1",
        None if alternada => FAIXA,
        None => "#FFFFFF",
    }
}

fn cor_texto(tom: Option<SpreadsheetTone>) -> &'static str {
    match tom {
        Some(SpreadsheetTone::Informacao) => "#173B67",
        Some(SpreadsheetTone::Sucesso) => "#214C39",
        Some(SpreadsheetTone::Atencao) => "#705817",
        Some(SpreadsheetTone::Perigo) => "#7A1F1F",
        Some(SpreadsheetTone::Inativo) => "#526074",
        None => "#172033",
    }
}

fn altura_estimada(valor: &Value, largura: f64) -> f64 {
    let texto = valor_como_texto(valor);
    if texto.is_empty() {
        return 18.0;
    }
    let por_linha = largura.clamp(8.0, 80.0) as usize;
    // Quebra explícita fica dentro da mesma célula no XLSX; ela aumenta a
    // altura visual da linha, não cria um registro novo como acontecia no CSV.
    let linhas = texto
        .split('\n')
        .map(|trecho| trecho.chars().count().div_ceil(por_linha).max(1))
        .sum::<usize>()
        .clamp(1, 4);
    18.0 * linhas as f64
}

fn invalida(detalhe: &str) -> AppError {
    AppError::Interno(format!("pedido de planilha invalido: {detalhe}"))
}

fn erro_xlsx(erro: rust_xlsxwriter::XlsxError) -> AppError {
    AppError::Interno(format!("falha ao montar planilha XLSX: {erro}"))
}

#[cfg(test)]
mod tests {
    use std::io::{Cursor, Read};

    use calamine::{open_workbook_from_rs, Data, Reader, Xlsx};
    use serde_json::json;

    use super::*;
    use crate::files::domain::{
        SpreadsheetColumn, SpreadsheetMetadata, SpreadsheetRow, SpreadsheetSheet,
    };

    fn coluna(rotulo: &str, tipo: SpreadsheetColumnType) -> SpreadsheetColumn {
        SpreadsheetColumn {
            rotulo: rotulo.to_string(),
            tipo,
            largura: 18.0,
            alinhamento: SpreadsheetAlignment::Esquerda,
            tom: None,
        }
    }

    #[test]
    fn gera_xlsx_com_abas_tipos_acentos_e_texto_que_parece_formula() {
        let request = SpreadsheetRequest {
            nome_sugerido: "relatório.xlsx".to_string(),
            abas: vec![SpreadsheetSheet {
                nome: "Dados".to_string(),
                titulo: "Relatório de teste".to_string(),
                metadados: vec![SpreadsheetMetadata {
                    rotulo: "Escopo".to_string(),
                    valor: "Todos".to_string(),
                }],
                colunas: vec![
                    coluna("Texto", SpreadsheetColumnType::Texto),
                    coluna("Quantidade", SpreadsheetColumnType::Inteiro),
                    coluna("Data", SpreadsheetColumnType::Data),
                ],
                linhas: vec![SpreadsheetRow {
                    celulas: vec![json!("=1+1; ação"), json!(7), json!("2026-09-04")],
                    tom: Some(SpreadsheetTone::Sucesso),
                }],
                congelar_colunas: 1,
            }],
        };

        let bytes = gerar(&request).expect("gerar planilha");
        assert!(bytes.starts_with(b"PK"));
        let mut workbook: Xlsx<_> =
            open_workbook_from_rs(Cursor::new(bytes.clone())).expect("reabrir XLSX");
        assert_eq!(workbook.sheet_names(), &["Dados"]);
        let range = workbook.worksheet_range("Dados").expect("ler aba");
        assert!(range.used_cells().any(|(_, _, valor)| {
            matches!(valor, Data::String(texto) if texto == "=1+1; ação")
        }));
        assert!(range
            .used_cells()
            .any(|(_, _, valor)| matches!(valor, Data::Float(numero) if *numero == 7.0)));

        let mut pacote = zip::ZipArchive::new(Cursor::new(bytes)).expect("abrir pacote XLSX");
        let mut estilos = String::new();
        pacote
            .by_name("xl/styles.xml")
            .expect("arquivo de estilos")
            .read_to_string(&mut estilos)
            .expect("ler estilos");
        assert!(estilos.contains("FF0B1F3A"), "paleta institucional ausente");
        assert!(estilos.contains("FFE8F3ED"), "tom de sucesso ausente");

        let mut planilha = String::new();
        pacote
            .by_name("xl/worksheets/sheet1.xml")
            .expect("xml da aba")
            .read_to_string(&mut planilha)
            .expect("ler aba");
        assert!(planilha.contains("<autoFilter"), "autofiltro ausente");
        assert!(planilha.contains("<pane"), "painel congelado ausente");
    }

    #[test]
    fn recusa_aba_repetida_e_linha_desalinhada() {
        let aba = SpreadsheetSheet {
            nome: "Dados".to_string(),
            titulo: "Dados".to_string(),
            metadados: vec![],
            colunas: vec![coluna("Uma", SpreadsheetColumnType::Texto)],
            linhas: vec![],
            congelar_colunas: 0,
        };
        let request = SpreadsheetRequest {
            nome_sugerido: "dados.xlsx".to_string(),
            abas: vec![
                aba,
                SpreadsheetSheet {
                    nome: "dados".to_string(),
                    titulo: "Outro".to_string(),
                    metadados: vec![],
                    colunas: vec![coluna("Uma", SpreadsheetColumnType::Texto)],
                    linhas: vec![],
                    congelar_colunas: 0,
                },
            ],
        };
        assert!(gerar(&request).is_err());

        let request = SpreadsheetRequest {
            nome_sugerido: "dados.xlsx".to_string(),
            abas: vec![SpreadsheetSheet {
                nome: "Dados".to_string(),
                titulo: "Dados".to_string(),
                metadados: vec![],
                colunas: vec![coluna("Uma", SpreadsheetColumnType::Texto)],
                linhas: vec![SpreadsheetRow {
                    celulas: vec![json!(1), json!(2)],
                    tom: None,
                }],
                congelar_colunas: 0,
            }],
        };
        assert!(gerar(&request).is_err());
    }

    #[test]
    fn quebra_de_linha_aumenta_a_altura_sem_criar_outro_registro() {
        assert_eq!(altura_estimada(&json!("primeira\nsegunda"), 18.0), 36.0);
    }
}
