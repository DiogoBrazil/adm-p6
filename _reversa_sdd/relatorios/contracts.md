# Relatórios — Contratos Eel (@eel.expose)

## gerar_relatorio_anual_pdf

```
Guard: login
Entrada: ano: int
Saída ok:  {sucesso: true,
             pdf_base64: str (PDF codificado em base64),
             estatisticas: {
               total_processos: int,
               total_procedimentos: int,
               total_geral: int,
               por_tipo: [{tipo_detalhe, status, qtd}],
               concluidos: int,
               em_andamento: int
             }}
Saída err: {sucesso: false, mensagem: str}
Status: 🟢 Implementado
```

## gerar_relatorio_estatisticas_gerais

```
Guard: login
Entrada: ano?: int
Saída ok:  {sucesso: true, estatisticas: {...}}  (estrutura a definir)
Saída err: {sucesso: false, mensagem: str}
Status: 🟢 Escopo confirmado pelo usuário; stub no legado, implementar do zero
```

## gerar_relatorio_processos_por_encarregado

```
Guard: login
Entrada: ano?: int
Saída ok:  {sucesso: true, relatorio: [{encarregado: {...}, processos: [...]}]}
Saída err: {sucesso: false, mensagem: str}
Status: 🟢 Escopo confirmado pelo usuário; stub no legado, implementar do zero
```

## gerar_relatorio_processos_por_tipo

```
Guard: login
Entrada: ano?: int
Saída ok:  {sucesso: true, relatorio: [{tipo_detalhe, total, concluidos, em_andamento}]}
Saída err: {sucesso: false, mensagem: str}
Status: 🟢 Escopo confirmado pelo usuário; stub no legado, implementar do zero
```

## gerar_relatorio_prazos_vencidos

```
Guard: login
Entrada: dias_atras: int (default 30)
Saída ok:  {sucesso: true, processos: [{id, numero, tipo_detalhe, data_vencimento, dias_atraso}]}
Saída err: {sucesso: false, mensagem: str}
Status: 🟢 Escopo confirmado pelo usuário; stub no legado, implementar do zero
```

## exportar_relatorio_csv

```
Guard: login
Entrada: tipo_relatorio: str, filtros?: dict
Saída ok:  {sucesso: true, csv_base64: str} | download direto (a definir)
Saída err: {sucesso: false, mensagem: str}
Status: 🟢 Escopo confirmado pelo usuário; stub no legado, implementar do zero
```

## exportar_relatorio_excel

```
Guard: login
Entrada: tipo_relatorio: str, filtros?: dict
Saída ok:  {sucesso: true, excel_base64: str} | download direto (a definir)
Saída err: {sucesso: false, mensagem: str}
Status: 🟢 Escopo confirmado pelo usuário; stub no legado, implementar do zero
```

## Padrão de resposta

Todos os contratos usam `sucesso/mensagem` (pt-br).
Os 6 contratos de relatórios sem implementação no service legado têm escopo confirmado pelo usuário (`questions.md#14`) e devem ser implementados do zero na migração para Rust/Tauri. Prioridade: relatório de mapa mensal em PDF.
