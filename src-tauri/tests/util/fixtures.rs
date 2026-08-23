//! Mundo de teste com um apuratório configurado ponta a ponta.
//!
//! A migration 0002 semeia só a conta administrativa e a 0003 só os catálogos
//! LEGAIS. Tudo que é operacional — apuratórios, papéis, documentos iniciadores,
//! unidades, status, soluções, penalidades — nasce vazio de propósito, então
//! todo teste que toque em processo precisa construí-lo.
//!
//! A ordem abaixo é imposta pelas FKs, todas `ON DELETE RESTRICT`:
//!
//! ```text
//! circulos → postos → policiais_militares
//! municipios → unidades_pm
//! tipos_apuratorio → apuratorios
//! tipos_documento  → apuratorio_documentos_iniciadores  ← sem isto não há processo
//! papeis_processo  → apuratorio_papeis                  ← sem isto não há designação
//! ```
//!
//! Nomes e siglas carregam "Teste"/"TST" porque os índices únicos dos catálogos
//! são case-insensitive e a 0003 já ocupa os nomes reais.
#![allow(dead_code)]

use sqlx::{Executor, PgPool};

/// Ids do mundo montado. Circulam como `String` porque é assim que os
/// repositórios os recebem — o cast `::uuid` acontece no SQL.
pub struct Mundo {
    /// `max_envolvidos = 1`, exige natureza do fato, papéis Encarregado
    /// (obrigatório, responsável) e Escrivão (opcional, até 2 ocupantes).
    pub apuratorio: String,
    /// `max_envolvidos = NULL` (ilimitado), não exige natureza, só Encarregado.
    /// Não prevê Escrivão — serve para provar que a FK composta recusa o papel.
    pub apuratorio_livre: String,
    /// `codigo_extensao = 'carta_precatoria'`.
    pub apuratorio_cp: String,

    /// Prazo herdado do apuratório (30 dias).
    pub documento: String,
    /// Declara `prazo_base_dias = 15`, sobrepondo o do apuratório.
    pub documento_curto: String,

    pub papel_encarregado: String,
    pub papel_escrivao: String,

    pub unidade: String,
    pub unidade_deprecada: String,
    pub municipio: String,

    pub pm_um: String,
    pub pm_dois: String,
    pub pm_tres: String,

    pub status_envolvido: String,
    pub natureza: String,
    /// `exige_condutor = true`.
    pub natureza_transito: String,
    pub solucao_sugerida: String,
    /// `permite_penalidade = true`.
    pub solucao_punido: String,
    /// `permite_penalidade = false`.
    pub solucao_absolvido: String,
    /// `usa_quantidade_dias = true`.
    pub penalidade_prisao: String,
    /// `usa_quantidade_dias = false`.
    pub penalidade_repreensao: String,
    pub papel_vitima: String,
    pub categoria_indicio: String,
    pub tipo_andamento: String,
}

/// UUID legível: o prefixo identifica a família, como em `schema_integrity.sql`.
fn id(prefixo: &str, n: u32) -> String {
    format!("{prefixo}-0000-4000-8000-{n:012}")
}

pub const PRAZO_APURATORIO: i32 = 30;
pub const PRAZO_DOCUMENTO_CURTO: i32 = 15;

pub async fn mundo_configurado(pool: &PgPool) -> Mundo {
    let m = Mundo {
        apuratorio: id("aa000000", 1),
        apuratorio_livre: id("aa000000", 2),
        apuratorio_cp: id("aa000000", 3),
        documento: id("dd000000", 1),
        documento_curto: id("dd000000", 2),
        papel_encarregado: id("ee000000", 1),
        papel_escrivao: id("ee000000", 2),
        unidade: id("ff000000", 1),
        unidade_deprecada: id("ff000000", 2),
        municipio: id("ff000000", 3),
        pm_um: id("11100000", 1),
        pm_dois: id("11100000", 2),
        pm_tres: id("11100000", 3),
        status_envolvido: id("22200000", 1),
        natureza: id("22200000", 2),
        natureza_transito: id("22200000", 3),
        solucao_sugerida: id("22200000", 4),
        solucao_punido: id("22200000", 5),
        solucao_absolvido: id("22200000", 6),
        penalidade_prisao: id("22200000", 7),
        penalidade_repreensao: id("22200000", 8),
        papel_vitima: id("22200000", 9),
        categoria_indicio: id("22200000", 10),
        tipo_andamento: id("22200000", 11),
    };

    let circulo = id("33300000", 1);
    let posto = id("33300000", 2);
    let tipo_apuratorio = id("33300000", 3);

    let sql = format!(
        r#"
INSERT INTO circulos_hierarquicos (id, nome) VALUES ('{circulo}', 'Circulo Teste');
INSERT INTO postos_graduacoes (id, sigla, nome, circulo_hierarquico_id, ordem_hierarquica)
VALUES ('{posto}', 'TST PM', 'Posto Teste PM', '{circulo}', 1);
INSERT INTO policiais_militares (id, matricula, nome, posto_graduacao_id, is_encarregado) VALUES
    ('{pm_um}',   '100000001', 'PM UM',   '{posto}', true),
    ('{pm_dois}', '100000002', 'PM DOIS', '{posto}', true),
    ('{pm_tres}', '100000003', 'PM TRES', '{posto}', false);

INSERT INTO municipios_distritos (id, nome, tipo) VALUES ('{municipio}', 'Cidade Teste', 'municipio');
INSERT INTO unidades_pm (id, nome, municipio_id) VALUES
    ('{unidade}',           'Unidade Teste',    '{municipio}'),
    ('{unidade_deprecada}', 'Unidade Deprecada','{municipio}');

INSERT INTO tipos_apuratorio (id, nome) VALUES ('{tipo_apuratorio}', 'procedimento');
INSERT INTO apuratorios
    (id, sigla, nome, tipo_apuratorio_id, prazo_base_dias, max_envolvidos,
     exige_natureza_fato, codigo_extensao) VALUES
    ('{apuratorio}',       'TST-A', 'Apuratorio Teste A', '{tipo_apuratorio}', {prazo}, 1,    true,  NULL),
    ('{apuratorio_livre}', 'TST-B', 'Apuratorio Teste B', '{tipo_apuratorio}', {prazo}, NULL, false, NULL),
    ('{apuratorio_cp}',    'TST-C', 'Apuratorio Teste C', '{tipo_apuratorio}', {prazo}, 1,    false, 'carta_precatoria');

INSERT INTO tipos_documento (id, nome) VALUES
    ('{documento}',       'Portaria Teste'),
    ('{documento_curto}', 'Feito Teste');
-- O documento curto declara prazo próprio: é o COALESCE que o prazo inicial usa.
INSERT INTO apuratorio_documentos_iniciadores
    (apuratorio_id, tipo_documento_id, prazo_base_dias, padrao) VALUES
    ('{apuratorio}',       '{documento}',       NULL,   true),
    ('{apuratorio}',       '{documento_curto}', {curto}, false),
    ('{apuratorio_livre}', '{documento}',       NULL,   true),
    ('{apuratorio_cp}',    '{documento}',       NULL,   true);

INSERT INTO papeis_processo (id, nome) VALUES
    ('{papel_encarregado}', 'Encarregado Teste'),
    ('{papel_escrivao}',    'Escrivao Teste');
-- Escrivão NÃO é previsto para o apuratório livre: a FK composta precisa recusá-lo.
INSERT INTO apuratorio_papeis
    (apuratorio_id, papel_id, obrigatorio, max_ocupantes, e_responsavel) VALUES
    ('{apuratorio}',       '{papel_encarregado}', true,  1, true),
    ('{apuratorio}',       '{papel_escrivao}',    false, 2, false),
    ('{apuratorio_livre}', '{papel_encarregado}', true,  1, true),
    ('{apuratorio_cp}',    '{papel_encarregado}', true,  1, true);

INSERT INTO status_envolvido (id, nome) VALUES ('{status}', 'Sindicado Teste');
INSERT INTO naturezas_fato (id, nome, exige_condutor) VALUES
    ('{natureza}',          'Natureza Teste',  false),
    ('{natureza_transito}', 'Sinistro Teste',  true);
INSERT INTO tipos_solucao_sugerida (id, nome) VALUES ('{sol_sug}', 'Sugerido Teste');
INSERT INTO tipos_solucao_decidida (id, nome, permite_penalidade) VALUES
    ('{sol_punido}',    'Punido Teste',    true),
    ('{sol_absolvido}', 'Absolvido Teste', false);
INSERT INTO tipos_penalidade (id, nome, usa_quantidade_dias) VALUES
    ('{pen_prisao}',     'Prisao Teste',     true),
    ('{pen_repreensao}', 'Repreensao Teste', false);
INSERT INTO papeis_pessoa (id, nome) VALUES ('{papel_vitima}', 'Vitima Teste');
INSERT INTO categorias_indicio (id, nome, indica_ausencia) VALUES
    ('{categoria}', 'Sem Indicios Teste', true);
INSERT INTO tipos_andamento (id, nome) VALUES ('{andamento}', 'Despacho Teste');
"#,
        circulo = circulo,
        posto = posto,
        tipo_apuratorio = tipo_apuratorio,
        prazo = PRAZO_APURATORIO,
        curto = PRAZO_DOCUMENTO_CURTO,
        pm_um = m.pm_um,
        pm_dois = m.pm_dois,
        pm_tres = m.pm_tres,
        municipio = m.municipio,
        unidade = m.unidade,
        unidade_deprecada = m.unidade_deprecada,
        apuratorio = m.apuratorio,
        apuratorio_livre = m.apuratorio_livre,
        apuratorio_cp = m.apuratorio_cp,
        documento = m.documento,
        documento_curto = m.documento_curto,
        papel_encarregado = m.papel_encarregado,
        papel_escrivao = m.papel_escrivao,
        status = m.status_envolvido,
        natureza = m.natureza,
        natureza_transito = m.natureza_transito,
        sol_sug = m.solucao_sugerida,
        sol_punido = m.solucao_punido,
        sol_absolvido = m.solucao_absolvido,
        pen_prisao = m.penalidade_prisao,
        pen_repreensao = m.penalidade_repreensao,
        papel_vitima = m.papel_vitima,
        categoria = m.categoria_indicio,
        andamento = m.tipo_andamento,
    );

    pool.execute(&*sql).await.expect("montar mundo de teste");
    m
}

// ── Atalhos compartilhados pelos arquivos de teste ───────────────────────────
//
// Processo, envolvido e conta aparecem em quase todo cenário. Ficam aqui para
// que os testes de cada módulo digam só o que é próprio deles.

/// Cria um processo no apuratório indicado.
///
/// `conclusao` presente = concluído: a coluna booleana foi eliminada porque
/// `concluido` ⟺ `data_conclusao IS NOT NULL` em 128/128 registros do dump.
pub async fn processo(
    pool: &PgPool,
    m: &Mundo,
    apuratorio: &str,
    numero: &str,
    instauracao: chrono::NaiveDate,
    conclusao: Option<chrono::NaiveDate>,
) -> String {
    sqlx::query_scalar(
        "INSERT INTO processos_procedimentos
             (apuratorio_id, documento_iniciador_id, numero_documento,
              unidade_origem_id, municipio_fato_id, natureza_fato_id,
              data_instauracao, data_recebimento, data_conclusao)
         VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::uuid, $6::uuid, $7, $7, $8)
      RETURNING id::text",
    )
    .bind(apuratorio)
    .bind(&m.documento)
    .bind(numero)
    .bind(&m.unidade)
    .bind(&m.municipio)
    .bind(&m.natureza)
    .bind(instauracao)
    .bind(conclusao)
    .fetch_one(pool)
    .await
    .expect("criar processo")
}

/// Vincula um policial militar ao processo como envolvido.
pub async fn envolvido(
    pool: &PgPool,
    m: &Mundo,
    processo_id: &str,
    pm: &str,
    ordem: i32,
) -> String {
    sqlx::query_scalar(
        "INSERT INTO processo_envolvidos
             (processo_id, policial_militar_id, status_envolvido_id, ordem)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
      RETURNING id::text",
    )
    .bind(processo_id)
    .bind(pm)
    .bind(&m.status_envolvido)
    .bind(ordem)
    .fetch_one(pool)
    .await
    .expect("criar envolvido")
}

/// A conta administrativa da migration 0002. É o autor de qualquer escrita
/// auditada: o autor é uma CONTA, não um policial militar.
pub async fn conta_admin(pool: &PgPool) -> String {
    sqlx::query_scalar("SELECT id::text FROM usuarios WHERE email = 'admin@sistema.com'")
        .fetch_one(pool)
        .await
        .expect("conta do seed")
}
