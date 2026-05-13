# Flowchart — Módulo mapas

> Gerado pelo Arqueólogo em 2026-05-12
> Fonte: `app/routers/mapas.py`

---

## Fluxo: Gerar Mapa (`gerar_mapa`)

```mermaid
flowchart TD
    A([gerar_mapa\ntipo_processo, periodo_inicio,\nperiodo_fim]) --> B[_guard_login]
    B --> C{tipo_processo\n== 'COMPLETO'?}
    C -- Sim --> D[Conta totais para TODOS\nos tipos de processo]
    C -- Não --> E[Filtra por tipo_processo\nespecífico]
    D --> F[Algoritmo totais COMPLETO:\npara cada tipo_detalhe:\n  total = COUNT WHERE tipo=X\n  concluidos = COUNT WHERE tipo=X AND concluido=TRUE\n  andamento = total - concluidos]
    E --> G[Algoritmo totais simples:\n  total = COUNT WHERE tipo=tipo_processo\n  concluidos = COUNT WHERE tipo=X AND concluido=TRUE\n  andamento = total - concluidos]
    F --> H[Monta dados_mapa JSONB:\n{tipo: {total, concluidos, andamento}}]
    G --> H
    H --> I[Retorna dados do mapa\nsem salvar]
```

---

## Fluxo: Salvar Mapa (`salvar_mapa`)

```mermaid
flowchart TD
    A([salvar_mapa\ntitulo, tipo_processo,\nperiodo, dados_mapa]) --> B[_guard_login]
    B --> C{titulo e\ndados_mapa fornecidos?}
    C -- Não --> D[Retorna erro]
    C -- Sim --> E[INSERT mapas_salvos\nid=uuid4,\ntitulo, tipo_processo,\nperiodo_inicio, periodo_fim,\nperiodo_descricao,\ntotal_processos,\ntotal_concluidos,\ntotal_andamento,\nusuario_id, usuario_nome,\ndados_mapa=JSONB]
    E --> F[Registra auditoria CREATE]
    F --> G[Retorna sucesso + id]
```

---

## Fluxo: Listar Mapas Salvos (`listar_mapas`)

```mermaid
flowchart TD
    A([listar_mapas\nfiltros]) --> B[_guard_login]
    B --> C[SELECT * FROM mapas_salvos\nWHERE ativo=TRUE\nORDER BY data_geracao DESC]
    C --> D[Opcionalmente filtra\npor tipo_processo ou periodo]
    D --> E[Retorna lista]
```

---

## Fluxo: Gerar PDF do Mapa (`gerar_pdf_mapa`)

```mermaid
flowchart TD
    A([gerar_pdf_mapa\nmapa_id ou dados_mapa]) --> B[_guard_login]
    B --> C{mapa_id\nfornecido?}
    C -- Sim --> D[Busca mapa salvo\nWHERE id=? AND ativo=TRUE]
    D --> E[Carrega dados_mapa]
    C -- Não --> F[Usa dados_mapa\npassados diretamente]
    E --> G[ReportLab: monta tabela\ncom totais por tipo]
    F --> G
    G --> H[Inclui logo SJD-GESTOR]
    H --> I[Gera PDF em memória]
    I --> J[Retorna PDF como\nbase64 ou bytes]
```

---

## Fluxo: Excluir Mapa (`excluir_mapa`)

```mermaid
flowchart TD
    A([excluir_mapa id]) --> B[_guard_login]
    B --> C[UPDATE mapas_salvos\nSET ativo=FALSE WHERE id=?]
    C --> D[Registra auditoria DELETE]
    D --> E[Retorna sucesso]
```

> 🟢 CONFIRMADO: dados_mapa armazenados como JSONB em mapas_salvos
> 🟡 INFERIDO: algoritmo de totais COMPLETO agrega todos os tipos individualmente
> 🔴 LACUNA: período de referência não é validado (periodo_inicio pode ser > periodo_fim)
