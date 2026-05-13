# Autenticação — Tarefas de Implementação

## Pré-requisitos

- [ ] Tabela `usuarios` disponível com colunas: `email`, `senha`, `ativo`, `is_operador`, `perfil`, `posto_graduacao`, `nome`
- [ ] Crate `bcrypt` disponível no Rust (ou equivalente)
- [ ] Mecanismo de estado de sessão definido (ex.: `tauri::State<Mutex<Option<Usuario>>>`)

## Tarefas

- [ ] T-01 — Implementar `fazer_login(email, senha)` com suporte a bcrypt
  - Origem: `main.py:183-241` (`verify_login`)
  - Critério de pronto: login com hash bcrypt funciona; retorna dict com todos os campos incluindo `is_admin`
  - Confiança: 🟢

- [ ] T-02 — Implementar detecção e upgrade de hash SHA-256 legado
  - Origem: `main.py:204-218`
  - Critério de pronto: hash que não começa com `$2` é tratado como SHA-256; se correto, re-hash para bcrypt e UPDATE no banco
  - Confiança: 🟢

- [ ] T-03 — Implementar `fazer_logout()`
  - Origem: `app/routers/auth.py` → `set_usuario_logado(None)`
  - Critério de pronto: estado de sessão volta a None/vazio
  - Confiança: 🟢

- [ ] T-04 — Implementar `obter_usuario_logado()`
  - Origem: `app/routers/auth.py`
  - Critério de pronto: retorna `{logado: false}` se não autenticado; `{logado: true, usuario: {...}}` se autenticado
  - Confiança: 🟢

- [ ] T-05 — Implementar guards `guard_login` e `guard_admin`
  - Origem: `main.py:674-686`
  - Critério de pronto: qualquer comando Tauri pode chamar o guard; retorna erro padronizado se sessão inválida ou perfil insuficiente
  - Confiança: 🟢

- [ ] T-06 — Implementar criação do admin padrão na inicialização
  - Origem: `main.py:161-173` (`create_admin_user`)
  - Critério de pronto: `admin@sistema.com` / `123456` é criado com bcrypt se não existir nenhum admin
  - Confiança: 🟢

- [ ] T-07 — Garantir que `nome_completo` é calculado no login
  - Origem: `main.py:237` — `f"{posto_graduacao} {nome}"`
  - Critério de pronto: campo `nome_completo` presente no objeto de sessão
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01 — Login com bcrypt retorna dados corretos e is_admin calculado
- [ ] TT-02 — Login com SHA-256 legado autentica e faz upgrade no banco
- [ ] TT-03 — Login com senha incorreta retorna erro sem expor hash
- [ ] TT-04 — Login de usuário inativo rejeitado
- [ ] TT-05 — Login de usuário não-operador rejeitado
- [ ] TT-06 — Logout limpa sessão; chamada subsequente retorna `{logado: false}`
- [ ] TT-07 — Guard login bloqueia comando quando sessão é None
- [ ] TT-08 — Guard admin bloqueia usuário com `perfil = "comum"`

## Ordem Sugerida

1. T-05 (guards) — bloqueia todos os outros módulos sem isso
2. T-01 (fazer_login bcrypt) — funcionalidade central
3. T-02 (upgrade SHA-256) — complementar ao T-01
4. T-03 e T-04 (logout e consulta) — simples, sem dependências
5. T-06 (admin padrão) — pode ser feito no startup do app
6. T-07 (nome_completo) — ajuste de dados, junto com T-01

## Lacunas Pendentes (🔴)

- Nenhuma lacuna bloqueante após validação do usuário.
- Credencial padrão `123456`: manter comportamento atual, sem troca obrigatória no primeiro login (`questions.md#15`).
- Definir comportamento de sessão no Tauri: `tauri::State<Mutex<Option<Usuario>>>` é o padrão recomendado, a validar na fase de arquitetura alvo.
