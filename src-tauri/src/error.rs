//! O erro que atravessa o IPC, e a tradução dele para português.
//!
//! REGRA ÚNICA DESTE ARQUIVO
//!
//! O que sai daqui é lido por um sargento da Seção de Justiça e Disciplina, não
//! por quem escreveu o código. Nome de constraint, SQL, caminho de arquivo,
//! erro de bcrypt, stack trace e mensagem crua do PostgreSQL **nunca** chegam à
//! tela. O detalhe técnico continua existindo — vai para o console do backend
//! em `ApiResponse::err`, que é onde se diagnostica.
//!
//! E toda mensagem diz **o que fazer**: qual campo corrigir, onde a operação
//! realmente acontece, ou que nada foi salvo. "Erro ao salvar" não é mensagem.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Erro de banco de dados: {0}")]
    Database(#[from] sqlx::Error),
    #[error("E-mail ou senha incorretos.")]
    InvalidCredentials,
    #[error("Sua sessão expirou. Entre novamente para continuar.")]
    Unauthorized,
    #[error("Seu perfil é somente leitura e não pode fazer alterações.")]
    Forbidden,
    #[error("{0}")]
    Domain(String),
    /// Falha ao gravar o arquivo que o usuário escolheu no diálogo nativo. O
    /// texto carregado é o motivo do sistema operacional — inclusive o caminho
    /// local, que por isso não pode ser exibido.
    #[error("Falha ao gravar arquivo: {0}")]
    Arquivo(String),
    /// Falha interna inesperada: hash de senha, decodificação, invariante
    /// quebrada. Nada disso é acionável pelo usuário, e o texto original pode
    /// carregar detalhe de implementação.
    #[error("Erro interno: {0}")]
    Interno(String),
}

impl AppError {
    /// O texto que vai para a tela.
    pub fn message(&self) -> String {
        match self {
            Self::Database(error) => mensagem_banco(error),
            Self::Domain(message) => message.clone(),
            Self::Arquivo(_) => "Não foi possível gravar o arquivo no local escolhido. \
                 Verifique se você tem permissão nessa pasta e escolha outro local."
                .to_string(),
            Self::Interno(_) => "Ocorreu um erro interno e nenhuma alteração foi salva. \
                 Se acontecer de novo, informe ao suporte o horário e a ação que você estava fazendo."
                .to_string(),
            _ => self.to_string(),
        }
    }

    /// O detalhe que o usuário não vê e o diagnóstico precisa. `None` para os
    /// erros cuja mensagem já é a informação inteira (sessão, perfil, regra de
    /// negócio) — registrá-los no console só faria ruído.
    pub fn detalhe_tecnico(&self) -> Option<String> {
        match self {
            Self::Database(error) => Some(format!("{error:?}")),
            Self::Arquivo(detalhe) | Self::Interno(detalhe) => Some(detalhe.clone()),
            _ => None,
        }
    }
}

/// Texto seguro para uma falha vinda do PostgreSQL.
///
/// Duas camadas, nesta ordem:
///
/// 1. **A constraint conhecida**, quando a aplicação sabe exatamente que regra
///    de negócio aquele nome representa. É a camada que produz a frase útil.
/// 2. **A categoria do erro**, pelo SQLSTATE, para tudo o mais. Diz o tipo de
///    problema — duplicidade, vínculo, período, campo obrigatório — sem inventar
///    detalhe que não se conhece.
///
/// A primeira camada é sempre preferível, e há uma terceira ainda melhor que não
/// mora aqui: **validar antes do SQL**. Onde a aplicação sabe qual campo o
/// usuário errou, quem responde é a validação de domínio, com o nome do campo na
/// frase. Este arquivo é a rede para o que escapa.
fn mensagem_banco(error: &sqlx::Error) -> String {
    // Falta de banco não é falha de regra: é o serviço fora do ar, e a saída é
    // outra. Vem antes de qualquer olhada em constraint porque nesses casos não
    // existe constraint nenhuma.
    if indisponivel(error) {
        return "O banco de dados não está respondendo. Verifique se o serviço do banco está \
                no ar e tente novamente em alguns instantes."
            .to_string();
    }

    if matches!(error, sqlx::Error::RowNotFound) {
        return "O registro não foi encontrado. Ele pode ter sido removido por outra pessoa — \
                recarregue a página."
            .to_string();
    }

    let Some(banco) = (match error {
        sqlx::Error::Database(database_error) => Some(database_error),
        _ => None,
    }) else {
        return GENERICA.to_string();
    };

    if let Some(constraint) = banco.constraint() {
        if let Some(mensagem) = mensagem_de_constraint(constraint) {
            return mensagem.to_string();
        }
    }

    mensagem_de_categoria(banco.code().as_deref().unwrap_or("")).to_string()
}

const GENERICA: &str = "Não foi possível concluir a operação no banco de dados. \
                        Tente novamente e, se o problema persistir, procure o suporte.";

/// Uma frase por regra de negócio que o schema protege.
///
/// Só entram constraints cuja violação é **alcançável pela tela**. Chave
/// primária e as `UNIQUE` que existem apenas para servir de alvo de FK ficam de
/// fora de propósito: o usuário não tem como violá-las, e uma frase para elas
/// seria adivinhação.
fn mensagem_de_constraint(constraint: &str) -> Option<&'static str> {
    Some(match constraint {
        // ── Duplicidade ──────────────────────────────────────────────────────
        "uq_processo_numero_documento" => {
            "Já existe um processo ou procedimento ativo com este número de documento para a \
             mesma unidade, ano, apuratório e documento iniciador."
        }
        "uq_processo_numero_controle" => {
            "Já existe um processo ou procedimento ativo com este número de controle para a \
             mesma unidade, ano e apuratório."
        }
        "uq_pm_matricula" => "Já existe um militar cadastrado com esta matrícula.",
        "uq_usuarios_email" => "Já existe uma conta de acesso com este e-mail.",
        "uq_usuario_pm" => "Este militar já tem conta de acesso. Edite a conta existente.",
        "uq_envolvido_pm" => "Este militar já está lançado como envolvido neste processo.",
        "uq_envolvido_ordem" => "Já existe um envolvido com esta ordem neste processo.",
        "uq_envolvido_condutor" => "Só pode haver um condutor por processo.",
        "uq_pessoa_ordem" => "Já existe uma pessoa com esta ordem neste processo.",
        "uq_prazo_ordem" => "Já existe um prazo com esta ordem neste processo.",
        "uq_apdoc_padrao" => {
            "Só um documento iniciador pode ser o padrão do apuratório. Desmarque o atual antes."
        }
        "uq_appapel_responsavel" => {
            "Só uma função pode responder pelo apuratório. Desmarque a atual antes."
        }
        "uq_designacao_anterior" => {
            "Esta designação já foi substituída. Recarregue a página para ver a substituição \
             mais recente."
        }

        // ── Período inválido ─────────────────────────────────────────────────
        "ex_designacao_sobreposicao" => {
            "Este militar já exerceu esta função em um período que se sobrepõe ao informado."
        }
        "ex_prazo_sobreposicao" => "Os prazos deste processo não podem se sobrepor.",
        "ck_designacao_periodo" => "O fim da designação precisa ser posterior ao início.",
        "ck_designacao_cadeia" => {
            "A substituição precisa começar exatamente no dia em que a designação anterior \
             termina, na mesma função e com outro militar."
        }
        "ck_prazo_ordem" | "ck_prazo_dias" => {
            "O prazo precisa de uma quantidade de dias maior que zero."
        }
        "ck_mapa_periodo" => "A data final do período não pode ser anterior à inicial.",
        "ck_processo_conclusao" => "A data de conclusão não pode ser anterior à instauração.",
        "ck_processo_recebimento" => "A data de recebimento não pode ser anterior à instauração.",
        "ck_processo_julgamento" => "A data de julgamento não pode ser anterior à instauração.",
        "ck_processo_remessa_enc" | "ck_processo_remessa_com" => {
            "A data de remessa não pode ser anterior à instauração."
        }

        // ── Vínculo com outro cadastro ───────────────────────────────────────
        "fk_designacao_apuratorio_papel" => {
            "A função escolhida não está prevista para esta espécie de apuratório. \
             Cadastre-a em Catálogos → Apuratórios ou escolha outra."
        }
        "fk_designacao_anterior" => {
            "Esta designação faz parte de uma cadeia de substituição. Desfaça a substituição \
             mais recente antes."
        }
        "fk_designacao_processo" => {
            "A espécie do apuratório não confere com a das designações já registradas."
        }

        // ── Campo obrigatório ────────────────────────────────────────────────
        "ck_andamento_descricao" => "Descreva o andamento antes de registrar.",
        "ck_pessoa_nome" => "Informe o nome da pessoa.",
        "ck_prazo_motivo" => "Informe o motivo da prorrogação.",
        "ck_anexo_nome" => "O arquivo precisa de um nome.",
        "ck_usuario_tem_nome" => {
            "A conta precisa de um nome: vincule um militar ou informe o nome de exibição."
        }

        // ── Limite configurado ───────────────────────────────────────────────
        "ck_apuratorio_max_envolvidos" => {
            "O número máximo de envolvidos precisa ser maior que zero."
        }
        "ck_apuratorio_acusacao_penal" => {
            "Ative primeiro a acusação do apuratório para então permitir acusações penais."
        }
        "ck_appapel_max" => "O número máximo de ocupantes precisa ser maior que zero.",
        "ck_apuratorio_prazo_base" | "ck_apdoc_prazo" => {
            "O prazo em dias precisa ser maior que zero."
        }
        "ck_envolvido_pena_dias" => {
            "A quantidade de dias da penalidade precisa ser maior que zero."
        }
        "ck_envolvido_pena_exige_decisao" => {
            "Só é possível registrar penalidade depois de informar a solução decidida."
        }
        "ck_envolvido_ordem" => "A ordem do envolvido precisa ser maior que zero.",

        _ => return None,
    })
}

/// A categoria do problema, quando a constraint específica é desconhecida.
///
/// Os catálogos administráveis são o caso que mais cai aqui: são 20 tabelas com
/// o mesmo formato e um índice único de nome cada uma (`uq_*_nome`), servidas
/// pelo CRUD genérico. Uma frase por tabela seria repetição sem ganho — a
/// categoria já diz o suficiente e continua acionável.
fn mensagem_de_categoria(sqlstate: &str) -> &'static str {
    match sqlstate {
        // unique_violation
        "23505" => {
            "Já existe um registro com estes dados. Verifique nome, sigla ou número informados."
        }
        // exclusion_violation
        "23P01" => "O período informado conflita com outro já registrado.",
        // foreign_key_violation
        "23503" => {
            "Este registro está vinculado a outro cadastro. Desative-o em vez de excluir, ou \
             remova antes os registros que dependem dele."
        }
        // check_violation
        "23514" => "Os dados informados não atendem a uma regra do cadastro. Revise os campos.",
        // not_null_violation
        "23502" => "Falta preencher um campo obrigatório.",
        // string_data_right_truncation
        "22001" => "Um dos textos informados é longo demais.",
        // invalid_text_representation / datetime_field_overflow
        "22P02" | "22008" => {
            "Um dos valores enviados está em formato inválido. Recarregue a página e tente de novo."
        }
        // serialization_failure / deadlock_detected
        "40001" | "40P01" => {
            "Outra pessoa alterou este registro ao mesmo tempo. Recarregue a página e refaça a \
             alteração."
        }
        _ => GENERICA,
    }
}

/// O banco não está acessível — serviço parado, rede, credencial, pool esgotado.
/// É a única família de falhas em que a orientação correta não é "tente de novo"
/// e sim "veja se o banco está no ar".
fn indisponivel(error: &sqlx::Error) -> bool {
    matches!(
        error,
        sqlx::Error::Io(_)
            | sqlx::Error::Tls(_)
            | sqlx::Error::PoolTimedOut
            | sqlx::Error::PoolClosed
            | sqlx::Error::Configuration(_)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Nenhuma mensagem pública pode carregar vocabulário de implementação.
    /// O teste vale para as duas camadas de uma vez.
    #[test]
    fn nenhuma_mensagem_publica_vaza_detalhe_tecnico() {
        let proibidos = [
            "constraint",
            "sqlx",
            "postgres",
            "sql",
            "uq_",
            "ck_",
            "fk_",
            "ex_",
            "pkey",
            "bcrypt",
            "panic",
            "unwrap",
            "null",
            "duplicate",
            "violates",
            "/home/",
            "\\\\",
        ];
        let constraints = [
            "uq_processo_numero_documento",
            "uq_pm_matricula",
            "ex_designacao_sobreposicao",
            "ck_designacao_cadeia",
            "fk_designacao_anterior",
            "ck_usuario_tem_nome",
        ];
        let categorias = [
            "23505", "23P01", "23503", "23514", "23502", "40001", "xxxxx",
        ];

        let mut mensagens: Vec<String> = constraints
            .iter()
            .map(|c| {
                mensagem_de_constraint(c)
                    .expect("constraint mapeada")
                    .to_string()
            })
            .collect();
        mensagens.extend(
            categorias
                .iter()
                .map(|c| mensagem_de_categoria(c).to_string()),
        );
        mensagens.push(AppError::Interno("bcrypt: cost inválido".into()).message());
        mensagens.push(AppError::Arquivo("/home/diogo/x.csv: acesso negado".into()).message());
        mensagens.push(AppError::Unauthorized.message());
        mensagens.push(AppError::Forbidden.message());
        mensagens.push(AppError::InvalidCredentials.message());

        for mensagem in &mensagens {
            let minuscula = mensagem.to_lowercase();
            for proibido in proibidos {
                assert!(
                    !minuscula.contains(proibido),
                    "a mensagem {mensagem:?} carrega o termo tecnico {proibido:?}"
                );
            }
            assert!(
                mensagem.ends_with('.'),
                "a mensagem {mensagem:?} precisa terminar em ponto"
            );
            assert!(
                mensagem.chars().next().is_some_and(char::is_uppercase),
                "a mensagem {mensagem:?} precisa comecar com maiuscula"
            );
        }
    }

    /// O detalhe técnico existe, mas só para o console — nunca no `message()`.
    #[test]
    fn o_detalhe_tecnico_fica_separado_da_mensagem() {
        let erro = AppError::Arquivo("/home/diogo/relatorio.csv: Permission denied".into());
        assert!(erro.detalhe_tecnico().is_some_and(|d| d.contains("/home/")));
        assert!(!erro.message().contains("/home/"));

        // Regra de negócio e sessão já dizem tudo na própria mensagem.
        assert!(AppError::Domain("Informe o motivo.".into())
            .detalhe_tecnico()
            .is_none());
        assert!(AppError::Unauthorized.detalhe_tecnico().is_none());
    }

    /// Banco fora do ar tem saída própria: mandar "tente novamente" para quem
    /// está com o serviço parado é mandar repetir o que não vai funcionar.
    #[test]
    fn banco_indisponivel_orienta_verificar_o_servico() {
        let erro = AppError::Database(sqlx::Error::PoolTimedOut);
        assert!(erro.message().contains("não está respondendo"));
        assert!(erro.message().contains("no ar"));
    }
}
