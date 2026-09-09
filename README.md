# ADM P6 — Seção de Justiça e Disciplina do 7º BPM

Sistema de cadastro e acompanhamento de **apuratórios** — os processos
disciplinares e procedimentos de apuração da Polícia Militar de Rondônia: SR,
IPM, PADS, PAD, CD, CJ, carta precatória e as demais espécies cadastradas —, com
prazos, designações, enquadramento e os relatórios que a Seção emite.

Aplicativo de desktop em **Rust + Tauri 2**, frontend em TypeScript sem framework
e **PostgreSQL 16**. Migrado de uma versão anterior em Python/Eel; o banco carrega
os registros de 2018 em diante.

---

## Como usar este documento

Ele tem duas metades, e você provavelmente só precisa de uma:

- **[Parte I — o que o app mostra](#parte-i--o-que-o-app-mostra)** responde
  *"o que é esta informação na tela?"*. Cada campo, cada coluna, cada número de
  relatório está aqui pelo **nome exato que aparece no app** — dá para procurar
  com `Ctrl+F` copiando o rótulo direto da tela.
- **[Parte II — rodar, buildar e manter](#parte-ii--rodar-buildar-e-manter)** é
  para quem mexe no projeto: ambiente, testes, instaladores, migração de dados.

E há um terceiro documento, que **não** é este: o **[`GUIA.md`](GUIA.md)** conta
*por que o código é assim* — as 70 decisões de negócio já tomadas, o modelo de
dados, as armadilhas conhecidas e o changelog das rodadas. Regra simples:
significado de dado e operação estão **aqui**; decisão de projeto e armadilha de
implementação estão **lá**.

---

## Índice

**Parte I — o que o app mostra**

1. [Glossário](#1-glossário)
2. [O ciclo de vida de um apuratório](#2-o-ciclo-de-vida-de-um-apuratório)
3. [As telas, uma a uma](#3-as-telas-uma-a-uma)
   · [Convenções gerais](#31-convenções-que-valem-para-todas-as-telas)
   · [Painel](#32-painel)
   · [Processos e Procedimentos](#33-processos-e-procedimentos)
   · [Prazos](#34-prazos)
   · [Usuários](#35-usuários)
   · [Configuração de apuratórios](#36-configuração-de-apuratórios)
   · [Auditoria](#37-auditoria)
   · [Designações por Policial Militar](#38-designações-por-policial-militar)
   · [Mapa do Período](#39-mapa-do-período)
   · [Mapas Salvos](#310-mapas-salvos)
   · [Relatório Anual](#311-relatório-anual)
   · [Estatísticas dos Apuratórios](#312-estatísticas-dos-apuratórios)
   · [Os 26 catálogos](#313-os-26-catálogos)
4. [Os números, um por um](#4-os-números-um-por-um)
   · [Escopo](#41-escopo-a-regra-que-vale-para-todos-os-relatórios)
   · [Painel](#42-os-números-do-painel)
   · [Prazos](#43-os-números-de-prazos)
   · [Status prazo](#44-a-coluna-status-prazo)
   · [Designações](#45-os-números-de-designações)
   · [Mapa do Período](#46-os-números-do-mapa-do-período)
   · [Estatísticas](#47-os-números-de-estatísticas)
   · [Relatório Anual](#48-os-números-do-relatório-anual)
5. [Perguntas frequentes](#5-perguntas-frequentes)

**Parte II — rodar, buildar e manter**

6. [Rodar em desenvolvimento](#6-rodar-em-desenvolvimento)
7. [Conferir](#7-conferir)
8. [Gerar os instaladores](#8-gerar-os-instaladores)
9. [A conexão no primeiro uso](#9-a-conexão-no-primeiro-uso)
10. [Antes de mexer no banco](#10-antes-de-mexer-no-banco)
11. [Migrar os dados do sistema anterior](#11-migrar-os-dados-do-sistema-anterior)
12. [Estrutura do repositório](#12-estrutura-do-repositório)

---
---

# Parte I — o que o app mostra

## 1. Glossário

Os termos que o app usa sem explicar. Cada verbete remete à seção onde o termo
aparece na tela.

**Apuratório** — a espécie do feito: SR, IPM, PADS, PAD, CD, CJ, carta
precatória e o que mais estiver cadastrado. Não é uma lista fixa no código: é o
catálogo `Apuratórios`, e cada espécie carrega os atributos que decidem como o
formulário se comporta — prazo base, máximo de envolvidos, se exige natureza do
fato, se permite julgamento, punição, remessa à comissão. Acrescentar uma espécie
é cadastro, não programação. Ver [3.13](#313-os-26-catálogos).

**Documento iniciador** — o documento que deu origem ao apuratório (portaria,
memorando, feito preliminar…). Cada espécie habilita os seus em
[Configuração de apuratórios](#36-configuração-de-apuratórios), e cada um pode
ter prazo próprio. O banco recusa qualquer par espécie/documento que o
administrador não tenha habilitado.

**Nº do documento × Nº de controle** — o primeiro é o número do documento que
instaurou; o segundo é o número interno da Seção. Deixar o controle em branco faz
ele valer igual ao número do documento.

**Identificação** — o nome curto pelo qual o apuratório aparece nas listagens e
nos relatórios, montado pelo sistema:
`SIGLA nº CONTROLE/ANO/UNIDADE[/SUBUNIDADE]`. Não é digitado.

**Unidade / Subunidade de origem** — de onde o fato veio. A subunidade é opcional
e a lista dela é filtrada pela unidade escolhida.

**Natureza geral do fato** — a rubrica do que se apura. Algumas naturezas estão
marcadas como *"Exige condutor"* no catálogo: quando uma delas é escolhida, o
formulário passa a pedir qual dos envolvidos conduzia a viatura.

**Envolvido** — o policial militar a quem o apuratório se dirige. Cada envolvido
tem situação, possivelmente a marca de condutor, os enquadramentos e o resultado.
Quantos cabem por apuratório é atributo da espécie.

**Condutor** — o PM que conduzia a viatura no sinistro. A caixa só existe quando
a natureza do fato exige, e um envolvido "À apurar" não pode ser marcado como
condutor — é preciso identificá-lo antes.

**"À apurar"** — envolvido ainda não identificado. Conta no limite de envolvidos,
recebe enquadramento e resultado como qualquer outro, aparece literalmente como
`À apurar` nas listagens, mas **não** pode ser condutor, e há no máximo um por
apuratório.

**Enquadramento (ou Acusações)** — os dispositivos imputados a **cada
envolvido**, em três famílias:

- **Infração penal** — crime ou contravenção, com a **esfera** (militar ou comum)
  escolhida caso a caso, no vínculo. A mesma infração pode aparecer nas duas.
- **Transgressão do RDPM** — artigo e inciso do Regulamento Disciplinar.
- **Infração do Estatuto** — e esta **exige** uma transgressão do RDPM por
  **analogia**. É regra universal, e o banco recusa gravar sem ela.

**Categoria de indício** — a classificação do indício encontrado. Uma das
categorias é de **ausência** de indício, e ela é exclusiva: marcada, o
enquadramento tem de ficar vazio.

**Solução sugerida × Solução decidida** — a primeira é a proposta do encarregado
(só existe nas espécies que a permitem); a segunda é a da autoridade. A
**Penalidade** só aparece quando a espécie permite punir *e* a solução decidida
está marcada como uma que permite penalidade; e o campo **Dias** só aparece
quando o tipo de penalidade usa duração.

**Designação / Função** — quem responde pelo apuratório e em que papel
(Encarregado, Presidente, Escrivão…). As funções disponíveis são configuradas por
espécie, com máximo de ocupantes e obrigatoriedade próprios. Uma delas é marcada
como **responsável** — é ela que aparece na coluna "Encarregado" das listagens e
nos relatórios.

**Responsável vigente** — o ocupante atual da função responsável, isto é, a
designação sem data de fim.

**Substituição** — a troca do ocupante de uma função no meio do apuratório. O
**fim é exclusivo**: é o dia em que o sucessor assume, sem sobreposição nem
lacuna. Só a substituição mais recente de cada função pode ser corrigida ou
desfeita.

**Prazo inicial × Prorrogação** — o prazo inicial **nasce da data de
recebimento**: sem ela, nenhum prazo existe. Cada prorrogação começa no
vencimento anterior e tem motivo próprio. O prazo que vale é sempre o de maior
ordem.

**Remessa** — a data em que o apuratório saiu das mãos do encarregado. Nas
espécies que tramitam por comissão, é a *remessa da comissão*; nas demais, a
*remessa do encarregado*. É ela que faz o status virar **Entregue**.

**Entregue × Concluído** — não são a mesma coisa, e a diferença explica metade
das dúvidas de prazo. **Entregue** é o encarregado ter cumprido a parte dele: o
prazo dele deixa de ser cobrado. **Concluído** é o apuratório ter terminado.
Um apuratório entregue e não concluído continua no acervo, mas sai da tela de
Prazos. Ver [4.4](#44-a-coluna-status-prazo).

**Ofendido/Vítima × Pessoa inquirida** — a vítima é registrada à parte, e só nas
espécies que a aceitam; as pessoas inquiridas são testemunhas e demais ouvidos,
cada uma com o seu papel.

**Andamento** — o registro datado de uma movimentação do apuratório.

**Anexo** — arquivo guardado junto ao apuratório.

**Ativo × inativo (nos catálogos)** — catálogo em uso se **desativa**, não se
apaga. Uma opção desativada some das listas de escolha, mas continua sendo
exibida nos registros antigos que a usam — um apuratório de 2019 tem de continuar
mostrando a natureza que foi desativada em 2026. Ver
[Perguntas frequentes](#5-perguntas-frequentes).

---

## 2. O ciclo de vida de um apuratório

As datas não são só registro: cada uma **destrava** alguma coisa. Esta é a ordem
em que aparecem, e o que cada uma muda.

| Data | Onde se informa | O que ela destrava |
|---|---|---|
| **Instauração** | formulário, obrigatória | O apuratório passa a existir e a contar no acervo. É dela que sai o **Ano** das listagens e dos relatórios. Não pode ser futura, nem posterior a qualquer data já gravada. |
| **Recebimento** | formulário, opcional | **Faz nascer o prazo inicial.** Sem ela o apuratório fica *Sem prazo* — que não é "no prazo" nem "vencido", é um quarto estado. |
| **Prorrogações** | detalhe → Prazos | Cada uma começa no vencimento anterior e substitui o prazo vigente. |
| **Remessa** (do encarregado ou da comissão) | detalhe → Datas posteriores | O status vira **Entregue** e o apuratório **sai da tela de Prazos** — o prazo era do encarregado, e ele já entregou. |
| **Julgamento** | detalhe → Datas posteriores | Só existe nas espécies que permitem julgamento. |
| **Conclusão** | detalhe → Datas posteriores | O apuratório sai de "em andamento". É a data que os relatórios usam para dizer o que foi concluído no período. |

Duas consequências que geram dúvida:

- **Apuratório sem recebimento não tem prazo nenhum.** Ele não aparece na tela de
  Prazos, não entra nos KPIs de prazo, e em Designações cai num balde próprio,
  *Sem prazo definido*. Não é erro: é a ausência de uma informação que ninguém
  ainda deu.
- **Entregue vence Vencido.** Um apuratório entregue com o prazo já estourado
  aparece como `Entregue`, não como vencido. O vencimento não some — fica no
  tooltip do badge.

Depois de concluído, o apuratório pode ser **reaberto** (botão `Reabrir` no
detalhe) — é a única forma de remover uma conclusão já registrada.

---

## 3. As telas, uma a uma

### 3.1 Convenções que valem para todas as telas

Antes das telas, o que se repete em todas — assim nenhuma seção precisa dizer de
novo:

| Convenção | O que significa |
|---|---|
| `—` numa célula | Não há valor. Não é zero, é vazio. |
| `sim` / `não` | Coluna de sim-ou-não. |
| `dd/mm/aaaa` | Data. Data vazia vira `—`. |
| `dd/mm/aaaa hh:mm:ss` | Data e hora (só em Auditoria). |
| **10 por página** | Toda listagem operacional pagina de dez em dez. |
| `1–10 de 47 (página 1 de 5)` | O rodapé da paginação, com `Anterior` e `Próxima`. Ele **some** quando tudo cabe numa página. |
| `(inativo)` depois de uma opção | Opção de catálogo desativada, mostrada porque o registro que você está vendo a usa. |
| `admin` no menu | Item que só o perfil administrador enxerga. |

Quem entra com perfil somente leitura não vê os botões de ação; algumas telas
escrevem `Perfil somente leitura.` no lugar deles.

A **busca instantânea** filtra enquanto você digita. A **exportação de planilha**
e a **impressão** levam sempre o **filtro inteiro**, não a página que está na
tela: exportar da página 1 de 5 traz as cinco.

**Os campos de escolha longos têm busca**: em vez de rolar a lista, digite parte
do que procura e o campo filtra — nome, posto ou matrícula, no caso de policial
militar. Vale no cadastro do apuratório e também no detalhe dele: o `Sucessor` de
uma substituição, a solução sugerida, a solução decidida, o tipo de penalidade e
o documento autorizador. Listas curtas e fixas — mês, ano, situação, ordenação —
continuam sendo um select comum, onde clicar é mais rápido que digitar.

**Todo campo de data** aceita as duas formas: escolher no calendário ou **digitar**
a data, inclusive o ano. O calendário navega para **qualquer ano** — não há piso
nem teto na navegação, então um processo de 2018 se cadastra sem rodeio.

Isso **não** afrouxa nenhuma regra. A ordem das datas do fluxo (instauração ≤
recebimento ≤ remessa ≤ julgamento ≤ conclusão) e o "não pode ser futura"
continuam valendo: a data fora de ordem recebe o aviso embaixo do campo, dizendo
qual é o limite e por quê, e o formulário não é salvo enquanto ela estiver ali. A
diferença é que agora o campo **avisa** em vez de impedir a navegação — o que
importa quando é a data de instauração que precisa ser corrigida, e é ela quem
define o limite das outras.

---

### 3.2 Painel

*Menu: Geral → Painel.* O panorama de triagem: como está o acervo hoje e o que já
venceu.

**Quatro indicadores no topo:** `Total de apuratórios`, `Em andamento`,
`Concluídos` e `Prazos vencidos` — este último com o detalhe
`Requer atenção imediata` quando há algum, e `Nenhuma pendência crítica` quando
não há.

**Cartão `Controle de prazos`** — *"Criticidade dos prazos vigentes; janela de
atenção de 30 dias."* Gráfico e tabela com as colunas `Criticidade` e
`Quantidade`, em três linhas: `Vencidos`, `A vencer`, `Regulares`. Vazio:
`Nenhum prazo vigente.`

**Painel `Prazos vencidos`** — no máximo **8 linhas**; havendo mais, a tela
avisa `Os 8 mais antigos.`. Colunas `Apuratório`, `Responsável`, `Venceu em` e
`Atraso` (em dias). O botão `Ver todos em Prazos` leva à tela cheia.

> **O Painel não tem filtro nenhum.** Ele é sempre o acervo inteiro. Distribuições
> por unidade, espécie ou ano ficam em
> [Estatísticas](#312-estatísticas-dos-apuratórios) — cada indicador tem uma tela
> dona, e repetir o mesmo número em três telas foi justamente o que se corrigiu.

De onde sai cada número: [4.2](#42-os-números-do-painel).

---

### 3.3 Processos e Procedimentos

*Menu: Apuratórios → Processos e Procedimentos.* A tela central do sistema.

#### 3.3.1 A listagem

Título `Apuratórios`, com o total de registros abaixo.

| Coluna | O que é |
|---|---|
| `Tipo` | A sigla da espécie (SR, IPM, PADS…). |
| `Ano` | O ano da **data de instauração**. |
| `Número` | O número de controle. |
| `Origem` | `Unidade / Subunidade`. |
| `SEI` | O número do processo SEI, quando houver. |
| `Encarregado` | O ocupante **vigente** da função marcada como responsável. Vazio quando a espécie não tem função responsável ativa. |
| `PM envolvido` | Um envolvido → a qualificação dele. Mais de um → `{primeiro} e outros`, com a lista completa no tooltip. Não identificado → `À apurar`. |
| `Status prazo` | O badge de situação. Os sete estados possíveis estão em [4.4](#44-a-coluna-status-prazo). |
| `Ações` | `Abrir` — vai ao detalhe. |

**Busca instantânea:** `Número, SEI, resumo, encarregado ou envolvido…`

**`Filtros avançados`** — o botão traz o número de filtros aplicados. O modal
*"Combine quantos parâmetros forem necessários."* oferece onze campos:
`Tipo de apuratório`, `Situação`, `Unidade`, `Local dos fatos`, `Encarregado`,
`PM envolvido`, `Vítima/Ofendido`, `Documento iniciador`, `Ano`,
`Data de instauração (início)` e `Data de instauração (fim)`. Botões
`Limpar filtros`, `Cancelar` e `Aplicar filtros`. Data inicial depois da final é
recusada com `A data inicial não pode ser posterior à data final.`

As opções de `Situação` são `Todas`, `Em andamento`, `Concluído`, `Entregue`,
`No prazo` e `Vencido` — e **`Em andamento` aqui significa "não concluído"**,
incluindo o entregue e o sem prazo. É uma pergunta diferente da que a tela de
Prazos faz; ver [4.3](#43-os-números-de-prazos).

Cada filtro aplicado vira uma etiqueta removível, prefixada pelo campo: `Tipo:`,
`Unidade:`, `Encarregado:`, `Vítima/Ofendido:`, `Situação:`, `Instauração:`,
`Ano:`, `Local:`, `PM envolvido:`, `Documento:`.

Vazio: `Nenhum apuratório encontrado.` O botão `Novo` (só admin) abre o
formulário.

#### 3.3.2 O formulário

Nada neste formulário depende de sigla escrita no código. O que aparece, o que é
obrigatório e o que fica escondido vem dos **atributos cadastrados** da espécie —
é por isso que criar uma espécie nova não exige programar.

**`Identificação`** — `Apuratório` (obrigatório; é ele que decide todo o resto da
tela), `Documento iniciador` (obrigatório, escrito `{documento} ({n} dias)`),
`Nº do documento` (obrigatório), `Nº de controle` (*"Em branco = igual ao número
do documento."*), `Processo SEI` e `Nº RGF`. Se a espécie não tem documento
habilitado, a tela avisa: *"Este apuratório não tem documento iniciador
habilitado. Configure em Catálogos → Configuração de apuratórios."*

**`Localização`** — `Unidade de origem` (obrigatória), `Subunidade/Seção de
origem` (opcional, e a lista é filtrada pela unidade), `Município do fato`
(obrigatório) e `Natureza geral do fato`, que é **obrigatória só nas espécies
marcadas para exigi-la**. Todos têm cadastro rápido: o botão `Cadastrar …` abre
`Novo — {catálogo}` sem sair do apuratório, com `Salvar e selecionar`.

**`Carta precatória`** — o bloco só existe nas espécies marcadas com essa
extensão. Campos `Deprecante` e `Unidade deprecada`, ambos obrigatórios.

**`Datas`** — `Instauração` (obrigatória) e `Recebimento` (opcional, com botão
`Limpar`). A ajuda do recebimento diz o essencial: *"Dispara o prazo inicial: sem
ela, nenhum prazo nasce."*

**`Designações`** — uma linha por designação, com `Função` e `Policial Militar`.
As funções obrigatórias saem marcadas com `*`, e a tela avisa quais são: *"O
apuratório não salva sem elas."* Função que já atingiu o teto de ocupantes
aparece como `— já preenchido (máx. n)` e desabilitada. Não há data nem documento
aqui, e o texto explica: *"A designação inicial começa na data de instauração e é
autorizada pelo documento que instaurou o apuratório… Trocas posteriores são
feitas em Substituir, na página de detalhes."* Designação que já sofreu
substituição fica **travada**, com o badge `com histórico`.

**`Envolvidos`** — por linha:

- `Policial Militar`, com a opção especial `À apurar — PM ainda não identificado`;
- `Situação` (obrigatória);
- `Condutor` — **só aparece** quando a natureza escolhida exige. Um `À apurar`
  não pode ser marcado: *"Identifique o PM antes de marcá-lo como condutor."*;
- **`Acusações`** — *"Selecione um ou mais enquadramentos. Infrações do Estatuto
  exigem analogia com o RDPM."*, com o total de selecionadas ao lado. Três buscas:
  `Crime ou contravenção` (busca por `artigo ou descrição`, com filtro
  `Dispositivo`), `Transgressão do RDPM` (por `inciso ou texto`, com filtro
  `Natureza`) e `Infração do Estatuto` (por `artigo, inciso ou texto`). Cada
  escolha vira um vínculo: o penal com o select `Esfera`, o estatutário com a
  `analogia:` e o botão `Trocar analogia`. Vazio: `Nenhuma acusação selecionada.`

Quando a espécie declara máximo de envolvidos, a tela escreve *"Este apuratório
aceita no máximo {n} envolvido(s)."* e esconde o botão de adicionar.

**`Ofendidos/Vítimas (opcional)`** — só nas espécies que aceitam. Se a espécie
deixou de aceitar mas já existe vítima gravada, o bloco vira somente leitura, com
o aviso de que *"O que já estava gravado é preservado e continua sendo exibido,
mas não pode ser alterado aqui."*

**`Pessoas inquiridas`** — `Papel` e `Nome`, quantas forem.

**`Fatos`** — `Resumo`, texto livre e opcional.

#### 3.3.3 O detalhe

Título: a identificação do apuratório; subtítulo `{espécie} — concluído` ou
`— em andamento`. Botões `Voltar`, `Editar` e, se concluído, `Reabrir`.

**A ficha** repete os dados cadastrais, e **cada linha só aparece se houver
valor**: documento iniciador, números, origem, município, natureza, as seis datas,
o responsável com a função entre parênteses, e os campos da carta precatória.

**`Datas posteriores ao cadastro`** (só admin) — é aqui que entram
`Remessa do encarregado` **ou** `Remessa da comissão` (a espécie escolhe qual),
`Julgamento` (nas espécies que o permitem) e `Conclusão`, cada um com `Limpar`.
A nota explica o limite: *"Remessas e julgamento podem ser corrigidos ou
removidos. Para remover uma conclusão já registrada, use Reabrir."*

> Um campo que a configuração **já não permite**, mas que tem valor gravado,
> continua aparecendo — com a ajuda *"O campo permanece disponível porque já há
> uma data registrada."* Não é inconsistência: configuração define comportamento
> **futuro**, e não reescreve fato já registrado.

**`Envolvidos`** — `#`, `Policial Militar`, `Situação`, `Condutor`, `Acusações`,
`Sugerida`, `Decidida`, `Penalidade` e `Ações`. As colunas `Acusações` e
`Sugerida` só existem nas espécies que as permitem. `Penalidade` escreve
`{tipo} — {n} dias`. Ações: `Editar resultado` (admin) e `Ver indícios`.

O formulário de resultado tem `Solução sugerida` (condicional),
`Solução decidida`, `Penalidade` (só quando a espécie permite punir **e** a
solução decidida permite penalidade) e `Dias` (só quando o tipo de penalidade usa
duração).

**`Ofendidos/Vítimas`** (`#`, `Nome`) e **`Pessoas inquiridas`** (`Papel`,
`Nome`) — somente leitura; a segunda só aparece quando há alguém.

**`Designações`** — `Função` (com ` (responsável)` quando for a responsável),
`Policial Militar`, `Início`, `Fim` (`vigente` quando aberta), `Documento`,
`Motivo` e `Ações`. O documento mostra `{tipo} nº {número}`, ou `-` quando a
função foi configurada sem citar documento. Ações: `Substituir {função}` e, só na
ponta da cadeia, `Editar esta substituição` e `Desfazer esta substituição`.
A nota fecha a regra: *"O fim é exclusivo: é o dia em que o sucessor assume, sem
sobreposição nem lacuna. Só a substituição mais recente de cada função pode ser
corrigida ou desfeita."*

**`Prazos`** — `Ordem` (`inicial` ou `{n}ª prorrogação`), `Início`, `Dias`,
`Vencimento`, `Motivo` (`Prazo inicial` na primeira linha) e `Ações` (só na
prorrogação vigente). Vazio: `Sem prazo. O prazo inicial nasce da data de
recebimento.` Para prorrogar: `Novo vencimento` e `Motivo`, com a nota
*"Vencimento atual: {data}. A nova data deve ser posterior; a prorrogação começa
no vencimento atual."*

**`Andamentos`** — `Data`, `Tipo`, `Registrado por`, `Descrição` e `Ações`.
**`Anexos`** — `Arquivo`, `Tamanho`, `Enviado por` e `Ações` (`Baixar`; `Remover`
para admin). **`Resumo dos fatos`** — o texto livre; vazio:
`Nenhum resumo registrado.`

**`Indícios e enquadramento`** — a tela aberta pelo `Ver indícios` de um
envolvido. É a versão completa das Acusações, com o bloco extra `Categorias`. Uma
categoria de **ausência** é exclusiva: marcada, a tela avisa que *"o enquadramento
abaixo deve ficar vazio"*.

---

### 3.4 Prazos

*Menu: Apuratórios → Prazos.* A tela de cobrança: de quem se cobra prazo agora.

**Quatro indicadores:** `Com prazo vigente`, `Vencidos` (com o detalhe
`Fora do prazo` ou `Nenhuma pendência crítica`), `Vencem em {n} dias` e
`Regulares`.

**Duas listagens, com as mesmas colunas:**

| Coluna | O que é |
|---|---|
| `Apuratório` | `{SIGLA} nº {número de controle}`. |
| `Unidade` | A unidade de origem. |
| `Responsável` | O ocupante vigente da função responsável. |
| `Vencimento` | A data do prazo vigente. |
| `Dias` | `{n} em atraso` ou `{n} restantes`. |
| `Prazo` | `inicial` ou `{n}ª prorrogação`. |

- **`Vencidos`** — com o total num badge vermelho. Vazio: `Nenhum prazo vencido.`
- **`Vencendo em até {n} dias`** — badge laranja. Vazio: `Nenhum prazo na janela.`

Os dois blocos **paginam separadamente**, e são **exclusivos**: nenhum apuratório
aparece nos dois. Linha vencida é destacada por inteiro.

**Filtro `Janela`:** `7 dias`, `14 dias`, `30 dias`, `60 dias` — o padrão é 14.
Trocar a janela devolve os dois blocos à página 1.

Não há ação de linha. `Imprimir / PDF` e `Exportar planilha` levam os **dois
blocos inteiros** (abas `Vencidos` e `A vencer`), não a página visível.

> **Esta tela não lista o entregue nem o concluído.** O prazo é do encarregado;
> registrada a remessa, não há mais o que cobrar dele. Por isso os números daqui
> não batem com os do Painel — ver [4.3](#43-os-números-de-prazos).

---

### 3.5 Usuários

*Menu: Usuários → Usuários.* O cadastro de policiais militares. A conta de acesso
é **opcional**: um PM pode existir no sistema para ser designado ou envolvido sem
nunca entrar nele.

| Coluna | O que é |
|---|---|
| `Posto/Graduação` | |
| `Matrícula` | |
| `Nome` | |
| `Encarregado` | `sim` / `—`. Quer dizer **pode ser designado**. |
| `Usuário do sistema` | `sim` / `não` — se tem conta de acesso. |
| `Perfil` | O perfil de acesso, quando tem conta. |
| `Situação` | `ativo` / `inativo`. Linha inativa fica esmaecida. |
| `Ações` | `Abrir` sempre; e, para admin, `Desativar` ou `Reativar`, e `Excluir`. |

Busca instantânea por nome ou matrícula. `Novo`, `Imprimir / PDF` e
`Exportar planilha` no cabeçalho. Vazios: `Nenhum policial militar encontrado.`
(com busca) ou `Nenhum policial militar cadastrado.`

**Desativar × Excluir:** desativar tira o PM de circulação preservando tudo o que
ele já tem; excluir só é possível para quem **não tem vínculo nenhum** — sem
designação e sem envolvimento.

**A ficha do PM** (`Abrir`) traz a qualificação e o badge `Ativo`/`Inativo`, o
círculo hierárquico, se é `pode ser designado` ou `não designável`, e o e-mail ou
`sem conta de acesso`. Três painéis de contagem — `Designações por função`,
`Designações por apuratório` e `Envolvimentos por status`, cada um com a coluna
`Quantidade` — e duas tabelas, `Designado (n)` e `Como envolvido (n)`, com
`Instauração` e `Situação` (`concluído em {data}` ou `em andamento`).

---

### 3.6 Configuração de apuratórios

*Menu: Catálogos → Configuração de apuratórios (admin).* *"Define o que o banco
aceita como apuratório desta espécie."* Escolhida a espécie no alto, duas tabelas.

**`Documentos iniciadores`** — `Documento`, `Prazo próprio`, `Prazo efetivo`,
`Padrão`, `Situação`, `Em uso`, `Ações`. Um documento sem prazo próprio
(placeholder `herda`) usa o prazo base da espécie — é isso que `Prazo efetivo`
mostra. Ações: `Desativar`/`Reativar`, `Tornar padrão` e `Excluir`, esta só
enquanto `Em uso` estiver vazio.

**`Funções`** — `Função`, `Obrigatória`, `Máx. ocupantes`, `Responsável`,
`Cita documento`, `Situação`, `Em uso`, `Ações`, com `Tornar responsável` entre
as ações.

Dois avisos que a tela dá, e que valem entender:

- *"Sem documento iniciador ativo, nenhum registro pode ser criado neste
  apuratório."*
- *"Sem função responsável ativa, os apuratórios aparecem sem responsável na
  listagem e nos relatórios."*

> A função responsável é configurada **por espécie**, de propósito: é o Encarregado
> nos procedimentos e o Presidente em PAD, CD e CJ. Uma marca global não
> conseguiria dizer isso.

---

### 3.7 Auditoria

*Menu: Auditoria → Auditoria.* A trilha do que foi cadastrado, alterado e
excluído.

| Coluna | O que é |
|---|---|
| `Quando` | Data e hora. |
| `Quem fez` | O usuário. |
| `O que foi feito` | A ação; na falta de uma descrição própria, `Cadastrou` / `Alterou` / `Excluiu` mais a entidade. |
| `Sobre o quê` | O registro atingido. Quando ele já não existe: `registro já removido`. |

Filtros `Sobre o quê` (as opções trazem o total entre parênteses), `Tipo de ação`
e `Quem fez`, com `Filtrar` e `Limpar`. A linha inteira é clicável.

O detalhe `Registro de auditoria` traz a seção **`O que mudou`**, que escreve as
diferenças na forma `de {antes} para {depois}` — com `vazio` para nulo e
`sim`/`não` para sim-ou-não. Quando não há detalhamento, explica por quê: *"Ele é
gravado nas mudanças de configuração, que alteram o comportamento futuro do
sistema."* A seção `Rastreio` (tabela, registro, operação) existe só para
conferência técnica, e a própria tela diz isso.

> **Desativar aparece como alteração, não como exclusão.** É o que de fato
> acontece: a linha continua no banco, com um campo mudado.

---

### 3.8 Designações por Policial Militar

*Menu: Relatórios → Designações por Policial Militar.* Quanto cada militar tem na
mão, por espécie e em que situação. É relatório de **carga de trabalho** — não de
cobrança de prazo.

**Filtros:** `Ano`, `Policial Militar`, `Situação`, `Ordenar por`, `Vínculo`, e as
listas `Apuratórios (nenhum marcado = todos)` e `Funções (nenhuma marcada =
todas)`. Abaixo, a faixa `Escopo aplicado:` repete tudo em palavras.

- `Situação`: `Todas as situações`, `Concluídos`, `Em andamento (todos)`,
  `Em andamento no prazo`, `Em andamento vencido`, `Sem prazo definido`.
- `Ordenar por`: `Mais apuratórios`, `Recebimento mais recente`,
  `Recebimento mais antigo`, `Conclusão mais recente`, `Conclusão mais antiga`.
- `Vínculo`: `Todas as designações` (padrão) ou `Somente as vigentes`. O padrão
  **conta designação já encerrada** — quem foi encarregado e foi substituído
  continua aparecendo, porque a pergunta é sobre carga histórica.

**Indicadores** — sem militar escolhido: `POLICIAIS MILITARES DESIGNADOS`,
`Apuratórios no escopo`, `Concluídos`, `Em andamento vencidos`. Com um militar
escolhido: `Apuratórios do policial militar`, `Concluídos`,
`Em andamento no prazo`, `Em andamento vencido`.

**A tabela** tem `Policial Militar` (ou `Apuratório`, no modo militar), depois uma
coluna por situação presente — `Concluídos`, `Em andamento no prazo`,
`Em andamento vencido`, `Sem prazo definido` —, mais `Total`, `Últ. recebimento` e
`Últ. conclusão`. Situação sem nenhum caso não vira coluna. Vazio:
`Nenhuma designação neste escopo.`

**`Matriz de designações`** — `Policial Militar` cruzado com uma coluna por sigla,
mais `Total` e uma linha final de totais; célula zero vira `—`. Na impressão ela
é substituída por uma tabela de três colunas (`Policial Militar`, `Apuratório`,
`Quantidade`), que é o que cabe no papel.

De onde saem os números, e por que `Em andamento (todos)` não fecha com
`Total − Concluídos`: [4.5](#45-os-números-de-designações).

---

### 3.9 Mapa do Período

*Menu: Mapas → Mapa do Período.* *"O que estava em mãos no período: aberto até o
fim dele — inclusive de anos anteriores — mais o concluído dentro dele."*

Filtros `Mês`, `Ano` e `Apuratórios (escolha um ou mais)`, com a caixa `Todos`, e
o botão `Gerar mapa`. Gerado, aparecem o título do período e a linha de resumo
`{n} no período · {n} em andamento · {n} concluídos no mês`, mais os controles
`Conteúdo do PDF` (o mapa inteiro ou um processo específico), `Gerar PDF`,
`Salvar este mapa` e `Exportar planilha`.

| Coluna | De onde vem |
|---|---|
| `Apuratório` | A sigla da espécie. |
| `Identificação` | `SIGLA nº CONTROLE/ANO/UNIDADE[/SUBUNIDADE]`. |
| `Unidade` | `Unidade / Subunidade` de origem. |
| `Natureza` | A natureza geral do fato, ou `—`. |
| `Instauração` | A data de instauração. |
| `Conclusão` | A data de conclusão — ou, se não houver, o texto **`em andamento`** (não é `—`). |
| `Responsável` | O ocupante vigente da função responsável, com posto e matrícula. |
| `Envolvidos` | Todos os envolvidos, na ordem de cadastro, com `À apurar` para os não identificados. |
| `Vencimento` | O prazo vigente, ou `—`. |
| `Último andamento` | O andamento mais recente que não foi cancelado. |

Esta tela **não pagina** — é documento, e sai inteira.

A ordem das espécies no documento não é alfabética: vem da coluna de ordem do
catálogo `Apuratórios`, que o administrador define.

Por que um apuratório de 2019 aparece no mapa deste mês:
[4.6](#46-os-números-do-mapa-do-período).

---

### 3.10 Mapas Salvos

*Menu: Mapas → Mapas Salvos.* *"Cada mapa é o registro do que foi emitido, não um
recálculo."*

Colunas `Título`, `Apuratório` (`todos` quando não era de uma espécie só),
`Período` (`{data} a {data}`), `Total`, `Em andamento`, `Concluídos`,
`Gerado por`, `Em` e `Ações` — `Ver resumo`, `Ver PDF completo` e `Excluir` (só
admin). Clicar na linha abre o resumo. Vazio: `Nenhum mapa salvo.`

> Um mapa salvo é um **retrato congelado**. Reabri-lo em 2027 mostra os números de
> quando foi emitido, mesmo que os apuratórios tenham mudado desde então — é o que
> se espera de um documento já publicado.

---

### 3.11 Relatório Anual

*Menu: Relatórios → Relatório Anual.* O documento de encerramento do exercício:
capa institucional, resumo e onze seções numeradas.

Filtro `Ano` e botão `Emitir`. O resumo traz `Instaurados no ano`,
`Ainda em andamento`, `Concluídos` e `Espécies com registros`. As seções são:
1 `Resumo do exercício`, 2 `Processos e procedimentos por espécie`,
3 `Unidades de origem`, 4 `Natureza geral do fato`, 5 `Categorias de indício`,
6 `Soluções sugeridas pelo encarregado`, 7 `Soluções decididas pela autoridade`,
8 `Responsabilidade vigente`, 9 `Transgressões do RDPM`,
10 `Infrações do Estatuto`, 11 `Infrações penais`.

Só `Imprimir / PDF` — **não** exporta planilha, de propósito: é peça de arquivo,
não material de trabalho.

> **Não há filtro por espécie aqui**, e é intencional: um relatório anual com
> metade das espécies não é o relatório anual do 7º BPM. Para recortar, use
> [Estatísticas](#312-estatísticas-dos-apuratórios) — as duas telas leem
> exatamente o mesmo dado, e diferem no gênero: uma se opera, a outra se imprime.

---

### 3.12 Estatísticas dos Apuratórios

*Menu: Relatórios → Estatísticas dos Apuratórios.* *"O escopo é escolhido no
filtro; todos os painéis o respeitam."* A tela de explorar.

Filtros `Ano` e `Apuratórios (nenhum marcado = todos)`, com `Aplicar` e a faixa
`Escopo aplicado:`. Indicadores: `Total no escopo`, `Em andamento`, `Concluídos`
e `Espécies com registros`.

**Sob `Acervo`:** `Situação por apuratório` (tabela `Apuratório`, `Tipo`,
`Em andamento`, `Concluídos`, `Total`), `Evolução das instaurações`,
`Unidades de origem`, `Natureza geral do fato` e `Responsabilidade vigente`.

**Sob `Apuração`:** `Soluções sugeridas pelo encarregado`,
`Soluções decididas pela autoridade`, `Categorias de indício`,
`Condutores em sinistro`, `Transgressões do RDPM`, `Infrações do Estatuto` e
`Infrações penais`.

Cada cartão tem gráfico **e** tabela, com um alternador. As tabelas de contagem
têm a coluna `Quantidade`; as de enquadramento têm `Classificação`, `Descrição` e
`Qtd.`.

> **O gráfico mostra os 12 maiores; a tabela e a planilha trazem tudo.** Quando há
> mais de doze, o cartão avisa. O percentual, porém, continua sendo calculado
> sobre o total real — ver [4.7](#47-os-números-de-estatísticas).

---

### 3.13 Os 26 catálogos

*Menu: Catálogos.* Cada catálogo é uma tela igual às outras — `Novo`, busca
`Filtrar…`, caixa `Mostrar inativos`, e por linha `Editar`, `Desativar`/`Reativar`
e `Excluir`. As colunas mudam conforme o catálogo; as duas últimas são sempre
`Situação` (badge `ativo`/`inativo`) e `Ações`.

Estas telas **não existem como arquivo de programa**: o menu é montado a partir
do que o backend declara. Cadastrar um catálogo novo faz a tela aparecer sozinha.

| Catálogo | Para que serve |
|---|---|
| `Tipos de apuratório` | A classificação maior — processo ou procedimento. |
| `Apuratórios` | As espécies (SR, IPM, PADS…) e os atributos que comandam o formulário: prazo base, máximo de envolvidos, se exige natureza, se permite julgamento, punição, remessa à comissão, e a ordem no mapa. |
| `Tipos de documento` | Os documentos que iniciam ou autorizam atos. |
| `Funções no apuratório` | Encarregado, Presidente, Escrivão… O que cada espécie usa se define em [Configuração de apuratórios](#36-configuração-de-apuratórios). |
| `Naturezas de transgressão` | A classificação das transgressões do RDPM. |
| `Naturezas gerais do fato apurado` | As rubricas do fato. É aqui que se marca *"Exige condutor"*. |
| `Status do envolvido` | As situações possíveis de um envolvido. |
| `Soluções sugeridas` | As propostas do encarregado. |
| `Soluções decididas` | As decisões da autoridade — e quais delas permitem penalidade. |
| `Tipos de penalidade` | E quais usam quantidade de dias. |
| `Categorias de indício` | Inclusive a categoria que indica **ausência** de indício. |
| `Esferas penais` | Militar e comum. |
| `Espécies de infração penal` | Crime, contravenção. |
| `Dispositivos legais` | Os diplomas citados, com a marca de qual é o Estatuto. |
| `Infrações penais` | O rol de crimes e contravenções. |
| `Artigos do RDPM` | |
| `Transgressões do RDPM` | Artigo e inciso, com a natureza. |
| `Infrações do Estatuto` | |
| `Tipos de andamento` | |
| `Papéis de pessoa (Exceto Vítima)` | Testemunha, indiciado, e demais ouvidos. |
| `Municípios e distritos` | Com a marca de distrito e o município a que pertence. |
| `Unidades PM` | |
| `Subunidades/Seções de origem` | Vinculadas à unidade. |
| `Círculos hierárquicos` | |
| `Postos e graduações` | |
| `Perfis de acesso` | E qual deles administra. |

Cada campo do formulário traz, abaixo dele, o texto do **efeito** daquele
atributo — por exemplo, em `Tipos de penalidade`: *"Habilita o campo de dias.
Penalidades sem duração ficam desmarcadas."* Alguns campos só aparecem quando
outro está marcado: em `Municípios e distritos`, `Município` só surge depois de
`É distrito`.

**Desativar × Excluir**, e a confirmação diz tudo: *"O registro sai do banco e NÃO
há como desfazer. Para tirá-lo de circulação sem perder o histórico, use
Desativar."*

---

## 4. Os números, um por um

Cada indicador aparece aqui com o rótulo exato, a pergunta que responde, a regra
em português e — recuada — a condição que o sistema de fato aplica. A regra em
português é para operar; o SQL é para quando um número parece errado e alguém
precisa conferir.

### 4.1 Escopo: a regra que vale para todos os relatórios

**Lista de filtro vazia significa "todos", não "nenhum".** Não marcar espécie
nenhuma em Estatísticas traz o acervo inteiro — não zero linhas.

```sql
-- Aplicado a todo relatório: NULL (nenhuma escolha) desliga o recorte.
AND ($1::uuid[] IS NULL OR p.apuratorio_id = ANY($1::uuid[]))
AND ($2::int    IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::int = $2)
```

Duas consequências:

- **O ano é sempre o da instauração.** Não existe outro. Filtrar 2025 traz o que
  foi instaurado em 2025, mesmo que tenha sido concluído em 2026.
- **Os catálogos desativados continuam contando.** Relatório lê registro
  existente, e registro existente não filtra por "ativo" — só a lista de
  **opções** filtra. Uma transgressão desativada hoje continua aparecendo nas
  estatísticas dos anos em que foi usada.

Cada tela tem o seu escopo, e nenhuma tem todos — cada indicador tem uma tela
dona:

| Tela | Escopo |
|---|---|
| Painel | **Nenhum.** Sempre o acervo inteiro. |
| Prazos | Só a janela em dias (7/14/30/60). |
| Estatísticas | Ano + espécies, e todos os cartões o respeitam. |
| Relatório Anual | Ano obrigatório, **sem** recorte por espécie. |
| Designações | Seis eixos: ano, espécies, funções, militar, vínculo e situação. |
| Mapa do Período | Mês/ano + espécies. |

---

### 4.2 Os números do Painel

**`Total de apuratórios`, `Em andamento`, `Concluídos`** — o acervo inteiro, sem
nenhum recorte. "Em andamento" aqui é simplesmente **não concluído**: inclui o
que já foi entregue e inclui o que não tem prazo.

```sql
SELECT count(*),
       count(*) FILTER (WHERE data_conclusao IS NULL),   -- Em andamento
       count(*) FILTER (WHERE data_conclusao IS NOT NULL) -- Concluídos
  FROM processos_procedimentos WHERE ativo
```

**`Prazos vencidos`** — quantos apuratórios ainda em mãos passaram do prazo
vigente. É o único dos quatro que olha prazo. Não conta o concluído, não conta o
entregue, e não conta quem não tem prazo.

```sql
SELECT count(*)
  FROM processos_procedimentos p
  JOIN LATERAL (SELECT pr.data_vencimento FROM processo_prazos pr
                 WHERE pr.processo_id = p.id
                 ORDER BY pr.ordem DESC LIMIT 1) prazo ON true
 WHERE p.ativo AND p.data_conclusao IS NULL
   AND COALESCE(p.data_remessa_comissao, p.data_remessa_encarregado) IS NULL
   AND prazo.data_vencimento < CURRENT_DATE
```

O `JOIN LATERAL` — e não um `LEFT JOIN` — é o que já descarta quem não tem prazo.

**O cartão `Controle de prazos`** usa a **janela fixa de 30 dias**, e as três
linhas são as mesmas de [4.3](#43-os-números-de-prazos).

---

### 4.3 Os números de Prazos

Os três primeiros vêm do banco, sobre o **prazo vigente** de cada apuratório (o
de maior ordem), com quatro exclusões que valem para todos ao mesmo tempo:
apuratório ativo, **não concluído**, **não entregue**, e que tenha prazo.

```sql
SELECT count(*)                                                        AS total,
       count(*) FILTER (WHERE p.data_vencimento <  CURRENT_DATE)       AS vencidos,
       count(*) FILTER (WHERE p.data_vencimento >= CURRENT_DATE
                          AND p.data_vencimento <= CURRENT_DATE + $1)  AS proximos
  FROM processo_prazos p
  JOIN processos_procedimentos pr ON pr.id = p.processo_id
 WHERE p.id IN (SELECT DISTINCT ON (processo_id) id FROM processo_prazos
                 ORDER BY processo_id, ordem DESC)
   AND pr.ativo AND pr.data_conclusao IS NULL
   AND COALESCE(pr.data_remessa_comissao, pr.data_remessa_encarregado) IS NULL
```

- **`Com prazo vigente`** = `total`.
- **`Vencidos`** = venceu **antes de hoje**.
- **`Vencem em {n} dias`** = vence de **hoje** até o fim da janela (`$1`).
- **`Regulares`** — **este não vem do banco**: é `total − vencidos − próximos`,
  calculado na tela. É por isso que retirar algo dos três primeiros (o entregue,
  por exemplo) tem de ser feito nos três de uma vez: tirar só de "vencidos" o
  empurraria para "Regulares".

**Por que o KPI bate com as linhas da tabela.** As duas consultas são diferentes,
mas aplicam as **mesmas quatro exclusões**. Foi um defeito real: o número dizia
oito e a tabela mostrava seis. Toda exclusão nova precisa entrar nas duas.

**Por que os dois blocos são exclusivos.** O piso `>= CURRENT_DATE` no bloco "a
vencer": "vencido" é estritamente antes de hoje, "vencendo" começa hoje. Sem esse
piso o mesmo apuratório aparecia nas duas tabelas.

---

### 4.4 A coluna `Status prazo`

O badge da listagem de apuratórios. A precedência é
**`Concluído` > `Entregue` > prazo**, e é ela que responde a maioria das dúvidas.

| Situação | Texto do badge | Cor |
|---|---|---|
| Concluído | `Concluído` | azul |
| Entregue (e não concluído) | `Entregue` | amarelo |
| Sem prazo | `Sem prazo` | cinza |
| Venceu | `Vencido há {n} dias` | vermelho |
| Vence hoje | `Vence hoje` | laranja |
| Vence em até 5 dias | `Vence em {n} dias` | laranja |
| Vence em mais de 5 dias | `Vence em {n} dias` | verde |

Três coisas que o badge esconde no tooltip, e que vale saber:

- **`Entregue` ganha de `Vencido` de propósito.** O prazo é do encarregado; feita
  a remessa, cobrar atraso dele não faz mais sentido. O vencimento não some — o
  tooltip diz `Entregue em {data} · prazo vencia em {data}`.
- **`Sem prazo` não é "no prazo".** O tooltip explica: *"o recebimento nunca foi
  informado"*. É a ausência de uma informação, não uma folga.
- **Cinco dias** é o limiar de urgência, e é o mesmo desde que a coluna existe.

> Esta regra vive em **cinco** lugares do sistema, que respondem perguntas
> diferentes de propósito: o badge, o filtro `Situação` da listagem, os números de
> Prazos, o `Prazos vencidos` do Painel e os baldes de Designações. Elas **não**
> são intercambiáveis, e é isso que a seção [5](#5-perguntas-frequentes) explica.

---

### 4.5 Os números de Designações

Cada apuratório cai em **um** dos quatro baldes, e só um:

```sql
CASE
    WHEN p.data_conclusao IS NOT NULL          THEN 'concluidos'
    WHEN prazo.data_vencimento IS NULL         THEN 'sem_prazo'
    WHEN prazo.data_vencimento >= CURRENT_DATE THEN 'no_prazo'
    ELSE 'vencidos' END
```

| Balde | Rótulo na tela | Regra |
|---|---|---|
| `concluidos` | `Concluídos` | Tem data de conclusão — **vence tudo**, mesmo com o prazo estourado. |
| `sem_prazo` | `Sem prazo definido` | Não concluído e sem prazo nenhum (recebimento nunca informado). |
| `no_prazo` | `Em andamento no prazo` | Não concluído, com prazo, vencendo hoje ou depois. |
| `vencidos` | `Em andamento vencido` | Todo o resto: não concluído, com prazo, vencido. |

Como a classificação tem saída única, **os quatro somam o total**. A contagem é
`count(DISTINCT processo_id)` porque um mesmo militar pode ter duas designações no
mesmo apuratório — funções diferentes, ou uma substituição.

#### Por que `Em andamento (todos)` não fecha com `Total − Concluídos`

Porque ele é a **união de dois baldes**, e deixa o terceiro de fora:

```
Em andamento (todos)  =  Em andamento no prazo  +  Em andamento vencido
                         (Sem prazo definido fica de fora)
```

Isso é decisão, não descuido: o recorte existe para acompanhar **prazo**, e um
apuratório sem recebimento informado não está no prazo nem vencido — não há prazo
para avaliar. Havendo qualquer apuratório sem prazo no escopo, o filtro devolve
**menos** que `Total − Concluídos`, e a diferença é exatamente a coluna
`Sem prazo definido`.

A união mora no **filtro**, e não na classificação — um quinto ramo no `CASE`
roubaria linhas dos outros quatro e quebraria a soma:

```rust
Some("em_andamento") => Some(vec!["no_prazo", "vencidos"]),
```

**As duas datas** (`Últ. recebimento` e `Últ. conclusão`) saem do conjunto **já
filtrado, inclusive pelo balde**. É o que faz "entre os encarregados de SR, qual
concluiu por último" ser respondível: com a data do conjunto inteiro, filtrar por
"vencido" ainda traria a conclusão de um apuratório que o filtro acabou de
excluir.

> **Esta tela mede carga, não cobrança.** Um apuratório já remetido, com prazo
> vencido, continua contando como `Em andamento vencido` aqui — enquanto sumiu da
> tela de Prazos. É deliberado: Designações pergunta *"o que este militar tem na
> mão?"*, e Prazos pergunta *"de quem eu cobro?"*.

---

### 4.6 Os números do Mapa do Período

A regra do período **não** é "instaurado entre as datas":

```sql
WHERE v.ativo
  AND (   (v.data_conclusao IS NULL     AND v.data_instauracao <= $2)
       OR (v.data_conclusao IS NOT NULL AND v.data_conclusao BETWEEN $1 AND $2) )
```

Em português: **o que ainda estava aberto ao fim do período** — inclusive
instaurado em anos anteriores — **mais o que foi concluído dentro dele**.

É por isso que um apuratório de 2019 ainda pendente aparece no mapa de 2026. E é
o comportamento certo: um mapa filtrado por instauração esconderia justamente o
processo antigo que continua na mão da Seção.

A linha de resumo (`{n} no período · {n} em andamento · {n} concluídos no mês`) é
contada sobre as linhas exibidas: concluídos são os que têm data de conclusão, e
"em andamento" é o resto.

A ordem das seções do documento vem da coluna de ordem do catálogo `Apuratórios`
— administrável, e não alfabética.

---

### 4.7 Os números de Estatísticas

Os quatro indicadores do topo (`Total no escopo`, `Em andamento`, `Concluídos`,
`Espécies com registros`) são a soma do cartão `Situação por apuratório`.

| Cartão | O que conta |
|---|---|
| `Situação por apuratório` | Apuratórios, agrupados por espécie e tipo. |
| `Evolução das instaurações` | Apuratórios por ano de instauração. |
| `Unidades de origem` | Apuratórios por unidade. |
| `Natureza geral do fato` | Apuratórios por natureza. |
| `Responsabilidade vigente` | Apuratórios por responsável **vigente** (designação aberta na função responsável). |
| `Soluções sugeridas` / `decididas` | **Envolvidos**, não apuratórios. |
| `Categorias de indício` | Categorias marcadas nos envolvidos. |
| `Condutores em sinistro` | Envolvidos marcados como condutor, nas naturezas que exigem condutor. |
| `Transgressões do RDPM` | Vínculos de transgressão, rotulados `artigo, inc. inciso`. |
| `Infrações do Estatuto` | Vínculos estatutários, classificados pelo dispositivo legal. |
| `Infrações penais` | Vínculos penais, **quebrados por esfera** — a mesma infração pode dar duas linhas, uma militar e uma comum. |

#### O denominador do percentual

Um percentual só significa alguma coisa se estiver dito de que ele é percentual.
O app diz, e são duas perguntas diferentes:

- **"do apuratório"** — num gráfico empilhado, a fatia é comparada com **a barra
  dela**. Os 96 em andamento de IPM são 70% do IPM, não 21% do relatório inteiro.
- **"do total"** — num ranking, a barra é comparada com **o conjunto**. E aqui
  está o detalhe que importa: num Top 12, o denominador é o total **real**, não a
  soma do que está plotado. Somar só as doze barras visíveis inflaria todos os
  percentuais em silêncio.

---

### 4.8 Os números do Relatório Anual

São exatamente os mesmos de [Estatísticas](#47-os-números-de-estatísticas), com o
escopo travado num ano e **sem** recorte por espécie. As duas telas leem o mesmo
dado, pela mesma função; o que muda é o gênero do documento.

Se o ano guardado na tela não existe mais no acervo, ele cai no **mais recente**
— e não em "todos" silenciosamente.

---

## 5. Perguntas frequentes

As divergências que parecem defeito e não são.

**"Por que 'Em andamento' dá números diferentes no Painel e em Prazos?"**
Porque são perguntas diferentes. O Painel conta **tudo o que não foi concluído**
— inclusive o que já foi entregue e o que não tem prazo. A tela de Prazos conta
só **o que ainda se cobra**: tira o entregue e tira quem não tem prazo. O Painel
responde "qual o tamanho do acervo"; Prazos responde "de quem eu cobro hoje".
Ver [4.2](#42-os-números-do-painel) e [4.3](#43-os-números-de-prazos).

**"Por que o total dos baldes de Designações não fecha com o filtro?"**
Porque `Em andamento (todos)` é a soma de `Em andamento no prazo` com
`Em andamento vencido`, e deixa `Sem prazo definido` de fora. A diferença entre o
filtro e `Total − Concluídos` é exatamente essa coluna. Ver
[4.5](#45-os-números-de-designações).

**"Um apuratório sumiu da tela de Prazos mas continua em Designações. Perdi ele?"**
Não. Ele foi **entregue**: o encarregado remeteu, então o prazo dele deixou de ser
cobrado e ele saiu de Prazos. Em Designações ele continua, porque ali a pergunta é
sobre a **carga** do militar, não sobre cobrança. Na listagem de apuratórios ele
aparece com o badge `Entregue`.

**"Por que este processo de 2019 aparece no Mapa deste mês?"**
Porque ele **ainda estava aberto** no fim do período. O mapa não é "instaurado no
mês": é o que a Seção tinha em mãos — o que continuava pendente, mais o que foi
concluído dentro do período. Ver [4.6](#46-os-números-do-mapa-do-período).

**"Por que a soma das barras do gráfico não bate com o total?"**
Porque o gráfico mostra os **12 maiores**, e o cartão avisa quando corta. A tabela
do mesmo cartão e a planilha trazem tudo. Os percentuais continuam certos: eles
são calculados sobre o total real, não sobre as doze barras.

**"Desativei um artigo do RDPM e ele continua aparecendo no relatório."**
Está certo. Desativar tira a opção das **listas de escolha**, para que ninguém
use daqui para a frente. Não apaga o passado: um enquadramento de 2019 continua
sendo o que foi. Se o objetivo era apagar o histórico, o caminho seria `Excluir`
— e ele só funciona quando ninguém usa aquele registro.

**"Deixei o filtro de apuratórios vazio e veio tudo. Não deveria vir nada?"**
Não marcar nada quer dizer **"não filtrar"**, e o app trata assim em todas as
telas de relatório. Os fieldsets dizem isso no próprio rótulo:
`Apuratórios (nenhum marcado = todos)`.

**"O prazo de um apuratório não aparece em lugar nenhum."**
Falta a **data de recebimento**. O prazo inicial nasce dela; sem ela não existe
prazo, e o apuratório aparece como `Sem prazo`. Informe o recebimento no
formulário e o prazo é calculado.

**"Um campo continua aparecendo no detalhe mesmo depois de eu desativá-lo na
configuração."**
Porque já havia valor gravado ali. Configuração define comportamento **futuro**;
não reescreve fato já registrado. A tela avisa: *"O campo permanece disponível
porque já há uma data registrada."*

**"O app pediu as credenciais do banco de novo."**
Elas ficam no cofre da **conta do sistema operacional**, não do aplicativo. Pede
de novo quando: é outra conta de usuário do Windows/Linux, é outro computador, ou
o cofre foi limpo. Falha de rede **não** apaga a configuração — nesse caso a tela
oferece `Tentar novamente`, e não o formulário. Ver
[9](#9-a-conexão-no-primeiro-uso).

**"O véu de carregamento aparece, mas o círculo não gira." (Windows)**
O app está obedecendo a uma configuração do sistema. Quando os efeitos de
animação do Windows estão desligados, o navegador embutido informa
*"prefiro menos movimento"*, e o app para **todas** as animações — o anel fica
visível, porém imóvel. Ligue em **Configurações → Acessibilidade → Efeitos
visuais → Efeitos de animação**. No Linux esse ajuste vem ligado por padrão, e
por isso o `.deb` nunca mostra o problema.

Vale saber que o giro **não** é o recado: quem informa que há trabalho em curso é
o véu escurecendo a tela mais a mensagem, que muda por etapa. Durante um trabalho
pesado o giro pode travar mesmo com a animação ligada — a mensagem continua certa.

**"Marquei o envolvido como condutor e a caixa sumiu."**
A caixa `Condutor` só existe quando a **natureza geral do fato** está marcada como
exigindo condutor. Trocar a natureza para uma que não exige esconde o campo.

**"Não consigo excluir um policial militar."**
Só sai do banco quem **não tem vínculo nenhum** — nem designação, nem
envolvimento. Para tirar de circulação preservando o histórico, use `Desativar`.

---
---

# Parte II — rodar, buildar e manter

## 6. Rodar em desenvolvimento

Requer Rust estável, Node 20+ e Docker.

```bash
cp .env.example .env          # já aponta para o compose (porta 5438)
docker compose up -d          # PostgreSQL 16

npm ci
npm run tauri dev             # aplica as migrations no startup e abre o app
```

Login inicial: `admin@sistema.com` / `123456` — **troque numa instalação real.**

### Rodar contra o Neon (produção)

`npm run tauri dev` sempre lê o `.env` (banco local) — é o que impede alcançar
produção por engano. Para conectar de propósito, usando as credenciais de
`.env.producao`:

```bash
./scripts/rodar_contra_neon.sh
```

Vale só para aquele processo do shell; um terminal novo volta ao banco local.

Produção é o projeto Neon **`adm-p6-sp`, região `sa-east-1` (São Paulo)**. A
região é escolha medida, não preferência: cada ida e volta ao banco custava
**215 ms** em `us-east-2` (Ohio) e custa **80 ms** em São Paulo. Como o custo de
uma tela é o *número* de idas e voltas, e não o tempo de cada consulta, isso
aparece em toda tela ao mesmo tempo — a ficha de um apuratório são 8 consultas
em sequência, ou seja 1,7 s em Ohio contra 0,6 s em São Paulo. O porquê está em
[`GUIA.md`](GUIA.md), decisão 71.

### Exercitar o cofre em desenvolvimento

Em build de debug o app **nunca** consulta o cofre do sistema operacional: usa o
`.env`. Para percorrer o fluxo real — modal de primeiro uso, cofre bloqueado,
reabertura direta no login — sem gerar instalador:

```bash
ADM_P6_USAR_COFRE=1 npm run tauri dev
```

---

## 7. Conferir

```bash
cd src-tauri
cargo fmt --check
cargo test                    # 205 testes, em bancos descartáveis
cd ..
npm ci                        # o happy-dom dos testes de tela vem daqui
npm test                      # 50 testes de frontend
npm run typecheck             # é aqui que erro de comando aparece
npm run build                 # typecheck + vite build
```

Os testes sobem e derrubam o próprio banco; não tocam no de desenvolvimento, nem
no cofre pessoal de quem roda.

> `npm ci` não é opcional antes de `npm test`: sem o `happy-dom` instalado, os
> testes de tela **não rodam** e a suíte ainda assim termina anunciando os outros
> como aprovados.

---

## 8. Gerar os instaladores

Os builds **não leem `.env.producao` e não incorporam credenciais** — a conexão é
configurada no primeiro uso, no computador de destino.

### Linux — pacote `.deb`

Com os [pré-requisitos Linux do Tauri](https://v2.tauri.app/start/prerequisites/#linux)
instalados, **mais `libdbus-1-dev`** (o cofre do Linux passa pelo Secret Service,
e essa biblioteca não consta da lista do Tauri):

```bash
sudo apt-get install -y libdbus-1-dev
npm ci
./scripts/empacotar.sh                  # .deb
./scripts/empacotar.sh --bundles deb,appimage
```

Saída, para a versão 0.1.0 em Linux x64:

```text
src-tauri/target/release/bundle/deb/gestao-p6_0.1.0_amd64.deb
```

O script normaliza o nome do arquivo — o bundler o nomeia com espaço, o que
atrapalha `scp`, `curl` e a linha de comando de quem instala.

### Windows — gerar o `.exe` pelo WSL/Linux

Usa NSIS e `cargo-xwin`, seguindo o
[fluxo de compilação cruzada do Tauri](https://v2.tauri.app/distribute/windows-installer/#build-windows-apps-on-linux-and-macos).

**Preparação da máquina, uma vez:**

```bash
sudo apt-get update
sudo apt-get install -y clang llvm lld nsis
rustup target add x86_64-pc-windows-msvc
cargo install --locked cargo-xwin --version 0.23.1
```

Confira as ferramentas antes de gastar um build:

```bash
command -v clang llvm-rc lld-link llvm-lib makensis cargo-xwin
rustup target list --installed          # deve listar x86_64-pc-windows-msvc
```

**A cada geração:**

```bash
npm ci
mkdir -p src-tauri/target/windows-tools/bin
# alguns pacotes Ubuntu trazem `clang` mas não o atalho `clang-cl`
if ! command -v clang-cl >/dev/null 2>&1; then
    ln -sf "$(command -v clang)" src-tauri/target/windows-tools/bin/clang-cl
fi
export PATH="$PWD/src-tauri/target/windows-tools/bin:$PATH"
export XWIN_CACHE_DIR="$PWD/src-tauri/target/xwin-cache"

npm run tauri -- build \
    --runner cargo-xwin \
    --target x86_64-pc-windows-msvc \
    --config '{"bundle":{"targets":["nsis"]}}'
```

A primeira execução baixa o SDK/CRT da Microsoft e o plugin do NSIS: reserve
internet e alguns GB. Nas seguintes, o cache em `xwin-cache` é reaproveitado.

O bundler nomeia o arquivo pelo `productName`, que tem espaço — e **nada renomeia
sozinho** neste caminho: `empacotar.sh` só normaliza `.deb`/`.rpm`/`.AppImage`, e
a receita do Windows não passa por ele. Renomeie na hora, no mesmo comando:

```bash
cd src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis
mv -f "Gestao P6_0.1.0_x64-setup.exe" gestao-p6_0.1.0_x64-setup.exe
```

O `mv -f` é deliberado, e é a parte que protege: o build novo sai com o nome
**com espaço**, então o arquivo já renomeado que estiver ali é de uma geração
ANTERIOR — e é justamente ele que tem o nome que se distribui. Foi assim que um
instalador de 7/9, com o defeito do subsistema console, ficou por dois dias ao
lado do build novo, com o nome bom. Sobrescreva, não conviva com os dois.

Saída:

```text
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/gestao-p6_0.1.0_x64-setup.exe
```

> Durante o link, o `lld-link` imprime dezenas de
> `>>> failed to load reference '…\libcmt.amd64.pdb': No such file or directory`.
> **Não é falha:** a CRT distribuída pelo xwin não traz os símbolos de depuração
> da Microsoft. O build termina com código 0 e o `.exe` sai íntegro.

Antes de distribuir, confira o subsistema do executável — sem
`windows_subsystem` no `main.rs` o app abre um terminal atrás da janela, e fechar
esse terminal mata o processo. O Linux ignora o atributo, então o `.deb` não
denuncia o problema:

```bash
file src-tauri/target/x86_64-pc-windows-msvc/release/gestao-p6.exe
# tem de dizer: PE32+ executable (GUI) ...   — e não (console)
```

O instalador **não tem assinatura digital**: o SmartScreen avisa na primeira
execução. E o modo padrão do Tauri baixa o WebView2 se ele faltar no destino,
exigindo internet naquele momento.

### Windows — gerar no próprio Windows

Com Rust/MSVC e os
[pré-requisitos Windows do Tauri](https://v2.tauri.app/start/prerequisites/#windows):

```powershell
npm ci
npm run tauri -- build --bundles nsis,msi
```

O `.msi` usa WiX e exige o recurso VBScript do Windows habilitado.

### Conferir a CSP

A política de segurança de conteúdo restritiva **só vale no build**: `tauri dev`
e `cargo run` usam uma versão afrouxada. Para conferi-la, é o binário de produção.

---

## 9. A conexão no primeiro uso

Na primeira abertura, antes do login, o app pede a conexão: a URL PostgreSQL
(com senha) ou servidor, porta, banco, usuário, senha e SSL. **Testar e salvar**
conecta, grava no cofre e aplica as migrations antes de liberar o login. Sem modo
SSL informado, o certificado e o nome do servidor são verificados.

A conexão fica no **Gerenciador de Credenciais do Windows** ou no **Secret Service
do Linux**, sob o serviço `br.gov.pmro.admp6`, entrada `database-v1`. Cada conta
do sistema operacional configura uma vez; atualizar o aplicativo preserva a
entrada. O app não usa arquivo de senha, `localStorage`, `.env`, `DATABASE_URL`,
`DB_*` nem `PG*` como fonte alternativa em builds release.

Nas aberturas seguintes o app recupera a configuração do cofre e vai **direto ao
login** — só a tela de abertura aparece no meio, enquanto a conexão sobe.

**No Linux** é necessário um provedor Secret Service ativo na sessão gráfica
(GNOME Keyring, ou KWallet com Secret Service habilitado). No Debian/Ubuntu,
instale `gnome-keyring` se não houver; o `.deb` já o recomenda. O sistema
operacional pode pedir o desbloqueio do cofre mesmo quando a conexão já está
salva.

**Trocar o banco de produção de lugar obriga cada PC a reconfigurar.** A
conexão mora no cofre do sistema operacional de cada máquina, uma por conta de
usuário — não há configuração central, e nenhuma atualização do pacote a
reescreve. Mudar o projeto Neon (foi o que a migração para São Paulo fez) chega
ao usuário como *falha de conexão*, não como pedido de reconfiguração: o app
tenta o endereço antigo, que ainda existe. Quem opera precisa saber que o
caminho é `Configurar conexão com o banco`, no rodapé da tela de login, e que a
senha salva não volta para a interface — informe os dados completos.

**Falha de rede não apaga credenciais.** Nesse caso a tela oferece
`Tentar novamente`, e não o formulário. Para corrigir ou trocar os dados, o botão
`Configurar conexão com o banco` fica no rodapé da tela de login. Por segurança a
senha salva não volta para a interface: ao reconfigurar, informe os dados
completos. Cancelar não salva. Falha nas migrations mantém a conexão salva, mas
impede o login até a atualização ser resolvida.

### Verificação manual dos pacotes

Em Windows e numa sessão gráfica Linux: instalar, configurar com uma conta de
teste, fechar, reabrir e reiniciar o computador — o login deve aparecer **sem
novo pedido de conexão**. Atualizar o pacote preserva a configuração; outra conta
do sistema recebe o modal. Conferir também cancelamento, troca de senha, rede
indisponível e cofre bloqueado ou ausente, sem que nenhuma mensagem exponha
credenciais.

**Dois itens que só o Windows revela**, e que esta lista não tinha até um pacote
chegar ao PC de destino com os dois:

- **Nenhum terminal atrás da janela.** Se aparecer um, o executável saiu no
  subsistema errado — fechar esse terminal mata o app com o trabalho aberto
  dentro. Confere-se antes de distribuir, sem precisar de Windows:
  `file …/x86_64-pc-windows-msvc/release/gestao-p6.exe` tem de dizer
  **`PE32+ executable (GUI)`**.
- **O círculo do véu de carregamento girando.** Parado significa que os efeitos
  de animação do Windows estão desligados naquela máquina — não é defeito do
  pacote, mas atrapalha quem usa. Ver as
  [Perguntas frequentes](#5-perguntas-frequentes).

---

## 10. Antes de mexer no banco

**Não rode `docker compose down -v`.** O banco de desenvolvimento tem os dados de
produção dentro, e recriar o volume apaga oito anos de registro.

Mudança de schema é **migration nova** (`0023`…). Os arquivos existentes de
`src-tauri/migrations/` são imutáveis: editar um já aplicado quebra o startup
seguinte com `VersionMismatch`.

---

## 11. Migrar os dados do sistema anterior

Um comando. O padrão é **ensaio**: roda a migração inteira numa cópia descartável
do banco e emite o relatório, sem tocar no real.

```bash
# teste, no PostgreSQL desta máquina (lê o .env)
./scripts/migrar_dados_legados.sh                        # ensaio
./scripts/migrar_dados_legados.sh --execute --destino adm_p6_db

# produção, no PostgreSQL de outra máquina (lê o .env.producao)
./scripts/migrar_dados_legados.sh --env-file .env.producao
./scripts/migrar_dados_legados.sh --env-file .env.producao --execute --destino admp6db
```

Qual banco será migrado sai do arquivo de configuração, e só dele. O `.env` aponta
para o banco local — é o que impede `cargo test` ou `npm run tauri dev` de
alcançarem produção.

O script faz backup validado antes de qualquer mutação, carrega o dump legado num
schema isolado, roda a carga numa transação só e emite contagens, invariantes e o
CSV das pendências que precisam de decisão humana. Detalhes, rollback e leitura
dos relatórios:
[`src-tauri/importacao/README.md`](src-tauri/importacao/README.md).

---

## 12. Estrutura do repositório

```
src/                    frontend TypeScript (sem framework), uma tela por arquivo
src/telas/              as telas; as de catálogo não existem aqui — nascem do Rust
src-tauri/src/          backend Rust, um módulo por área
src-tauri/migrations/   o schema, comentado seção por seção
src-tauri/tests/        os testes de integração, em bancos descartáveis
src-tauri/importacao/   a importação do banco legado (SQL, uso pontual)
scripts/                empacotamento e migração dos dados legados
tools/impressao/        o arnês que imprime pelo WebKitGTK e afere o PDF
```

### Onde está o resto

- **[`GUIA.md`](GUIA.md)** — a engenharia: o estado atual, o modelo de dados, as
  **70 decisões de negócio** já tomadas e o porquê de cada uma, as receitas para
  mexer sem quebrar, as armadilhas conhecidas e o changelog das rodadas. É o lugar
  de "por que o código é assim".
- **`src-tauri/migrations/0001_schema.sql`** — o schema, comentado.
- **`src-tauri/importacao/`** — a importação do banco legado, etapa por etapa.
- **`CLAUDE.md`** — as regras curtas para quem programa aqui.
