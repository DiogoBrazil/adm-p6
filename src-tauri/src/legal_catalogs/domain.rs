use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// Tipo de uma coluna configurável. Determina como o valor é lido do banco e
/// como é ligado na escrita — nunca há interpolação de valor em SQL.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TipoColuna {
    Texto,
    TextoOpcional,
    Booleano,
    Inteiro,
    InteiroOpcional,
    /// Referência a outro catálogo. `alvo` diz qual, para o formulário montar o select.
    Referencia,
    ReferenciaOpcional,
    /// Referência que o sistema resolve sozinho, e que por isso NÃO aparece
    /// nem no formulário nem na lista. O valor sai da linha do catálogo `alvo`
    /// marcada por `marcador` — nunca de comparação por nome.
    ///
    /// Existe para a coluna que é obrigatória no banco e cuja resposta é
    /// sempre a mesma: perguntá-la seria pedir ao administrador que confirme
    /// o óbvio, e removê-la do schema custaria o rótulo que ela monta.
    ReferenciaFixa,
}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Coluna {
    pub nome: &'static str,
    pub rotulo: &'static str,
    pub tipo: TipoColuna,
    /// Catálogo referenciado, quando o tipo é uma referência.
    pub alvo: Option<&'static str>,
    /// Explicação do efeito da coluna quando ela carrega comportamento, e não só
    /// apresentação. É o texto que a tela mostra ao lado do campo.
    pub efeito: Option<&'static str>,
    /// Coluna booleana do catálogo `alvo` que marca a linha a usar, quando o
    /// tipo é `ReferenciaFixa`.
    pub marcador: Option<&'static str>,
    /// Nome de uma coluna booleana DESTE catálogo que revela este campo. O
    /// formulário o esconde enquanto ela estiver desmarcada, e limpa o valor
    /// ao desmarcar. Quem garante a regra é o banco; isto é a tela não pedir
    /// o que não se aplica.
    pub visivel_se: Option<&'static str>,
    /// Centraliza os valores desta coluna na listagem administrativa.
    pub centralizar: bool,
}

const fn texto(nome: &'static str, rotulo: &'static str) -> Coluna {
    Coluna {
        nome,
        rotulo,
        tipo: TipoColuna::Texto,
        alvo: None,
        efeito: None,
        marcador: None,
        visivel_se: None,
        centralizar: false,
    }
}
const fn texto_opcional(nome: &'static str, rotulo: &'static str) -> Coluna {
    Coluna {
        nome,
        rotulo,
        tipo: TipoColuna::TextoOpcional,
        alvo: None,
        efeito: None,
        marcador: None,
        visivel_se: None,
        centralizar: false,
    }
}
const fn booleano(nome: &'static str, rotulo: &'static str, efeito: &'static str) -> Coluna {
    Coluna {
        nome,
        rotulo,
        tipo: TipoColuna::Booleano,
        alvo: None,
        efeito: Some(efeito),
        marcador: None,
        visivel_se: None,
        centralizar: false,
    }
}
const fn inteiro(nome: &'static str, rotulo: &'static str, efeito: &'static str) -> Coluna {
    Coluna {
        nome,
        rotulo,
        tipo: TipoColuna::Inteiro,
        alvo: None,
        efeito: Some(efeito),
        marcador: None,
        visivel_se: None,
        centralizar: false,
    }
}
const fn inteiro_opcional(
    nome: &'static str,
    rotulo: &'static str,
    efeito: &'static str,
) -> Coluna {
    Coluna {
        nome,
        rotulo,
        tipo: TipoColuna::InteiroOpcional,
        alvo: None,
        efeito: Some(efeito),
        marcador: None,
        visivel_se: None,
        centralizar: false,
    }
}
const fn referencia(nome: &'static str, rotulo: &'static str, alvo: &'static str) -> Coluna {
    Coluna {
        nome,
        rotulo,
        tipo: TipoColuna::Referencia,
        alvo: Some(alvo),
        efeito: None,
        marcador: None,
        visivel_se: None,
        centralizar: false,
    }
}
/// Referência que o sistema resolve pela linha marcada com `marcador` no
/// catálogo `alvo`. Não aparece na tela — ver `TipoColuna::ReferenciaFixa`.
const fn referencia_fixa(nome: &'static str, alvo: &'static str, marcador: &'static str) -> Coluna {
    Coluna {
        nome,
        rotulo: "",
        tipo: TipoColuna::ReferenciaFixa,
        alvo: Some(alvo),
        efeito: None,
        marcador: Some(marcador),
        visivel_se: None,
        centralizar: false,
    }
}

/// Igual a `referencia_opcional`, mas só exibida quando a coluna booleana
/// `gatilho` deste mesmo catálogo estiver marcada.
const fn referencia_condicional(
    nome: &'static str,
    rotulo: &'static str,
    alvo: &'static str,
    gatilho: &'static str,
) -> Coluna {
    Coluna {
        nome,
        rotulo,
        tipo: TipoColuna::ReferenciaOpcional,
        alvo: Some(alvo),
        efeito: None,
        marcador: None,
        visivel_se: Some(gatilho),
        centralizar: false,
    }
}

const fn referencia_opcional(
    nome: &'static str,
    rotulo: &'static str,
    alvo: &'static str,
) -> Coluna {
    Coluna {
        nome,
        rotulo,
        tipo: TipoColuna::ReferenciaOpcional,
        alvo: Some(alvo),
        efeito: None,
        marcador: None,
        visivel_se: None,
        centralizar: false,
    }
}

/** Marca uma coluna textual ou de referência como compacta na listagem. */
const fn centralizada(mut coluna: Coluna) -> Coluna {
    coluna.centralizar = true;
    coluna
}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Catalogo {
    /// Identificador estável usado pelo frontend e pela auditoria. Não é exibido.
    pub chave: &'static str,
    /// Nome físico da tabela. Só sai daqui — nunca de um parâmetro de requisição.
    pub tabela: &'static str,
    pub rotulo: &'static str,
    pub colunas: &'static [Coluna],
    pub ordenacao: &'static str,
}

/// Registro de tudo que o administrador pode cadastrar.
///
/// Substitui os 68 comandos e ~2.800 linhas de CRUD repetido da versão anterior.
/// Acrescentar um catálogo passa a ser acrescentar uma entrada aqui — e os
/// atributos semânticos (`permite_penalidade`, `usa_quantidade_dias`,
/// `exige_condutor`, `indica_ausencia`, `pode_administrar`) ficam declarados ao
/// lado do campo que os carrega, com o efeito explicado para a tela.
pub const CATALOGOS: &[Catalogo] = &[
    Catalogo {
        chave: "tipos_apuratorio",
        tabela: "tipos_apuratorio",
        rotulo: "Tipos de apuratório",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "apuratorios",
        tabela: "apuratorios",
        rotulo: "Apuratórios",
        colunas: &[
            centralizada(texto("sigla", "Sigla")),
            texto("nome", "Nome"),
            referencia("tipo_apuratorio_id", "Tipo", "tipos_apuratorio"),
            inteiro("prazo_base_dias", "Prazo base (dias)",
                "Prazo inicial padrão desta espécie. Um documento iniciador pode sobrescrevê-lo."),
            inteiro_opcional("max_envolvidos", "Máximo de envolvidos",
                "Em branco = sem limite. O banco recusa gravar acima deste número."),
            booleano("exige_natureza_fato", "Exige natureza do fato",
                "Torna a rubrica do fato apurado obrigatória no cadastro."),
            booleano("permite_julgamento", "Permite julgamento",
                "Revela a data de julgamento no cadastro do processo."),
            booleano("permite_punicao", "Permite punição",
                "Revela penalidade e dias em cada envolvido. Vale junto com o atributo \
                 da solução decidida: a espécie precisa punir E o desfecho precisa punir."),
            booleano("permite_remessa_comissao", "Permite remessa à comissão",
                "Revela a data de remessa à comissão no cadastro do processo."),
            // `codigo_extensao` NÃO entra: é o único código técnico do schema
            // (§5.3), e acrescentar uma extensão de formulário é mudança de
            // código, não operação de administrador. A coluna continua no banco
            // e continua dirigindo a carta precatória — o `UPDATE` genérico só
            // escreve o que está declarado aqui, então editar um apuratório
            // pela tela não a apaga.
        ],
        ordenacao: "sigla",
    },
    Catalogo {
        chave: "tipos_documento",
        tabela: "tipos_documento",
        rotulo: "Tipos de documento",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "papeis_processo",
        tabela: "papeis_processo",
        rotulo: "Papéis no processo",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "naturezas_transgressao",
        tabela: "naturezas_transgressao",
        rotulo: "Naturezas de transgressão",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "naturezas_fato",
        tabela: "naturezas_fato",
        rotulo: "Naturezas do fato apurado",
        colunas: &[
            texto("nome", "Nome"),
            booleano("exige_condutor", "Exige condutor",
                "Marca as rubricas de sinistro: o cadastro passa a exigir o PM condutor."),
        ],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "status_envolvido",
        tabela: "status_envolvido",
        rotulo: "Status do envolvido",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "tipos_solucao_sugerida",
        tabela: "tipos_solucao_sugerida",
        rotulo: "Soluções sugeridas",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "tipos_solucao_decidida",
        tabela: "tipos_solucao_decidida",
        rotulo: "Soluções decididas",
        colunas: &[
            centralizada(texto("nome", "Nome")),
            booleano("permite_penalidade", "Permite penalidade",
                "Só com uma solução assim marcada o cadastro aceita tipo e dias de penalidade."),
        ],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "tipos_penalidade",
        tabela: "tipos_penalidade",
        rotulo: "Tipos de penalidade",
        colunas: &[
            centralizada(texto("nome", "Nome")),
            booleano("usa_quantidade_dias", "Usa quantidade de dias",
                "Habilita o campo de dias. Penalidades sem duração ficam desmarcadas."),
        ],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "categorias_indicio",
        tabela: "categorias_indicio",
        rotulo: "Categorias de indício",
        colunas: &[
            centralizada(texto("nome", "Nome")),
            booleano("indica_ausencia", "Indica ausência de indícios",
                "A categoria marcada assim não pode conviver com nenhuma outra no mesmo envolvido."),
        ],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "esferas_penais",
        tabela: "esferas_penais",
        rotulo: "Esferas penais",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "especies_infracao_penal",
        tabela: "especies_infracao_penal",
        rotulo: "Espécies de infração penal",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "dispositivos_legais",
        tabela: "dispositivos_legais",
        rotulo: "Dispositivos legais",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "infracoes_penais",
        tabela: "infracoes_penais",
        rotulo: "Infrações penais",
        colunas: &[
            referencia("dispositivo_legal_id", "Dispositivo legal", "dispositivos_legais"),
            centralizada(referencia("especie_id", "Espécie", "especies_infracao_penal")),
            centralizada(texto("artigo", "Artigo")),
            texto("descricao", "Descrição"),
            centralizada(texto_opcional("paragrafo", "Parágrafo")),
            centralizada(texto_opcional("inciso", "Inciso")),
            centralizada(texto_opcional("alinea", "Alínea")),
        ],
        ordenacao: "artigo",
    },
    Catalogo {
        chave: "artigos_rdpm",
        tabela: "artigos_rdpm",
        rotulo: "Artigos do RDPM",
        colunas: &[
            centralizada(texto("artigo", "Artigo")),
            centralizada(referencia("natureza_transgressao_id", "Natureza", "naturezas_transgressao")),
        ],
        ordenacao: "artigo",
    },
    Catalogo {
        chave: "transgressoes",
        tabela: "transgressoes",
        rotulo: "Transgressões do RDPM",
        colunas: &[
            centralizada(referencia("artigo_rdpm_id", "Artigo", "artigos_rdpm")),
            centralizada(texto("inciso", "Inciso")),
            texto("texto", "Texto"),
        ],
        ordenacao: "inciso",
    },
    Catalogo {
        chave: "infracoes_estatuto",
        tabela: "infracoes_estatuto",
        rotulo: "Infrações do Estatuto",
        colunas: &[
            // Uma infração do Estatuto é, por definição, do Estatuto: o select
            // só podia ter uma resposta. A coluna fica porque monta o rótulo
            // completo, e é resolvida pelo atributo — nunca pelo nome.
            referencia_fixa("dispositivo_legal_id", "dispositivos_legais", "e_estatuto_militar"),
            centralizada(texto("artigo", "Artigo")),
            centralizada(texto("inciso", "Inciso")),
            texto("texto", "Texto"),
        ],
        ordenacao: "artigo, inciso",
    },
    Catalogo {
        chave: "tipos_andamento",
        tabela: "tipos_andamento",
        rotulo: "Tipos de andamento",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "papeis_pessoa",
        tabela: "papeis_pessoa",
        rotulo: "Papéis de pessoa",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "municipios_distritos",
        tabela: "municipios_distritos",
        rotulo: "Municípios e distritos",
        colunas: &[
            centralizada(texto("nome", "Nome")),
            booleano("e_distrito", "É distrito",
                "Marcado, exige o município a que o distrito pertence — e o banco recusa gravar sem ele."),
            centralizada(referencia_condicional("municipio_pai_id", "Município",
                "municipios_distritos", "e_distrito")),
        ],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "unidades_pm",
        tabela: "unidades_pm",
        rotulo: "Unidades PM",
        colunas: &[
            centralizada(texto("nome", "Nome")),
            centralizada(referencia_opcional("municipio_id", "Município", "municipios_distritos")),
        ],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "circulos_hierarquicos",
        tabela: "circulos_hierarquicos",
        rotulo: "Círculos hierárquicos",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "postos_graduacoes",
        tabela: "postos_graduacoes",
        rotulo: "Postos e graduações",
        colunas: &[
            centralizada(texto("sigla", "Sigla")),
            centralizada(texto("nome", "Nome")),
            centralizada(referencia("circulo_hierarquico_id", "Círculo hierárquico", "circulos_hierarquicos")),
        ],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "perfis_acesso",
        tabela: "perfis_acesso",
        rotulo: "Perfis de acesso",
        colunas: &[
            centralizada(texto("nome", "Nome")),
            booleano("pode_administrar", "Pode administrar",
                "Concede acesso às telas de cadastro e configuração. O sistema impede que sobre nenhum."),
        ],
        ordenacao: "nome",
    },
];

pub fn catalogo(chave: &str) -> Option<&'static Catalogo> {
    CATALOGOS.iter().find(|c| c.chave == chave)
}

#[derive(Debug, Deserialize)]
pub struct SaveCatalogRequest {
    pub catalogo: String,
    pub id: Option<String>,
    pub valores: Map<String, Value>,
}

#[derive(Debug, Serialize)]
pub struct SaveCatalogResult {
    pub id: String,
}
