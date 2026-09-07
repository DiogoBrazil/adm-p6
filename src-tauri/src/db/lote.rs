//! Leitura de coleção para **vários** processos numa consulta só.
//!
//! Existe porque uma consulta por linha, dentro de um laço, é invisível em
//! `localhost` e insuportável com o banco do outro lado da internet. O Mapa do
//! Período montava 53 fichas com 1.013 idas e voltas: a 0,2 ms do
//! docker-compose isso somava 0,2 s e ninguém percebeu em oito anos; a 224 ms
//! do Neon virou 3,8 minutos e o véu de carregamento não fechava mais.
//!
//! Daí a forma que as funções-folha dos repositórios seguem: quem manda é a
//! versão em lote (`WHERE ... = ANY($1::uuid[])`), e a de um id só é casca fina
//! sobre ela. O SQL vive num lugar só, e o custo de uma tela passa a se medir
//! em **número de idas e voltas**, não em tempo de consulta.
//!
//! Duas regras que vêm junto:
//!
//!   - **Lista vazia não vai ao banco.** `= ANY('{}')` é falso para toda linha,
//!     então a consulta estaria correta — mas seriam round-trips comprados para
//!     receber nada.
//!   - **A ordem de dentro do grupo é a da consulta.** O agrupamento preserva a
//!     ordem de chegada das linhas, então o `ORDER BY` de cada folha continua
//!     mandando na ordem da ficha; prefixar a chave nele não muda isso, só
//!     deixa a intenção escrita.

use std::collections::HashMap;

/// Declara a linha de uma consulta em lote: a chave de agrupamento ao lado do
/// item que a tela já conhece.
///
/// O struct é interno e **não** deriva `Serialize` — de propósito. `#[sqlx…]` e
/// `#[serde…]` são atributos de coisas diferentes: aqui só o `sqlx` monta o
/// struct a partir da linha, e o item continua saindo pelo IPC no formato de
/// sempre, sem a chave e sem aninhamento. Derivar `Serialize` aqui aninharia o
/// JSON e a tela leria `undefined` em todos os campos, sem erro no Rust nem no
/// TypeScript — é a armadilha registrada na seção 7 do guia, e o teste de
/// contrato em `tests/commands_ipc.rs` existe para travá-la.
macro_rules! linha_agrupada {
    ($nome:ident, $item:ty) => {
        #[derive(sqlx::FromRow)]
        struct $nome {
            chave: String,
            #[sqlx(flatten)]
            item: $item,
        }

        impl $nome {
            fn partir(self) -> (String, $item) {
                (self.chave, self.item)
            }
        }
    };
}

pub(crate) use linha_agrupada;

/// Agrupa linhas `(chave, item)` preservando a ordem de chegada dentro de cada
/// grupo.
///
/// Preservar a ordem é requisito, não detalhe: é ela que decide a ordem dos
/// envolvidos, das designações e dos andamentos no documento impresso.
pub fn agrupar<T>(linhas: impl IntoIterator<Item = (String, T)>) -> HashMap<String, Vec<T>> {
    let mut grupos: HashMap<String, Vec<T>> = HashMap::new();
    for (chave, item) in linhas {
        grupos.entry(chave).or_default().push(item);
    }
    grupos
}
