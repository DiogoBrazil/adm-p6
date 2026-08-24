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
| O app abre e **nenhuma tela carrega dado** | `connect-src` sem `ipc: http://ipc.localhost` — é por aí que os 76 comandos passam |
| Uma tela abre **sem estilo** | `style-src`. Em produção o Vite emite `<link>`; em dev injeta `<style>` |
| As **barras** dos painéis de contagem aparecem sem largura | `aplicarBarras()` não rodou, ou voltou um `style=""` no markup |

---

## a) As 13 telas, uma a uma, com o console aberto

Marque a tela quando ela **carregar dado** e o console seguir **sem `Refused to`**.

- [ ] **Painel** (`/`) — os cartões trazem números, não zeros
- [ ] **Procedimentos → lista** — a tabela lista processos
- [ ] **Procedimentos → detalhe** — abrir um processo
- [ ] **Procedimentos → formulário** — abrir "Novo"
- [ ] **Indícios** — a partir do detalhe de um processo, num envolvido
- [ ] **Prazos** — o painel carrega
- [ ] **Usuários → lista**
- [ ] **Usuários → detalhe** — clicar numa linha
- [ ] **Usuários → novo** — o formulário abre
- [ ] **Configuração de apuratórios**
- [ ] **Catálogos** — abrir ao menos três catálogos diferentes do menu
- [ ] **Auditoria** — a lista e os três filtros
- [ ] **Designações por Militar**
- [ ] **Estatísticas de Processos** — conferir que **as barras têm largura**
- [ ] **Estatísticas de Procedimentos** — idem
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
