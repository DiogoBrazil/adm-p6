# ADR-0006: PDF do processo armazenado como BYTEA no banco de dados

**Status:** Aceito  
**Data:** 2025-11-12 (commit `4cfc206`, migração `0006_add_pdf_processos`)  
**Confiança:** 🟢 CONFIRMADO

---

## Contexto

Processos e procedimentos podem ter um PDF de portaria/decisão associado. O sistema precisava de uma estratégia para armazenar esse arquivo.

**Evidências:**
- `4cfc206`: "Add PDF management functionality: implement upload, retrieval, and removal of PDFs for processos"
- `5714633`: "Update PDF handling: increase size limit to 100 MB"
- Migration `0006_add_pdf_processos`: adiciona colunas `pdf_arquivo` (LargeBinary), `pdf_nome`, `pdf_content_type`, `pdf_tamanho`, `pdf_upload_em`

---

## Decisão

Armazenar o PDF diretamente como **BYTEA** (`LargeBinary` no SQLAlchemy) na tabela `processos_procedimentos`, junto com metadados: nome, content-type, tamanho e timestamp de upload.

---

## Razões

1. Aplicação desktop — não há servidor de arquivos ou CDN disponível
2. Banco PostgreSQL é o único storage persistente disponível
3. Simplificação de backup — arquivo + metadados em um único dump do banco
4. Um processo tem no máximo **um** PDF (campo único, não lista)

---

## Alternativas Consideradas

- **Sistema de arquivos local**: descartado — banco em Docker torna o FS compartilhado complexo
- **Coluna `oid` do PostgreSQL (Large Objects)**: descartado — API mais complexa sem ganho significativo para arquivos de até 100 MB

---

## Consequências

- **Limite de 100 MB** validado apenas no frontend (commit `5714633`); o backend/banco não impõe limite
- PDF é transferido via Eel como base64 (string) e decodificado para bytes no backend
- Banco pode crescer significativamente se muitos PDFs forem anexados
- **Para migração Rust/Tauri:** Manter BYTEA (banco não muda). Tauri pode usar `tauri-plugin-dialog` para seleção de arquivo e enviar via comando como bytes ou base64.
