# ERD Completo — Gestão P6

> Gerado pelo Arquiteto em 2026-05-12
> 🟢 = confirmado no schema/código | 🟡 = inferido

---

## Diagrama ERD

```mermaid
erDiagram

    usuarios {
        TEXT id PK "UUID gerado em Python"
        TEXT tipo_usuario "CHECK: Oficial | Praça"
        TEXT posto_graduacao "CEL PM, TC PM, MAJ PM, CAP PM, 1TEN PM, 2TEN PM, ASP OF PM, ST PM, 1SGT PM, 2SGT PM, 3SGT PM, CB PM, SD PM"
        TEXT nome "UPPERCASE"
        TEXT matricula "UNIQUE NOT NULL (9 dígitos)"
        BOOLEAN is_encarregado "DEFAULT FALSE"
        BOOLEAN is_operador "DEFAULT FALSE"
        TEXT email "UNIQUE (apenas operadores)"
        TEXT senha "bcrypt hash | SHA-256 legado"
        TEXT perfil "CHECK: admin | comum | NULL"
        TIMESTAMP created_at
        TIMESTAMP updated_at
        BOOLEAN ativo "DEFAULT TRUE"
    }

    processos_procedimentos {
        TEXT id PK "UUID"
        TEXT numero "NOT NULL"
        TEXT tipo_geral "CHECK: processo | procedimento"
        TEXT tipo_detalhe "PAD|PADE|CD|CJ|SR|SV|IPM|IPPM|FP|CP|PADS"
        TEXT documento_iniciador "CHECK: Portaria | Memorando Disciplinar | Feito Preliminar"
        TEXT processo_sei "Formato XXXX.XXXXXX/AAAA-DV"
        TEXT responsavel_id FK "→ usuarios.id (NULL para PAD/CD/CJ)"
        TEXT responsavel_tipo "CHECK: usuario | NULL"
        TEXT local_origem
        TEXT local_fatos
        DATE data_instauracao
        DATE data_recebimento
        TEXT escrivao_id FK "→ usuarios.id"
        TEXT status_pm "Sindicado|Acusado|Indiciado|Investigado (TEXT livre)"
        TEXT nome_pm_id FK "→ usuarios.id (PM principal)"
        TEXT nome_vitima "JSON array (pode ser múltiplas)"
        TEXT natureza_processo "Leve|Média|Grave|Múltiplas"
        TEXT natureza_procedimento
        TEXT resumo_fatos
        TEXT numero_portaria
        TEXT numero_memorando
        TEXT numero_feito
        TEXT numero_rgf "Formato XX.XX.XXXX"
        TEXT numero_controle
        TIMESTAMP created_at
        TIMESTAMP updated_at
        BOOLEAN ativo "DEFAULT TRUE"
        BOOLEAN concluido
        DATE data_conclusao
        INTEGER infracao_id "LEGADO - não usado ativamente"
        TEXT transgressoes_ids "JSON array de IDs"
        TEXT solucao_final "TEXT livre"
        TEXT ano_instauracao
        TEXT andamentos "JSONB array de eventos"
        DATE data_remessa_encarregado
        DATE data_julgamento
        TEXT solucao_tipo "Punido|Absolvido|Arquivado (proc.) | Homologado|Avocado|Arquivado (proced.)"
        TEXT penalidade_tipo "Prisao|Detencao|Repreensao|Licenciado_Disciplina|Excluido_Disciplina|Demitido_Exoficio"
        INTEGER penalidade_dias "Apenas Prisao/Detencao"
        TEXT indicios_categorias "LEGADO TEXT - migrado para pm_envolvido_indicios.categorias_indicios"
        TEXT presidente_id FK "→ usuarios.id (PAD/PADE/CD/CJ)"
        TEXT presidente_tipo "CHECK: usuario"
        TEXT interrogante_id FK "→ usuarios.id (PAD/PADE/CD/CJ)"
        TEXT interrogante_tipo "CHECK: usuario"
        TEXT escrivao_processo_id FK "→ usuarios.id (PAD/CD/CJ)"
        TEXT escrivao_processo_tipo "CHECK: usuario"
        TEXT historico_encarregados "JSONB array de substituições"
        TEXT motorista_id FK "→ usuarios.id (sinistros de trânsito)"
        TEXT pdf_nome
        TEXT pdf_content_type
        BIGINT pdf_tamanho "bytes"
        TIMESTAMPTZ pdf_upload_em
        BYTEA pdf_arquivo "Até ~100MB"
        CONSTRAINT uq_proc_numero_doc_ano "UNIQUE(numero, documento_iniciador, ano_instauracao)"
    }

    procedimento_pms_envolvidos {
        TEXT id PK "UUID"
        TEXT procedimento_id FK "→ processos_procedimentos.id"
        TEXT pm_id FK "→ usuarios.id"
        TEXT pm_tipo
        INTEGER ordem "Ordem de cadastro"
        TEXT status_pm "Sindicado|Acusado|Indiciado|Investigado"
    }

    pm_envolvido_indicios {
        TEXT id PK "UUID"
        TEXT pm_envolvido_id FK "→ procedimento_pms_envolvidos.id"
        TEXT procedimento_id FK "→ processos_procedimentos.id"
        JSONB categorias_indicios "Array de strings"
        TEXT categoria "Primeira categoria (legado)"
        BOOLEAN ativo "DEFAULT TRUE"
    }

    pm_envolvido_crimes {
        TEXT id PK "UUID"
        TEXT pm_indicios_id FK "→ pm_envolvido_indicios.id"
        TEXT crime_id FK "→ crimes_contravencoes.id"
    }

    pm_envolvido_rdpm {
        TEXT id PK "UUID"
        TEXT pm_indicios_id FK "→ pm_envolvido_indicios.id"
        INTEGER transgressao_id FK "→ transgressoes.id"
    }

    pm_envolvido_art29 {
        TEXT id PK "UUID"
        TEXT pm_indicios_id FK "→ pm_envolvido_indicios.id"
        INTEGER art29_id FK "→ infracoes_estatuto_art29.id (ainda SERIAL neste FK)"
    }

    crimes_contravencoes {
        TEXT id PK "UUID"
        TEXT tipo "Crime | Contravenção"
        TEXT dispositivo_legal "Código Penal Militar | ..."
        TEXT artigo "apenas dígitos"
        TEXT descricao_artigo
        TEXT paragrafo "ordinal: 1º, 2º, único"
        TEXT inciso "romanos MAIÚSCULOS"
        TEXT alinea "letra minúscula"
        BOOLEAN ativo "DEFAULT TRUE (soft delete)"
    }

    transgressoes {
        SERIAL id PK "INTEGER auto-increment"
        INTEGER artigo
        TEXT gravidade "Leve | Média | Grave"
        TEXT inciso
        TEXT texto
        BOOLEAN ativo
        TIMESTAMP created_at
    }

    infracoes_estatuto_art29 {
        TEXT id PK "UUID (migrado de SERIAL)"
        TEXT inciso "UNIQUE ativo (case-insensitive)"
        TEXT texto
        BOOLEAN ativo "DEFAULT TRUE (soft delete)"
    }

    municipios_distritos {
        TEXT id PK "UUID"
        TEXT nome
        TEXT tipo "Município | Distrito"
        TEXT municipio_pai "FK lógica → municipios_distritos.nome (não FK real)"
        BOOLEAN ativo "DEFAULT TRUE"
    }

    prazos_processo {
        TEXT id PK "UUID"
        TEXT processo_id FK "→ processos_procedimentos.id"
        TEXT tipo_prazo
        DATE data_inicio
        DATE data_vencimento
        INTEGER dias_adicionados
        TEXT motivo
        TEXT autorizado_por FK "→ usuarios.id (lógica)"
        TEXT autorizado_tipo
        BOOLEAN ativo "DEFAULT TRUE"
        TEXT numero_portaria
        DATE data_portaria
        INTEGER ordem_prorrogacao
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    mapas_salvos {
        TEXT id PK "UUID"
        TEXT titulo
        TEXT tipo_processo "SR|SV|IPM|...|COMPLETO"
        DATE periodo_inicio
        DATE periodo_fim
        TEXT periodo_descricao
        INTEGER total_processos
        INTEGER total_concluidos
        INTEGER total_andamento
        TEXT usuario_id FK "→ usuarios.id (lógica)"
        TEXT usuario_nome
        TEXT dados_mapa "JSONB com dados completos"
        TEXT nome_arquivo
        TIMESTAMP data_geracao
        BOOLEAN ativo "DEFAULT TRUE"
    }

    auditoria {
        TEXT id PK "UUID"
        TEXT tabela "processos_procedimentos | usuarios | crimes_contravencoes | transgressoes"
        TEXT registro_id "ID do registro afetado"
        TEXT operacao "CREATE | UPDATE | DELETE"
        TEXT usuario_id FK "→ usuarios.id (lógica, pode ser NULL)"
        TIMESTAMP timestamp
    }

    %% TABELAS LEGADAS (uso incerto) 🟡
    procedimentos_indicios_crimes {
        TEXT id PK
        TEXT procedimento_id FK
        TEXT crime_id FK
        TIMESTAMP created_at
    }
    procedimentos_indicios_rdpm {
        TEXT id PK
        TEXT procedimento_id FK
        INTEGER transgressao_id FK
        TIMESTAMP created_at
    }
    procedimentos_indicios_art29 {
        TEXT id PK
        TEXT procedimento_id FK
        INTEGER art29_id FK
        TIMESTAMP created_at
    }

    %% Relacionamentos
    usuarios ||--o{ processos_procedimentos : "responsavel_id"
    usuarios ||--o{ processos_procedimentos : "escrivao_id"
    usuarios ||--o{ processos_procedimentos : "presidente_id"
    usuarios ||--o{ processos_procedimentos : "nome_pm_id"
    processos_procedimentos ||--o{ procedimento_pms_envolvidos : "procedimento_id"
    usuarios ||--o{ procedimento_pms_envolvidos : "pm_id"
    procedimento_pms_envolvidos ||--o| pm_envolvido_indicios : "pm_envolvido_id"
    pm_envolvido_indicios ||--o{ pm_envolvido_crimes : "pm_indicios_id"
    pm_envolvido_indicios ||--o{ pm_envolvido_rdpm : "pm_indicios_id"
    pm_envolvido_indicios ||--o{ pm_envolvido_art29 : "pm_indicios_id"
    crimes_contravencoes ||--o{ pm_envolvido_crimes : "crime_id"
    transgressoes ||--o{ pm_envolvido_rdpm : "transgressao_id"
    infracoes_estatuto_art29 ||--o{ pm_envolvido_art29 : "art29_id"
    processos_procedimentos ||--o{ prazos_processo : "processo_id"
```

---

## Observações sobre o Schema

| Observação | Confiança |
|-----------|-----------|
| FKs são lógicas (não declaradas como FOREIGN KEY no DDL) — sem CASCADE | 🟢 CONFIRMADO |
| `transgressoes.id` é SERIAL; todas as outras entidades principais usam UUID (TEXT) | 🟢 CONFIRMADO |
| `infracoes_estatuto_art29.id` foi migrado de SERIAL para UUID (migration commit `76cb813`) | 🟢 CONFIRMADO |
| `processos_procedimentos.andamentos` e `historico_encarregados` são TEXT/JSONB inline | 🟢 CONFIRMADO |
| Tabelas `procedimentos_indicios_*` existem e devem ser incluídas na migração Rust/Tauri, apesar de não haver uso ativo confirmado no código Python analisado | 🟢 CONFIRMADO pelo usuário (`questions.md#5`) |
| `municipios_distritos.municipio_pai` é uma FK lógica por nome, não por ID | 🟢 CONFIRMADO |
| Não há índices explícitos além dos criados em `0004_add_indexes.py` | 🟢 CONFIRMADO |
