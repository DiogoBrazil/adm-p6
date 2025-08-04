# Alteração do Texto da Coluna - "Local de Origem" para "Origem"

## Resumo da Alteração
Alterado o texto do cabeçalho da coluna de "Local de Origem" para "Origem" para melhorar o espaçamento da tabela de procedimentos.

## Data da Alteração
31 de julho de 2025

## Arquivo Modificado
- `/web/procedure_list.html` - Linha 72

## Detalhes da Modificação

### HTML (procedure_list.html)
**Antes:**
```html
<th width="10%" style="text-align:center;">Local de Origem</th>
```

**Depois:**
```html
<th width="10%" style="text-align:center;">Origem</th>
```

## Motivo da Alteração
- Melhoria no espaçamento visual da tabela
- Texto mais conciso e objetivo
- Melhor organização da interface

## Layout da Tabela Atualizado
| Coluna | Largura | Texto |
|---------|---------|--------|
| Tipo | 9% | Tipo |
| Ano | 7% | Ano |
| Número | 8% | Número |
| **Origem** | **10%** | **Origem** |
| SEI | 14% | SEI |
| Encarregado | 20% | Encarregado |
| PM Envolvido | 20% | PM Envolvido |
| Tipo de Envolvimento | 7% | Tipo de Envolvimento |
| Ações | 5% | Ações |

**Total:** 100% (distribuição mantida)

## Verificação
✅ Alteração aplicada com sucesso
✅ Texto "Origem" encontrado na linha 72 do HTML
✅ Layout da tabela mantém 100% de largura
✅ Funcionalidade não foi afetada

## Observações
- A alteração foi apenas cosmética no texto do cabeçalho
- O campo de dados `local_origem` permanece inalterado no JavaScript
- A funcionalidade de pesquisa continua funcionando normalmente
- Não foram necessárias alterações no arquivo JavaScript
