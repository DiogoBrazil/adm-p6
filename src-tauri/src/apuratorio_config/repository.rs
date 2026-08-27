use sqlx::{PgPool, Postgres, Transaction};

use crate::apuratorio_config::domain::{
    ApuratorioConfig, DocumentoIniciadorItem, PapelItem, SaveDocumentoIniciadorRequest,
    SavePapelRequest,
};
use crate::error::AppError;

/// Configuração completa de um apuratório.
///
/// **Não filtra `ativo`**: esta é a tela de administração, e um item desativado
/// precisa continuar visível para poder ser reativado. Quem filtra `ativo` são as
/// listas de opções de um cadastro novo.
pub async fn get(pool: &PgPool, apuratorio_id: &str) -> Result<Option<ApuratorioConfig>, AppError> {
    // Os atributos de comportamento vêm daqui, e não do registro de catálogos —
    // ver o cabeçalho de `ApuratorioConfig` para o porquê.
    type Cabecalho = (
        String,
        String,
        i32,
        Option<i32>,
        bool,
        bool,
        bool,
        bool,
        Option<String>,
    );
    let cabecalho: Option<Cabecalho> = sqlx::query_as(
        "SELECT sigla, nome, prazo_base_dias, max_envolvidos, exige_natureza_fato,
                permite_julgamento, permite_punicao, permite_remessa_comissao,
                codigo_extensao
           FROM apuratorios WHERE id = $1::uuid",
    )
    .bind(apuratorio_id)
    .fetch_optional(pool)
    .await?;

    let Some((
        sigla,
        nome,
        prazo_base_dias,
        max_envolvidos,
        exige_natureza_fato,
        permite_julgamento,
        permite_punicao,
        permite_remessa_comissao,
        codigo_extensao,
    )) = cabecalho
    else {
        return Ok(None);
    };

    let documentos: Vec<DocumentoIniciadorItem> = sqlx::query_as(
        "SELECT adi.tipo_documento_id::text          AS tipo_documento_id,
                td.nome                              AS tipo_documento,
                adi.prazo_base_dias                  AS prazo_base_dias,
                COALESCE(adi.prazo_base_dias, a.prazo_base_dias) AS prazo_efetivo_dias,
                adi.padrao                           AS padrao,
                adi.ativo                            AS ativo,
                EXISTS (SELECT 1 FROM processos_procedimentos p
                         WHERE p.apuratorio_id = adi.apuratorio_id
                           AND p.documento_iniciador_id = adi.tipo_documento_id) AS em_uso
           FROM apuratorio_documentos_iniciadores adi
           JOIN tipos_documento td ON td.id = adi.tipo_documento_id
           JOIN apuratorios     a  ON a.id  = adi.apuratorio_id
          WHERE adi.apuratorio_id = $1::uuid
          ORDER BY adi.padrao DESC, td.nome",
    )
    .bind(apuratorio_id)
    .fetch_all(pool)
    .await?;

    let papeis: Vec<PapelItem> = sqlx::query_as(
        "SELECT ap.papel_id::text  AS papel_id,
                pp.nome            AS papel,
                ap.obrigatorio     AS obrigatorio,
                ap.max_ocupantes   AS max_ocupantes,
                ap.e_responsavel   AS e_responsavel,
                ap.ativo           AS ativo,
                EXISTS (SELECT 1 FROM processo_designacoes d
                         WHERE d.apuratorio_id = ap.apuratorio_id
                           AND d.papel_id = ap.papel_id) AS em_uso
           FROM apuratorio_papeis ap
           JOIN papeis_processo pp ON pp.id = ap.papel_id
          WHERE ap.apuratorio_id = $1::uuid
          ORDER BY ap.e_responsavel DESC, pp.nome",
    )
    .bind(apuratorio_id)
    .fetch_all(pool)
    .await?;

    Ok(Some(ApuratorioConfig {
        apuratorio_id: apuratorio_id.to_string(),
        sigla,
        nome,
        prazo_base_dias,
        max_envolvidos,
        exige_natureza_fato,
        permite_julgamento,
        permite_punicao,
        permite_remessa_comissao,
        codigo_extensao,
        documentos,
        papeis,
    }))
}

/// Habilita (ou reconfigura) um documento iniciador para o apuratório.
pub async fn save_documento(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveDocumentoIniciadorRequest,
) -> Result<(), AppError> {
    // `uq_apdoc_padrao` admite um único padrão por apuratório. Zerar o anterior
    // antes de gravar é o que permite trocar o padrão sem violar o índice.
    if request.padrao {
        sqlx::query(
            "UPDATE apuratorio_documentos_iniciadores
                SET padrao = false, updated_at = now()
              WHERE apuratorio_id = $1::uuid AND tipo_documento_id <> $2::uuid AND padrao",
        )
        .bind(&request.apuratorio_id)
        .bind(&request.tipo_documento_id)
        .execute(&mut **tx)
        .await?;
    }

    sqlx::query(
        "INSERT INTO apuratorio_documentos_iniciadores
             (apuratorio_id, tipo_documento_id, prazo_base_dias, padrao, ativo)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5)
         ON CONFLICT (apuratorio_id, tipo_documento_id) DO UPDATE
            SET prazo_base_dias = EXCLUDED.prazo_base_dias,
                padrao          = EXCLUDED.padrao,
                ativo           = EXCLUDED.ativo,
                updated_at      = now()",
    )
    .bind(&request.apuratorio_id)
    .bind(&request.tipo_documento_id)
    .bind(request.prazo_base_dias)
    .bind(request.padrao)
    .bind(request.ativo)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Habilita (ou reconfigura) um papel para o apuratório.
///
/// Baixar `max_ocupantes` **não** invalida designações já gravadas: a constraint
/// trigger só dispara em escrita de `processo_designacoes`. É o princípio de que
/// configuração define o comportamento futuro e não reescreve fatos passados.
pub async fn save_papel(
    tx: &mut Transaction<'_, Postgres>,
    request: &SavePapelRequest,
) -> Result<(), AppError> {
    // `uq_appapel_responsavel` admite um único responsável por apuratório.
    if request.e_responsavel {
        sqlx::query(
            "UPDATE apuratorio_papeis
                SET e_responsavel = false, updated_at = now()
              WHERE apuratorio_id = $1::uuid AND papel_id <> $2::uuid AND e_responsavel",
        )
        .bind(&request.apuratorio_id)
        .bind(&request.papel_id)
        .execute(&mut **tx)
        .await?;
    }

    sqlx::query(
        "INSERT INTO apuratorio_papeis
             (apuratorio_id, papel_id, obrigatorio, max_ocupantes, e_responsavel, ativo)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
         ON CONFLICT (apuratorio_id, papel_id) DO UPDATE
            SET obrigatorio   = EXCLUDED.obrigatorio,
                max_ocupantes = EXCLUDED.max_ocupantes,
                e_responsavel = EXCLUDED.e_responsavel,
                ativo         = EXCLUDED.ativo,
                updated_at    = now()",
    )
    .bind(&request.apuratorio_id)
    .bind(&request.papel_id)
    .bind(request.obrigatorio)
    .bind(request.max_ocupantes)
    .bind(request.e_responsavel)
    .bind(request.ativo)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Desativa um documento iniciador: some dos cadastros novos, e os processos que
/// já o usam continuam íntegros — a FK composta aponta para a PK, não para
/// `ativo`. Perde o `padrao` junto, porque padrão desativado não faz sentido.
pub async fn deactivate_documento(
    tx: &mut Transaction<'_, Postgres>,
    apuratorio_id: &str,
    tipo_documento_id: &str,
) -> Result<bool, AppError> {
    let afetadas = sqlx::query(
        "UPDATE apuratorio_documentos_iniciadores
            SET ativo = false, padrao = false, updated_at = now()
          WHERE apuratorio_id = $1::uuid AND tipo_documento_id = $2::uuid",
    )
    .bind(apuratorio_id)
    .bind(tipo_documento_id)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    Ok(afetadas > 0)
}

/// Desativa um papel do apuratório.
///
/// Recusa desativar o papel que responde pelo apuratório: listagem, dashboard e
/// relatórios resolvem o responsável por `e_responsavel`, e desativá-lo faria o
/// responsável sumir de todos os processos daquela espécie. O caminho correto é
/// apontar `e_responsavel` para outro papel antes.
pub async fn deactivate_papel(
    tx: &mut Transaction<'_, Postgres>,
    apuratorio_id: &str,
    papel_id: &str,
) -> Result<bool, AppError> {
    let e_responsavel: Option<bool> = sqlx::query_scalar(
        "SELECT e_responsavel FROM apuratorio_papeis
          WHERE apuratorio_id = $1::uuid AND papel_id = $2::uuid",
    )
    .bind(apuratorio_id)
    .bind(papel_id)
    .fetch_optional(&mut **tx)
    .await?;

    match e_responsavel {
        None => Ok(false),
        Some(true) => Err(AppError::Domain(
            "Esta função responde pelo apuratório. Indique outra responsável antes de desativá-la."
                .to_string(),
        )),
        Some(false) => {
            sqlx::query(
                "UPDATE apuratorio_papeis SET ativo = false, updated_at = now()
                  WHERE apuratorio_id = $1::uuid AND papel_id = $2::uuid",
            )
            .bind(apuratorio_id)
            .bind(papel_id)
            .execute(&mut **tx)
            .await?;
            Ok(true)
        }
    }
}
