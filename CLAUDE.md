# ADM P6 — instruções do projeto

App de desktop **Rust + Tauri 2**, frontend TypeScript sem framework,
PostgreSQL 16. Sistema da Seção de Justiça e Disciplina do 7º BPM (PMRO).
Migrado de Python/Eel; o banco tem os dados reais de 2018 em diante.

**Antes de propor qualquer coisa, leia `GUIA.md`** — é a
fonte de verdade declarada do projeto: o modelo, as decisões de negócio já
tomadas (com o porquê), as armadilhas e o que falta. A seção 9 é um índice de "quero
entender X → olhe em Y".

## Nunca

- **`docker compose down -v`.** O banco tem os dados de produção; recriar o
  volume apaga oito anos de registro.
- **Editar migration já aplicada.** `sqlx` guarda checksum por versão e o
  startup seguinte quebra com `VersionMismatch`. Mudança de schema é migration
  nova (`0018`…).
- **Tocar em `adm-p6.sql`, ou versionar um `*.dump`.** Dump de produção, 44 MB,
  somente leitura, fora do git — e com dados pessoais de 235 militares. Os backups
  da seção 6.1 nascem na raiz e carregam os mesmos dados: o `.gitignore` cobre
  `*.dump`, e essa linha não sai.
- **Reabrir uma decisão da seção 3 sem motivo novo.** São 54, todas decididas pelo
  responsável e implementadas.

## Princípios do modelo, que valem para toda mudança

1. Todo conceito de negócio é cadastro administrável, não literal no código.
2. **Nome e sigla são apresentação.** O comportamento vem de atributo semântico
   (`permite_penalidade`, `exige_condutor`, `e_responsavel`…), nunca do `nome` de
   uma linha que o administrador pode renomear. Se o código precisa distinguir
   uma linha das outras, isso é uma coluna booleana na tabela.
3. Relação conhecida do domínio é tabela com FK — nunca JSONB, nunca lista em
   `TEXT`. Só duas colunas JSONB são justificadas, e um teste falha se aparecer
   uma terceira.
4. Cada informação tem uma única fonte de verdade.
5. Configuração define comportamento futuro; não reescreve fato já registrado.
6. Catálogo em uso se **desativa**, não se apaga. E daí decorre: lista de
   **opções** filtra `WHERE ativo`; leitura de **registro existente** não filtra.
   Um processo de 2019 tem de continuar exibindo a natureza desativada em 2026.

## Armadilhas que mordem quem escreve código aqui

| | |
|---|---|
| Argumento de comando Tauri v2 | chega em **camelCase**; grafia errada é ignorada **em silêncio**. Já dentro de `{ request: {...} }` os campos seguem snake_case, porque ali quem desserializa é o serde |
| Constraint trigger `DEFERRABLE` | `max_envolvidos` e `max_ocupantes` só falham no **`commit`**, não no `insert` |
| SQL montado em `format!` | `tests/sql_prepare.rs` cobra um teste que o execute — aquele SQL só se valida rodando |
| Comando com `AppHandle` | precisa ser genérico (`AppHandle<R>`), senão não compila sob o `MockRuntime` |
| Comando novo | entra em `lib.rs::registrar_comandos`, que é a lista única do app e do teste |
| Lista de escopo vazia num filtro | `= ANY('{}')` é falso para toda linha. Use `maps_reports::repository::escopo()` |
| `count(*)`/`GROUP BY` em `v_processos_detalhados` | 7× mais lento; agregação parte das tabelas base |
| Entregar arquivo ao usuário | `dom.ts::baixarArquivoBase64` → `files_save_download` (diálogo nativo no Rust). Nunca `<a download>` com `blob:`: no WebView não define destino |
| Interpolar `style=""` ou handler inline no HTML | a CSP está ligada e recusa. Estilo calculado vai pela CSSOM, evento por `addEventListener` |
| `ON CONFLICT` em `processo_envolvidos` | as três unicidades são **adiadas** (`0016`/`0017`), e constraint adiada não serve de árbitro — a forma sem alvo considera todos os índices e quebra tudo. Declare `ON CONFLICT (id)` |
| Trocar valor único entre duas linhas | com constraint imediata a colisão é no **meio** da transação, e a mensagem descreve a regra certa para a situação errada. Unicidade que a tela permite permutar é `DEFERRABLE`; índice parcial não se adia, vira `EXCLUDE` |
| Sincronizar coleção pelo id da entidade referida | trocar a FK vira **apagar e recriar**, e o `ON DELETE CASCADE` leva os filhos. Sincronize pelo id da própria linha — é o que `EnvolvidoRequest.id` existe para fazer |
| Redesenhar formulário com select pesquisável na tela | o `TomSelect` fica preso ao DOM antigo. `dom.ts::destruirSelectsPesquisaveis` antes do redraw, e absorva o formulário **antes**: `destroy()` restaura as opções originais |
| Verbo novo em `auditoria.operacao` | `ck_auditoria_operacao` só aceita `CREATE`/`UPDATE`/`DELETE`, e o `INSERT` da trilha corre na mesma transação da operação — **as duas caem juntas**. Desativação é `UPDATE` com `Acao::acao` própria |
| Auditar exclusão física depois do `DELETE` | O `assunto` sai de junção com a linha que sumiu. Leia-o **antes**, na mesma transação — ver `audit/assunto.rs` |
| Envolver num `<label>` em coluna um campo com `flex` declarado | `flex-basis` é do eixo principal: o `flex: 1 1 260px` de `.filtros input[type="search"]` vira **altura** num container em coluna. Campo de filtro é filho direto de `.filtros` |
| Limpar um `<select>` sob Tom Select | `select.value = ""` zera o `<select>` e **não** mexe no controle visível, que segue exibindo o rótulo antigo. Use `select.tomselect?.clear(true)` |
| Esconder com `display:none` um `<select>` obrigatório | o navegador recusa o submit **em silêncio**, por não conseguir focá-lo. O Tom Select usa `clip` justamente por isso |
| Envolvido "À apurar" | é `policial_militar_id IS NULL`, sem coluna booleana ao lado. Conta no limite, recebe enquadramento e resultado; não pode ser condutor, e é no máximo um por processo |
| Comando paginado servindo de lista de **opções** | O teto de 200 **corta em silêncio**. Lista de opções não pagina (`users_list_ativos`); paginação é da listagem de tela, e precisa de controle de página |
| Listagem de tela nova | o recorte é `db::paginacao::Recorte` (padrão 10, teto 200), e o envelope devolve `page`/`per_page` — sem isso a tela desenha um controle de página com o que **pediu**, não com o que foi servido |
| Largura de coluna | vem de `dom.ts::Coluna.largura`, sai em `data-largura` e é aplicada por `aplicarLarguras` (chamada de `shell()`). Num `<col style="">` a CSP recusa igual, e a tabela volta a se dimensionar pelo conteúdo sem avisar |
| Redesenhar **parte** de uma listagem | não passa pelo `shell()`, e por isso não passa por `aplicarLarguras`: chame-a você mesmo sobre a área (`aplicarLarguras(area)`), senão as larguras somem sem avisar |
| Debounce de busca sem `aoDigitar` | o estado do módulo tem de mudar a **cada tecla**; só o redesenho espera. Quem exporta CSV ou aplica filtro dentro dos 250 ms lê a variável, não o campo. `dom.ts::ligarBuscaInstantanea` já separa os dois |
| Mais de uma ação na mesma célula | `dom.ts::Celula.acoes`, e **cada botão com o seu `data-`** (`dado`): o padrão é `data-tabela-acao`, e repetido nos três os cliques caem todos no mesmo listener |
| Comando cujo nome não é o que ele faz | `users_delete` desativava, e por isso tela nenhuma o chamava por sete rodadas. Verbo de comando descreve o efeito na linha; desativação é `users_deactivate` e grava `UPDATE` na trilha |
| Mexer em regra de CSS que já existe duplicada no arquivo | qual vence é a ordem, não a intenção. Medir o computado antes e depois num navegador — foi como a rodada 14 provou que a listagem de processos não mudou |
| Teste de limite que não passa do limite | a fixture tem 3 militares: o clamp de 200 nunca é exercido e o teste passa. Teste de limite monta **mais que o limite** |
| Orientar a folha impressa por `@page` | o WebKitGTK (motor do Tauri no Linux) **ignora** o descritor `size`, e não tem página nomeada. Quem orienta é o `GtkPageSetup` — `print_report_landscape` (297×210mm) ou `print_portrait` (210×297mm) nos relatórios; `print_landscape` fica exclusivo do Mapa Mensal. E validar impressão em Chromium headless não prova nada: lá o `@page` funciona |
| Exibir enquadramento concatenando a descrição | o `rotulo` de `evidence/repository.rs` **já termina** na descrição. Acrescentá-la de novo imprime o parágrafo duas vezes |
| Folha em paisagem no `GtkPageSetup` | pedir **rotação** ao GTK imprime as páginas **em branco** pelo `run_dialog`, sem erro nenhum. Declare um papel de 297×210mm — ver `folha_a4_paisagem` |
| Conferir a CSP com `tauri dev` | dev usa a `devCsp`, que afrouxa `style-src`. A restritiva só vale no build: `npm run tauri build` |
| Preparar um gráfico para a impressão | dimensione a **caixa** (`.analytics-chart`) e chame `resize()` **sem medidas**. `resize(l, a)` muda só o bitmap, e o `100% !important` do canvas segura a caixa: o desenho sai esticado no papel, sem erro nenhum |
| `Chart.resize()` com animação em curso | ele **adia** o pedido, e o `draw()` seguinte o aplica com as medidas **velhas**. `stop()`, `draw()` para consumir a pendência, **depois** mudar a caixa — ver `graficos/index.ts::pararEredimensionar` |
| Medir a folha para o canvas | não dá: a largura útil do papel só existe depois que a impressão começou. `px` é unidade absoluta na impressão, então fixe a caixa em px antes — é o que `LARGURA_IMPRESSAO` faz |
| Altura de impressão menor que a da tela num ranking | tira o espaço entre as barras e os rótulos de três linhas **encavalam**. Mesmos 42px por barra, com teto de 700px (a altura útil da A4 paisagem) |
| Roving tabindex sem tratador de setas | `tabIndex = -1` no botão inativo o tira do Tab, e sem `keydown` ele fica inalcançável pelo teclado. Alternador de dois estados é grupo de botões com `aria-pressed` |
| Percentual de gráfico sobre o que está plotado | num ranking Top 12 o denominador tem de ser o total **real** (`GraficoSpec.totalReal`); num empilhado, o da categoria. `dados.ts::denominadorPercentual` decide, e diz de que o percentual fala |
| Cortar rótulo de eixo sem reticências | o eixo passa a mentir o nome da categoria, e no papel não há tooltip para desmentir. `dados.ts::quebrarRotulo` marca o corte com `…` |
| Esconder `.table-wrap` para imprimir o bloco completo | a tabela dentro de um cartão analítico não é listagem paginada, e os títulos da listagem ficam soltos. Envolva exatamente títulos+tabela+paginação e passe o id em `ligarExportacao(..., { seletorSubstituido })` |
| Confiar em `break-inside: avoid` no `<tr>` | o WebKitGTK 2.52.6 parte a linha na quebra de página **e não imprime a metade de cima**: o registro some do papel, sem erro. Medido em `tools/impressao` — 14 de 400 linhas. Tabela longa declara `linhasPorFragmentoImpressao` |
| Escolher `linhasPorFragmentoImpressao` no olho | bloco menor que a folha repete o **cabeçalho no meio da página**; maior que a folha deixa de ser indivisível e volta a perder a linha. O valor é medido: `tools/impressao/README.md` |
| Fragmentar tabela dentro de cartão ou painel | em item de `.analytics-grid`/`.stat-grid` o WebKitGTK **ignora** o `break-inside` das caixas de dentro: gasta uma folha a mais e parte a linha assim mesmo. Ali quem protege é o `break-inside: avoid` do próprio cartão — fragmento só no fluxo do documento |
| Dar CSS de impressão por pronto sem imprimir | `@page size` ignorado, linha que some, `break-inside` que não vale dentro de grid: nada disso aparece lendo o CSS. `tools/impressao` imprime pelo WebKitGTK e afere com `pdfinfo`/`pdftotext`; `controle-mapa.sh` prova que o Mapa Mensal não mudou |
| Transformação de gráfico dentro de `graficos/index.ts` | ali não há teste possível — o módulo importa `chart.js` e chama `matchMedia`. Função pura vai para `graficos/dados.ts`, que o Vitest alcança |
| Contar "em andamento" sem olhar o prazo | apuratório em andamento **sem recebimento informado** não tem linha em `processo_prazos`: `prazo_vencimento IS NULL` não é "no prazo" nem "vencido". São **quatro** baldes, e o quarto tem coluna própria — decisão 57 |
| Testar prazo vencido inserindo `dias` negativo | `ck_prazo_dias` exige `dias > 0`, e o vencimento é coluna gerada (`data_inicio + dias`). Quem anda para trás é a **data de início** — ver `prazo_vencendo_em` em `tests/maps_reports_repository.rs` |
| Acrescentar cartão a um painel | antes, ver se outra tela já o desenha. A rodada 29 nasceu de três telas mostrando os mesmos números, e duas delas sem escopo nenhum. Cada indicador tem **uma** tela dona — decisão 55 |
| Agregar data sem olhar de qual conjunto ela sai | `max(data_conclusao)` calculado antes do recorte responde a pergunta errada — e devolve número plausível. A data sai do mesmo `WHERE` que os contadores |
| Ordenar por `Option<data>` direto | `None` < `Some`, então no crescente a lista **abre** com quem não tem a data. Quem não tem vai para o fim nas duas direções — `ordenar_por_data` |
| Distinguir duas telas só pelo filtro | vira a mesma tela com dois nomes no menu. Ou uma sai, ou elas diferem no **gênero** — uma se opera, a outra se imprime — e o dado vem de uma função só (decisão 59) |
| Achatar struct na resposta com `serde(flatten)` | os campos sobem para o topo do JSON, e é isso que mantém `linha.total` onde a tela sempre o leu. Trocar por um objeto aninhado quebra o frontend **sem** erro de compilação no Rust |
| Mandar um `<canvas>` para a impressão | com o compositing ligado — como o app roda — o WebKitGTK o pinta de **preto chapado**, sem erro nenhum. Congele em `<img>` antes: `graficos/index.ts::congelarGraficosParaImpressao`, que custa `data:` no `img-src` da CSP |
| Esconder com `hidden` um canvas do Chart.js | não esconde: ele põe `display:block` inline ao montar, e não há `[hidden]` global no projeto. O canvas continua ocupando caixa e sai preto **ao lado** do PNG — o gráfico imprime em duplicata. Tire do **DOM**, e leia o vizinho antes para devolvê-lo ao lugar |
| Fixtura de gráfico com o canvas nascendo oculto | canvas que nunca foi visível não ganha camada de composição: a fixtura aprova o que o PDF reprova. Pinte visível, deixe compor, ponha o `display:block` inline, e só então troque — `trocaPeloPng` |
| Recorte que é **união** de baldes virando ramo novo do `CASE` | o `BALDE` é `CASE` de saída única, e é isso que torna os quatro exclusivos e somando o total. Um quinto `WHEN 'em_andamento'` roubaria linhas dos `FILTER`, que passariam a contar errado. União mora no **filtro** (`baldes_do_filtro` + `= ANY($n::text[])`), onde é pergunta e não classificação |
| Rotular um recorte de "todos" sem conferir o que ele deixa de fora | "Em andamento (todos)" **não** inclui `sem_prazo`, então não fecha com `total - concluídos` (decisão 63). Escolha assim se registra em teste que diz o porquê, não só no código |
| Véu de carregamento sem ceder um quadro antes da ação | o navegador entra no trabalho síncrono **antes de pintar**, e o loader só aparece quando a ação acabou. `comCarregamento` cede um `requestAnimationFrame` antes de chamar, e `passo()` cede outro a cada mensagem |
| Contar com o giro do spinner durante trabalho que bloqueia a thread | a animação congela junto e parece app travado. Quem informa é o véu **mais a mensagem**, trocada por fase — e o `prefers-reduced-motion` global já zera toda animação do projeto |
| `hidden` em elemento cujo CSS declara `display` | não há `[hidden]` global aqui: o `display` do seletor vence a regra do navegador. Declare o composto (`.carregando[hidden]{display:none!important}`) ou tire do DOM |
| Dois modificadores de tabela que discordam no mesmo valor | `--larga` quer `min-width:1060px`, `--fixa` quer `0`, e a ordem no arquivo decide. Use seletor composto, que decide por especificidade e não por posição |
| Ordem de exibição que o negócio pede | é coluna no banco (`apuratorios.ordem`, 0019), não lista de siglas no código — sigla é apresentação e pode ser renomeada. Carga inicial por sigla **na migration** é legítima (decisões 23, 31, 64) |
| Medir impressão de gráfico com o compositing desligado | é o padrão de `tools/impressao/imprimir.py`, e ele **esconde** a faixa preta: o mesmo canvas sai pintado. Fixtura de gráfico declara `compositing: true`, e `semFaixaPreta` reprova folha com preto chapado |
| Bloco indivisível alto logo abaixo da faixa de KPIs | `.analytics-card` não cabe nos 180mm úteis menos o cabeçalho, e o motor o desmancha por cima da folha seguinte. Ou ele desce (`data-impressao-ao-fim`), ou encolhe — e encolher ranking encavala rótulo |
| Mudar o que vem antes de uma tabela fragmentada | o `linhasNoPrimeiroFragmentoImpressao` foi medido **com** o que estava lá. Mover um bloco na impressão obriga a remedir o primeiro bloco — em Designações, 18 → 12 |
| Guardar o brasão dos documentos em `src-tauri/icons/` | `tauri icon` **sobrescreve** `icon.png` ao gerar o ícone do app, e o brasão do Mapa Mensal e do login sairia trocado pelo ícone, sem erro nenhum. O brasão é `src/assets/brasao-pmro.png`, exportado por `src/brasao.ts`; `src-tauri/icons/` é só do empacotador |
| Fixtura de impressão com o tamanho do bloco escrito à mão | `matriz-normalizada` guardava `22, 18` enquanto a tela já estava em 12: ela certificava uma folha que o app não imprime mais, e só reprovou quando o cabeçalho institucional entrou. Tamanho de bloco sai de `CONJUNTOS`, que é onde o valor da tela mora |
| Imagem criada no clique de imprimir | o WebKitGTK imprime **espaço em branco** por uma `<img>` ainda não decodificada, sem erro. `await img.decode()` antes de chamar o comando de impressão — `mapa-pdf.ts::aguardarImagens` e `dom.ts::inserirCabecalhoInstitucional` |

| `#[sqlx(flatten)]` sem `#[serde(flatten)]` | são atributos de coisas diferentes: `sqlx` monta o struct a partir da linha, `serde` achata a resposta. Só o primeiro deixa o JSON aninhado sob o campo, e a tela lê `undefined` em **todos** os campos do cabeçalho — sem erro no Rust nem no TypeScript, porque `types.ts` declara os campos no topo e o compilador acredita na declaração |
| Testar `resposta.cabecalho.titulo` num struct achatado | é o campo do struct, que o serde não altera: o teste passa com e sem o flatten. Quem afere contrato de JSON serializa e olha o JSON — `tests/commands_ipc.rs`, e as duas metades (campo no topo **e** ausência do aninhado) |

| Passar um botão de **ícone** como gatilho de `comCarregamento` | ele escreve a mensagem no botão e restaura o rótulo no fim; num `.botao-icone` o conteúdo é um `<svg>` e `textContent` é vazio, então escrever **apaga o desenho** e restaurar devolve nada — o botão fica um quadrado em branco até a tela redesenhar. O helper pula os `.botao-icone`: quem informa ali é o véu |
| Coluna `nowrap` mais estreita que o conteúdo em tabela `--fixa` | `table-layout: fixed` não encolhe nem corta: a célula **transborda por cima da vizinha**. Só `truncar` corta com reticências (e dá o `title`). Largura de coluna com dado de tamanho conhecido se mede no motor, não se estima — data `dd/mm/aaaa` pede ~96px |

A seção 7 do guia tem a lista completa, com o que cada uma já custou.

## Antes de dar algo por pronto

```bash
cd src-tauri && cargo fmt --check && cargo test   # 180 testes
cd .. && npm test && npm run typecheck            # 20 testes frontend
```

Escreva comentário explicando **o porquê**, no tom do resto do repositório —
o código já é lido por quem chega sem contexto. Comentários e documentação em
português.
