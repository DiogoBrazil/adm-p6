# 🔧 Resolver Problema de Permissões PostgreSQL

## Problema Detectado

```
ERRO: permissão negada para esquema public
```

O usuário `app_user` não tem permissões para criar tabelas no banco `app_db`.

---

## 🛠️ Solução: Conceder Permissões

### Opção 1: Via pgAdmin (Interface Gráfica) - RECOMENDADO

1. **Abra pgAdmin** no servidor Windows (192.168.0.137)

2. **Conecte-se ao PostgreSQL** como superusuário (postgres)

3. **Clique com botão direito** em `app_db` → **Query Tool**

4. **Execute os seguintes comandos SQL**:

```sql
-- Conectar ao banco app_db
\c app_db

-- Conceder permissões completas ao app_user no schema public
GRANT ALL PRIVILEGES ON SCHEMA public TO app_user;

-- Conceder permissões para criar tabelas
GRANT CREATE ON SCHEMA public TO app_user;

-- Conceder permissões em todas as tabelas existentes (se houver)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;

-- Conceder permissões em todas as sequences (para auto-increment)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Definir permissões padrão para futuras tabelas
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL PRIVILEGES ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL PRIVILEGES ON SEQUENCES TO app_user;

-- Verificar permissões
\dn+ public
```

5. **Verifique se funcionou**:

```sql
-- Teste criar uma tabela simples
CREATE TABLE teste_permissoes (id SERIAL PRIMARY KEY, nome TEXT);

-- Se funcionou, pode deletar
DROP TABLE teste_permissoes;
```

---

### Opção 2: Via Linha de Comando (psql)

Se você tem acesso ao terminal do servidor Windows com `psql` instalado:

```bash
# Conectar como superusuário
psql -U postgres -d app_db

# Então execute os comandos SQL da Opção 1
```

---

### Opção 3: Recriar o Usuário com Permissões Corretas

Se preferir recriar o usuário desde o início (mais simples):

```sql
-- Conectar como postgres (superusuário)

-- Deletar usuário antigo (se não estiver sendo usado)
DROP USER IF EXISTS app_user;

-- Recriar com permissões adequadas
CREATE USER app_user WITH PASSWORD 'p67bpm';

-- Conceder permissões no banco
GRANT ALL PRIVILEGES ON DATABASE app_db TO app_user;

-- Conectar ao banco app_db
\c app_db

-- Conceder todas permissões no schema
GRANT ALL ON SCHEMA public TO app_user;
GRANT CREATE ON SCHEMA public TO app_user;

-- Tornar app_user "dono" do schema (mais permissões)
ALTER SCHEMA public OWNER TO app_user;
```

---

## ✅ Após Resolver as Permissões

### Teste 1: Verificar Conexão e Permissões

No seu Linux, execute:

```bash
cd /home/diogo/DEV/aulas/test-eel
python teste_rapido_pg.py
```

**Resultado esperado**: Deve passar mais testes (pelo menos conexão).

---

### Teste 2: Tentar Criar Tabelas Novamente

```bash
# Teste criar tabelas (migração)
python migrar_dados.py --tabela usuarios
```

**Resultado esperado**:
```
✓ Tabela 'usuarios' criada/verificada no PostgreSQL
✓ Migrados 14/14 registros da tabela 'usuarios'
```

---

### Teste 3: Migrar Todas as Tabelas

Depois que a tabela `usuarios` funcionar:

```bash
# Migrar tudo
python migrar_dados.py
```

Isso vai:
- Criar todas as 28 tabelas
- Migrar todos os dados do SQLite

---

## 🎯 Verificação Final

Após a migração completa, execute:

```bash
python teste_rapido_pg.py
```

**Resultado esperado**: `5/5 testes passaram` 🎉

---

## 📝 Resumo dos Comandos SQL Necessários

Para copiar e colar no pgAdmin ou psql:

```sql
-- Execute como superusuário (postgres)
\c app_db;

GRANT ALL PRIVILEGES ON SCHEMA public TO app_user;
GRANT CREATE ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL PRIVILEGES ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL PRIVILEGES ON SEQUENCES TO app_user;

-- Verificar
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = 'app_user';
```

---

## ⚠️ Nota de Segurança

Em ambiente de **produção**, você deve limitar as permissões conforme necessário. Para **desenvolvimento/teste**, as permissões acima são adequadas.

Para produção, considere:
- Criar schemas separados
- Limitar permissões (apenas SELECT/INSERT/UPDATE/DELETE)
- Usar diferentes usuários para migração vs. aplicação

---

## 🆘 Se Continuar com Erro

1. **Verifique se você está usando o superusuário correto**
   - Usuário padrão: `postgres`
   - Senha: (a que você definiu na instalação)

2. **Verifique o dono do banco**:
   ```sql
   SELECT datname, datdba::regrole as owner 
   FROM pg_database 
   WHERE datname = 'app_db';
   ```

3. **Última alternativa**: Recrie o banco e usuário do zero
   ```sql
   -- Como postgres
   DROP DATABASE IF EXISTS app_db;
   DROP USER IF EXISTS app_user;
   
   CREATE USER app_user WITH PASSWORD 'p67bpm' CREATEDB;
   CREATE DATABASE app_db OWNER app_user;
   ```

---

**Após resolver, volte e execute a migração!** 🚀
