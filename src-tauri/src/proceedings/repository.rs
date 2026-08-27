use base64::Engine;
use sqlx::{PgExecutor, PgPool, Postgres, Transaction};

use crate::db::paginacao::{PADRAO, TETO};
use crate::deadlines::repository as deadlines_repository;
use crate::error::AppError;
use crate::proceedings::domain::{
    AnexoItem, AttachmentContent, AtualizarSubstituicaoRequest, CartaPrecatoriaDetalhes,
    ContagemRotulada, DashboardSummary, DesignacaoItem, DesignacaoRequest, EnvolvidoItem,
    PessoaItem, ProceedingDetail, ProceedingFilter, ProceedingListItem, ProceedingListResult,
    SaveProceedingRequest, SubstituirDesignacaoRequest, UpdateInvolvedOutcomeRequest,
    UpdateProceedingClosureRequest, UploadAttachmentRequest, EXTENSAO_CARTA_PRECATORIA,
    MOTIVO_DESIGNACAO_INICIAL,
};

/// Limite de tamanho do anexo. Trafega em base64 pelo IPC, então o custo real em
/// memória é cerca de 1/3 maior.
const MAX_ANEXO_BYTES: usize = 100 * 1024 * 1024;

/// Colunas da listagem. Saem de `v_processos_detalhados` (migration 0004), que
/// já resolve os catálogos, o responsável vigente, o prazo vigente e a contagem
/// de envolvidos. Antes esta composição estava escrita aqui, em `maps_reports`,
/// em `deadlines` e em `users` — quatro cópias que podiam divergir, e duas já
/// divergiam.
///
/// Os ids saem como texto porque é assim que atravessam o IPC.
const COLUNAS_LISTA: &str = r#"
    v.id::text                     AS id,
    v.apuratorio_id::text          AS apuratorio_id,
    v.apuratorio_sigla,
    v.apuratorio_nome,
    v.tipo_apuratorio,
    v.documento_iniciador_id::text AS documento_iniciador_id,
    v.documento_iniciador,
    v.numero_documento,
    v.numero_controle,
    v.processo_sei,
    v.rotulo,
    v.unidade_origem_id::text      AS unidade_origem_id,
    v.unidade_origem,
    v.municipio_fato_id::text      AS municipio_fato_id,
    v.municipio_fato,
    v.natureza_fato_id::text       AS natureza_fato_id,
    v.natureza_fato,
    v.data_instauracao,
    v.data_recebimento,
    v.data_conclusao,
    v.concluido,
    v.resumo_fatos,
    v.responsavel_nome,
    responsavel_pm.matricula        AS responsavel_matricula,
    responsavel_posto.sigla         AS responsavel_posto_graduacao,
    v.responsavel_papel,
    v.total_envolvidos,
    COALESCE(envolvidos.lista, '[]'::jsonb) AS envolvidos_resumo,
    v.prazo_vencimento,
    v.prazo_dias_restantes
"#;

/// Dados complementares usados somente pelo CRUD de processos. Permanecem
/// fora da view comum para não obrigar mapas e relatórios a agregarem a lista
/// completa de envolvidos quando não precisam dela.
const JOINS_LISTA: &str = r#"
    LEFT JOIN policiais_militares responsavel_pm
           ON responsavel_pm.id = v.responsavel_id::uuid
    LEFT JOIN postos_graduacoes responsavel_posto
           ON responsavel_posto.id = responsavel_pm.posto_graduacao_id
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(
                   jsonb_build_object(
                       'posto_graduacao', pg.sigla,
                       'matricula', pm.matricula,
                       'nome', pm.nome
                   ) ORDER BY e.ordem
               ) AS lista
          FROM processo_envolvidos e
          JOIN policiais_militares pm ON pm.id = e.policial_militar_id
          JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
         WHERE e.processo_id = v.id
    ) envolvidos ON true
"#;

/// Fonte da CONTAGEM da listagem — deliberadamente as tabelas base, e não a
/// view.
///
/// Medido com 5.000 processos: contar sobre a view leva 408 ms, porque o
/// PostgreSQL não poda os `LATERAL` cujo resultado a contagem não usa. Esta
/// projeção enxuta leva 1,8 ms — e é mais rápida até que a versão anterior
/// (58 ms), que arrastava quatro joins de catálogo que a contagem nunca leu.
///
/// As colunas repetem os nomes que a view expõe, de propósito: é o que permite
/// o mesmo `FILTRO` valer para as duas fontes.
const BASE_CONTAGEM: &str = r#"
    FROM (
        SELECT pp.id,
               pp.ativo,
               pp.apuratorio_id,
               aa.tipo_apuratorio_id,
               pp.unidade_origem_id,
               pp.natureza_fato_id,
               pp.numero_documento,
               COALESCE(pp.numero_controle, pp.numero_documento) AS numero_controle,
               pp.resumo_fatos,
               pp.processo_sei,
               pp.numero_rgf,
               pp.data_instauracao,
               pp.data_conclusao,
               (pp.data_conclusao IS NOT NULL) AS concluido
          FROM processos_procedimentos pp
          JOIN apuratorios aa ON aa.id = pp.apuratorio_id
    ) v
"#;

/// O filtro vale para as duas fontes acima, porque ambas expõem estes nomes.
const FILTRO: &str = r#"
    WHERE v.ativo
      AND ($1::text IS NULL
           OR lower(v.numero_documento) LIKE $1
           OR lower(v.numero_controle) LIKE $1
           OR lower(COALESCE(v.resumo_fatos, '')) LIKE $1
           OR lower(COALESCE(v.processo_sei, '')) LIKE $1
           OR lower(COALESCE(v.numero_rgf, '')) LIKE $1)
      AND ($2::uuid[] IS NULL OR v.apuratorio_id = ANY($2::uuid[]))
      AND ($3::uuid IS NULL OR v.tipo_apuratorio_id = $3::uuid)
      AND ($4::uuid IS NULL OR v.unidade_origem_id = $4::uuid)
      AND ($5::uuid IS NULL OR v.natureza_fato_id = $5::uuid)
      AND ($6::uuid IS NULL OR EXISTS (
              SELECT 1 FROM processo_designacoes d
               WHERE d.processo_id = v.id AND d.data_fim IS NULL
                 AND d.policial_militar_id = $6::uuid))
      AND ($7::int IS NULL OR EXTRACT(YEAR FROM v.data_instauracao)::int = $7)
      AND ($8::bool IS NULL OR v.concluido = $8)
"#;

fn bind_filtro<'q, O>(
    query: sqlx::query::QueryAs<'q, Postgres, O, sqlx::postgres::PgArguments>,
    filtro: &'q ProceedingFilter,
    busca: Option<String>,
) -> sqlx::query::QueryAs<'q, Postgres, O, sqlx::postgres::PgArguments> {
    query
        .bind(busca)
        .bind(filtro.apuratorio_ids.as_deref())
        .bind(filtro.tipo_apuratorio_id.as_deref())
        .bind(filtro.unidade_origem_id.as_deref())
        .bind(filtro.natureza_fato_id.as_deref())
        .bind(filtro.responsavel_id.as_deref())
        .bind(filtro.ano)
        .bind(filtro.concluido)
}

pub async fn list(
    pool: &PgPool,
    filtro: &ProceedingFilter,
) -> Result<ProceedingListResult, sqlx::Error> {
    let page = filtro.page.unwrap_or(1).max(1);
    let per_page = filtro.per_page.unwrap_or(PADRAO).clamp(1, TETO);
    let busca = filtro
        .busca
        .as_deref()
        .map(|s| format!("%{}%", s.trim().to_lowercase()));

    let total: (i64,) = bind_filtro(
        sqlx::query_as(&format!("SELECT count(*) {BASE_CONTAGEM} {FILTRO}")),
        filtro,
        busca.clone(),
    )
    .fetch_one(pool)
    .await?;

    let items = bind_filtro(
        sqlx::query_as::<_, ProceedingListItem>(&format!(
            "SELECT {COLUNAS_LISTA} FROM v_processos_detalhados v {JOINS_LISTA} {FILTRO}
             ORDER BY v.data_instauracao DESC, v.numero_documento
             LIMIT $9 OFFSET $10"
        )),
        filtro,
        busca,
    )
    .bind(per_page)
    .bind((page - 1) * per_page)
    .fetch_all(pool)
    .await?;

    Ok(ProceedingListResult {
        items,
        total: total.0,
        page,
        per_page,
    })
}

pub async fn get(pool: &PgPool, id: &str) -> Result<Option<ProceedingDetail>, sqlx::Error> {
    let cabecalho = sqlx::query_as::<_, ProceedingListItem>(&format!(
        "SELECT {COLUNAS_LISTA} FROM v_processos_detalhados v {JOINS_LISTA}
          WHERE v.id = $1::uuid"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await?;

    let Some(cabecalho) = cabecalho else {
        return Ok(None);
    };

    let extras: (
        Option<String>,
        Option<chrono::NaiveDate>,
        Option<chrono::NaiveDate>,
        Option<chrono::NaiveDate>,
    ) = sqlx::query_as(
        "SELECT numero_rgf, data_remessa_encarregado,
                    data_remessa_comissao, data_julgamento
               FROM processos_procedimentos WHERE id = $1::uuid",
    )
    .bind(id)
    .fetch_one(pool)
    .await?;

    Ok(Some(ProceedingDetail {
        cabecalho,
        numero_rgf: extras.0,
        data_remessa_encarregado: extras.1,
        data_remessa_comissao: extras.2,
        data_julgamento: extras.3,
        envolvidos: list_envolvidos(pool, id).await?,
        designacoes: list_designacoes(pool, id).await?,
        pessoas: list_pessoas(pool, id).await?,
        anexos: list_anexos(pool, id).await?,
        carta_precatoria: carta_precatoria(pool, id).await?,
    }))
}

pub async fn list_envolvidos<'e, E: PgExecutor<'e>>(
    executor: E,
    processo_id: &str,
) -> Result<Vec<EnvolvidoItem>, sqlx::Error> {
    sqlx::query_as::<_, EnvolvidoItem>(
        "SELECT e.id::text                    AS id,
                pm.id::text                   AS policial_militar_id,
                pm.nome                       AS nome,
                pm.matricula                  AS matricula,
                pg.sigla                      AS posto_graduacao,
                se.id::text                   AS status_envolvido_id,
                se.nome                       AS status_envolvido,
                e.ordem                       AS ordem,
                e.e_condutor                  AS e_condutor,
                e.solucao_sugerida_id::text   AS solucao_sugerida_id,
                ss.nome                       AS solucao_sugerida,
                e.solucao_decidida_id::text   AS solucao_decidida_id,
                sd.nome                       AS solucao_decidida,
                e.penalidade_tipo_id::text    AS penalidade_tipo_id,
                tp.nome                       AS penalidade_tipo,
                e.penalidade_dias             AS penalidade_dias
           FROM processo_envolvidos e
           JOIN policiais_militares pm ON pm.id = e.policial_militar_id
           JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
           JOIN status_envolvido se    ON se.id = e.status_envolvido_id
           LEFT JOIN tipos_solucao_sugerida ss ON ss.id = e.solucao_sugerida_id
           LEFT JOIN tipos_solucao_decidida sd ON sd.id = e.solucao_decidida_id
           LEFT JOIN tipos_penalidade tp       ON tp.id = e.penalidade_tipo_id
          WHERE e.processo_id = $1::uuid
          ORDER BY e.ordem",
    )
    .bind(processo_id)
    .fetch_all(executor)
    .await
}

/// Designações vigentes e encerradas. O histórico de substituição de encarregado
/// é consequência desta tabela — não existe jsonb nem tabela paralela.
pub async fn list_designacoes<'e, E: PgExecutor<'e>>(
    executor: E,
    processo_id: &str,
) -> Result<Vec<DesignacaoItem>, sqlx::Error> {
    sqlx::query_as::<_, DesignacaoItem>(
        "SELECT d.id::text                     AS id,
                pap.id::text                   AS papel_id,
                pap.nome                       AS papel,
                ap.e_responsavel               AS e_responsavel,
                ap.usa_documento_designacao    AS usa_documento_designacao,
                pm.id::text                    AS policial_militar_id,
                pm.nome                        AS nome,
                pg.sigla                       AS posto_graduacao,
                pm.matricula                   AS matricula,
                d.data_inicio                  AS data_inicio,
                d.data_fim                     AS data_fim,
                d.documento_autorizador_id::text AS documento_autorizador_id,
                td.nome                        AS documento_autorizador,
                d.numero_documento             AS numero_documento,
                d.motivo                       AS motivo,
                d.designacao_anterior_id::text AS designacao_anterior_id
           FROM processo_designacoes d
           JOIN papeis_processo pap    ON pap.id = d.papel_id
           JOIN apuratorio_papeis ap   ON ap.apuratorio_id = d.apuratorio_id
                                      AND ap.papel_id = d.papel_id
           JOIN policiais_militares pm ON pm.id = d.policial_militar_id
           JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
           LEFT JOIN tipos_documento td ON td.id = d.documento_autorizador_id
          WHERE d.processo_id = $1::uuid
          ORDER BY pap.nome, d.data_inicio",
    )
    .bind(processo_id)
    .fetch_all(executor)
    .await
}

pub async fn list_pessoas<'e, E: PgExecutor<'e>>(
    executor: E,
    processo_id: &str,
) -> Result<Vec<PessoaItem>, sqlx::Error> {
    sqlx::query_as::<_, PessoaItem>(
        "SELECT pp.id::text        AS id,
                pap.id::text       AS papel_pessoa_id,
                pap.nome           AS papel_pessoa,
                pp.nome            AS nome,
                pp.ordem           AS ordem
           FROM processo_pessoas pp
           JOIN papeis_pessoa pap ON pap.id = pp.papel_pessoa_id
          WHERE pp.processo_id = $1::uuid
          ORDER BY pap.nome, pp.ordem",
    )
    .bind(processo_id)
    .fetch_all(executor)
    .await
}

/// Metadados dos anexos. O conteúdo fica de fora: `octet_length` devolve o
/// tamanho sem carregar o arquivo, e sem uma coluna que possa divergir dele.
pub async fn list_anexos<'e, E: PgExecutor<'e>>(
    executor: E,
    processo_id: &str,
) -> Result<Vec<AnexoItem>, sqlx::Error> {
    sqlx::query_as::<_, AnexoItem>(
        "SELECT an.id::text                        AS id,
                an.nome_arquivo                    AS nome_arquivo,
                an.mime_type                       AS mime_type,
                octet_length(an.conteudo)::bigint  AS tamanho_bytes,
                COALESCE(u.nome_exibicao, pm.nome) AS enviado_por,
                an.created_at                      AS created_at
           FROM processo_anexos an
           LEFT JOIN usuarios u             ON u.id = an.enviado_por_id
           LEFT JOIN policiais_militares pm ON pm.id = u.policial_militar_id
          WHERE an.processo_id = $1::uuid AND an.cancelado_em IS NULL
          ORDER BY an.created_at DESC",
    )
    .bind(processo_id)
    .fetch_all(executor)
    .await
}

pub async fn carta_precatoria<'e, E: PgExecutor<'e>>(
    executor: E,
    processo_id: &str,
) -> Result<Option<CartaPrecatoriaDetalhes>, sqlx::Error> {
    sqlx::query_as::<_, CartaPrecatoriaDetalhes>(
        "SELECT cp.deprecante, cp.unidade_deprecada_id::text, un.nome AS unidade_deprecada
           FROM carta_precatoria_detalhes cp
           JOIN unidades_pm un ON un.id = cp.unidade_deprecada_id
          WHERE cp.processo_id = $1::uuid",
    )
    .bind(processo_id)
    .fetch_optional(executor)
    .await
}

// ── Escrita ──────────────────────────────────────────────────────────────────

/// Configuração do apuratório que a gravação precisa consultar. Tudo o que antes
/// era literal no Rust (`"IPM" => 40`, `tipo_detalhe == "CP"`, `exige natureza`)
/// vem daqui, do cadastro.
#[derive(sqlx::FromRow)]
struct ConfigApuratorio {
    exige_natureza_fato: bool,
    codigo_extensao: Option<String>,
}

async fn config_apuratorio(
    tx: &mut Transaction<'_, Postgres>,
    apuratorio_id: &str,
) -> Result<ConfigApuratorio, AppError> {
    sqlx::query_as::<_, ConfigApuratorio>(
        "SELECT exige_natureza_fato, codigo_extensao FROM apuratorios WHERE id = $1::uuid",
    )
    .bind(apuratorio_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::Domain("apuratorio nao encontrado".to_string()))
}

/// Validações que dependem de configuração. Todas leem atributos semânticos dos
/// catálogos — nenhuma compara nome exibido.
async fn validar_contra_configuracao(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveProceedingRequest,
    config: &ConfigApuratorio,
) -> Result<(), AppError> {
    if config.exige_natureza_fato && request.natureza_fato_id.is_none() {
        return Err(AppError::Domain(
            "este apuratorio exige a natureza do fato apurado".to_string(),
        ));
    }

    // `naturezas_fato.exige_condutor` substitui o
    // `natureza.toLowerCase().includes('sinistro de trânsito')` do frontend legado.
    if let Some(natureza_id) = request.natureza_fato_id.as_deref() {
        let exige_condutor: bool =
            sqlx::query_scalar("SELECT exige_condutor FROM naturezas_fato WHERE id = $1::uuid")
                .bind(natureza_id)
                .fetch_optional(&mut **tx)
                .await?
                .ok_or_else(|| AppError::Domain("natureza do fato nao encontrada".to_string()))?;

        if exige_condutor && !request.envolvidos.iter().any(|e| e.e_condutor) {
            return Err(AppError::Domain(
                "esta natureza exige indicar o PM condutor entre os envolvidos".to_string(),
            ));
        }
    }

    if config.codigo_extensao.as_deref() == Some(EXTENSAO_CARTA_PRECATORIA)
        && request.carta_precatoria.is_none()
    {
        return Err(AppError::Domain(
            "este apuratorio exige deprecante e unidade deprecada".to_string(),
        ));
    }

    // Papéis obrigatórios do apuratório precisam estar designados.
    let faltando: Vec<String> = sqlx::query_scalar(
        "SELECT pap.nome
           FROM apuratorio_papeis ap
           JOIN papeis_processo pap ON pap.id = ap.papel_id
          WHERE ap.apuratorio_id = $1::uuid AND ap.obrigatorio AND ap.ativo
            AND NOT (ap.papel_id::text = ANY($2::text[]))",
    )
    .bind(&request.apuratorio_id)
    .bind(
        request
            .designacoes
            .iter()
            .map(|d| d.papel_id.clone())
            .collect::<Vec<_>>(),
    )
    .fetch_all(&mut **tx)
    .await?;
    if !faltando.is_empty() {
        return Err(AppError::Domain(format!(
            "Falta designar quem responde por: {}. Esta espécie de apuratório exige.",
            faltando.join(", ")
        )));
    }

    Ok(())
}

/// Grava o processo inteiro numa transação: cabeçalho, extensão, envolvidos,
/// designações e pessoas. Na criação, o prazo inicial nasce junto quando há data
/// de recebimento.
///
/// Uma tabela só — não existe mais o `match tipo_detalhe` que escolhia entre dez
/// tabelas físicas nem a segunda escrita no hub de identidade.
pub async fn save(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveProceedingRequest,
) -> Result<String, AppError> {
    let config = config_apuratorio(tx, &request.apuratorio_id).await?;
    validar_contra_configuracao(tx, request, &config).await?;

    let numero_controle = request
        .numero_controle
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());

    // A data anterior precisa ser lida antes do UPDATE para que a sincronização
    // do prazo saiba distinguir uma edição comum de uma tentativa de reescrever
    // uma cadeia que já possui prorrogações.
    let data_recebimento_anterior: Option<Option<chrono::NaiveDate>> = if let Some(id) =
        request.id.as_deref()
    {
        let (anterior, tem_prorrogacao): (Option<chrono::NaiveDate>, bool) = sqlx::query_as(
            "SELECT p.data_recebimento,
                        EXISTS (SELECT 1 FROM processo_prazos pr
                                 WHERE pr.processo_id = p.id AND pr.ordem > 0)
                   FROM processos_procedimentos p
                  WHERE p.id = $1::uuid AND p.ativo",
        )
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::Domain("processo nao encontrado".to_string()))?;

        // A verificacao vem antes de qualquer UPDATE: assim nenhuma
        // constraint atingida mais adiante mascara a regra com o fallback
        // generico de banco de dados.
        if tem_prorrogacao && anterior != request.data_recebimento {
            return Err(AppError::Domain(
                    "A data de recebimento não pode ser alterada porque este processo já possui prorrogação de prazo.".to_string(),
                ));
        }
        Some(anterior)
    } else {
        None
    };

    // Trocar o apuratório de um processo que já tem designações é impossível:
    // `processo_designacoes` amarra `(processo_id, apuratorio_id)` por FK
    // composta e as designações NUNCA são apagadas — são registro histórico de
    // quem respondeu pelo apuratório e quando. Sem esta verificação o usuário
    // recebia a violação de FK crua do PostgreSQL na tela.
    if let Some(id) = request.id.as_deref() {
        let conflito: Option<String> = sqlx::query_scalar(
            "SELECT a.sigla
               FROM processos_procedimentos p
               JOIN apuratorios a ON a.id = p.apuratorio_id
              WHERE p.id = $1::uuid
                AND p.apuratorio_id <> $2::uuid
                AND EXISTS (SELECT 1 FROM processo_designacoes d WHERE d.processo_id = p.id)",
        )
        .bind(id)
        .bind(&request.apuratorio_id)
        .fetch_optional(&mut **tx)
        .await?;
        if let Some(sigla) = conflito {
            return Err(AppError::Domain(format!(
                "este processo ja tem designacoes registradas como {sigla}; nao e possivel trocar a especie do apuratorio"
            )));
        }
    }

    let id: String = match request.id.as_deref() {
        Some(id) => sqlx::query_scalar(
            "UPDATE processos_procedimentos SET
                     apuratorio_id = $2::uuid, documento_iniciador_id = $3::uuid,
                     numero_documento = $4, numero_controle = $5, processo_sei = $6,
                     numero_rgf = $7, unidade_origem_id = $8::uuid,
                     municipio_fato_id = $9::uuid, natureza_fato_id = $10::uuid,
                     data_instauracao = $11, data_recebimento = $12,
                     data_remessa_comissao = $13, data_julgamento = $14,
                     resumo_fatos = $15,
                     updated_at = now()
                 WHERE id = $1::uuid AND ativo
             RETURNING id::text",
        )
        .bind(id)
        .bind(&request.apuratorio_id)
        .bind(&request.documento_iniciador_id)
        .bind(request.numero_documento.trim())
        .bind(numero_controle)
        .bind(request.processo_sei.as_deref())
        .bind(request.numero_rgf.as_deref())
        .bind(&request.unidade_origem_id)
        .bind(&request.municipio_fato_id)
        .bind(request.natureza_fato_id.as_deref())
        .bind(request.data_instauracao)
        .bind(request.data_recebimento)
        .bind(request.data_remessa_comissao)
        .bind(request.data_julgamento)
        .bind(request.resumo_fatos.as_deref())
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::Domain("processo nao encontrado".to_string()))?,
        None => {
            sqlx::query_scalar(
                "INSERT INTO processos_procedimentos
                     (apuratorio_id, documento_iniciador_id, numero_documento, numero_controle,
                      processo_sei, numero_rgf, unidade_origem_id, municipio_fato_id,
                      natureza_fato_id, data_instauracao, data_recebimento,
                      data_remessa_comissao, data_julgamento, resumo_fatos)
                 VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid, $8::uuid, $9::uuid,
                         $10, $11, $12, $13, $14)
             RETURNING id::text",
            )
            .bind(&request.apuratorio_id)
            .bind(&request.documento_iniciador_id)
            .bind(request.numero_documento.trim())
            .bind(numero_controle)
            .bind(request.processo_sei.as_deref())
            .bind(request.numero_rgf.as_deref())
            .bind(&request.unidade_origem_id)
            .bind(&request.municipio_fato_id)
            .bind(request.natureza_fato_id.as_deref())
            .bind(request.data_instauracao)
            .bind(request.data_recebimento)
            .bind(request.data_remessa_comissao)
            .bind(request.data_julgamento)
            .bind(request.resumo_fatos.as_deref())
            .fetch_one(&mut **tx)
            .await?
        }
    };

    gravar_extensao(tx, &id, request, &config).await?;
    gravar_envolvidos(tx, &id, request).await?;
    gravar_designacoes(tx, &id, request).await?;
    gravar_pessoas(tx, &id, request).await?;

    match data_recebimento_anterior {
        Some(anterior) => {
            deadlines_repository::sync_initial(
                tx,
                &id,
                anterior,
                request.data_recebimento,
                &request.apuratorio_id,
                &request.documento_iniciador_id,
            )
            .await?;
        }
        None => {
            if let Some(data_recebimento) = request.data_recebimento {
                let (dias, _) = deadlines_repository::dias_base(
                    &mut **tx,
                    &request.apuratorio_id,
                    &request.documento_iniciador_id,
                )
                .await?;
                deadlines_repository::create_initial(tx, &id, data_recebimento, dias).await?;
            }
        }
    }

    Ok(id)
}

async fn gravar_extensao(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    request: &SaveProceedingRequest,
    config: &ConfigApuratorio,
) -> Result<(), AppError> {
    // Trocar o apuratório de um processo pode deixar uma extensão órfã.
    if config.codigo_extensao.as_deref() != Some(EXTENSAO_CARTA_PRECATORIA) {
        sqlx::query("DELETE FROM carta_precatoria_detalhes WHERE processo_id = $1::uuid")
            .bind(processo_id)
            .execute(&mut **tx)
            .await?;
        return Ok(());
    }

    let Some(cp) = &request.carta_precatoria else {
        return Ok(());
    };
    sqlx::query(
        "INSERT INTO carta_precatoria_detalhes (processo_id, deprecante, unidade_deprecada_id)
         VALUES ($1::uuid, $2, $3::uuid)
         ON CONFLICT (processo_id) DO UPDATE
            SET deprecante = EXCLUDED.deprecante,
                unidade_deprecada_id = EXCLUDED.unidade_deprecada_id,
                updated_at = now()",
    )
    .bind(processo_id)
    .bind(cp.deprecante.trim())
    .bind(&cp.unidade_deprecada_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Substitui a lista de envolvidos. Quem sai leva junto o próprio enquadramento,
/// por `ON DELETE CASCADE` nas quatro associativas — que é o comportamento certo:
/// o vínculo não tem significado sem o envolvido.
async fn gravar_envolvidos(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    request: &SaveProceedingRequest,
) -> Result<(), AppError> {
    let manter: Vec<String> = request
        .envolvidos
        .iter()
        .map(|e| e.policial_militar_id.clone())
        .collect();

    sqlx::query(
        "DELETE FROM processo_envolvidos
          WHERE processo_id = $1::uuid AND NOT (policial_militar_id::text = ANY($2::text[]))",
    )
    .bind(processo_id)
    .bind(&manter)
    .execute(&mut **tx)
    .await?;

    for envolvido in &request.envolvidos {
        sqlx::query(
            "INSERT INTO processo_envolvidos
                 (processo_id, policial_militar_id, status_envolvido_id, ordem, e_condutor)
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5)
             ON CONFLICT (processo_id, policial_militar_id) DO UPDATE
                SET status_envolvido_id = EXCLUDED.status_envolvido_id,
                    ordem               = EXCLUDED.ordem,
                    e_condutor          = EXCLUDED.e_condutor,
                    updated_at          = now()",
        )
        .bind(processo_id)
        .bind(&envolvido.policial_militar_id)
        .bind(&envolvido.status_envolvido_id)
        .bind(envolvido.ordem)
        .bind(envolvido.e_condutor)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

/// O que já está gravado para o processo, com o que decide se ainda pode mudar.
#[derive(sqlx::FromRow)]
struct DesignacaoGravada {
    id: String,
    papel_id: String,
    papel: String,
    policial_militar_id: String,
    /// `data_fim` preenchida: o militar já saiu do papel. É histórico puro.
    encerrada: bool,
    /// Nasceu de uma substituição. Vigente, mas fora do alcance do cadastro.
    e_substituicao: bool,
}

impl DesignacaoGravada {
    /// Designação que o formulário do processo não altera nem remove. As duas
    /// razões são diferentes e as duas valem: já terminou, ou já é elo de uma
    /// cadeia. Mexer em qualquer das duas reescreveria fato registrado —
    /// princípio 5. A troca de ocupante existe, mas é pela página de detalhes,
    /// que preserva a cadeia.
    fn imutavel(&self) -> bool {
        self.encerrada || self.e_substituicao
    }
}

/// Um papel previsto para o apuratório, como o cadastro o configurou.
#[derive(sqlx::FromRow)]
struct PapelConfigurado {
    papel_id: String,
    papel: String,
    max_ocupantes: i32,
    ativo: bool,
}

/// As regras de designação que dependem do cadastro do apuratório, verificadas
/// ANTES de qualquer escrita.
///
/// Sem isto, cada uma destas situações chegava ao usuário como a frase genérica
/// do banco: a FK composta recusando um papel que a espécie não prevê, e o
/// `tg_max_ocupantes` — que, por ser `DEFERRABLE`, só falha no `commit`, longe
/// da linha que a causou. A aplicação sabe qual linha está errada; é ela que
/// deve dizer.
async fn validar_designacoes(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveProceedingRequest,
) -> Result<(), AppError> {
    let configurados = sqlx::query_as::<_, PapelConfigurado>(
        "SELECT ap.papel_id::text AS papel_id,
                pap.nome          AS papel,
                ap.max_ocupantes  AS max_ocupantes,
                ap.ativo          AS ativo
           FROM apuratorio_papeis ap
           JOIN papeis_processo pap ON pap.id = ap.papel_id
          WHERE ap.apuratorio_id = $1::uuid",
    )
    .bind(&request.apuratorio_id)
    .fetch_all(&mut **tx)
    .await?;

    for designacao in &request.designacoes {
        let Some(config) = configurados
            .iter()
            .find(|c| c.papel_id == designacao.papel_id)
        else {
            return Err(AppError::Domain(
                "A função escolhida não está prevista para esta espécie de apuratório. \
                 Cadastre-a em Catálogos → Apuratórios ou escolha outra."
                    .to_string(),
            ));
        };

        // Papel desativado continua valendo para quem já o exercia (princípio
        // 6), mas não recebe designação nova.
        if !config.ativo && designacao.id.is_none() {
            return Err(AppError::Domain(format!(
                "A função {} foi desativada e não aceita novas designações.",
                config.papel
            )));
        }

        let informados = request
            .designacoes
            .iter()
            .filter(|d| d.papel_id == designacao.papel_id)
            .count();
        if informados > config.max_ocupantes as usize {
            return Err(AppError::Domain(format!(
                "A função {} aceita no máximo {} ocupante(s) ao mesmo tempo, e foram informados {}.",
                config.papel, config.max_ocupantes, informados
            )));
        }
    }
    Ok(())
}

/// Sincroniza as designações **iniciais** do processo, pelo id de cada uma.
///
/// Antes disto a função só inseria o que não existisse, e o formulário não
/// tinha como corrigir um encarregado lançado errado: reeditar com outro militar
/// criava uma segunda designação vigente em vez de arrumar a primeira. O `id`
/// que `DesignacaoRequest` passou a carregar é o que dá alvo ao UPDATE.
///
/// Três campos não vêm do formulário porque não são digitados — são derivados do
/// cabeçalho do processo, e rederivados a cada gravação:
///
/// - `data_inicio` = data de instauração. Corrigir a instauração move junto o
///   início de quem ainda não tem histórico, pelo mesmo motivo que
///   `deadlines::sync_initial` move o prazo inicial quando o recebimento muda:
///   uma informação, uma fonte de verdade (princípio 4).
/// - `documento_autorizador_id` e `numero_documento` = o documento que instaurou
///   o processo, que é o que de fato designou o encarregado inicial.
///
/// **O que a função nunca toca**: designação encerrada e designação nascida de
/// substituição. Ver `DesignacaoGravada::imutavel`.
async fn gravar_designacoes(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    request: &SaveProceedingRequest,
) -> Result<(), AppError> {
    validar_designacoes(tx, request).await?;

    // `FOR UPDATE` porque a decisão de cada linha (atualizar, apagar, recusar)
    // depende do estado lido: sem o travamento, uma substituição concorrente
    // poderia transformar uma linha livre em elo de cadeia entre a leitura e a
    // escrita, e o cadastro a apagaria por baixo da substituição.
    let gravadas = sqlx::query_as::<_, DesignacaoGravada>(
        "SELECT d.id::text                        AS id,
                d.papel_id::text                  AS papel_id,
                pap.nome                          AS papel,
                d.policial_militar_id::text       AS policial_militar_id,
                d.data_fim IS NOT NULL            AS encerrada,
                d.designacao_anterior_id IS NOT NULL AS e_substituicao
           FROM processo_designacoes d
           JOIN papeis_processo pap ON pap.id = d.papel_id
          WHERE d.processo_id = $1::uuid
          ORDER BY d.data_inicio
            FOR UPDATE OF d",
    )
    .bind(processo_id)
    .fetch_all(&mut **tx)
    .await?;

    let mut mantidas: Vec<&str> = Vec::new();

    for designacao in &request.designacoes {
        let Some(id) = designacao.id.as_deref() else {
            // Sem `id`, é linha nova — e linha nova não pode repetir alguém que
            // já ocupa a mesma função. O EXCLUDE do schema também recusaria,
            // mas falando de "período que se sobrepõe", que não é o que o
            // usuário fez: ele acrescentou uma designação repetida.
            if let Some(repetida) = gravadas.iter().find(|g| {
                !g.encerrada
                    && g.papel_id == designacao.papel_id
                    && g.policial_militar_id == designacao.policial_militar_id
            }) {
                return Err(AppError::Domain(format!(
                    "Este militar já está designado como {} neste processo.",
                    repetida.papel
                )));
            }
            inserir_designacao(tx, processo_id, request, designacao).await?;
            continue;
        };

        let Some(gravada) = gravadas.iter().find(|g| g.id == id) else {
            return Err(AppError::Domain(
                "Uma das designações não existe mais neste processo. \
                 Recarregue a página antes de salvar."
                    .to_string(),
            ));
        };
        mantidas.push(id);

        if gravada.imutavel() {
            // Chegou até aqui contornando a tela, que a mostra bloqueada. Se
            // nada mudou é ruído inofensivo do formulário reenviando o que leu;
            // se mudou, é a alteração que a cadeia não admite.
            if gravada.papel_id != designacao.papel_id
                || gravada.policial_militar_id != designacao.policial_militar_id
            {
                return Err(AppError::Domain(format!(
                    "A designação de {} já tem histórico de substituição e não pode ser alterada aqui. \
                     Use Substituir, na página de detalhes do processo.",
                    gravada.papel
                )));
            }
            continue;
        }

        // Só quem entra agora precisa estar ativo. Reeditar um processo cujo
        // encarregado foi desativado depois não pode virar um erro.
        if gravada.policial_militar_id != designacao.policial_militar_id {
            exigir_militar_ativo(tx, &designacao.policial_militar_id).await?;
        }
        atualizar_designacao(tx, processo_id, request, designacao, id).await?;
    }

    for gravada in &gravadas {
        // Designação encerrada é histórico e nunca viaja no formulário: a tela
        // só manda as vigentes. Ausência dela aqui não significa remoção.
        if gravada.encerrada || mantidas.contains(&gravada.id.as_str()) {
            continue;
        }
        if gravada.imutavel() {
            return Err(AppError::Domain(format!(
                "A designação de {} nasceu de uma substituição e não pode ser removida aqui. \
                 Desfaça a substituição na página de detalhes do processo.",
                gravada.papel
            )));
        }
        sqlx::query("DELETE FROM processo_designacoes WHERE id = $1::uuid")
            .bind(&gravada.id)
            .execute(&mut **tx)
            .await?;
    }

    Ok(())
}

async fn inserir_designacao(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    request: &SaveProceedingRequest,
    designacao: &DesignacaoRequest,
) -> Result<(), AppError> {
    exigir_militar_ativo(tx, &designacao.policial_militar_id).await?;
    sqlx::query(
        "INSERT INTO processo_designacoes
             (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio,
              documento_autorizador_id, numero_documento, motivo)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
                 CASE WHEN (SELECT usa_documento_designacao
                                   FROM apuratorio_papeis
                                  WHERE apuratorio_id = $2::uuid AND papel_id = $4::uuid)
                      THEN $6::uuid END,
                 CASE WHEN (SELECT usa_documento_designacao
                                   FROM apuratorio_papeis
                                  WHERE apuratorio_id = $2::uuid AND papel_id = $4::uuid)
                      THEN $7 END,
                 $8)",
    )
    .bind(processo_id)
    .bind(&request.apuratorio_id)
    .bind(&designacao.policial_militar_id)
    .bind(&designacao.papel_id)
    .bind(request.data_instauracao)
    .bind(&request.documento_iniciador_id)
    .bind(request.numero_documento.trim())
    .bind(MOTIVO_DESIGNACAO_INICIAL)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn atualizar_designacao(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    request: &SaveProceedingRequest,
    designacao: &DesignacaoRequest,
    id: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE processo_designacoes
            SET policial_militar_id      = $3::uuid,
                papel_id                 = $4::uuid,
                data_inicio              = $5,
                documento_autorizador_id = CASE WHEN (SELECT usa_documento_designacao
                                                         FROM apuratorio_papeis
                                                        WHERE apuratorio_id = $9::uuid
                                                          AND papel_id = $4::uuid)
                                                   THEN $6::uuid END,
                numero_documento         = CASE WHEN (SELECT usa_documento_designacao
                                                         FROM apuratorio_papeis
                                                        WHERE apuratorio_id = $9::uuid
                                                          AND papel_id = $4::uuid)
                                                   THEN $7 END,
                motivo                   = $8,
                updated_at               = now()
          WHERE id = $1::uuid AND processo_id = $2::uuid",
    )
    .bind(id)
    .bind(processo_id)
    .bind(&designacao.policial_militar_id)
    .bind(&designacao.papel_id)
    .bind(request.data_instauracao)
    .bind(&request.documento_iniciador_id)
    .bind(request.numero_documento.trim())
    .bind(MOTIVO_DESIGNACAO_INICIAL)
    .bind(&request.apuratorio_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Militar desativado não recebe designação nova.
///
/// A recíproca **não** vale, e é por isso que a checagem está aqui e não na
/// leitura: quem já exercia um papel continua exibido depois de desativado, e
/// reeditar o processo não pode apagar esse vínculo (princípio 6).
async fn exigir_militar_ativo(
    tx: &mut Transaction<'_, Postgres>,
    policial_militar_id: &str,
) -> Result<(), AppError> {
    let ativo: Option<bool> =
        sqlx::query_scalar("SELECT ativo FROM policiais_militares WHERE id = $1::uuid")
            .bind(policial_militar_id)
            .fetch_optional(&mut **tx)
            .await?;
    match ativo {
        Some(true) => Ok(()),
        Some(false) => Err(AppError::Domain(
            "O militar escolhido está desativado e não pode receber designação.".to_string(),
        )),
        None => Err(AppError::Domain(
            "O militar escolhido não existe mais no cadastro.".to_string(),
        )),
    }
}

async fn gravar_pessoas(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    request: &SaveProceedingRequest,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM processo_pessoas WHERE processo_id = $1::uuid")
        .bind(processo_id)
        .execute(&mut **tx)
        .await?;
    for pessoa in &request.pessoas {
        sqlx::query(
            "INSERT INTO processo_pessoas (processo_id, papel_pessoa_id, nome, ordem)
             VALUES ($1::uuid, $2::uuid, $3, $4)",
        )
        .bind(processo_id)
        .bind(&pessoa.papel_pessoa_id)
        .bind(pessoa.nome.trim().to_uppercase())
        .bind(pessoa.ordem)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

// ── Substituição: criar, corrigir e desfazer ─────────────────────────────────
//
// As três operam sobre a MESMA cadeia e compartilham o mesmo cuidado: travar as
// linhas envolvidas com `FOR UPDATE` e reverificar tudo no banco. Nenhuma delas
// confia no que a tela mandou — o IPC é chamável direto, e duas janelas do app
// podem estar na mesma página.

/// Uma designação com o que as regras da cadeia precisam saber, já travada.
#[derive(sqlx::FromRow)]
struct DesignacaoTravada {
    id: String,
    apuratorio_id: String,
    papel_id: String,
    papel: String,
    usa_documento_designacao: bool,
    policial_militar_id: String,
    ocupante: String,
    data_inicio: chrono::NaiveDate,
    data_fim: Option<chrono::NaiveDate>,
    designacao_anterior_id: Option<String>,
}

/// Ids que a substituição mexeu. Os dois são auditados: a antecessora muda de
/// estado tanto quanto a sucessora, e uma trilha que registrasse só uma das duas
/// não explicaria o que aconteceu com a outra.
pub struct SubstituicaoAplicada {
    pub designacao_id: String,
    pub anterior_id: String,
}

/// Lê e trava uma designação do processo. `None` quando o id não é do processo
/// informado — o que também cobre a tentativa de alcançar designação alheia
/// passando um id qualquer pelo IPC.
async fn travar_designacao(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    designacao_id: &str,
) -> Result<Option<DesignacaoTravada>, AppError> {
    sqlx::query_as::<_, DesignacaoTravada>(
        "SELECT d.id::text                    AS id,
                d.apuratorio_id::text         AS apuratorio_id,
                d.papel_id::text              AS papel_id,
                pap.nome                      AS papel,
                ap.usa_documento_designacao   AS usa_documento_designacao,
                d.policial_militar_id::text   AS policial_militar_id,
                pg.sigla || ' ' || pm.nome    AS ocupante,
                d.data_inicio                 AS data_inicio,
                d.data_fim                    AS data_fim,
                d.designacao_anterior_id::text AS designacao_anterior_id
           FROM processo_designacoes d
           JOIN papeis_processo pap    ON pap.id = d.papel_id
           JOIN apuratorio_papeis ap   ON ap.apuratorio_id = d.apuratorio_id
                                      AND ap.papel_id = d.papel_id
           JOIN policiais_militares pm ON pm.id = d.policial_militar_id
           JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
          WHERE d.id = $1::uuid AND d.processo_id = $2::uuid
            FOR UPDATE OF d",
    )
    .bind(designacao_id)
    .bind(processo_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(AppError::from)
}

const DESIGNACAO_AUSENTE: &str = "A designação informada não pertence a este processo. \
                                  Recarregue a página e tente de novo.";

/// Regras comuns a criar e a corrigir uma substituição: quem sai, quem entra e
/// quando. `antecessora` é sempre a designação que será encerrada na troca.
async fn validar_troca(
    tx: &mut Transaction<'_, Postgres>,
    antecessora: &DesignacaoTravada,
    sucessor_id: &str,
    data_troca: chrono::NaiveDate,
) -> Result<(), AppError> {
    if data_troca <= antecessora.data_inicio {
        return Err(AppError::Domain(format!(
            "A substituição precisa ser posterior a {}, quando {} assumiu como {}.",
            antecessora.data_inicio.format("%d/%m/%Y"),
            antecessora.ocupante,
            antecessora.papel
        )));
    }
    if antecessora.policial_militar_id == sucessor_id {
        return Err(AppError::Domain(format!(
            "{} já ocupa a função de {}. Escolha outro militar como sucessor.",
            antecessora.ocupante, antecessora.papel
        )));
    }
    exigir_militar_ativo(tx, sucessor_id).await
}

/// Encerra uma designação vigente e abre a do sucessor no MESMO dia.
///
/// `data_fim` é exclusiva (decisão 6): os períodos se encostam sem sobrepor e
/// sem lacuna, com uma data só registrada. O vínculo `designacao_anterior_id` é
/// o que torna a troca reversível depois.
pub async fn substituir_designacao(
    tx: &mut Transaction<'_, Postgres>,
    request: &SubstituirDesignacaoRequest,
) -> Result<SubstituicaoAplicada, AppError> {
    crate::db::processo::exigir_em_andamento(
        tx,
        &request.processo_id,
        "registrar uma substituição",
    )
    .await?;
    let antecessora = travar_designacao(tx, &request.processo_id, &request.designacao_id)
        .await?
        .ok_or_else(|| AppError::Domain(DESIGNACAO_AUSENTE.to_string()))?;

    if antecessora.data_fim.is_some() {
        return Err(AppError::Domain(format!(
            "A designação de {} como {} já foi encerrada em {}. \
             Substitua quem está vigente na função.",
            antecessora.ocupante,
            antecessora.papel,
            antecessora
                .data_fim
                .expect("data_fim conferida logo acima")
                .format("%d/%m/%Y")
        )));
    }

    validar_troca(tx, &antecessora, &request.sucessor_id, request.data_troca).await?;

    sqlx::query(
        "UPDATE processo_designacoes SET data_fim = $2, updated_at = now() WHERE id = $1::uuid",
    )
    .bind(&antecessora.id)
    .bind(request.data_troca)
    .execute(&mut **tx)
    .await?;

    let documento = antecessora
        .usa_documento_designacao
        .then(|| texto_opcional(request.documento_autorizador_id.as_deref()))
        .flatten();
    let numero_documento = antecessora
        .usa_documento_designacao
        .then(|| texto_opcional(request.numero_documento.as_deref()))
        .flatten();
    let designacao_id: String = sqlx::query_scalar(
        "INSERT INTO processo_designacoes
             (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio,
              documento_autorizador_id, numero_documento, motivo, designacao_anterior_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::uuid, $7, $8, $9::uuid)
      RETURNING id::text",
    )
    .bind(&request.processo_id)
    .bind(&antecessora.apuratorio_id)
    .bind(&request.sucessor_id)
    .bind(&antecessora.papel_id)
    .bind(request.data_troca)
    .bind(documento)
    .bind(numero_documento)
    .bind(request.motivo.trim())
    .bind(&antecessora.id)
    .fetch_one(&mut **tx)
    .await?;

    Ok(SubstituicaoAplicada {
        designacao_id,
        anterior_id: antecessora.id,
    })
}

/// A substituição que está na ponta da cadeia, travada junto com a antecessora.
///
/// "Última" é por CADEIA, não pelo processo nem pelo papel: uma designação
/// vigente que tem antecessora é a ponta da sua própria cadeia. A diferença
/// aparece quando um papel admite dois ocupantes — a configuração de Escrivão
/// prevê isso —, e aí corrigir a troca de um escrivão não pode depender da troca
/// do outro. Ser vigente (`data_fim IS NULL`) já garante que nada a sucedeu.
async fn travar_ultima_substituicao(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    designacao_id: &str,
) -> Result<(DesignacaoTravada, DesignacaoTravada), AppError> {
    let sucessora = travar_designacao(tx, processo_id, designacao_id)
        .await?
        .ok_or_else(|| AppError::Domain(DESIGNACAO_AUSENTE.to_string()))?;

    let Some(anterior_id) = sucessora.designacao_anterior_id.clone() else {
        return Err(AppError::Domain(format!(
            "A designação de {} como {} é a inicial do processo, não uma substituição. \
             Corrija-a pelo cadastro do processo.",
            sucessora.ocupante, sucessora.papel
        )));
    };

    if sucessora.data_fim.is_some() {
        return Err(AppError::Domain(format!(
            "Esta substituição de {} já foi sucedida por outra. \
             Desfaça primeiro a substituição mais recente da função.",
            sucessora.papel
        )));
    }

    let anterior = travar_designacao(tx, processo_id, &anterior_id)
        .await?
        .ok_or_else(|| AppError::Domain(DESIGNACAO_AUSENTE.to_string()))?;

    Ok((sucessora, anterior))
}

/// Corrige a última substituição da cadeia sem abrir lacuna nem sobreposição.
///
/// A data move as DUAS linhas: é uma data só, o fim da antecessora e o início da
/// sucessora. Alterar apenas uma delas é o que produziria o buraco — e é também
/// o que `tg_cadeia_designacao` recusa no `commit`, caso algum caminho futuro
/// tente.
pub async fn atualizar_substituicao(
    tx: &mut Transaction<'_, Postgres>,
    request: &AtualizarSubstituicaoRequest,
) -> Result<SubstituicaoAplicada, AppError> {
    let (sucessora, anterior) =
        travar_ultima_substituicao(tx, &request.processo_id, &request.designacao_id).await?;

    validar_troca(tx, &anterior, &request.sucessor_id, request.data_troca).await?;

    let documento = sucessora
        .usa_documento_designacao
        .then(|| texto_opcional(request.documento_autorizador_id.as_deref()))
        .flatten();
    let numero_documento = sucessora
        .usa_documento_designacao
        .then(|| texto_opcional(request.numero_documento.as_deref()))
        .flatten();

    sqlx::query(
        "UPDATE processo_designacoes SET data_fim = $2, updated_at = now() WHERE id = $1::uuid",
    )
    .bind(&anterior.id)
    .bind(request.data_troca)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "UPDATE processo_designacoes
            SET policial_militar_id      = $2::uuid,
                data_inicio              = $3,
                documento_autorizador_id = $4::uuid,
                numero_documento         = $5,
                motivo                   = $6,
                updated_at               = now()
          WHERE id = $1::uuid",
    )
    .bind(&sucessora.id)
    .bind(&request.sucessor_id)
    .bind(request.data_troca)
    .bind(documento)
    .bind(numero_documento)
    .bind(request.motivo.trim())
    .execute(&mut **tx)
    .await?;

    Ok(SubstituicaoAplicada {
        designacao_id: sucessora.id,
        anterior_id: anterior.id,
    })
}

/// Desfaz a última substituição da cadeia: apaga a sucessora e reabre a
/// antecessora.
///
/// Reabrir é limpar `data_fim` — a vigência é derivada dela, não de uma coluna
/// `ativo`. Feito isto, a substituição anterior passa a ser a ponta da cadeia e
/// pode ser desfeita em seguida, uma a uma, de trás para frente. É o mesmo
/// desenho de `deadlines::delete_extension`.
pub async fn remover_substituicao(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    designacao_id: &str,
) -> Result<SubstituicaoAplicada, AppError> {
    let (sucessora, anterior) = travar_ultima_substituicao(tx, processo_id, designacao_id).await?;

    // Nesta ordem: enquanto a sucessora existir, a FK `fk_designacao_anterior`
    // segura a antecessora — que é exatamente o que impede alguém apagar o meio
    // da cadeia por fora.
    sqlx::query("DELETE FROM processo_designacoes WHERE id = $1::uuid")
        .bind(&sucessora.id)
        .execute(&mut **tx)
        .await?;

    sqlx::query(
        "UPDATE processo_designacoes SET data_fim = NULL, updated_at = now() WHERE id = $1::uuid",
    )
    .bind(&anterior.id)
    .execute(&mut **tx)
    .await?;

    Ok(SubstituicaoAplicada {
        designacao_id: sucessora.id,
        anterior_id: anterior.id,
    })
}

/// Campo de texto opcional vindo da tela: em branco é ausência, não string
/// vazia. Sem isto, um `<input>` intocado gravaria `''` e o documento passaria a
/// "existir" vazio no histórico.
fn texto_opcional(valor: Option<&str>) -> Option<String> {
    valor
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
}

/// Atualiza somente as datas registradas depois do cadastro. Uma conclusão já
/// gravada pode ser corrigida aqui, mas sua remoção continua sendo a operação
/// explícita `reopen`, com autorização e auditoria próprias.
pub async fn update_closure(
    tx: &mut Transaction<'_, Postgres>,
    request: &UpdateProceedingClosureRequest,
) -> Result<(), AppError> {
    let (data_instauracao, conclusao_atual): (chrono::NaiveDate, Option<chrono::NaiveDate>) =
        sqlx::query_as(
            "SELECT data_instauracao, data_conclusao
               FROM processos_procedimentos
              WHERE id = $1::uuid AND ativo
              FOR UPDATE",
        )
        .bind(&request.processo_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::Domain("processo nao encontrado".to_string()))?;

    if request
        .data_remessa_encarregado
        .is_some_and(|data| data < data_instauracao)
    {
        return Err(AppError::Domain(
            "A remessa do encarregado não pode ser anterior à instauração.".to_string(),
        ));
    }
    if request
        .data_conclusao
        .is_some_and(|data| data < data_instauracao)
    {
        return Err(AppError::Domain(
            "A conclusão não pode ser anterior à instauração.".to_string(),
        ));
    }
    if conclusao_atual.is_some() && request.data_conclusao.is_none() {
        return Err(AppError::Domain(
            "Para remover a conclusão, use a ação Reabrir processo.".to_string(),
        ));
    }

    sqlx::query(
        "UPDATE processos_procedimentos
            SET data_remessa_encarregado = $2, data_conclusao = $3, updated_at = now()
          WHERE id = $1::uuid AND ativo",
    )
    .bind(&request.processo_id)
    .bind(request.data_remessa_encarregado)
    .bind(request.data_conclusao)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Atualiza o resultado de um único envolvido sem regravar os demais dados do
/// processo. Os atributos dos catálogos, e não seus nomes, controlam punição e
/// quantidade de dias.
pub async fn update_involved_outcome(
    tx: &mut Transaction<'_, Postgres>,
    request: &UpdateInvolvedOutcomeRequest,
) -> Result<(), AppError> {
    let permite_punicao: bool = sqlx::query_scalar(
        "SELECT a.permite_punicao
           FROM processo_envolvidos e
           JOIN processos_procedimentos p ON p.id = e.processo_id AND p.ativo
           JOIN apuratorios a ON a.id = p.apuratorio_id
          WHERE e.id = $1::uuid AND e.processo_id = $2::uuid
          FOR UPDATE OF e",
    )
    .bind(&request.envolvido_id)
    .bind(&request.processo_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::Domain("envolvido nao encontrado neste processo".to_string()))?;

    if request.penalidade_tipo_id.is_some() {
        if !permite_punicao {
            return Err(AppError::Domain(
                "este apuratório não permite registrar penalidade".to_string(),
            ));
        }
        let permite_penalidade: bool = match request.solucao_decidida_id.as_deref() {
            Some(id) => sqlx::query_scalar(
                "SELECT permite_penalidade FROM tipos_solucao_decidida WHERE id = $1::uuid",
            )
            .bind(id)
            .fetch_optional(&mut **tx)
            .await?
            .unwrap_or(false),
            None => false,
        };
        if !permite_penalidade {
            return Err(AppError::Domain(
                "a solução decidida selecionada não permite penalidade".to_string(),
            ));
        }
    }

    if let Some(penalidade_id) = request.penalidade_tipo_id.as_deref() {
        let usa_dias: bool = sqlx::query_scalar(
            "SELECT usa_quantidade_dias FROM tipos_penalidade WHERE id = $1::uuid",
        )
        .bind(penalidade_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::Domain("tipo de penalidade não encontrado".to_string()))?;
        if request.penalidade_dias.is_some() && !usa_dias {
            return Err(AppError::Domain(
                "este tipo de penalidade não usa quantidade de dias".to_string(),
            ));
        }
    } else if request.penalidade_dias.is_some() {
        return Err(AppError::Domain(
            "selecione a penalidade antes de informar a quantidade de dias".to_string(),
        ));
    }

    sqlx::query(
        "UPDATE processo_envolvidos
            SET solucao_sugerida_id = $3::uuid, solucao_decidida_id = $4::uuid,
                penalidade_tipo_id = $5::uuid, penalidade_dias = $6, updated_at = now()
          WHERE id = $1::uuid AND processo_id = $2::uuid",
    )
    .bind(&request.envolvido_id)
    .bind(&request.processo_id)
    .bind(request.solucao_sugerida_id.as_deref())
    .bind(request.solucao_decidida_id.as_deref())
    .bind(request.penalidade_tipo_id.as_deref())
    .bind(request.penalidade_dias)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn soft_delete(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), AppError> {
    let n = sqlx::query(
        "UPDATE processos_procedimentos SET ativo = false, updated_at = now() WHERE id = $1::uuid",
    )
    .bind(id)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::Domain("processo nao encontrado".to_string()));
    }
    Ok(())
}

/// Reabrir é limpar a data de conclusão — que é o que define "concluído".
pub async fn reopen(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), AppError> {
    let n = sqlx::query(
        "UPDATE processos_procedimentos SET data_conclusao = NULL, updated_at = now()
          WHERE id = $1::uuid AND ativo",
    )
    .bind(id)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::Domain("processo nao encontrado".to_string()));
    }
    Ok(())
}

// ── Anexos ───────────────────────────────────────────────────────────────────

/// Um processo pode ter vários anexos — antes eram cinco colunas `pdf_*` dentro
/// de cada tabela de espécie, coexistindo com uma tabela de PDFs nunca usada.
pub async fn upload_anexo(
    tx: &mut Transaction<'_, Postgres>,
    request: &UploadAttachmentRequest,
    autor_id: &str,
) -> Result<String, AppError> {
    let conteudo = base64::engine::general_purpose::STANDARD
        .decode(request.conteudo.as_bytes())
        .map_err(|_| AppError::Domain("conteudo do anexo nao esta em base64".to_string()))?;

    if conteudo.is_empty() {
        return Err(AppError::Domain("o anexo esta vazio".to_string()));
    }
    if conteudo.len() > MAX_ANEXO_BYTES {
        return Err(AppError::Domain(format!(
            "o anexo excede o limite de {} MB",
            MAX_ANEXO_BYTES / 1024 / 1024
        )));
    }

    sqlx::query_scalar(
        "INSERT INTO processo_anexos
             (processo_id, nome_arquivo, mime_type, conteudo, enviado_por_id)
         VALUES ($1::uuid, $2, $3, $4, $5::uuid)
      RETURNING id::text",
    )
    .bind(&request.processo_id)
    .bind(request.nome_arquivo.trim())
    .bind(request.mime_type.trim())
    .bind(conteudo)
    .bind(autor_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(AppError::from)
}

pub async fn get_anexo(
    pool: &PgPool,
    anexo_id: &str,
) -> Result<Option<AttachmentContent>, sqlx::Error> {
    let linha: Option<(String, String, Vec<u8>)> = sqlx::query_as(
        "SELECT nome_arquivo, mime_type, conteudo FROM processo_anexos
          WHERE id = $1::uuid AND cancelado_em IS NULL",
    )
    .bind(anexo_id)
    .fetch_optional(pool)
    .await?;

    Ok(
        linha.map(|(nome_arquivo, mime_type, conteudo)| AttachmentContent {
            nome_arquivo,
            mime_type,
            conteudo: base64::engine::general_purpose::STANDARD.encode(conteudo),
        }),
    )
}

pub async fn remove_anexo(
    tx: &mut Transaction<'_, Postgres>,
    anexo_id: &str,
) -> Result<(), AppError> {
    let n = sqlx::query(
        "UPDATE processo_anexos SET cancelado_em = now()
          WHERE id = $1::uuid AND cancelado_em IS NULL",
    )
    .bind(anexo_id)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::Domain("anexo nao encontrado".to_string()));
    }
    Ok(())
}

// ── Dashboard ────────────────────────────────────────────────────────────────

/// Panorama geral. Todo agrupamento é por FK; nenhuma sigla ou nome aparece no
/// SQL, então cadastrar um apuratório novo o inclui no painel automaticamente.
pub async fn dashboard(pool: &PgPool) -> Result<DashboardSummary, sqlx::Error> {
    let (total, em_andamento, concluidos): (i64, i64, i64) = sqlx::query_as(
        "SELECT count(*),
                count(*) FILTER (WHERE data_conclusao IS NULL),
                count(*) FILTER (WHERE data_conclusao IS NOT NULL)
           FROM processos_procedimentos WHERE ativo",
    )
    .fetch_one(pool)
    .await?;

    let prazos_vencidos: i64 = sqlx::query_scalar(
        "SELECT count(*)
           FROM processos_procedimentos p
           JOIN LATERAL (
               SELECT pr.data_vencimento FROM processo_prazos pr
                WHERE pr.processo_id = p.id ORDER BY pr.ordem DESC LIMIT 1
           ) prazo ON true
          WHERE p.ativo AND p.data_conclusao IS NULL
            AND prazo.data_vencimento < CURRENT_DATE",
    )
    .fetch_one(pool)
    .await?;

    let por_apuratorio = sqlx::query_as::<_, ContagemRotulada>(
        "SELECT a.id::text AS id, a.sigla AS rotulo, count(*) AS total
           FROM processos_procedimentos p
           JOIN apuratorios a ON a.id = p.apuratorio_id
          WHERE p.ativo GROUP BY a.id, a.sigla ORDER BY total DESC",
    )
    .fetch_all(pool)
    .await?;

    let por_natureza = sqlx::query_as::<_, ContagemRotulada>(
        "SELECT nf.id::text AS id, nf.nome AS rotulo, count(*) AS total
           FROM processos_procedimentos p
           JOIN naturezas_fato nf ON nf.id = p.natureza_fato_id
          WHERE p.ativo GROUP BY nf.id, nf.nome ORDER BY total DESC",
    )
    .fetch_all(pool)
    .await?;

    let por_unidade = sqlx::query_as::<_, ContagemRotulada>(
        "SELECT un.id::text AS id, un.nome AS rotulo, count(*) AS total
           FROM processos_procedimentos p
           JOIN unidades_pm un ON un.id = p.unidade_origem_id
          WHERE p.ativo GROUP BY un.id, un.nome ORDER BY total DESC",
    )
    .fetch_all(pool)
    .await?;

    // Ano é derivado da data de instauração — não existe coluna `ano_instauracao`.
    let por_ano = sqlx::query_as::<_, ContagemRotulada>(
        "SELECT EXTRACT(YEAR FROM data_instauracao)::int::text AS id,
                EXTRACT(YEAR FROM data_instauracao)::int::text AS rotulo,
                count(*) AS total
           FROM processos_procedimentos WHERE ativo
          GROUP BY 1 ORDER BY 1 DESC",
    )
    .fetch_all(pool)
    .await?;

    Ok(DashboardSummary {
        total,
        em_andamento,
        concluidos,
        prazos_vencidos,
        por_apuratorio,
        por_natureza,
        por_unidade,
        por_ano,
    })
}
