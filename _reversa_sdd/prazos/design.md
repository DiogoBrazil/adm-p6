# Prazos — Design Técnico

## Interface (principais funções)

| Símbolo | Guard | Descrição |
|---------|-------|-----------|
| `listar_prazos_processo(processo_id)` | login | Histórico de prazos do processo |
| `adicionar_prorrogacao(processo_id, dias, portaria?, ...)` | login | Prorroga prazo ativo |
| `concluir_prazo_processo(processo_id, responsavel_id?)` | login | Conclui prazo ativo |
| `obter_prazos_vencendo(dias_antecedencia?)` | login | Prazos vencendo em N dias (default 7) |
| `obter_prazos_vencidos()` | login | Prazos já vencidos |
| `obter_dashboard_prazos()` | login | Contagens para dashboard |
| `gerar_relatorio_prazos(filtros?)` | login | Relatório com filtros |
| `registrar_andamento_processo(...)` | login | Andamento associado ao prazo |

## Estrutura da Tabela `prazos_processo`

```sql
prazos_processo (
  id               UUID PRIMARY KEY,
  processo_id      UUID REFERENCES processos_procedimentos(id),
  tipo_prazo       VARCHAR -- 'inicial' | 'prorrogacao'
  data_inicio      DATE,
  data_vencimento  DATE,
  dias_adicionados INTEGER,
  motivo           TEXT NULLABLE,
  autorizado_por   UUID NULLABLE,
  autorizado_tipo  VARCHAR NULLABLE,
  numero_portaria  VARCHAR NULLABLE,
  data_portaria    DATE NULLABLE,
  ordem_prorrogacao INTEGER NULLABLE,  -- sequência da prorrogação
  ativo            INTEGER DEFAULT 1   -- 1=ativo, 0=inativo (INTEGER, não BOOLEAN)
)
```

**Nota:** `ativo` usa INTEGER (1/0), não BOOLEAN — herança do design original SQLite.

## Fluxo Principal — Adicionar Prazo Inicial

```
Chamado por registrar_processo() após INSERT do processo:
1. data_inicio = data_instauracao do processo
2. dias_prazo  = prazo_base por tipo_detalhe (RN-06)
3. data_vencimento = data_inicio + timedelta(days=dias_prazo)
4. INSERT INTO prazos_processo (tipo_prazo='inicial', ativo=1)
5. Retornar {sucesso: true, prazo_id: UUID}
```

## Fluxo Principal — Prorrogar Prazo

```
prorrogar_prazo(processo_id, dias_prorrogacao, motivo, autorizado_por,
                autorizado_tipo, numero_portaria, data_portaria):
1. SELECT prazo ativo (ativo=1) para o processo
2. Calcular novo_inicio = data_vencimento_atual + 1 dia
3. nova_data_vencimento = novo_inicio + timedelta(days=dias_prorrogacao - 1)
   -- equivale a: data_vencimento_atual + timedelta(days=dias_prorrogacao)
   -- confirmado em `prazos_andamentos_manager.py:150-151` [Revisão: fórmula corrigida]
4. Calcular ordem_prorrogacao = COUNT(prorrogacoes existentes) + 1
5. UPDATE prazo atual: ativo=0
6. INSERT novo prazo (tipo_prazo='prorrogacao', ativo=1,
   numero_portaria, data_portaria, ordem_prorrogacao)
7. Retornar {sucesso: true}
```

## Fluxo Principal — Dashboard

```
obter_dashboard_prazos():
1. COUNT prazos com data_vencimento < TODAY() AND ativo=1  → vencidos
2. COUNT prazos com data_vencimento BETWEEN TODAY() AND TODAY()+7 AND ativo=1 → vencendo_em_7_dias
3. COUNT prazos com data_vencimento > TODAY()+7 AND ativo=1 → em_andamento
4. COUNT prazos concluidos (inferido: ativo=0 com registro de conclusao) → concluidos
5. Retornar {vencidos, vencendo_em_7_dias, em_andamento, concluidos}
```

## Arquitetura do Módulo

```
PrazosAndamentosManager (prazos_andamentos_manager.py)
  ├── Prazos
  │     ├── adicionar_prazo_inicial()
  │     ├── prorrogar_prazo()
  │     ├── listar_prazos_processo()
  │     ├── concluir_prazo()
  │     └── obter_prazos_vencendo() / obter_prazos_vencidos()
  ├── Andamentos
  │     ├── adicionar_andamento()
  │     ├── listar_andamentos_processo()
  │     ├── obter_ultimo_andamento()
  │     └── registrar_andamento()
  └── Relatórios
        ├── obter_dashboard_prazos()
        ├── gerar_relatorio_processo()
        ├── gerar_relatorio_prazos()
        └── relatorio_processos_por_prazo()
```

**Nota arquitetural:** `PrazosAndamentosManager` é uma classe standalone fora do `app/` — instanciada em `main.py` e passada via injeção de dependência para os routers.

## Dependências

- `prazos_andamentos_manager.py` — classe principal (standalone, raiz do projeto)
- `app/services/prazos_andamentos.py` — wrappers finos que delegam ao manager
- `db_config.py:get_pg_connection()` — conexão direta (não via DatabaseManager)
- Tabelas: `prazos_processo`, `processos_procedimentos`

## Dívida Técnica

- 🟡 `ativo` como INTEGER em vez de BOOLEAN — incompatível com o padrão do restante do sistema
- 🟡 `PrazosAndamentosManager` usa `get_pg_connection()` diretamente, sem pool de conexões
- 🟡 O módulo mistura responsabilidades: prazos + andamentos + relatórios em uma única classe
