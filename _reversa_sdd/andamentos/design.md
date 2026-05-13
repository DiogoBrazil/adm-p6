# Andamentos — Design Técnico

## Interface (principais funções)

| Símbolo | Guard | Descrição |
|---------|-------|-----------|
| `adicionar_andamento(processo_id, texto, usuario_nome?)` | login | Adiciona andamento ao JSONB |
| `listar_andamentos(processo_id)` | login | Lista andamentos normalizados |
| `listar_andamentos_processo(processo_id)` | login | Alias de `listar_andamentos` |
| `remover_andamento(processo_id, andamento_id)` | login | Remove da lista JSONB |
| `obter_tipos_andamento()` | login | Tipos disponíveis |
| `calcular_prazo_processo(tipo, data_inicio, dias?)` | login | Calcula data de vencimento |

## Estrutura de Armazenamento

Andamentos **não possuem tabela própria**. São armazenados no campo `JSONB` da tabela `processos_procedimentos`:

```
processos_procedimentos.andamentos = [
  {
    "id": "uuid",
    "texto": "Texto do andamento",
    "data": "2025-01-15 10:30:00",
    "usuario": "CAP PM SILVA"
  },
  ...
]
```

A lista é mantida em ordem inversa (mais recente primeiro via `insert(0, novo)`).

## Fluxo — Adicionar Andamento

```
1. guard_login()
2. SELECT andamentos FROM processos_procedimentos WHERE id=processo_id AND ativo=TRUE
3. Se não encontrado → erro
4. Parse JSONB → list (com fallback de string JSON legada)
5. Criar novo_andamento = {id: UUID, texto, data: NOW(), usuario: usuario_nome or "Sistema"}
6. andamentos.insert(0, novo_andamento)
7. UPDATE processos_procedimentos SET andamentos = json.dumps(andamentos), updated_at=NOW()
8. Retornar {sucesso: true, mensagem: "...", andamento: novo_andamento}
```

## Fluxo — Listar Andamentos (com normalização)

```
1. guard_login()
2. SELECT andamentos FROM processos_procedimentos WHERE id=processo_id AND ativo=TRUE
3. Parse JSONB → list
4. Para cada andamento:
   a. Resolver campo texto: tenta "texto" → "descricao" → "descricao_andamento" → "observacoes"
   b. Resolver campo usuario: tenta "usuario" → "usuario_nome" → "responsavel_nome" → "responsavel"
   c. Montar andamento_formatado com ambos os campos (para compatibilidade frontend)
5. Retornar {sucesso: true, andamentos: [...]}
```

**Nota:** A normalização de campos existe porque andamentos registrados por outros módulos (ex.: prazos) usam `descricao` em vez de `texto`.

## Fluxo — Remover Andamento

```
1. guard_login()
2. SELECT andamentos FROM processos_procedimentos WHERE id=processo_id AND ativo=TRUE
3. Parse JSONB → list
4. andamentos = [a for a in andamentos if a.get('id') != andamento_id]
5. UPDATE processos_procedimentos SET andamentos = json.dumps(andamentos)
6. Retornar {sucesso: true, mensagem: "..."}
```

## Dependências

- `app/services/prazos_andamentos.py` — implementação dos handlers de andamento
- `prazos_andamentos_manager.py` — implementação alternativa (registrar_andamento via PrazosAndamentosManager)
- Tabela: `processos_procedimentos.andamentos` (JSONB)

## Dívida Técnica

- 🟡 Andamentos em JSONB dentro de `processos_procedimentos` vs. tabela `andamentos_processo` separada — design de armazenamento embebido dificulta consultas analíticas
- 🟢 Dois caminhos de escrita de andamentos convergem para a mesma coluna JSONB: `PrazosAndamentosManager.registrar_andamento` também escreve em `processos_procedimentos.andamentos` (confirmado pelo usuário em `questions.md#12`)
- 🟢 Debug print em `listar_andamentos` linha 192 — remover na migração
