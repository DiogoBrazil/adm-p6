//! O recorte de uma listagem de tela, num lugar só.
//!
//! Existia copiado em cada repositório, com números diferentes em cada um:
//! `users` travava em 200, `audit_by_user` em 100, `audit_list` não travava em
//! nada e `deadlines_report` em 500. Três dessas listagens serviam a mesma
//! tela de listagem, com o mesmo controle de página — e a quarta deixava um
//! pedido de 100.000 linhas passar.
//!
//! **O teto corta calado, e é essa a armadilha.** Quem pede 500 e recebe 200
//! não recebe erro nem aviso: foi assim que 35 militares sumiram dos seletores
//! por toda a migração (§8.9 do guia). Por isso duas coisas valem aqui:
//!
//!   - o teto é **um só**, e vale para toda listagem de tela;
//!   - `page` e `per_page` **voltam no envelope**, para que a tela desenhe o
//!     controle de página com o que foi de fato servido, não com o que pediu.
//!
//! Lista de **opções** (a que alimenta um `<select>`) não passa por aqui: ela
//! não pagina de jeito nenhum. Ver `users::repository::list_ativos`.

/// Itens por página quando o chamador não diz. O mesmo número da tela.
pub const PADRAO: i64 = 10;

/// Teto de itens por página. Acima disto a listagem deixa de ser listagem.
pub const TETO: i64 = 200;

/// Página e tamanho já corrigidos, com o `OFFSET` derivado.
#[derive(Debug, Clone, Copy)]
pub struct Recorte {
    pub page: i64,
    pub per_page: i64,
    pub offset: i64,
}

impl Recorte {
    /// Corrige o pedido: página mínima 1, tamanho entre 1 e [`TETO`].
    pub fn novo(page: Option<i64>, per_page: Option<i64>) -> Self {
        let page = page.unwrap_or(1).max(1);
        let per_page = per_page.unwrap_or(PADRAO).clamp(1, TETO);
        Self {
            page,
            per_page,
            offset: (page - 1) * per_page,
        }
    }
}

impl Default for Recorte {
    fn default() -> Self {
        Self::novo(None, None)
    }
}
