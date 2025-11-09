# Correção - Visualização de Usuário

## 📋 Problema Identificado

Ao clicar no ícone de visualizar usuário na lista de usuários, a página `user_view.html` abria mas exibia a mensagem **"Usuário não encontrado"**.

## 🔍 Causa do Problema

A função `obter_usuario_por_id()` no backend (`main.py`) estava buscando dados nas **tabelas antigas** (`operadores` e `encarregados`), mas o sistema foi migrado para uma **estrutura unificada** usando a tabela `usuarios`.

### Código Antigo (INCORRETO):
```python
def obter_usuario_por_id(user_id, user_type):
    """Retorna os dados atuais de um usuário para edição"""
    conn = db_manager.get_connection()
    cursor = conn.cursor()
    user = None
    if user_type == 'operador':
        cursor.execute('''
            SELECT id, posto_graduacao, matricula, nome, email, profile, created_at, updated_at, ativo
            FROM operadores WHERE id = ?
        ''', (user_id,))
        # ... busca em operadores
    elif user_type == 'encarregado':
        cursor.execute('''
            SELECT id, posto_graduacao, matricula, nome, email, created_at, updated_at, ativo
            FROM encarregados WHERE id = ?
        ''', (user_id,))
        # ... busca em encarregados
```

## ✅ Solução Implementada

Atualizei a função `obter_usuario_por_id()` para buscar na tabela unificada `usuarios`:

### Código Novo (CORRETO):
```python
def obter_usuario_por_id(user_id, user_type):
    """Retorna os dados atuais de um usuário para edição/visualização"""
    conn = db_manager.get_connection()
    cursor = conn.cursor()
    
    try:
        # Buscar na tabela unificada usuarios
        cursor.execute('''
            SELECT id, tipo_usuario, posto_graduacao, matricula, nome, 
                   is_encarregado, is_operador, email, perfil, 
                   created_at, updated_at, ativo
            FROM usuarios 
            WHERE id = ?
        ''', (user_id,))
        
        row = cursor.fetchone()
        if row:
            # Determinar vínculos
            vinculos = []
            if row[5]:  # is_encarregado
                vinculos.append("Encarregado")
            if row[6]:  # is_operador
                perfil_texto = f"Operador ({row[8]})" if row[8] else "Operador"
                vinculos.append(perfil_texto)
            
            vinculo_texto = " / ".join(vinculos) if vinculos else "Sem vínculo"
            
            user = {
                "id": row[0],
                "tipo_usuario": row[1],
                "posto_graduacao": row[2],
                "matricula": row[3],
                "nome": row[4],
                "is_encarregado": bool(row[5]),
                "is_operador": bool(row[6]),
                "email": row[7],
                "profile": row[8],  # Mantém 'profile' para compatibilidade
                "perfil": row[8],
                "created_at": row[9],
                "updated_at": row[10],
                "ativo": bool(row[11]),
                "tipo": user_type,  # Mantém o tipo passado para compatibilidade
                "vinculo_texto": vinculo_texto
            }
            
            conn.close()
            return user
        
        conn.close()
        return None
        
    except Exception as e:
        print(f"Erro ao obter usuário por ID: {e}")
        conn.close()
        return None
```

## 🎯 Melhorias Implementadas

1. **Busca Unificada**: Agora busca diretamente na tabela `usuarios`
2. **Vínculos Dinâmicos**: Calcula automaticamente se o usuário é Encarregado, Operador ou ambos
3. **Compatibilidade**: Mantém campos `profile` e `tipo` para compatibilidade com frontend
4. **Tratamento de Erros**: Adiciona try/except para melhor tratamento de erros
5. **Informações Completas**: Retorna todos os campos necessários, incluindo `tipo_usuario`, `is_encarregado`, `is_operador`

## 📊 Dados Retornados

A função agora retorna:
- `id`: ID único do usuário
- `tipo_usuario`: "Oficial" ou "Praça"
- `posto_graduacao`: Posto ou graduação
- `matricula`: Matrícula funcional
- `nome`: Nome completo
- `is_encarregado`: Boolean indicando se pode ser encarregado
- `is_operador`: Boolean indicando se é operador do sistema
- `email`: Email (se tiver)
- `perfil`: "admin" ou "comum" (para operadores)
- `created_at`: Data de criação
- `updated_at`: Data da última atualização
- `ativo`: Status ativo/inativo
- `vinculo_texto`: Texto formatado dos vínculos ("Encarregado / Operador (admin)")

## 🔄 Impacto

- ✅ Visualização de usuários funcionando corretamente
- ✅ Exibe informações completas do usuário
- ✅ Mostra processos/procedimentos como encarregado
- ✅ Mostra processos/procedimentos como escrivão
- ✅ Estatísticas funcionando (função `obter_estatisticas_usuario` já estava correta)

## 📝 Observações

A função `obter_estatisticas_usuario()` **não precisou ser alterada** pois já estava consultando a tabela `processos_procedimentos` corretamente, usando os campos `responsavel_id`, `escrivao_id` e `nome_pm_id` que continuam válidos.

## ⚠️ Pendências Identificadas

Ainda existem **outras funções** no `main.py` que usam as tabelas antigas (`operadores` e `encarregados`):
- Funções de criação de usuário (linhas 191-239)
- Funções de atualização de usuário (linhas 271-313)
- Validações diversas (linhas 1542, 1545, 2044, 2049, etc.)

Essas funções podem precisar ser migradas posteriormente, mas **não afetam a visualização de usuários**.

---

**Data da Correção**: 20 de outubro de 2025  
**Arquivo Modificado**: `main.py` (função `obter_usuario_por_id`)  
**Status**: ✅ Resolvido
