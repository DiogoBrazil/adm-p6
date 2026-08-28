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
  nova (`0015`…).
- **Tocar em `adm-p6.sql`.** Dump de produção, 44 MB, somente leitura, fora do
  git — e com dados pessoais de 235 militares.
- **Reabrir uma decisão da seção 3 sem motivo novo.** São 50, todas decididas pelo
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
| Comando paginado servindo de lista de **opções** | O teto de 200 **corta em silêncio**. Lista de opções não pagina (`users_list_ativos`); paginação é da listagem de tela, e precisa de controle de página |
| Listagem de tela nova | o recorte é `db::paginacao::Recorte` (padrão 10, teto 200), e o envelope devolve `page`/`per_page` — sem isso a tela desenha um controle de página com o que **pediu**, não com o que foi servido |
| Largura de coluna | vem de `dom.ts::Coluna.largura`, sai em `data-largura` e é aplicada por `aplicarLarguras` (chamada de `shell()`). Num `<col style="">` a CSP recusa igual, e a tabela volta a se dimensionar pelo conteúdo sem avisar |
| Mexer em regra de CSS que já existe duplicada no arquivo | qual vence é a ordem, não a intenção. Medir o computado antes e depois num navegador — foi como a rodada 14 provou que a listagem de processos não mudou |
| Teste de limite que não passa do limite | a fixture tem 3 militares: o clamp de 200 nunca é exercido e o teste passa. Teste de limite monta **mais que o limite** |
| Conferir a CSP com `tauri dev` | dev usa a `devCsp`, que afrouxa `style-src`. A restritiva só vale no build: `npm run tauri build -- --no-bundle` |

A seção 7 do guia tem a lista completa, com o que cada uma já custou.

## Antes de dar algo por pronto

```bash
cd src-tauri && cargo fmt --check && cargo test   # 143 testes
cd .. && npm run typecheck
```

Escreva comentário explicando **o porquê**, no tom do resto do repositório —
o código já é lido por quem chega sem contexto. Comentários e documentação em
português.
