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
    /// Consulta que devolve o assunto de UMA linha para a trilha de auditoria.
    /// `$1` é o id; o resultado é o texto da coluna "Sobre o quê".
    ///
    /// É consulta inteira, e não nome de coluna, porque não existe uma coluna de
    /// exibição para todos: os quatro catálogos jurídicos compõem o rótulo com
    /// junções. São as mesmas expressões de
    /// `evidence/repository.rs::{ROTULO_PENAL, ROTULO_TRANSGRESSAO, ROTULO_ESTATUTO}`,
    /// e o aviso de lá vale aqui — **o rótulo já termina na descrição**, não se
    /// concatena `descricao`/`texto` de novo.
    ///
    /// Mora ao lado de `tabela` pela mesma razão que ela: o SQL sai da tabela de
    /// metadados, nunca de um parâmetro de requisição.
    pub assunto_sql: &'static str,
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
        assunto_sql: "SELECT nome FROM tipos_apuratorio WHERE id = $1::uuid",
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
            booleano("exige_natureza_fato", "Exige natureza geral do fato",
                "Torna a rubrica do fato apurado obrigatória no cadastro."),
            booleano("permite_julgamento", "Permite julgamento",
                "Revela a data de julgamento no cadastro do processo."),
            booleano("permite_punicao", "Permite punição",
                "Revela penalidade e dias em cada envolvido. Vale junto com o atributo \
                 da solução decidida: a espécie precisa punir E o desfecho precisa punir."),
            booleano("permite_remessa_comissao", "Permite remessa à comissão",
                "Revela a data de remessa à comissão no cadastro do processo."),
            booleano("permite_acusacao", "Permite acusação",
                "Exige enquadramento jurídico do acusado no cadastro do processo."),
            booleano("permite_acusacao_penal", "Permite acusação penal",
                "Libera crimes e contravenções na acusação, além das infrações disciplinares."),
            booleano("permite_indicios", "Permite indícios",
                "Libera o registro de indícios para procedimentos investigativos."),
            booleano("permite_solucao_sugerida", "Permite solução sugerida",
                "Libera a proposta de solução pelo encarregado no resultado do envolvido."),
            // `codigo_extensao` NÃO entra: é o único código técnico do schema
            // (§5.3), e acrescentar uma extensão de formulário é mudança de
            // código, não operação de administrador. A coluna continua no banco
            // e continua dirigindo a carta precatória — o `UPDATE` genérico só
            // escreve o que está declarado aqui, então editar um apuratório
            // pela tela não a apaga.
        ],
        ordenacao: "sigla",
        assunto_sql: "SELECT sigla || ' - ' || nome FROM apuratorios WHERE id = $1::uuid",
    },
    Catalogo {
        chave: "tipos_documento",
        tabela: "tipos_documento",
        rotulo: "Tipos de documento",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
        assunto_sql: "SELECT nome FROM tipos_documento WHERE id = $1::uuid",
    },
    Catalogo {
        chave: "papeis_processo",
        tabela: "papeis_processo",
        rotulo: "Funções no apuratório",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
        assunto_sql: "SELECT nome FROM papeis_processo WHERE id = $1::uuid",
    },
    Catalogo {
        chave: "naturezas_transgressao",
        tabela: "naturezas_transgressao",
        rotulo: "Naturezas de transgressão",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
        assunto_sql: "SELECT nome FROM naturezas_transgressao WHERE id = $1::uuid",
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
        assunto_sql: "SELECT nome FROM naturezas_fato WHERE id = $1::uuid",
    },
    Catalogo {
        chave: "status_envolvido",
        tabela: "status_envolvido",
        rotulo: "Status do envolvido",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
        assunto_sql: "SELECT nome FROM status_envolvido WHERE id = $1::uuid",
    },
    Catalogo {
        chave: "tipos_solucao_sugerida",
        tabela: "tipos_solucao_sugerida",
        rotulo: "Soluções sugeridas",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
        assunto_sql: "SELECT nome FROM tipos_solucao_sugerida WHERE id = $1::uuid",
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
        assunto_sql: "SELECT nome FROM tipos_solucao_decidida WHERE id = $1::uuid",
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
        assunto_sql: "SELECT nome FROM tipos_penalidade WHERE id = $1::uuid",
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
        assunto_sql: "SELECT nome FROM categorias_indicio WHERE id = $1::uuid",
    },
    Catalogo {
        chave: "esferas_penais",
        tabela: "esferas_penais",
        rotulo: "Esferas penais",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
        assunto_sql: "SELECT nome FROM esferas_penais WHERE id = $1::uuid",
    },
    Catalogo {
        chave: "especies_infracao_penal",
        tabela: "especies_infracao_penal",
        rotulo: "Espécies de infração penal",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
        assunto_sql: "SELECT nome FROM especies_infracao_penal WHERE id = $1::uuid",
    },
    Catalogo {
        chave: "dispositivos_legais",
        tabela: "dispositivos_legais",
        rotulo: "Dispositivos legais",
        colunas: &[
            centralizada(texto("nome", "Nome")),
            centralizada(booleano("nome_feminino", "Nome feminino",
                "Concorda o artigo com o nome ao citar o enquadramento: marcado escreve \
                 'Art. 33 da Lei de Drogas'; desmarcado, 'Art. 312 do Código Penal'.")),
        ],
        ordenacao: "nome",
        assunto_sql: "SELECT nome FROM dispositivos_legais WHERE id = $1::uuid",
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
        assunto_sql: r#"
            SELECT 'Art. ' || ip.artigo
                     || COALESCE(', § ' || ip.paragrafo, '')
                     || COALESCE(', inciso ' || ip.inciso, '')
                     || COALESCE(', alínea ' || ip.alinea, '')
                     || CASE WHEN dl.nome_feminino THEN ' da ' ELSE ' do ' END || dl.nome
                     || ' - ' || ip.descricao
              FROM infracoes_penais ip
              JOIN dispositivos_legais dl ON dl.id = ip.dispositivo_legal_id
             WHERE ip.id = $1::uuid
        "#,
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
        assunto_sql: r#"
            SELECT ar.artigo || ' do RDPM (' || nt.nome || ')'
              FROM artigos_rdpm ar
              JOIN naturezas_transgressao nt ON nt.id = ar.natureza_transgressao_id
             WHERE ar.id = $1::uuid
        "#,
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
        assunto_sql: r#"
            SELECT ar.artigo || ', inciso ' || t.inciso || ' do RDPM ('
                     || nt.nome || ') - ' || t.texto
              FROM transgressoes t
              JOIN artigos_rdpm ar ON ar.id = t.artigo_rdpm_id
              JOIN naturezas_transgressao nt ON nt.id = ar.natureza_transgressao_id
             WHERE t.id = $1::uuid
        "#,
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
        assunto_sql: r#"
            SELECT ie.artigo || ', inciso ' || ie.inciso
                     || CASE WHEN dl.nome_feminino THEN ' da ' ELSE ' do ' END || dl.nome
                     || ' - ' || ie.texto
              FROM infracoes_estatuto ie
              JOIN dispositivos_legais dl ON dl.id = ie.dispositivo_legal_id
             WHERE ie.id = $1::uuid
        "#,
    },
    Catalogo {
        chave: "tipos_andamento",
        tabela: "tipos_andamento",
        rotulo: "Tipos de andamento",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
        assunto_sql: "SELECT nome FROM tipos_andamento WHERE id = $1::uuid",
    },
    Catalogo {
        chave: "papeis_pessoa",
        tabela: "papeis_pessoa",
        rotulo: "Papéis de pessoa",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
        assunto_sql: "SELECT nome FROM papeis_pessoa WHERE id = $1::uuid",
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
        assunto_sql: r#"
            SELECT nome || CASE WHEN e_distrito THEN ' (distrito)' ELSE '' END
              FROM municipios_distritos WHERE id = $1::uuid
        "#,
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
        assunto_sql: "SELECT nome FROM unidades_pm WHERE id = $1::uuid",
    },
    Catalogo {
        chave: "subunidades_secoes",
        tabela: "subunidades_secoes",
        rotulo: "Subunidades/Seções de origem",
        colunas: &[
            centralizada(referencia("unidade_pm_id", "Unidade PM", "unidades_pm")),
            centralizada(texto("nome", "Nome")),
        ],
        ordenacao: "unidade_pm_id, nome",
        assunto_sql: r#"
            SELECT u.nome || ' / ' || s.nome
              FROM subunidades_secoes s
              JOIN unidades_pm u ON u.id = s.unidade_pm_id
             WHERE s.id = $1::uuid
        "#,
    },
    Catalogo {
        chave: "circulos_hierarquicos",
        tabela: "circulos_hierarquicos",
        rotulo: "Círculos hierárquicos",
        colunas: &[centralizada(texto("nome", "Nome"))],
        ordenacao: "nome",
        assunto_sql: "SELECT nome FROM circulos_hierarquicos WHERE id = $1::uuid",
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
        assunto_sql: "SELECT sigla || ' - ' || nome FROM postos_graduacoes WHERE id = $1::uuid",
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
        assunto_sql: "SELECT nome FROM perfis_acesso WHERE id = $1::uuid",
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
