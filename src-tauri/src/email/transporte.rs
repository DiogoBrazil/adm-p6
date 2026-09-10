//! O envio propriamente dito, atrás de um trait.
//!
//! POR QUE UM TRAIT
//!
//! Testar o caminho do aviso — ler a configuração, montar o texto, recusar
//! quando falta dado — não pode depender de um servidor SMTP: o teste ficaria
//! lento, dependente de rede e, pior, **mandaria e-mail de verdade** para quem
//! estivesse no banco de fixtura. O trait separa a decisão do efeito, do mesmo
//! jeito que `database_config.rs::SetupBackend` separa salvar/migrar/publicar
//! para poder testar a ordem sem tocar no cofre.

use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use crate::email::domain::AvisoMontado;
use crate::email::repository::ConfiguracaoSmtp;
use crate::error::AppError;

pub trait EnviaEmail: Sync {
    fn enviar(
        &self,
        config: &ConfiguracaoSmtp,
        aviso: &AvisoMontado,
    ) -> impl std::future::Future<Output = Result<(), AppError>> + Send;
}

pub struct Smtp;

impl EnviaEmail for Smtp {
    async fn enviar(
        &self,
        config: &ConfiguracaoSmtp,
        aviso: &AvisoMontado,
    ) -> Result<(), AppError> {
        // Endereço malformado é erro de cadastro, não falha de envio: a frase
        // aponta onde corrigir em vez de mandar procurar o suporte.
        let para = format!("{} <{}>", aviso.destinatario_nome, aviso.destinatario)
            .parse()
            .map_err(|_| {
                AppError::Domain(format!(
                    "O e-mail cadastrado para {} não é um endereço válido. \
                     Corrija-o em Usuários e tente de novo.",
                    aviso.destinatario_nome
                ))
            })?;
        let de = config.remetente.parse().map_err(|_| {
            AppError::Domain(
                "O remetente configurado não é um endereço de e-mail válido. \
                 Corrija-o em Catálogos → Configuração de e-mail."
                    .into(),
            )
        })?;

        let mensagem = Message::builder()
            .from(de)
            .to(para)
            .subject(&aviso.assunto)
            .header(ContentType::TEXT_PLAIN)
            .body(aviso.corpo.clone())
            .map_err(|e| AppError::Interno(format!("montagem da mensagem: {e}")))?;

        // A porta decide o modo, e não há um terceiro caso: 465 é TLS desde o
        // primeiro byte (SMTPS), qualquer outra é STARTTLS sobre conexão limpa —
        // é assim que o Gmail atende as duas. Medido contra `smtp.gmail.com`:
        // 587 e 465 autenticam, e a 587 é a porta de submissão padrão.
        let construtor = if config.porta == 465 {
            AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)
        } else {
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.host)
        };

        let transporte = construtor
            .map_err(|e| AppError::Interno(format!("transporte SMTP: {e}")))?
            .port(config.porta as u16)
            .credentials(Credentials::new(
                config.usuario.clone(),
                config.senha.clone(),
            ))
            .build();

        transporte.send(mensagem).await.map_err(|e| {
            // O texto do lettre cita servidor, porta e às vezes o endereço —
            // vai para o console, não para a tela.
            if e.is_permanent() {
                AppError::Domain(
                    "O servidor de e-mail recusou o envio. Confira o usuário, a senha de \
                     aplicativo e o remetente em Catálogos → Configuração de e-mail."
                        .into(),
                )
            } else {
                AppError::Interno(format!("envio SMTP: {e}"))
            }
        })?;
        Ok(())
    }
}
