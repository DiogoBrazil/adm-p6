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
| Envolver num `<label>` em coluna um campo com `flex` declarado | `flex-basis` é do eixo principal: o `flex: 1 1 260px` de `.filtros input[type="search"]` vira **altura** num container em coluna. Campo de filtro é filho direto de `.filtros` |
| Limpar um `<select>` sob Tom Select | `select.value = ""` zera o `<select>` e **não** mexe no controle visível, que segue exibindo o rótulo antigo. Use `select.tomselect?.clear(true)` |
| Esconder com `display:none` um `<select>` obrigatório | o navegador recusa o submit **em silêncio**, por não conseguir focá-lo. O Tom Select usa `clip` justamente por isso |
| Envolvido "À apurar" | é `policial_militar_id IS NULL`, sem coluna booleana ao lado. Conta no limite, recebe enquadramento e resultado; não pode ser condutor, e é no máximo um por processo |
| Comando paginado servindo de lista de **opções** | O teto de 200 **corta em silêncio**. Lista de opções não pagina (`users_list_ativos`); paginação é da listagem de tela, e precisa de controle de página |
| Listagem de tela nova | o recorte é `db::paginacao::Recorte` (padrão 10, teto 200), e o envelope devolve `page`/`per_page` — sem isso a tela desenha um controle de página com o que **pediu**, não com o que foi servido |
| Largura de coluna | vem de `dom.ts::Coluna.largura`, sai em `data-largura` e é aplicada por `aplicarLarguras` (chamada de `shell()`). Num `<col style="">` a CSP recusa igual, e a tabela volta a se dimensionar pelo conteúdo sem avisar |
| Mexer em regra de CSS que já existe duplicada no arquivo | qual vence é a ordem, não a intenção. Medir o computado antes e depois num navegador — foi como a rodada 14 provou que a listagem de processos não mudou |
| Teste de limite que não passa do limite | a fixture tem 3 militares: o clamp de 200 nunca é exercido e o teste passa. Teste de limite monta **mais que o limite** |
| Orientar a folha impressa por `@page` | o WebKitGTK (motor do Tauri no Linux) **ignora** o descritor `size`, e não tem página nomeada. Quem orienta é o `GtkPageSetup` — ver `print::commands::print_landscape`. E validar impressão em Chromium headless não prova nada: lá o `@page` funciona |
| Exibir enquadramento concatenando a descrição | o `rotulo` de `evidence/repository.rs` **já termina** na descrição. Acrescentá-la de novo imprime o parágrafo duas vezes |
| Folha em paisagem no `GtkPageSetup` | pedir **rotação** ao GTK imprime as páginas **em branco** pelo `run_dialog`, sem erro nenhum. Declare um papel de 297×210mm — ver `folha_a4_paisagem` |
| Conferir a CSP com `tauri dev` | dev usa a `devCsp`, que afrouxa `style-src`. A restritiva só vale no build: `npm run tauri build -- --no-bundle` |

A seção 7 do guia tem a lista completa, com o que cada uma já custou.

## Antes de dar algo por pronto

```bash
cd src-tauri && cargo fmt --check && cargo test   # 162 testes
cd .. && npm run typecheck
```

Escreva comentário explicando **o porquê**, no tom do resto do repositório —
o código já é lido por quem chega sem contexto. Comentários e documentação em
português.
