# Roteiro de conferência de tela — o que falta para dar a migração por concluída

> Este arquivo é uma **lista para marcar enquanto percorre**. É a §7.5 do
> `REFATORACAO-MODELO-DADOS.md` transformada em checklist, mais o que a rodada de
> correções de hoje acrescentou.
>
> Nada aqui é automatizável: são as duas coisas que teste não alcança — a CSP,
> que só falha dentro do WebView, e o julgamento de quem conhece o domínio.

## Antes de começar

```bash
# 1. O binário de produção — é ele que carrega a CSP restritiva.
#    `tauri dev` usa a `devCsp`, que afrouxa `style-src`: não serve para isto.
npm run tauri build -- --no-bundle

# 2. O banco precisa estar de pé.
docker compose up -d

# 3. Abrir o app
./src-tauri/target/release/adm-p6-tauri
```

Entre com `admin@sistema.com` / `123456` e **deixe o console aberto (F12)**.

> **Toda violação de CSP aparece só no console**, como `Refused to…`. Não aparece
> no log do processo e não vira mensagem de erro na tela. Uma tela pode ficar
> muda sem avisar.

| Sintoma | Causa provável |
|---|---|
| O app abre e **nenhuma tela carrega dado** | `connect-src` sem `ipc: http://ipc.localhost` — é por aí que todos os comandos passam |
| Uma tela abre **sem estilo** | `style-src`. Em produção o Vite emite `<link>`; em dev injeta `<style>` |
| Uma tabela de contagem mostra uma terceira coluna vazia | Sobrou marcação da antiga barra percentual; cada painel deve ter somente rótulo e quantidade |

---

## a) As 13 telas, uma a uma, com o console aberto

Marque a tela quando ela **carregar dado** e o console seguir **sem `Refused to`**.

- [ ] **Painel** (`/`) — os cartões trazem números, não zeros
- [ ] **Procedimentos → lista** — a tabela lista processos
- [ ] **Procedimentos → detalhe** — registrar/corrigir remessas, julgamento e conclusão; editar o resultado de um envolvido; confirmar que só **Reabrir** remove a conclusão
- [ ] Em um **IPM**, a linha de Escrivão mostra apenas **“-”** na coluna Documento e o formulário de substituição não pede tipo/número
- [ ] Depois de concluir, desaparecem os controles de nova substituição, prorrogação e andamento; o aviso orienta usar **Reabrir**
- [ ] Com o processo concluído, chamadas diretas desses três comandos devolvem mensagem amigável e não gravam nada
- [ ] **Catálogos → Apuratórios** — a coluna **Cita documento** aparece nos papéis, a alternância grava, e tornar o mesmo papel responsável logo depois **não** religa a flag
- [ ] **Procedimentos → formulário** — abrir "Novo" e confirmar que remessas, julgamento, conclusão, soluções e penalidade não aparecem antes do cadastro
- [ ] **Indícios** — a partir do detalhe de um processo, num envolvido
- [ ] **Prazos** — o painel carrega
- [ ] **Usuários → lista**
- [ ] **Usuários → detalhe** — clicar numa linha
- [ ] **Usuários → novo** — o formulário abre
- [ ] **Configuração de apuratórios**
- [ ] **Catálogos** — abrir ao menos três catálogos diferentes do menu
- [ ] **Auditoria** — a lista e os três filtros
- [ ] **Designações por Militar**
- [ ] **Estatísticas de Processos** — tabelas centralizadas, somente rótulo e quantidade
- [ ] **Estatísticas de Procedimentos** — idem, sem barras percentuais
- [ ] **Mapa do Período**
- [ ] **Mapas Salvos**
- [ ] **Relatório Anual**

---

## b) Os dois caminhos que gravam arquivo

Abrem diálogo nativo — nenhum teste os cobre.

- [ ] **Exportar CSV** em Prazos → o diálogo "salvar como" abre, e o arquivo sai correto
- [ ] **Baixar o anexo** de 20 MB do **IPM nº 1/P6/7ºBPM/2024** → salva e abre
      (é o único anexo do banco; passou a usar o diálogo nativo na §8.6.6, e
      antes disso provavelmente não funcionava)

---

## c) O que a rodada dos catálogos mudou (§8.7)

- [ ] **Apuratórios** — a coluna "Código de extensão" **não** aparece
- [ ] **Carta precatória** — criar um processo de CP e confirmar que **ainda
      exige deprecante e unidade deprecada**. É a prova de que esconder o código
      não desligou a extensão
- [ ] **Municípios e distritos** — marcar "É distrito" revela o select de
      município e o exige; desmarcar limpa
- [ ] **Municípios e distritos** — conferir por amostragem que os 60 distritos
      existentes seguem com o município certo
- [ ] **Infrações do Estatuto** — o select de dispositivo legal **não** aparece
- [ ] **Infrações do Estatuto** — cadastrar uma e conferir **na tela de indícios**
      que o rótulo sai completo, com " - Estatuto dos Policiais Militares"
- [ ] **Postos e graduações** — "Ordem hierárquica" **não** aparece
- [ ] **Usuários** — confirmar que a **ordem alfabética** é aceitável. É a
      mudança mais visível, e a única que não se desfaz sem migration nova **e**
      redigitar os 13 valores (decisão 27)
- [ ] **Catálogos** — "Subdivisões de textos normativos" sumiu do menu, e o
      formulário de Infrações penais perdeu o campo "Subdivisão"

---

## d) O seletor de analogia (§8.6.1)

Abrir os indícios de um envolvido e adicionar uma infração do Estatuto.

- [ ] A busca filtra a partir de **2 caracteres**
- [ ] O filtro por **natureza** funciona
- [ ] **`Esc`** cancela
- [ ] **Clique no fundo** cancela
- [ ] **Cancelar não grava nada** — a analogia é `NOT NULL`, então meia escolha
      não pode virar registro

---

## e) O que a rodada de correções de hoje acrescentou

### Os seletores de militar, antes truncados

Havia um defeito que atravessou a migração inteira: os seletores eram
alimentados por um comando paginado que trava em 200, e com 235 militares os 35
últimos em ordem alfabética **não apareciam**.

- [ ] No **formulário de processo**, abrir o seletor de **envolvidos** e
      confirmar que **`ZAQUEU DE ALMEIDA KVIATKOSKI`** está na lista (é o último
      alfabético — se ele aparece, os 35 voltaram)
- [ ] O mesmo no seletor de **designações**
- [ ] Na **Auditoria**, o filtro de autor lista os autores esperados

### Paginação nas duas listagens

- [ ] **Usuários** — o controle de página aparece no rodapé, "Próxima" avança, e
      o intervalo mostrado bate com o total (235)
- [ ] **Procedimentos** — idem, com 128 (ou 129 se o IPM de teste ainda estiver lá)
- [ ] Buscar ou trocar filtro **volta para a página 1** (não deixa tela vazia)

### Os filtros novos de indícios

- [ ] **Infrações penais** — o select "Dispositivo" aparece ao lado da busca e
      **filtra de verdade** (há 4 dispositivos distintos entre as 26 infrações)
- [ ] **Transgressões do RDPM** — o select "Natureza" aparece e filtra

---

## e2) Os campos por apuratório, e a carta precatória que voltou

A migration `0007` tornou condicionais os campos que antes apareciam nas dez espécies, e
consertou o bloco de carta precatória, que **não renderizava havia dois ciclos**.

### O que precisa aparecer no detalhe, por espécie

Cadastre primeiro apenas Instauração e Recebimento. Remessas, Julgamento e Conclusão são
fatos posteriores e não podem aparecer no formulário geral, nem ao criar nem ao editar.
Em CD, CJ e PAD aparece somente **Remessa à comissão**; “Remessa do encarregado” não pode
aparecer, pois nesses ritos as duas datas representam o mesmo fato.

| Abra o detalhe de… | Tem de mostrar | Não pode mostrar |
|---|---|---|
| **IPM** | Escrivão (designação) | Julgamento · Remessa à comissão · Penalidade |
| **SR** ou **SV** | — | Julgamento · Remessa à comissão · Penalidade |
| **PADS** | Julgamento · Penalidade (quando a solução decidida for de punição) | Remessa à comissão |
| **PADE** | Julgamento · Penalidade | Remessa à comissão |
| **CD**, **CJ** ou **PAD** | Julgamento · Remessa à comissão · Penalidade · **Escrivão de Processo** | — |
| **CP** | **Deprecante e Unidade deprecada** | Julgamento · Remessa à comissão · Penalidade |

- [ ] IPM — confere a linha da tabela
- [ ] SR — confere a linha da tabela
- [ ] PADS — confere a linha da tabela
- [ ] CD — confere a linha da tabela, e o papel aparece como **Escrivão de Processo**
- [ ] **CP — criar um processo de carta precatória de ponta a ponta e salvar.** É o teste
      que importa: até agora o formulário não oferecia os campos e o backend recusava o
      salvamento, então a espécie era impossível de cadastrar

### O que não pode acontecer

- [ ] Abrir um **PADS que já tem data de julgamento**, salvar sem tocar no campo, e
      conferir que a data **continua lá**. Campo escondido não pode apagar fato gravado
- [ ] Em *Catálogos → Apuratórios*, os três atributos novos aparecem e são editáveis:
      "Permite julgamento", "Permite punição", "Permite remessa à comissão"

### A reforma de tela

- [ ] **Formulário** — os campos se distribuem em 2–3 colunas por bloco, e não numa
      coluna só; o resumo ocupa a linha inteira
- [ ] **Envolvidos e designações** — os campos de linhas diferentes **alinham** entre si,
      e o botão Remover fica sempre no mesmo lugar
- [ ] **Listagem** — colunas com largura estável, situação e "vencido" como etiqueta,
      cabeçalho fixo ao rolar
- [ ] **Janela estreita** — o formulário cai para 1–2 colunas e a tabela rola na
      horizontal em vez de espremer as colunas; os botões não atravessam a tela

---

## g) As listagens padronizadas (§8.14)

Seis listagens passaram a dez itens por página, com o desenho da listagem de
processos. Três defeitos foram corrigidos junto, e cada um só se confirma na tela.

### O que a paginação tem de fazer

- [ ] **Usuários** — dez linhas; o rodapé diz "1–10 de 235"; "Próxima" avança até
      a última página, e "Anterior" volta
- [ ] **Procedimentos**, **Auditoria**, **Mapas Salvos** e **Catálogos** — idem,
      cada um com o seu total
- [ ] **Auditoria** — o cabeçalho **não** diz mais "últimos 200 registros": diz o
      total real do escopo, e o 201º é alcançável
- [ ] Buscar ou trocar filtro **volta para a página 1** (não deixa tela vazia)
- [ ] **Catálogos** — trocar de catálogo pelo menu volta para a página 1. Ir para
      a 4ª página de Municípios e clicar em "Postos e graduações" não pode abrir
      o vazio
- [ ] **Catálogos** — desativar um item da 3ª página **mantém** a 3ª página; se
      aquela página deixar de existir, recua uma
- [ ] Desativar/excluir o único item da última página recua sozinho

### Prazos: os dois blocos não podem se sobrepor

É o defeito mais visível desta rodada. Antes, um prazo vencido aparecia em
**Vencidos** e outra vez em **Vencendo em até X dias**.

- [ ] Um processo com prazo **vencido** aparece só em "Vencidos"
- [ ] Um processo vencendo **hoje** aparece só em "Vencendo em até X dias"
- [ ] Os três **cartões de contagem** batem com os totais das duas tabelas —
      antes discordavam, porque o cartão usava a regra certa e a tabela não
- [ ] Os **dois paginadores são independentes**: avançar em "Vencidos" não mexe
      em "Vencendo"
- [ ] Trocar a **janela** (7/14/30/60) reinicia os dois

### CSV e impressão levam o filtro, não a página

- [ ] **Usuários** — buscar algo que dê mais de 10 resultados, exportar CSV, e
      conferir que a planilha traz **todos** os do filtro, não os 10 da tela
- [ ] **Auditoria** — idem, com filtro de entidade aplicado
- [ ] **Prazos** — o CSV traz os dois blocos inteiros, com a coluna "Situacao"
      dizendo de qual bloco veio cada linha
- [ ] **Imprimir / PDF** nas três: o papel sai com o conjunto completo, e a
      tabela de dez **não** sai impressa junto (duplicada)
- [ ] Se algum filtro passar de 5.000 registros, aparece o aviso dizendo que
      saíram os 5.000 mais recentes. **Não pode cortar calado**

### O desenho, e o que a CSP recusaria

- [ ] **Procedimentos** — lado a lado com uma captura de antes: tem de estar
      **idêntica**. Foi medida propriedade a propriedade, mas o olho é o juiz
- [ ] **Larguras de coluna aparecem** em todas as listagens. Se
      `aplicarLarguras()` não rodar, as colunas voltam a se dimensionar pelo
      conteúdo e **nada acusa** — é o mesmo sintoma das barras dos painéis
- [ ] Console **sem `Refused to`** nas seis listagens. É o que pegaria uma
      largura que tenha escapado para um `style=""`
- [ ] Texto longo (nome, unidade, descrição de infração) corta com **reticências**
      e entrega o inteiro no **tooltip**
- [ ] **Estatísticas de Procedimentos** — a descrição das infrações não está mais
      cortada em 90 caracteres com "…" no meio do texto: corta por largura e o
      tooltip traz o texto legal inteiro
- [ ] Em **1600, 1366, 1100 e 900px** nenhuma listagem operacional rola na
      horizontal; em **899px** rola, em vez de espremer as colunas
- [ ] **Designações por Militar** e **Mapa do Período** continuam rolando na
      horizontal e mostrando o conjunto completo — são matrizes, não listagens

---

## h) Substituição de designações e mensagens (§8.15)

É a rodada mais recente. Mexe em duas coisas que só a tela conta se estão certas:
o fluxo de substituição, que envolve duas linhas por operação, e o texto que o
usuário lê quando alguma coisa é recusada.

### Preparar: duas cadeias no mesmo processo

Use um apuratório que tenha **Encarregado e Escrivão** habilitados, com o Escrivão
aceitando 2 ocupantes (*Catálogos → Configuração de apuratórios*). Cadastre um
processo com um Encarregado e dois Escrivães.

No cadastro, confira antes de salvar:

- a linha de designação tem **Papel e Militar, e mais nada** — sem campo de data;
- ao escolher Encarregado numa linha, a opção **some da outra** (fica desabilitada,
  com "já preenchido"), porque o teto é 1;
- Escrivão continua disponível nas duas, porque o teto é 2.

### O que a tabela de Designações tem de mostrar

Sete colunas: Papel, Militar, Início, Fim, **Documento**, Motivo, **Ações**. O
militar aparece com **posto, matrícula e nome**. A designação inicial já nasce com
Documento preenchido (o documento que instaurou) e motivo "Designação inicial" —
ninguém digitou isso.

### O fluxo, na ordem

| # | O que fazer | O que tem de acontecer |
|---|---|---|
| 1 | *Substituir* no Encarregado | Formulário abre **abaixo da tabela**, com o resumo dizendo quem está sendo substituído e desde quando |
| 2 | Salvar sem escolher sucessor | Aviso **em vermelho, embaixo do campo Sucessor**, e o foco vai para ele. Nada é salvo |
| 3 | Escolher o **mesmo** militar que já ocupa | Aviso no campo Sucessor, nomeando quem já ocupa |
| 4 | Data igual ou anterior ao início | Aviso no campo Data, com a data-limite escrita por extenso |
| 5 | Data futura | Recusada — o campo já tem `max`, e a validação repete |
| 6 | Motivo em branco | Aviso no campo Motivo |
| 7 | Escolher Documento e **não** preencher o Nº (e o contrário) | Aviso no campo que falta. Os dois são opcionais **juntos** |
| 8 | Preencher tudo e salvar | Duas linhas: a anterior encerrada na data da troca, a nova vigente **começando no mesmo dia**. Sem buraco, sem sobreposição |
| 9 | Substituir **um dos escrivães** | A cadeia do outro escrivão **não se mexe** — e os dois passam a ter *Editar* e *Remover* |

### O que só a última pode fazer

Substitua o Encarregado **duas vezes**. Agora:

- só a **última** linha da cadeia tem *Editar* e *Remover*;
- a do meio e a inicial ficam **só com leitura** (a inicial mantém *Substituir*);
- em *Editar*, o formulário abre **preenchido** com o que está gravado, e o botão
  diz "Salvar correção";
- mudar a data na correção move **as duas** linhas: o Fim da anterior e o Início
  da corrigida andam juntos;
- *Remover* pede confirmação **nominal** — quem sai, quem volta a ser o quê;
- removida a última, a do meio **vira a última** e ganha os dois botões.

### O cadastro depois que existe substituição

Reabra o processo em *Editar*. A designação do Encarregado tem de aparecer
**bloqueada**: sem `<select>`, com a tarja "com histórico", a borda em tom
diferente e a frase mandando usar *Substituir* na página de detalhes. O Escrivão
sem substituição continua editável e removível.

Corrija a **data de instauração** e salve: o Início das designações **sem
histórico** acompanha; as com histórico não se mexem.

### As mensagens

Nenhuma tela pode mostrar nome de constraint, SQL, caminho de arquivo ou texto em
inglês. Três provocações rápidas:

1. Cadastrar dois processos com o **mesmo número de documento** → frase explicando
   a combinação (unidade, ano, apuratório, documento), não `uq_processo_...`;
2. Excluir um item de catálogo **já usado** → "já foi usado... Desative-o";
3. **Parar o banco** (`docker compose stop postgres`), tentar qualquer tela e
   religar → tem de dizer para **verificar o serviço do banco**, não "tente
   novamente". Religue com `docker compose start postgres`.

> Toda mensagem começa com maiúscula, termina em ponto e diz **o que fazer**. Se
> alguma só constatar o problema, é defeito — anote qual.

### Janela estreita

Estreite a janela até ~720px. A tabela de Designações **rola dentro da própria
moldura**; a página **não** rola na horizontal. O formulário de substituição
quebra em linhas, sem campo sobrepondo outro nem escapando da borda.

---

## f) A amostra dos 6 processos

O campo a campo já está feito e acusa **0 divergências em 377 comparações**,
rodado contra o banco de produção. O que falta é o olho: rótulo, layout, o que a
Seção reconhece.

| Processo | Id | Por que este |
|---|---|---|
| IPM nº 8/7ºBPM/2024 | `10b39de3-fad8-4e93-9cea-7b2027118253` | 9 envolvidos (o máximo) e substituição de encarregado colapsada |
| IPM nº 1/7ºBPM/2024 | `ec07f120-e4c5-4337-b628-592c5859339c` | 8 prorrogações — a cadeia de prazos mais longa |
| IPM nº 1/P6/7ºBPM/2024 | `b0294d82-4d35-46d4-a10f-2bd2b555d462` | o anexo de 20 MB |
| PADS nº 1/7ºBPM/2025 | `22ce21be-aa00-42b5-98cd-65e1d328ba4e` | penalidade + envolvido criado (decisão 14) + enquadramento do jsonb |
| CP nº 1/7ºBPM/2025 | `6b1f19a8-4ab8-4ecc-b596-27480bf9e017` | a extensão de carta precatória |
| SR nº 20/7ºBPM/2025 | `980f1a82-3771-4193-b43b-37a09eadf0c5` | três trocas de encarregado no mesmo dia, colapsadas em uma |

- [ ] IPM nº 8/7ºBPM/2024
- [ ] IPM nº 1/7ºBPM/2024
- [ ] IPM nº 1/P6/7ºBPM/2024
- [ ] PADS nº 1/7ºBPM/2025
- [ ] CP nº 1/7ºBPM/2025
- [ ] SR nº 20/7ºBPM/2025

**Confira em especial o que a importação transformou**, e não só copiou:
responsável vigente, cadeia de prazos, envolvidos com solução e penalidade,
vítimas (o legado guardava array JSON), enquadramento, e o município nos
processos de distrito (Bom Futuro, Jaci-Paraná, Joelândia, Tarilândia — vinham
como `"Distrito (Município)"`).

Para ver o mesmo registro do lado do legado, **enquanto o schema ainda existe**:

```bash
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db -x -c \
  "SELECT * FROM legado.processos_procedimentos WHERE id = '<id>';"
```

---

## Aceitou tudo?

Então a limpeza final (é a Fase 4 do plano):

1. Apagar o IPM de teste `250d8ee1-c167-4604-8cdf-2bd5a62d8422`
2. Rodar `99_conferencia.sql` e conferir 24 contagens e 17 invariantes em zero
3. Remover o schema `legado` (passo 8 do roteiro da §8.5)

**Achou divergência na amostra?** Ela é de mapeamento, não de dado: corrija a
etapa correspondente em `src-tauri/importacao/` e rode o roteiro do zero.

> ⚠ **Cuidado:** o roteiro do zero recria o banco. Se alguém já tiver lançado
> processo real pelo app, ele se perde. Hoje há **um backup verificado** em
> `~/backups/adm-p6/`, restaurado e conferido contra a origem — inclusive o
> anexo de 20 MB, byte a byte.
