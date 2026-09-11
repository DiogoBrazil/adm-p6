-- =============================================================================
-- Aviso por e-mail ao encarregado do apuratório.
--
-- Três peças: onde o militar recebe, o que se manda, e por onde se manda.
--
-- POR QUE A CREDENCIAL SMTP MORA NO BANCO
--
-- A conexão do banco vive no cofre do sistema operacional de cada máquina
-- (`database_config.rs`), e o instalador não embute credencial nenhuma — é a
-- decisão do README §8. Repetir esse caminho para o SMTP obrigaria configurar a
-- senha do Gmail em CADA PC da seção, à mão, e quem esquecesse descobriria só na
-- hora de disparar. A configuração de e-mail é da SEÇÃO, não da máquina: uma
-- linha no banco serve todas.
--
-- O preço, declarado: a App Password entra nos backups. Eles já carregam os
-- dados pessoais de 235 militares e já ficam fora do git (`.gitignore` cobre
-- `*.dump`), então o acréscimo é marginal — mas é acréscimo, e quem girar a
-- senha do Gmail precisa lembrar de trocá-la aqui.
-- =============================================================================

-- ------------------------------------------- 1. onde o militar recebe aviso --
-- Opcional de propósito: nem todo militar designável tem e-mail cadastrado, e
-- exigir um travaria o cadastro por um dado que não é do negócio.
--
-- Isto NÃO duplica `usuarios.email`. Aquele é credencial de acesso e é
-- obrigatório; este é endereço de notificação e não. Quem tem os dois em branco
-- não recebe aviso, e o disparo diz isso. A resolução na hora do envio é
-- `COALESCE(pm.email, u.email)` — quem já tem conta não digita o mesmo endereço
-- duas vezes, que seria duas cópias do mesmo dado livres para divergir
-- (princípio 4).
ALTER TABLE policiais_militares ADD COLUMN email TEXT NULL;

COMMENT ON COLUMN policiais_militares.email IS
    'Endereço para aviso de designação e prazo. Opcional. Na falta dele vale o e-mail da conta de acesso, se houver.';

-- --------------------------------------------------- 2. o que se manda ------
-- Catálogo administrável, como todo conceito de negócio (princípio 1). O texto
-- nasce semeado abaixo e o administrador edita pela tela quando quiser.
--
-- `codigo` é o que o CÓDIGO lê, e é por isso que ele existe: `nome` é
-- apresentação e o administrador pode renomeá-lo a qualquer momento
-- (princípio 2). Mesmo desenho de `apuratorios.codigo_extensao`.
CREATE TABLE mensagens_email (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo     TEXT        NOT NULL,
    nome       TEXT        NOT NULL,
    assunto    TEXT        NOT NULL,
    corpo      TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_mensagem_email_codigo
        CHECK (codigo IN ('designacao', 'prazo_vencendo', 'prazo_vencido')),
    CONSTRAINT ck_mensagem_email_nome    CHECK (btrim(nome) <> ''),
    CONSTRAINT ck_mensagem_email_assunto CHECK (btrim(assunto) <> ''),
    CONSTRAINT ck_mensagem_email_corpo   CHECK (btrim(corpo) <> '')
);

CREATE UNIQUE INDEX uq_mensagens_email_nome ON mensagens_email (lower(nome));

-- Uma mensagem VIGENTE por tipo. Parcial `WHERE ativo` porque catálogo em uso se
-- desativa, não se apaga (princípio 6): as versões antigas continuam na tabela,
-- inativas, e só uma responde pelo código.
--
-- Índice parcial não se adia. Se um dia a tela precisar permutar qual das duas
-- está ativa dentro de uma transação, isto vira `EXCLUDE ... DEFERRABLE` — hoje
-- a troca é um UPDATE de cada vez e a colisão não acontece.
CREATE UNIQUE INDEX uq_mensagem_email_codigo_ativa
    ON mensagens_email (codigo) WHERE ativo;

COMMENT ON TABLE mensagens_email IS
    'Textos dos avisos ao encarregado. `codigo` é o que o código lê; `nome` é apresentação.';

-- --------------------------------------------------- 3. por onde se manda ---
-- Linha única: a seção tem um remetente. O `CHECK (id = 1)` é o que impede uma
-- segunda linha aparecer e o envio passar a depender de qual delas foi lida.
CREATE TABLE configuracao_email (
    id         INTEGER     PRIMARY KEY,
    host       TEXT        NOT NULL,
    porta      INTEGER     NOT NULL,
    usuario    TEXT        NOT NULL,
    senha      TEXT        NOT NULL,
    remetente  TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_config_email_linha_unica CHECK (id = 1),
    CONSTRAINT ck_config_email_porta       CHECK (porta > 0 AND porta <= 65535),
    CONSTRAINT ck_config_email_host        CHECK (btrim(host) <> ''),
    CONSTRAINT ck_config_email_usuario     CHECK (btrim(usuario) <> ''),
    CONSTRAINT ck_config_email_senha       CHECK (btrim(senha) <> ''),
    CONSTRAINT ck_config_email_remetente   CHECK (btrim(remetente) <> '')
);

COMMENT ON TABLE configuracao_email IS
    'Servidor de envio, uma linha só. A senha nunca volta para a interface — ver email/commands.rs.';

-- --------------------------------------------------- 4. os três textos ------
-- Semeados aqui, e aqui é legítimo: quem INSERE estas linhas é a migration, não
-- a importação. A armadilha das decisões 64 e 31 — semear por migration o que a
-- etapa `importacao/01_catalogos.sql` insere depois — não se aplica, porque
-- `importacao/` não conhece esta tabela.
--
-- Os marcadores entre chaves são substituídos no envio por
-- `email/domain.rs::montar_corpo`. Marcador que ela não conhece fica literal, e
-- quem o denuncia é a prévia, antes de o e-mail sair.
INSERT INTO mensagens_email (codigo, nome, assunto, corpo) VALUES
('designacao',
 'Aviso de designação como encarregado',
 'Designação como encarregado — {apuratorio} {numero_documento}',
 E'{encarregado},\n\n'
 'Comunico que V. Sa. foi designado(a) como encarregado(a) do apuratório abaixo:\n\n'
 '  Apuratório: {apuratorio}\n'
 '  Documento: {numero_documento}\n'
 '  Unidade de origem: {unidade}\n'
 '  Data de instauração: {data_instauracao}\n'
 '  Prazo de vencimento: {prazo_vencimento}\n\n'
 'Solicito o comparecimento à Seção de Justiça e Disciplina do 7º BPM, no dia '
 'útil mais próximo, no horário de 7h30min às 13h30min, para esclarecimentos '
 'adicionais.\n\n'
 'Atenciosamente,\nSeção de Justiça e Disciplina — 7º BPM/PMRO'),

('prazo_vencendo',
 'Aviso de prazo próximo do vencimento',
 'Prazo próximo do vencimento — {apuratorio} {numero_documento}',
 E'{encarregado},\n\n'
 'Comunico que o prazo do apuratório sob sua responsabilidade está próximo do '
 'vencimento:\n\n'
 '  Apuratório: {apuratorio}\n'
 '  Documento: {numero_documento}\n'
 '  Unidade de origem: {unidade}\n'
 '  Data de instauração: {data_instauracao}\n'
 '  Prazo de vencimento: {prazo_vencimento}\n\n'
 'Havendo causa justificável, solicito que confeccione a devida solicitação de '
 'prorrogação de prazo.\n\n'
 'Para esclarecimentos adicionais, procure a Seção de Justiça e Disciplina do '
 '7º BPM, no horário de 7h30min às 13h30min.\n\n'
 'Atenciosamente,\nSeção de Justiça e Disciplina — 7º BPM/PMRO'),

('prazo_vencido',
 'Aviso de prazo vencido',
 'Prazo VENCIDO — {apuratorio} {numero_documento}',
 E'{encarregado},\n\n'
 'Comunico que o prazo do apuratório sob sua responsabilidade encontra-se '
 'VENCIDO:\n\n'
 '  Apuratório: {apuratorio}\n'
 '  Documento: {numero_documento}\n'
 '  Unidade de origem: {unidade}\n'
 '  Data de instauração: {data_instauracao}\n'
 '  Prazo de vencimento: {prazo_vencimento}\n\n'
 'Havendo causa justificável, solicito que confeccione com URGÊNCIA a devida '
 'solicitação de prorrogação de prazo.\n\n'
 'Em caso de dúvidas, compareça à Seção de Justiça e Disciplina do 7º BPM, no '
 'horário de 7h30min às 13h30min.\n\n'
 'Atenciosamente,\nSeção de Justiça e Disciplina — 7º BPM/PMRO');
