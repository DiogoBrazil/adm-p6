use sqlx::{PgExecutor, PgPool, Postgres, Transaction};

use crate::error::AppError;
use crate::evidence::domain::{
    AcusacoesRequest, CategoriaIndicioItem, EnvolvidoComIndicios, EvidenceData,
    InfracaoEstatutoItem, InfracaoEstatutoVinculo, InfracaoPenalItem, InfracaoPenalVinculo,
    SaveEvidenceRequest, TransgressaoItem,
};

/// Rótulos montados a partir do dado. No schema anterior estes textos eram
/// `format!` no Rust, com o nome da lei escrito no código.
///
/// Os três seguem a ordem em que se cita uma norma — o artigo primeiro, a norma
/// depois: "Art. 312 do Código Penal Militar - …". O conector vem de
/// `dispositivos_legais.nome_feminino`, atributo semântico da linha, e não de
/// leitura do nome, que o administrador pode renomear.
///
/// **O rótulo já termina na descrição.** Quem o exibe não deve concatenar
/// `descricao`/`texto` de novo: era assim que o PDF do mapa mensal saía com o
/// texto da infração repetido duas vezes.
const ROTULO_PENAL: &str = r#"
    'Art. ' || ip.artigo
      || COALESCE(', § ' || ip.paragrafo, '')
      || COALESCE(', inciso ' || ip.inciso, '')
      || COALESCE(', alínea ' || ip.alinea, '')
      || CASE WHEN dl.nome_feminino THEN ' da ' ELSE ' do ' END || dl.nome
      || ' - ' || ip.descricao
"#;

// `artigos_rdpm.artigo` e `infracoes_estatuto.artigo` já guardam o artigo por
// extenso ("Art. 15", "Art. 29") — é o que o administrador digita e o que a
// tela de catálogos exibe. Prefixar com 'Art. ' aqui produzia "Art. Art. 15".
// `infracoes_penais.artigo`, ao contrário, guarda só o número ("121"), e é por
// isso que só o rótulo penal acima escreve o prefixo.
const ROTULO_TRANSGRESSAO: &str = r#"
    ar.artigo || ', inciso ' || t.inciso || ' do RDPM (' || nt.nome || ') - ' || t.texto
"#;

const ROTULO_ESTATUTO: &str = r#"
    ie.artigo || ', inciso ' || ie.inciso
      || CASE WHEN dl.nome_feminino THEN ' da ' ELSE ' do ' END || dl.nome
      || ' - ' || ie.texto
"#;

// ── Buscas para o formulário ─────────────────────────────────────────────────

pub async fn search_infracoes_penais(
    pool: &PgPool,
    termo: &str,
    dispositivo_legal_id: Option<&str>,
) -> Result<Vec<InfracaoPenalItem>, sqlx::Error> {
    sqlx::query_as::<_, InfracaoPenalItem>(&format!(
        "SELECT ip.id::text AS id, dl.nome AS dispositivo_legal, e.nome AS especie,
                ip.artigo, ip.descricao, {ROTULO_PENAL} AS rotulo
           FROM infracoes_penais ip
           JOIN dispositivos_legais dl     ON dl.id = ip.dispositivo_legal_id
           JOIN especies_infracao_penal e  ON e.id = ip.especie_id
          WHERE ip.ativo
            AND ($2::uuid IS NULL OR ip.dispositivo_legal_id = $2::uuid)
            AND (lower(ip.artigo) LIKE $1 OR lower(ip.descricao) LIKE $1)
          ORDER BY dl.nome, ip.artigo
          LIMIT 50"
    ))
    .bind(format!("%{}%", termo.trim().to_lowercase()))
    .bind(dispositivo_legal_id)
    .fetch_all(pool)
    .await
}

pub async fn search_transgressoes(
    pool: &PgPool,
    termo: &str,
    natureza_id: Option<&str>,
) -> Result<Vec<TransgressaoItem>, sqlx::Error> {
    sqlx::query_as::<_, TransgressaoItem>(&format!(
        "SELECT t.id::text AS id, ar.artigo, nt.nome AS natureza, t.inciso, t.texto,
                {ROTULO_TRANSGRESSAO} AS rotulo
           FROM transgressoes t
           JOIN artigos_rdpm ar           ON ar.id = t.artigo_rdpm_id
           JOIN naturezas_transgressao nt ON nt.id = ar.natureza_transgressao_id
          WHERE t.ativo
            AND ($2::uuid IS NULL OR ar.natureza_transgressao_id = $2::uuid)
            AND (lower(t.inciso) LIKE $1 OR lower(t.texto) LIKE $1)
          ORDER BY ar.artigo, t.inciso
          LIMIT 50"
    ))
    .bind(format!("%{}%", termo.trim().to_lowercase()))
    .bind(natureza_id)
    .fetch_all(pool)
    .await
}

pub async fn search_infracoes_estatuto(
    pool: &PgPool,
    termo: &str,
    artigo: Option<&str>,
) -> Result<Vec<InfracaoEstatutoItem>, sqlx::Error> {
    sqlx::query_as::<_, InfracaoEstatutoItem>(&format!(
        "SELECT ie.id::text AS id, dl.nome AS dispositivo_legal, ie.artigo, ie.inciso, ie.texto,
                {ROTULO_ESTATUTO} AS rotulo
           FROM infracoes_estatuto ie
           JOIN dispositivos_legais dl ON dl.id = ie.dispositivo_legal_id
          WHERE ie.ativo
            AND ($2::text IS NULL OR ie.artigo = $2)
            AND (lower(ie.inciso) LIKE $1 OR lower(ie.texto) LIKE $1)
          ORDER BY ie.artigo, ie.inciso
          LIMIT 50"
    ))
    .bind(format!("%{}%", termo.trim().to_lowercase()))
    .bind(artigo)
    .fetch_all(pool)
    .await
}

// ── Leitura do enquadramento ─────────────────────────────────────────────────

async fn categorias_do_envolvido<'e, E: PgExecutor<'e>>(
    executor: E,
    envolvido_id: &str,
) -> Result<Vec<CategoriaIndicioItem>, sqlx::Error> {
    // Sem filtro de `ativo`: uma categoria desativada hoje precisa continuar
    // aparecendo no processo que a usou.
    sqlx::query_as::<_, CategoriaIndicioItem>(
        "SELECT ci.id::text AS id, ci.nome, ci.indica_ausencia
           FROM envolvido_categorias_indicio eci
           JOIN categorias_indicio ci ON ci.id = eci.categoria_indicio_id
          WHERE eci.envolvido_id = $1::uuid
          ORDER BY ci.nome",
    )
    .bind(envolvido_id)
    .fetch_all(executor)
    .await
}

pub async fn load_for_envolvido(
    pool: &PgPool,
    envolvido_id: &str,
) -> Result<EvidenceData, sqlx::Error> {
    let categorias = categorias_do_envolvido(pool, envolvido_id).await?;

    let infracoes_penais = sqlx::query_as::<_, InfracaoPenalVinculo>(&format!(
        "SELECT ip.id::text AS infracao_penal_id, ep.id::text AS esfera_penal_id,
                ep.nome AS esfera_penal, dl.nome AS dispositivo_legal, e.nome AS especie,
                ip.artigo, ip.descricao, {ROTULO_PENAL} AS rotulo
           FROM envolvido_infracoes_penais eip
           JOIN infracoes_penais ip        ON ip.id = eip.infracao_penal_id
           JOIN esferas_penais ep          ON ep.id = eip.esfera_penal_id
           JOIN dispositivos_legais dl     ON dl.id = ip.dispositivo_legal_id
           JOIN especies_infracao_penal e  ON e.id = ip.especie_id
          WHERE eip.envolvido_id = $1::uuid
          ORDER BY dl.nome, ip.artigo"
    ))
    .bind(envolvido_id)
    .fetch_all(pool)
    .await?;

    let transgressoes = sqlx::query_as::<_, TransgressaoItem>(&format!(
        "SELECT t.id::text AS id, ar.artigo, nt.nome AS natureza, t.inciso, t.texto,
                {ROTULO_TRANSGRESSAO} AS rotulo
           FROM envolvido_transgressoes et
           JOIN transgressoes t           ON t.id = et.transgressao_id
           JOIN artigos_rdpm ar           ON ar.id = t.artigo_rdpm_id
           JOIN naturezas_transgressao nt ON nt.id = ar.natureza_transgressao_id
          WHERE et.envolvido_id = $1::uuid
          ORDER BY ar.artigo, t.inciso"
    ))
    .bind(envolvido_id)
    .fetch_all(pool)
    .await?;

    let infracoes_estatuto = sqlx::query_as::<_, InfracaoEstatutoVinculo>(&format!(
        "SELECT ie.id::text AS infracao_estatuto_id,
                {ROTULO_ESTATUTO} AS rotulo,
                t.id::text AS analogia_transgressao_id,
                {ROTULO_TRANSGRESSAO} AS analogia_rotulo
           FROM envolvido_infracoes_estatuto eie
           JOIN infracoes_estatuto ie     ON ie.id = eie.infracao_estatuto_id
           JOIN dispositivos_legais dl    ON dl.id = ie.dispositivo_legal_id
           JOIN transgressoes t           ON t.id = eie.analogia_transgressao_id
           JOIN artigos_rdpm ar           ON ar.id = t.artigo_rdpm_id
           JOIN naturezas_transgressao nt ON nt.id = ar.natureza_transgressao_id
          WHERE eie.envolvido_id = $1::uuid
          ORDER BY ie.artigo, ie.inciso"
    ))
    .bind(envolvido_id)
    .fetch_all(pool)
    .await?;

    Ok(EvidenceData {
        envolvido_id: envolvido_id.to_string(),
        categorias,
        infracoes_penais,
        transgressoes,
        infracoes_estatuto,
    })
}

/// Envolvidos do processo com o enquadramento de cada um.
pub async fn list_for_proceeding(
    pool: &PgPool,
    processo_id: &str,
) -> Result<Vec<EnvolvidoComIndicios>, AppError> {
    #[derive(sqlx::FromRow)]
    struct Linha {
        envolvido_id: String,
        policial_militar_id: Option<String>,
        nome: String,
        matricula: String,
        posto_graduacao: String,
        status_envolvido: String,
        ordem: i32,
    }

    let envolvidos = sqlx::query_as::<_, Linha>(
        "SELECT e.id::text                  AS envolvido_id,
                e.policial_militar_id::text AS policial_militar_id,
                COALESCE(pm.nome, 'À apurar') AS nome,
                COALESCE(pm.matricula, '')  AS matricula,
                COALESCE(pg.sigla, '')      AS posto_graduacao,
                se.nome                     AS status_envolvido,
                e.ordem                     AS ordem
           FROM processo_envolvidos e
           LEFT JOIN policiais_militares pm ON pm.id = e.policial_militar_id
           LEFT JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
           JOIN status_envolvido se    ON se.id = e.status_envolvido_id
          WHERE e.processo_id = $1::uuid
          ORDER BY e.ordem",
    )
    .bind(processo_id)
    .fetch_all(pool)
    .await?;

    let mut resultado = Vec::with_capacity(envolvidos.len());
    for linha in envolvidos {
        let indicios = load_for_envolvido(pool, &linha.envolvido_id).await?;
        resultado.push(EnvolvidoComIndicios {
            envolvido_id: linha.envolvido_id,
            policial_militar_id: linha.policial_militar_id,
            nome: linha.nome,
            matricula: linha.matricula,
            posto_graduacao: linha.posto_graduacao,
            status_envolvido: linha.status_envolvido,
            ordem: linha.ordem,
            indicios,
        });
    }
    Ok(resultado)
}

// ── Escrita ──────────────────────────────────────────────────────────────────

/// Substitui todo o enquadramento do envolvido, numa transação: o que o
/// formulário mandou passa a ser a verdade completa.
pub async fn save_for_envolvido(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveEvidenceRequest,
) -> Result<(), AppError> {
    validar_categorias(tx, &request.categorias_ids).await?;

    sqlx::query("DELETE FROM envolvido_categorias_indicio WHERE envolvido_id = $1::uuid")
        .bind(&request.envolvido_id)
        .execute(&mut **tx)
        .await?;

    for categoria_id in &request.categorias_ids {
        sqlx::query(
            "INSERT INTO envolvido_categorias_indicio (envolvido_id, categoria_indicio_id)
             VALUES ($1::uuid, $2::uuid)",
        )
        .bind(&request.envolvido_id)
        .bind(categoria_id)
        .execute(&mut **tx)
        .await?;
    }

    save_acusacoes(
        tx,
        &request.envolvido_id,
        &AcusacoesRequest {
            infracoes_penais: request
                .infracoes_penais
                .iter()
                .map(|item| crate::evidence::domain::SelecaoInfracaoPenal {
                    infracao_penal_id: item.infracao_penal_id.clone(),
                    esfera_penal_id: item.esfera_penal_id.clone(),
                })
                .collect(),
            transgressoes_ids: request.transgressoes_ids.clone(),
            infracoes_estatuto: request
                .infracoes_estatuto
                .iter()
                .map(|item| crate::evidence::domain::SelecaoInfracaoEstatuto {
                    infracao_estatuto_id: item.infracao_estatuto_id.clone(),
                    analogia_transgressao_id: item.analogia_transgressao_id.clone(),
                })
                .collect(),
        },
    )
    .await?;

    Ok(())
}

/// Sincroniza somente o enquadramento juridico. Acusacoes usam esta parte sem
/// tocar nas categorias, que pertencem exclusivamente ao fluxo de indicios.
pub async fn save_acusacoes(
    tx: &mut Transaction<'_, Postgres>,
    envolvido_id: &str,
    request: &AcusacoesRequest,
) -> Result<(), AppError> {
    for tabela in [
        "envolvido_infracoes_penais",
        "envolvido_transgressoes",
        "envolvido_infracoes_estatuto",
    ] {
        sqlx::query(&format!(
            "DELETE FROM {tabela} WHERE envolvido_id = $1::uuid"
        ))
        .bind(envolvido_id)
        .execute(&mut **tx)
        .await?;
    }

    for selecao in &request.infracoes_penais {
        sqlx::query(
            "INSERT INTO envolvido_infracoes_penais
                 (envolvido_id, infracao_penal_id, esfera_penal_id)
             VALUES ($1::uuid, $2::uuid, $3::uuid)",
        )
        .bind(envolvido_id)
        .bind(&selecao.infracao_penal_id)
        .bind(&selecao.esfera_penal_id)
        .execute(&mut **tx)
        .await?;
    }

    for transgressao_id in &request.transgressoes_ids {
        sqlx::query(
            "INSERT INTO envolvido_transgressoes (envolvido_id, transgressao_id)
             VALUES ($1::uuid, $2::uuid)",
        )
        .bind(envolvido_id)
        .bind(transgressao_id)
        .execute(&mut **tx)
        .await?;
    }

    for selecao in &request.infracoes_estatuto {
        sqlx::query(
            "INSERT INTO envolvido_infracoes_estatuto
                 (envolvido_id, infracao_estatuto_id, analogia_transgressao_id)
             VALUES ($1::uuid, $2::uuid, $3::uuid)",
        )
        .bind(envolvido_id)
        .bind(&selecao.infracao_estatuto_id)
        .bind(&selecao.analogia_transgressao_id)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

/// Impede que o comando de indicios seja usado como atalho para alterar uma
/// acusacao ou para criar enquadramento em especie que nao investiga fatos.
pub async fn exigir_permissao_indicios(
    tx: &mut Transaction<'_, Postgres>,
    envolvido_id: &str,
) -> Result<(), AppError> {
    let permite: bool = sqlx::query_scalar(
        "SELECT a.permite_indicios
           FROM processo_envolvidos e
           JOIN processos_procedimentos p ON p.id = e.processo_id AND p.ativo
           JOIN apuratorios a ON a.id = p.apuratorio_id
          WHERE e.id = $1::uuid
          FOR UPDATE OF e",
    )
    .bind(envolvido_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::Domain("envolvido não encontrado".to_string()))?;

    if !permite {
        return Err(AppError::Domain(
            "Indícios são registrados somente em procedimentos investigativos. Em processos, corrija a acusação pelo botão Editar."
                .to_string(),
        ));
    }
    Ok(())
}

/// A categoria que indica ausência de indícios não convive com nenhuma outra.
/// A regra é lida do catálogo (`indica_ausencia`), não do nome da opção — o
/// administrador pode renomear "Não houve indícios" à vontade.
async fn validar_categorias(
    tx: &mut Transaction<'_, Postgres>,
    categorias_ids: &[String],
) -> Result<(), AppError> {
    if categorias_ids.len() < 2 {
        return Ok(());
    }
    let ausencia: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM categorias_indicio
          WHERE indica_ausencia AND id = ANY($1::uuid[])",
    )
    .bind(categorias_ids)
    .fetch_one(&mut **tx)
    .await?;
    if ausencia > 0 {
        return Err(AppError::Domain(
            "A categoria que indica ausência de indícios não pode ser combinada com outras. \
             Escolha apenas ela, ou remova-a da seleção."
                .to_string(),
        ));
    }
    Ok(())
}

pub async fn remove_for_envolvido(
    tx: &mut Transaction<'_, Postgres>,
    envolvido_id: &str,
) -> Result<(), sqlx::Error> {
    for tabela in [
        "envolvido_categorias_indicio",
        "envolvido_infracoes_penais",
        "envolvido_transgressoes",
        "envolvido_infracoes_estatuto",
    ] {
        sqlx::query(&format!(
            "DELETE FROM {tabela} WHERE envolvido_id = $1::uuid"
        ))
        .bind(envolvido_id)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}
