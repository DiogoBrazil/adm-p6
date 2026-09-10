//! Lê do banco o que o aviso precisa: para quem, com que texto, por qual servidor.
//!
//! Cada uma das três leituras pode faltar, e cada falta tem frase própria — a
//! categoria genérica ("Os dados informados não atendem a uma regra do
//! cadastro") não serve para dizer que o militar não tem e-mail cadastrado.

use sqlx::PgPool;

use crate::email::domain::{DadosDoAviso, TipoAviso};
use crate::error::AppError;

/// O texto administrável de um aviso.
pub struct Mensagem {
    pub assunto: String,
    pub corpo: String,
}

/// Onde e como enviar. A senha sai daqui para o transporte e para lugar nenhum
/// mais — nunca para o IPC.
pub struct ConfiguracaoSmtp {
    pub host: String,
    pub porta: i32,
    pub usuario: String,
    pub senha: String,
    pub remetente: String,
}

/// O destinatário do aviso, já resolvido.
pub struct Destinatario {
    pub nome: String,
    pub email: String,
}

/// A quem o aviso vai, e por quê esta consulta tem um `COALESCE`.
///
/// Um militar pode ter DOIS endereços no sistema: o de notificação
/// (`policiais_militares.email`, que a `0025` criou, opcional) e o da conta de
/// acesso (`usuarios.email`, obrigatório para quem opera o sistema). Pedir os
/// dois seria pedir o mesmo dado duas vezes, e duas cópias divergem — o de
/// notificação vence quando existe, e o da conta é a rede.
///
/// Sem responsável designado não há a quem avisar, e isso é diferente de não ter
/// endereço: as duas faltas têm mensagens diferentes porque as saídas são
/// diferentes — uma se resolve designando, a outra cadastrando o e-mail.
pub async fn destinatario(pool: &PgPool, processo_id: &str) -> Result<Destinatario, AppError> {
    let linha: Option<(Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT v.responsavel_nome,
                v.responsavel_papel,
                COALESCE(pm.email, u.email) AS email
           FROM v_processos_detalhados v
           LEFT JOIN policiais_militares pm ON pm.id = v.responsavel_id::uuid
           LEFT JOIN usuarios u             ON u.policial_militar_id = pm.id AND u.ativo
          WHERE v.id = $1::uuid",
    )
    .bind(processo_id)
    .fetch_optional(pool)
    .await?;

    let Some((nome, papel, email)) = linha else {
        return Err(AppError::Domain(
            "Este apuratório não existe mais. Recarregue a página.".into(),
        ));
    };

    let Some(nome) = nome.filter(|n| !n.trim().is_empty()) else {
        return Err(AppError::Domain(
            "Este apuratório não tem encarregado designado no momento. \
             Designe o responsável antes de enviar o aviso."
                .into(),
        ));
    };

    let Some(email) = email.filter(|e| !e.trim().is_empty()) else {
        let funcao = papel.unwrap_or_else(|| "responsável".into());
        return Err(AppError::Domain(format!(
            "{nome}, que responde como {funcao}, não tem e-mail cadastrado. \
             Informe o e-mail em Usuários, no cadastro do policial militar, e tente de novo."
        )));
    };

    Ok(Destinatario {
        nome,
        email: email.trim().to_string(),
    })
}

/// Os dados que os marcadores citam, do mesmo `WHERE` do destinatário.
pub async fn dados_do_aviso(
    pool: &PgPool,
    processo_id: &str,
    encarregado: &str,
) -> Result<DadosDoAviso, AppError> {
    let linha: Option<(
        String,
        String,
        String,
        chrono::NaiveDate,
        Option<chrono::NaiveDate>,
    )> = sqlx::query_as(
        "SELECT v.apuratorio_nome, v.numero_documento, v.unidade_origem,
                    v.data_instauracao, v.prazo_vencimento
               FROM v_processos_detalhados v
              WHERE v.id = $1::uuid",
    )
    .bind(processo_id)
    .fetch_optional(pool)
    .await?;

    let Some((apuratorio, numero_documento, unidade, instauracao, vencimento)) = linha else {
        return Err(AppError::Domain(
            "Este apuratório não existe mais. Recarregue a página.".into(),
        ));
    };

    // `dd/mm/aaaa` montado aqui, e não pela sessão: `to_char` dependeria do
    // locale do servidor, e o formato do documento não é preferência de máquina.
    let br = |d: chrono::NaiveDate| d.format("%d/%m/%Y").to_string();
    Ok(DadosDoAviso {
        encarregado: encarregado.to_string(),
        apuratorio,
        numero_documento,
        unidade,
        data_instauracao: br(instauracao),
        prazo_vencimento: vencimento.map(br),
    })
}

/// O texto vigente de um tipo de aviso.
///
/// Filtra `ativo` porque é uma leitura de OPÇÃO, não de registro histórico
/// (princípio 6): desativar uma mensagem tira-a de uso sem apagar o texto.
pub async fn mensagem(pool: &PgPool, tipo: TipoAviso) -> Result<Mensagem, AppError> {
    let linha: Option<(String, String)> =
        sqlx::query_as("SELECT assunto, corpo FROM mensagens_email WHERE codigo = $1 AND ativo")
            .bind(tipo.codigo())
            .fetch_optional(pool)
            .await?;

    linha
        .map(|(assunto, corpo)| Mensagem { assunto, corpo })
        .ok_or_else(|| {
            AppError::Domain(
                "Não há mensagem cadastrada e ativa para este tipo de aviso. \
                 Cadastre-a em Catálogos → Mensagens de e-mail antes de enviar."
                    .into(),
            )
        })
}

/// O servidor de envio configurado para a seção.
pub async fn configuracao(pool: &PgPool) -> Result<ConfiguracaoSmtp, AppError> {
    let linha: Option<(String, i32, String, String, String)> = sqlx::query_as(
        "SELECT host, porta, usuario, senha, remetente
           FROM configuracao_email WHERE id = 1 AND ativo",
    )
    .fetch_optional(pool)
    .await?;

    linha
        .map(
            |(host, porta, usuario, senha, remetente)| ConfiguracaoSmtp {
                host,
                porta,
                usuario,
                senha,
                remetente,
            },
        )
        .ok_or_else(|| {
            AppError::Domain(
                "O servidor de e-mail ainda não foi configurado. \
                 Peça a um administrador que o configure em Catálogos → Configuração de e-mail."
                    .into(),
            )
        })
}
