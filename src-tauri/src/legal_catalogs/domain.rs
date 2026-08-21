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
}

const fn texto(nome: &'static str, rotulo: &'static str) -> Coluna {
    Coluna {
        nome,
        rotulo,
        tipo: TipoColuna::Texto,
        alvo: None,
        efeito: None,
    }
}
const fn texto_opcional(nome: &'static str, rotulo: &'static str) -> Coluna {
    Coluna {
        nome,
        rotulo,
        tipo: TipoColuna::TextoOpcional,
        alvo: None,
        efeito: None,
    }
}
const fn booleano(nome: &'static str, rotulo: &'static str, efeito: &'static str) -> Coluna {
    Coluna {
        nome,
        rotulo,
        tipo: TipoColuna::Booleano,
        alvo: None,
        efeito: Some(efeito),
    }
}
const fn inteiro(nome: &'static str, rotulo: &'static str, efeito: &'static str) -> Coluna {
    Coluna {
        nome,
        rotulo,
        tipo: TipoColuna::Inteiro,
        alvo: None,
        efeito: Some(efeito),
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
    }
}
const fn referencia(nome: &'static str, rotulo: &'static str, alvo: &'static str) -> Coluna {
    Coluna {
        nome,
        rotulo,
        tipo: TipoColuna::Referencia,
        alvo: Some(alvo),
        efeito: None,
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
    }
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
        colunas: &[texto("nome", "Nome")],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "apuratorios",
        tabela: "apuratorios",
        rotulo: "Apuratórios",
        colunas: &[
            texto("sigla", "Sigla"),
            texto("nome", "Nome"),
            referencia("tipo_apuratorio_id", "Tipo", "tipos_apuratorio"),
            inteiro("prazo_base_dias", "Prazo base (dias)",
                "Prazo inicial padrão desta espécie. Um documento iniciador pode sobrescrevê-lo."),
            inteiro_opcional("max_envolvidos", "Máximo de envolvidos",
                "Em branco = sem limite. O banco recusa gravar acima deste número."),
            booleano("exige_natureza_fato", "Exige natureza do fato",
                "Torna a rubrica do fato apurado obrigatória no cadastro."),
            texto_opcional("codigo_extensao", "Código de extensão"),
        ],
        ordenacao: "sigla",
    },
    Catalogo {
        chave: "tipos_documento",
        tabela: "tipos_documento",
        rotulo: "Tipos de documento",
        colunas: &[texto("nome", "Nome")],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "papeis_processo",
        tabela: "papeis_processo",
        rotulo: "Papéis no processo",
        colunas: &[texto("nome", "Nome")],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "naturezas_transgressao",
        tabela: "naturezas_transgressao",
        rotulo: "Naturezas de transgressão",
        colunas: &[texto("nome", "Nome")],
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
        colunas: &[texto("nome", "Nome")],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "tipos_solucao_sugerida",
        tabela: "tipos_solucao_sugerida",
        rotulo: "Soluções sugeridas",
        colunas: &[texto("nome", "Nome")],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "tipos_solucao_decidida",
        tabela: "tipos_solucao_decidida",
        rotulo: "Soluções decididas",
        colunas: &[
            texto("nome", "Nome"),
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
            texto("nome", "Nome"),
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
            texto("nome", "Nome"),
            booleano("indica_ausencia", "Indica ausência de indícios",
                "A categoria marcada assim não pode conviver com nenhuma outra no mesmo envolvido."),
        ],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "esferas_penais",
        tabela: "esferas_penais",
        rotulo: "Esferas penais",
        colunas: &[texto("nome", "Nome")],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "especies_infracao_penal",
        tabela: "especies_infracao_penal",
        rotulo: "Espécies de infração penal",
        colunas: &[texto("nome", "Nome")],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "dispositivos_legais",
        tabela: "dispositivos_legais",
        rotulo: "Dispositivos legais",
        colunas: &[texto("nome", "Nome")],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "subdivisao_textos_normativos",
        tabela: "subdivisao_textos_normativos",
        rotulo: "Subdivisões de textos normativos",
        colunas: &[
            texto("nome", "Nome"),
            referencia("dispositivo_legal_id", "Dispositivo legal", "dispositivos_legais"),
        ],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "infracoes_penais",
        tabela: "infracoes_penais",
        rotulo: "Infrações penais",
        colunas: &[
            referencia("dispositivo_legal_id", "Dispositivo legal", "dispositivos_legais"),
            referencia("especie_id", "Espécie", "especies_infracao_penal"),
            referencia_opcional("subdivisao_id", "Subdivisão", "subdivisao_textos_normativos"),
            texto("artigo", "Artigo"),
            texto("descricao", "Descrição"),
            texto_opcional("paragrafo", "Parágrafo"),
            texto_opcional("inciso", "Inciso"),
            texto_opcional("alinea", "Alínea"),
        ],
        ordenacao: "artigo",
    },
    Catalogo {
        chave: "artigos_rdpm",
        tabela: "artigos_rdpm",
        rotulo: "Artigos do RDPM",
        colunas: &[
            texto("artigo", "Artigo"),
            referencia("natureza_transgressao_id", "Natureza", "naturezas_transgressao"),
        ],
        ordenacao: "artigo",
    },
    Catalogo {
        chave: "transgressoes",
        tabela: "transgressoes",
        rotulo: "Transgressões do RDPM",
        colunas: &[
            referencia("artigo_rdpm_id", "Artigo", "artigos_rdpm"),
            texto("inciso", "Inciso"),
            texto("texto", "Texto"),
        ],
        ordenacao: "inciso",
    },
    Catalogo {
        chave: "infracoes_estatuto",
        tabela: "infracoes_estatuto",
        rotulo: "Infrações do Estatuto",
        colunas: &[
            referencia("dispositivo_legal_id", "Dispositivo legal", "dispositivos_legais"),
            texto("artigo", "Artigo"),
            texto("inciso", "Inciso"),
            texto("texto", "Texto"),
        ],
        ordenacao: "artigo, inciso",
    },
    Catalogo {
        chave: "tipos_andamento",
        tabela: "tipos_andamento",
        rotulo: "Tipos de andamento",
        colunas: &[texto("nome", "Nome")],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "papeis_pessoa",
        tabela: "papeis_pessoa",
        rotulo: "Papéis de pessoa",
        colunas: &[texto("nome", "Nome")],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "municipios_distritos",
        tabela: "municipios_distritos",
        rotulo: "Municípios e distritos",
        colunas: &[
            texto("nome", "Nome"),
            texto("tipo", "Tipo"),
            referencia_opcional("municipio_pai_id", "Município", "municipios_distritos"),
        ],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "unidades_pm",
        tabela: "unidades_pm",
        rotulo: "Unidades PM",
        colunas: &[
            texto("nome", "Nome"),
            referencia_opcional("municipio_id", "Município", "municipios_distritos"),
        ],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "circulos_hierarquicos",
        tabela: "circulos_hierarquicos",
        rotulo: "Círculos hierárquicos",
        colunas: &[texto("nome", "Nome")],
        ordenacao: "nome",
    },
    Catalogo {
        chave: "postos_graduacoes",
        tabela: "postos_graduacoes",
        rotulo: "Postos e graduações",
        colunas: &[
            texto("sigla", "Sigla"),
            texto("nome", "Nome"),
            referencia("circulo_hierarquico_id", "Círculo hierárquico", "circulos_hierarquicos"),
            inteiro("ordem_hierarquica", "Ordem hierárquica",
                "Maior valor = posto mais alto. É a ordenação usada em listas e relatórios."),
        ],
        ordenacao: "ordem_hierarquica DESC",
    },
    Catalogo {
        chave: "perfis_acesso",
        tabela: "perfis_acesso",
        rotulo: "Perfis de acesso",
        colunas: &[
            texto("nome", "Nome"),
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
