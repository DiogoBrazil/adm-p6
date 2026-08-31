use chrono::NaiveDate;
use sqlx::{PgExecutor, PgPool, Postgres, Transaction};

use crate::db::paginacao::Recorte;
use crate::deadlines::domain::{
    AddExtensionRequest, DeadlineItem, DeadlineReportFilter, DeadlineReportItem,
    DeadlineReportResult, DeadlineSummary, UpdateExtensionRequest,
};
use crate::error::AppError;

/// Prazo vigente de um processo: o de maior `ordem`. Não há coluna `ativo` —
/// a vigência é derivada, e o EXCLUDE do schema garante que os períodos nunca
/// se sobrepõem.
const VIGENTE: &str = r#"
    p.id IN (
        SELECT DISTINCT ON (processo_id) id FROM processo_prazos
         ORDER BY processo_id, ordem DESC
    )
"#;

/// Dias de prazo de uma combinação apuratório × documento iniciador.
/// O override que antes era `if documento_iniciador == "Feito Preliminar" { 15 }`
/// virou dado: `apuratorio_documentos_iniciadores.prazo_base_dias`.
pub async fn dias_base<'e, E: PgExecutor<'e>>(
    executor: E,
    apuratorio_id: &str,
    documento_iniciador_id: &str,
) -> Result<(i32, bool), sqlx::Error> {
    let (dias, do_documento): (i32, bool) = sqlx::query_as(
        "SELECT COALESCE(adi.prazo_base_dias, a.prazo_base_dias),
                adi.prazo_base_dias IS NOT NULL
           FROM apuratorios a
           JOIN apuratorio_documentos_iniciadores adi
             ON adi.apuratorio_id = a.id AND adi.tipo_documento_id = $2::uuid
          WHERE a.id = $1::uuid",
    )
    .bind(apuratorio_id)
    .bind(documento_iniciador_id)
    .fetch_one(executor)
    .await?;
    Ok((dias, do_documento))
}

/// Cria o prazo inicial (ordem 0). O vencimento é calculado pelo banco, na coluna
/// gerada `data_inicio + dias` — não há aritmética de prazo em Rust.
pub async fn create_initial(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    data_inicio: NaiveDate,
    dias: i32,
) -> Result<String, sqlx::Error> {
    sqlx::query_scalar(
        "INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias)
         VALUES ($1::uuid, 0, $2, $3)
      RETURNING id::text",
    )
    .bind(processo_id)
    .bind(data_inicio)
    .bind(dias)
    .fetch_one(&mut **tx)
    .await
}

/// Mantém a data de recebimento e o prazo inicial como um único fato.
///
/// Antes desta sincronização, a edição alterava apenas
/// `processos_procedimentos.data_recebimento`; a linha de ordem zero continuava
/// com a data antiga e todas as leituras de prazo exibiam o vencimento anterior.
/// Os dias já concedidos são preservados quando só a data é corrigida. Depois
/// que existe prorrogação, a cadeia é histórico e não pode ser reescrita pelo
/// formulário do processo.
pub async fn sync_initial(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    data_anterior: Option<NaiveDate>,
    data_nova: Option<NaiveDate>,
    apuratorio_id: &str,
    documento_iniciador_id: &str,
) -> Result<(), AppError> {
    let tem_prorrogacao: bool = sqlx::query_scalar(
        "SELECT EXISTS (
             SELECT 1 FROM processo_prazos
              WHERE processo_id = $1::uuid AND ordem > 0
         )",
    )
    .bind(processo_id)
    .fetch_one(&mut **tx)
    .await?;

    if tem_prorrogacao {
        if data_anterior != data_nova {
            return Err(AppError::Domain(
                "A data de recebimento não pode ser alterada porque este apuratório já possui prorrogação de prazo.".to_string(),
            ));
        }
        return Ok(());
    }

    let prazo_inicial: Option<NaiveDate> = sqlx::query_scalar(
        "SELECT data_inicio FROM processo_prazos
          WHERE processo_id = $1::uuid AND ordem = 0",
    )
    .bind(processo_id)
    .fetch_optional(&mut **tx)
    .await?;

    match (prazo_inicial, data_nova) {
        (Some(_), None) => {
            sqlx::query(
                "DELETE FROM processo_prazos
                  WHERE processo_id = $1::uuid AND ordem = 0",
            )
            .bind(processo_id)
            .execute(&mut **tx)
            .await?;
        }
        (Some(atual), Some(nova)) if atual != nova => {
            sqlx::query(
                "UPDATE processo_prazos
                    SET data_inicio = $2, updated_at = now()
                  WHERE processo_id = $1::uuid AND ordem = 0",
            )
            .bind(processo_id)
            .bind(nova)
            .execute(&mut **tx)
            .await?;
        }
        (None, Some(nova)) => {
            let (dias, _) = dias_base(&mut **tx, apuratorio_id, documento_iniciador_id).await?;
            create_initial(tx, processo_id, nova, dias).await?;
        }
        _ => {}
    }

    Ok(())
}

pub async fn list(pool: &PgPool, processo_id: &str) -> Result<Vec<DeadlineItem>, sqlx::Error> {
    sqlx::query_as::<_, DeadlineItem>(&format!(
        "SELECT p.id::text                      AS id,
                p.processo_id::text             AS processo_id,
                p.ordem                         AS ordem,
                p.data_inicio                   AS data_inicio,
                p.dias                          AS dias,
                p.data_vencimento               AS data_vencimento,
                p.motivo                        AS motivo,
                p.documento_autorizador_id::text AS documento_autorizador_id,
                td.nome                         AS documento_autorizador,
                p.numero_documento              AS numero_documento,
                p.data_documento                AS data_documento,
                p.autoridade_id::text           AS autoridade_id,
                CASE WHEN pm.id IS NULL THEN NULL
                     ELSE pg.sigla || ' ' || pm.matricula || ' ' || pm.nome END AS autoridade,
                {VIGENTE}                       AS vigente
           FROM processo_prazos p
           LEFT JOIN tipos_documento td     ON td.id = p.documento_autorizador_id
           LEFT JOIN policiais_militares pm ON pm.id = p.autoridade_id
           LEFT JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
          WHERE p.processo_id = $1::uuid
          ORDER BY p.ordem"
    ))
    .bind(processo_id)
    .fetch_all(pool)
    .await
}

/// Concede uma prorrogação: ela começa NO DIA do vencimento vigente e recebe a
/// próxima `ordem`. É a convenção que a Seção sempre praticou — 97 de 97
/// prorrogações do histórico começam no dia em que o prazo anterior vence —, e
/// o EXCLUDE da migration 0005 a acomoda comparando o intervalo de ocupação
/// como `[data_inicio, data_inicio + dias)`. `data_vencimento` continua sendo o
/// último dia válido do prazo; o que o dia da troca não faz é ser ocupado duas
/// vezes. Qualquer sobreposição real continua recusada pelo banco, então não é
/// possível prorrogar duas vezes a partir do mesmo ponto. O usuário informa o
/// novo vencimento; `dias` continua persistido como a diferença entre ele e o
/// vencimento atual, preservando a coluna gerada como fonte da aritmética.
pub async fn add_extension(
    tx: &mut Transaction<'_, Postgres>,
    request: &AddExtensionRequest,
) -> Result<String, AppError> {
    crate::db::processo::exigir_em_andamento(
        tx,
        &request.processo_id,
        "adicionar uma prorrogação de prazo",
    )
    .await?;
    let atual: Option<(i32, NaiveDate)> = sqlx::query_as(
        "SELECT ordem, data_vencimento FROM processo_prazos
          WHERE processo_id = $1::uuid ORDER BY ordem DESC LIMIT 1 FOR UPDATE",
    )
    .bind(&request.processo_id)
    .fetch_optional(&mut **tx)
    .await?;

    let (ordem_atual, vencimento_atual) = atual.ok_or_else(|| {
        AppError::Domain(
            "O apuratório ainda não tem prazo inicial. Informe a data de recebimento para que ele seja criado."
                .to_string(),
        )
    })?;

    let dias = request
        .nova_data_vencimento
        .signed_duration_since(vencimento_atual)
        .num_days();
    if dias <= 0 {
        return Err(AppError::Domain(format!(
            "A nova data de vencimento deve ser posterior ao vencimento atual ({}).",
            vencimento_atual.format("%d/%m/%Y")
        )));
    }
    let dias = i32::try_from(dias).map_err(|_| {
        AppError::Domain("O intervalo informado para a prorrogação é muito longo.".to_string())
    })?;

    sqlx::query_scalar(
        "INSERT INTO processo_prazos
             (processo_id, ordem, data_inicio, dias, motivo,
              documento_autorizador_id, numero_documento, data_documento, autoridade_id)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, $7, $8, $9::uuid)
      RETURNING id::text",
    )
    .bind(&request.processo_id)
    .bind(ordem_atual + 1)
    .bind(vencimento_atual)
    .bind(dias)
    .bind(request.motivo.trim())
    .bind(request.documento_autorizador_id.as_deref())
    .bind(request.numero_documento.as_deref())
    .bind(request.data_documento)
    .bind(request.autoridade_id.as_deref())
    .fetch_one(&mut **tx)
    .await
    .map_err(AppError::from)
}

/// Corrige somente a ultima prorrogacao. Como o seu `data_inicio` e o
/// vencimento anterior, alterar `dias` preserva a cadeia e permite tanto
/// antecipar quanto postergar o vencimento atual, sem alcancar o prazo
/// anterior.
pub async fn update_extension(
    tx: &mut Transaction<'_, Postgres>,
    request: &UpdateExtensionRequest,
) -> Result<bool, AppError> {
    let atual: Option<(String, i32, NaiveDate)> = sqlx::query_as(
        "SELECT id::text, ordem, data_inicio FROM processo_prazos
          WHERE processo_id = $1::uuid ORDER BY ordem DESC LIMIT 1 FOR UPDATE",
    )
    .bind(&request.processo_id)
    .fetch_optional(&mut **tx)
    .await?;

    let (prazo_atual_id, ordem, data_inicio) = atual.ok_or_else(|| {
        AppError::Domain("O apuratório ainda não possui prazo para editar.".to_string())
    })?;
    if ordem == 0 {
        return Err(AppError::Domain(
            "O prazo inicial não pode ser editado como prorrogação.".to_string(),
        ));
    }
    if prazo_atual_id != request.prazo_id {
        return Err(AppError::Domain(
            "Somente a última prorrogação pode ser editada.".to_string(),
        ));
    }

    let dias = request
        .nova_data_vencimento
        .signed_duration_since(data_inicio)
        .num_days();
    if dias <= 0 {
        return Err(AppError::Domain(format!(
            "A nova data de vencimento deve ser posterior ao prazo anterior ({}).",
            data_inicio.format("%d/%m/%Y")
        )));
    }
    let dias = i32::try_from(dias).map_err(|_| {
        AppError::Domain("O intervalo informado para a prorrogação é muito longo.".to_string())
    })?;

    let alteradas = sqlx::query(
        "UPDATE processo_prazos
            SET dias = $3, updated_at = now()
          WHERE id = $1::uuid AND processo_id = $2::uuid",
    )
    .bind(&request.prazo_id)
    .bind(&request.processo_id)
    .bind(dias)
    .execute(&mut **tx)
    .await?
    .rows_affected();

    Ok(alteradas == 1)
}

/// Remove somente a ultima prorrogacao. A vigencia e derivada da maior ordem,
/// portanto o registro anterior volta a ser vigente sem atualizacao adicional.
pub async fn delete_extension(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    prazo_id: &str,
) -> Result<bool, AppError> {
    let atual: Option<(String, i32)> = sqlx::query_as(
        "SELECT id::text, ordem FROM processo_prazos
          WHERE processo_id = $1::uuid ORDER BY ordem DESC LIMIT 1 FOR UPDATE",
    )
    .bind(processo_id)
    .fetch_optional(&mut **tx)
    .await?;

    let (prazo_atual_id, ordem) = atual.ok_or_else(|| {
        AppError::Domain("O apuratório ainda não possui prazo para excluir.".to_string())
    })?;
    if ordem == 0 {
        return Err(AppError::Domain(
            "O prazo inicial não pode ser excluído como prorrogação.".to_string(),
        ));
    }
    if prazo_atual_id != prazo_id {
        return Err(AppError::Domain(
            "Somente a última prorrogação pode ser excluída. Exclua primeiro as prorrogações mais recentes.".to_string(),
        ));
    }

    let removidas = sqlx::query(
        "DELETE FROM processo_prazos
          WHERE id = $1::uuid AND processo_id = $2::uuid",
    )
    .bind(prazo_id)
    .bind(processo_id)
    .execute(&mut **tx)
    .await?
    .rows_affected();

    Ok(removidas == 1)
}

/// Panorama dos prazos vigentes dos processos em andamento.
pub async fn dashboard(pool: &PgPool, dias_janela: i32) -> Result<DeadlineSummary, sqlx::Error> {
    sqlx::query_as::<_, DeadlineSummary>(&format!(
        "SELECT count(*)                                                        AS total,
                count(*) FILTER (WHERE p.data_vencimento < CURRENT_DATE)        AS vencidos,
                count(*) FILTER (WHERE p.data_vencimento >= CURRENT_DATE
                                   AND p.data_vencimento <= CURRENT_DATE + $1)  AS proximos
           FROM processo_prazos p
           JOIN processos_procedimentos pr ON pr.id = p.processo_id
          WHERE {VIGENTE} AND pr.ativo AND pr.data_conclusao IS NULL"
    ))
    .bind(dias_janela)
    .fetch_one(pool)
    .await
}

/// Filtro do relatório de prazos, escrito uma vez para a contagem e a página.
///
/// **Os dois blocos da tela são exclusivos, e é aqui que isso se decide.**
/// A condição da janela era `prazo_vencimento <= CURRENT_DATE + $4`, **sem
/// piso**: quem pedia "vencendo em até 14 dias" recebia junto tudo que já
/// tinha vencido, e o mesmo processo aparecia nas duas tabelas da tela de
/// Prazos. Pior: o `dashboard()` logo acima sempre contou com o piso
/// (`>= CURRENT_DATE`), então o cartão de contagem e a tabela abaixo dele
/// discordavam na mesma tela.
///
/// Com o piso, "vencido" é estritamente antes de hoje e "vencendo" vai de hoje
/// até o fim da janela — sem interseção, e batendo com as contagens.
const FILTRO_REPORT: &str = "WHERE v.ativo
           AND v.data_conclusao IS NULL
           AND v.prazo_vencimento IS NOT NULL
           AND ($1::uuid[] IS NULL OR v.apuratorio_id = ANY($1::uuid[]))
           AND ($2::uuid IS NULL OR EXISTS (
                   SELECT 1 FROM processo_designacoes d
                    WHERE d.processo_id = v.id AND d.data_fim IS NULL
                      AND d.policial_militar_id = $2::uuid))
           AND (NOT $3 OR v.prazo_vencimento < CURRENT_DATE)
           AND ($4::int IS NULL OR (v.prazo_vencimento >= CURRENT_DATE
                                AND v.prazo_vencimento <= CURRENT_DATE + $4))
           AND ($5::int IS NULL OR EXTRACT(YEAR FROM v.data_instauracao)::int = $5)";

/// Relatório de prazos. O escopo de apuratórios vem por parâmetro — antes era um
/// `IN ('IPM','SR','SV')` escrito no SQL.
///
/// Sai de `v_processos_detalhados`: o prazo vigente e o responsável já são
/// derivações da view. Antes esta função repetia as duas — e derivava a
/// vigência por `DISTINCT ON`, enquanto o resto do código usava `LATERAL`.
///
/// Pagina como as demais listagens de tela: o `limit` solto que existia aqui
/// saiu, porque duas formas de recortar a mesma lista é ambiguidade que o
/// modelo evita — quem quer só os N primeiros pede a página 1 com `per_page` N.
pub async fn report(
    pool: &PgPool,
    filter: &DeadlineReportFilter,
) -> Result<DeadlineReportResult, sqlx::Error> {
    let recorte = Recorte::novo(filter.page, filter.per_page);

    let total: i64 = sqlx::query_scalar(&format!(
        "SELECT count(*) FROM v_processos_detalhados v {FILTRO_REPORT}"
    ))
    .bind(filter.apuratorio_ids.as_deref())
    .bind(filter.responsavel_id.as_deref())
    .bind(filter.apenas_vencidos.unwrap_or(false))
    .bind(filter.dias_ate_vencer)
    .bind(filter.ano)
    .fetch_one(pool)
    .await?;

    // `id` desempata: dois processos vencendo no mesmo dia trocariam de lugar
    // entre uma página e outra, e a linha da fronteira apareceria duas vezes ou
    // nenhuma.
    let items = sqlx::query_as::<_, DeadlineReportItem>(&format!(
        "SELECT v.id::text            AS processo_id,
               v.apuratorio_sigla    AS apuratorio_sigla,
               v.numero_controle     AS numero_controle,
               v.unidade_origem      AS unidade_origem,
               v.subunidade_secao_origem AS subunidade_secao_origem,
               v.responsavel_nome    AS responsavel_nome,
               responsavel_pm.matricula AS responsavel_matricula,
               responsavel_posto.sigla AS responsavel_posto_graduacao,
               v.prazo_vencimento    AS data_vencimento,
               v.prazo_dias_restantes AS dias_restantes,
               v.prazo_ordem         AS ordem
          FROM v_processos_detalhados v
          LEFT JOIN policiais_militares responsavel_pm
                 ON responsavel_pm.id = v.responsavel_id::uuid
          LEFT JOIN postos_graduacoes responsavel_posto
                 ON responsavel_posto.id = responsavel_pm.posto_graduacao_id
         {FILTRO_REPORT}
         ORDER BY v.prazo_vencimento, v.id
         LIMIT $6 OFFSET $7"
    ))
    .bind(filter.apuratorio_ids.as_deref())
    .bind(filter.responsavel_id.as_deref())
    .bind(filter.apenas_vencidos.unwrap_or(false))
    .bind(filter.dias_ate_vencer)
    .bind(filter.ano)
    .bind(recorte.per_page)
    .bind(recorte.offset)
    .fetch_all(pool)
    .await?;

    Ok(DeadlineReportResult {
        items,
        total,
        page: recorte.page,
        per_page: recorte.per_page,
    })
}
