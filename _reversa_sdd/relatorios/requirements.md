# Relatórios — Requisitos

## Visão Geral

Módulo de geração de relatórios analíticos do sistema. Compartilha o serviço `mapas_relatorios.py` com o módulo de Mapas. Inclui o relatório anual em PDF (a única função completamente implementada) e uma série de relatórios declarados no router mas sem implementação no service (stubs).

## Responsabilidades

- Gerar relatório anual completo em PDF com estatísticas por tipo, PM e natureza
- Gerar estatísticas gerais por ano (stub)
- Gerar relatório por encarregado (stub)
- Gerar relatório por tipo de processo (stub)
- Gerar relatório de prazos vencidos (stub)
- Exportar dados em CSV (stub)
- Exportar dados em Excel (stub)

## Regras de Negócio

- 🟢 **RN-01** — Relatório anual filtra por `TO_CHAR(data_instauracao, 'YYYY') = ano` (`mapas_relatorios.py:667`)
- 🟢 **RN-02** — Separa `tipo_geral='processo'` de `tipo_geral='procedimento'` nas contagens
- 🟢 **RN-03** — Relatório anual gera PDF base64 via biblioteca de geração interna (`_gerar_pdf_relatorio_anual`)
- 🟡 **RN-04** — Status: `concluido=TRUE` → "Concluído"; caso contrário → "Em Andamento"
- 🟢 **RN-05 a RN-10** — Os 6 relatórios stub devem ser implementados na versão Rust/Tauri, com prioridade inicial para o relatório de mapa mensal em PDF (confirmado pelo usuário em `questions.md#14`). Como não há implementação no service legado, as queries devem ser desenhadas a partir das regras de negócio e dos dados existentes.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite | Status |
|----|-----------|-----------|-------------------|--------|
| RF-01 | Gerar relatório anual em PDF | Should | Retorna base64 de PDF + estatísticas | 🟢 Implementado |
| RF-02 | Estatísticas gerais por ano | Could | Retorna contagens por categoria | 🟢 Escopo confirmado; implementar do zero |
| RF-03 | Relatório por encarregado | Could | Lista processos por encarregado | 🟢 Escopo confirmado; implementar do zero |
| RF-04 | Relatório por tipo de processo | Could | Contagens por tipo_detalhe | 🟢 Escopo confirmado; implementar do zero |
| RF-05 | Relatório de prazos vencidos | Could | Processos com prazo > N dias vencido | 🟢 Escopo confirmado; implementar do zero |
| RF-06 | Exportar CSV | Could | Dados em formato CSV | 🟢 Escopo confirmado; implementar do zero |
| RF-07 | Exportar Excel | Could | Dados em formato XLSX | 🟢 Escopo confirmado; implementar do zero |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Segurança | Somente usuários logados | `guard_login()` em todos os handlers | 🟢 |

## Critérios de Aceitação

```gherkin
Cenário: Relatório anual de 2025
  Dado processos e procedimentos instaurados em 2025
  Quando gerar_relatorio_anual_pdf(ano=2025)
  Então retornar {sucesso: true, pdf_base64: str, estatisticas: {
                   total_processos, total_procedimentos,
                   por_tipo: [...], concluidos: int, em_andamento: int}}
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Relatório anual PDF | Should | Única função implementada; necessário para gestão |
| Demais relatórios | Could | Stubs no legado, mas escopo confirmado pelo usuário; implementar do zero |

## Rastreabilidade de Código

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `app/routers/relatorios.py` | 7 handlers @eel.expose | 🟢 |
| `app/services/mapas_relatorios.py:641` | `gerar_relatorio_anual` (implementada) | 🟢 |
| `app/services/mapas_relatorios.py` | `gerar_relatorio_anual_pdf`, `gerar_relatorio_estatisticas_gerais`, etc. | 🟢 Escopo confirmado pelo usuário; sem implementação legada para migrar |
