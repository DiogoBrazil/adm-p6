-- Migração 010: Infrações do Art. 29 do Decreto Lei 09-A
-- Cria tabela para armazenar os incisos do artigo 29 e permite analogias com RDPM

-- Criar tabela para os incisos do Art. 29
CREATE TABLE IF NOT EXISTS infracoes_estatuto_art29 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inciso TEXT NOT NULL, -- I, II, III, etc.
    texto TEXT NOT NULL, -- Texto completo do inciso
    ativo BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela para armazenar as analogias entre Art. 29 e RDPM
CREATE TABLE IF NOT EXISTS analogias_estatuto_rdpm (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    art29_id INTEGER NOT NULL, -- FK para infracoes_estatuto_art29
    rdpm_id INTEGER NOT NULL, -- FK para transgressoes (RDPM)
    usuario_id INTEGER, -- Quem criou a analogia (opcional)
    observacoes TEXT, -- Justificativa da analogia (opcional)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (art29_id) REFERENCES infracoes_estatuto_art29(id),
    FOREIGN KEY (rdpm_id) REFERENCES transgressoes(id)
);

-- Popular tabela com incisos do Art. 29
INSERT INTO infracoes_estatuto_art29 (inciso, texto) VALUES 
('I', 'amar a verdade e a responsabilidade como fundamentos da dignidade pessoal'),
('II', 'exercer, com autoridade, eficiência e probidade, as funções que lhe couberem em decorrência do cargo'),
('III', 'respeitar a dignidade da pessoa humana'),
('IV', 'cumprir e fazer cumprir as leis, os regulamentos, as instruções e as ordens das autoridades competentes'),
('V', 'ser justo e imparcial, nos julgamentos dos atos e na apreciação do mérito dos subordinados'),
('VI', 'zelar pelo preparo próprio, moral, intelectual e físico, e, também, pelo dos subordinados, tendo em vista o cumprimento da missão comum'),
('VII', 'empregar todas as suas energias em benefício do serviço'),
('VIII', 'praticar a camaradagem e desenvolver, permanentemente, o espírito de cooperação'),
('IX', 'ser discreto em suas atitudes e maneiras, e em sua linguagem escrita e falada'),
('X', 'abster-se de tratar, fora do âmbito apropriado, de matéria relativa à Segurança Nacional, seja de caráter sigiloso ou não'),
('XI', 'acatar as autoridades constituídas'),
('XII', 'cumprir seus deveres de cidadão'),
('XIII', 'proceder de maneira ilibada na vida pública e particular'),
('XIV', 'observar as normas de boa educação'),
('XV', 'garantir assistência moral e material ao seu lar e conduzir-se como chefe de família modelar'),
('XVI', 'conduzir-se, mesmo fora do serviço, ou na inatividade, de modo que não sejam prejudicados os princípios da disciplina, do respeito e do decoro policial-militar'),
('XVII', 'abster-se de fazer uso do posto, ou graduação, para obter facilidades pessoais de qualquer natureza, ou para encaminhar negócios particulares ou de terceiros'),
('XVIII', 'abster-se o Militar do Estado, na inatividade, do uso das designações hierárquicas quando: a) em atividade político-partidária; b) em atividades comerciais; c) em atividades industriais; d) para discutir ou provocar discussões pela imprensa a respeito de assuntos políticos ou policiais-militares, excetuando-se as de natureza exclusivamente técnica, se devidamente autorizado; e) no exercício de funções de natureza não Militar do Estado, mesmo oficiais'),
('XIX', 'zelar pelo bom nome da Polícia Militar e de cada um dos seus integrantes, obedecendo e fazendo obedecer aos preceitos da ética policial-militar');

-- Atualizar formato JSON das transgressões para incluir tipo (rdpm/estatuto) e analogia se necessário
-- Novo formato: [{"id": "4", "natureza": "leve", "tipo": "rdpm"}, {"id": "15", "tipo": "estatuto", "rdpm_analogia": {"id": "20", "natureza": "media"}}]
-- Para transgressões do RDPM: tipo="rdpm", natureza é a gravidade
-- Para transgressões do Art.29: tipo="estatuto", rdpm_analogia contém a analogia escolhida
