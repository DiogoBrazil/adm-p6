-- Migration 0032: Reestruturar a família pm_envolvido_*.
-- Antes: art29/art32/rdpm/crimes penduravam em pm_envolvido_indicios via pm_indicios_id.
-- Depois: ligam-se direto a (processo_procedimento_id, envolvido_id). art29/art32 ganham
--         analogia_art_rdpm_id. A genérica pm_envolvido_crimes é substituída por duas
--         tabelas: pm_envolvido_crimes_militares e pm_envolvido_crimes_comuns.
-- Todas as tabelas estavam vazias -> DROP+CREATE.

DROP TABLE IF EXISTS pm_envolvido_art29;
DROP TABLE IF EXISTS pm_envolvido_art32;
DROP TABLE IF EXISTS pm_envolvido_rdpm;
DROP TABLE IF EXISTS pm_envolvido_crimes;

CREATE TABLE pm_envolvido_art29 (
    id                       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    processo_procedimento_id UUID NOT NULL,
    envolvido_id             UUID NOT NULL,
    infracao_art29_id        UUID NOT NULL,
    analogia_art_rdpm_id     UUID NOT NULL,
    ativo      BOOLEAN   NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pea_proc FOREIGN KEY (processo_procedimento_id)
        REFERENCES historico_processo_procedimentos(processo_procedimento_id),
    CONSTRAINT fk_pea_envolvido FOREIGN KEY (envolvido_id) REFERENCES usuarios(id),
    CONSTRAINT fk_pea_art29 FOREIGN KEY (infracao_art29_id) REFERENCES infracoes_estatuto_art29(id),
    CONSTRAINT fk_pea_analogia FOREIGN KEY (analogia_art_rdpm_id) REFERENCES transgressoes(id)
);

CREATE TABLE pm_envolvido_art32 (
    id                       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    processo_procedimento_id UUID NOT NULL,
    envolvido_id             UUID NOT NULL,
    infracao_art32_id        UUID NOT NULL,
    analogia_art_rdpm_id     UUID NOT NULL,
    ativo      BOOLEAN   NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pe32_proc FOREIGN KEY (processo_procedimento_id)
        REFERENCES historico_processo_procedimentos(processo_procedimento_id),
    CONSTRAINT fk_pe32_envolvido FOREIGN KEY (envolvido_id) REFERENCES usuarios(id),
    CONSTRAINT fk_pe32_art32 FOREIGN KEY (infracao_art32_id) REFERENCES infracoes_estatuto_art32(id),
    CONSTRAINT fk_pe32_analogia FOREIGN KEY (analogia_art_rdpm_id) REFERENCES transgressoes(id)
);

CREATE TABLE pm_envolvido_rdpm (
    id                       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    processo_procedimento_id UUID NOT NULL,
    envolvido_id             UUID NOT NULL,
    transgressao_id          UUID NOT NULL,
    ativo      BOOLEAN   NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_per_proc FOREIGN KEY (processo_procedimento_id)
        REFERENCES historico_processo_procedimentos(processo_procedimento_id),
    CONSTRAINT fk_per_envolvido FOREIGN KEY (envolvido_id) REFERENCES usuarios(id),
    CONSTRAINT fk_per_trans FOREIGN KEY (transgressao_id) REFERENCES transgressoes(id)
);

CREATE TABLE pm_envolvido_crimes_militares (
    id                       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    processo_procedimento_id UUID NOT NULL,
    envolvido_id             UUID NOT NULL,
    crime_id                 UUID NOT NULL,
    ativo      BOOLEAN   NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pecm_proc FOREIGN KEY (processo_procedimento_id)
        REFERENCES historico_processo_procedimentos(processo_procedimento_id),
    CONSTRAINT fk_pecm_envolvido FOREIGN KEY (envolvido_id) REFERENCES usuarios(id),
    CONSTRAINT fk_pecm_crime FOREIGN KEY (crime_id) REFERENCES crimes_contravencoes(id)
);

CREATE TABLE pm_envolvido_crimes_comuns (
    id                       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    processo_procedimento_id UUID NOT NULL,
    envolvido_id             UUID NOT NULL,
    crime_id                 UUID NOT NULL,
    ativo      BOOLEAN   NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pecc_proc FOREIGN KEY (processo_procedimento_id)
        REFERENCES historico_processo_procedimentos(processo_procedimento_id),
    CONSTRAINT fk_pecc_envolvido FOREIGN KEY (envolvido_id) REFERENCES usuarios(id),
    CONSTRAINT fk_pecc_crime FOREIGN KEY (crime_id) REFERENCES crimes_contravencoes(id)
);
