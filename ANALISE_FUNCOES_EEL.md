# Análise Completa das Funções @eel.expose no main.py

**Total de funções encontradas:** 73

## 📊 Estatísticas Gerais

| Métrica | Quantidade |
|---------|------------|
| Funções com guard_login | 5 |
| Funções com guard_admin | 1 |
| Funções que usam db_manager | 58 |

## 📂 Distribuição por Categoria

| Categoria | Quantidade |
|-----------|------------|
| processos | 22 |
| auth | 12 |
| outros | 10 |
| prazos_andamentos | 10 |
| mapas_relatorios | 8 |
| indicios | 7 |
| estatisticas | 2 |
| catalogos | 1 |
| auditorias | 1 |

## 🔍 Detalhamento das Funções por Categoria

### PROCESSOS (22 funções)

| # | Linha | Nome | Parâmetros | DB | Guard Login | Guard Admin |
|---|-------|------|------------|----|--------------|--------------| 
| 1 | 1563 | `registrar_processo` | numero, tipo_geral, tipo_detalhe, ... (+47) | ❌ | ❌ | ❌ |
| 2 | 1964 | `listar_processos` | - | ✅ | ❌ | ❌ |
| 3 | 2349 | `obter_processo` | processo_id | ✅ | ❌ | ❌ |
| 4 | 2723 | `obter_procedimento_completo` | procedimento_id | ✅ | ❌ | ❌ |
| 5 | 2830 | `obter_encarregados_procedimento` | procedimento_id | ✅ | ❌ | ❌ |
| 6 | 2919 | `obter_envolvidos_procedimento` | procedimento_id | ✅ | ❌ | ❌ |
| 7 | 2995 | `atualizar_processo` | processo_id, numero, tipo_geral, ... (+48) | ❌ | ✅ | ❌ |
| 8 | 3434 | `definir_prazo_processo` | processo_id, tipo_prazo, data_limite, ... (+2) | ❌ | ❌ | ❌ |
| 9 | 3449 | `prorrogar_prazo_processo` | prazo_id, nova_data_limite, motivo_prorrogacao, ... (+1) | ❌ | ❌ | ❌ |
| 10 | 3463 | `concluir_prazo_processo` | prazo_id, observacoes, responsavel_id | ❌ | ❌ | ❌ |
| 11 | 3476 | `listar_prazos_processo` | processo_id | ✅ | ❌ | ❌ |
| 12 | 3520 | `backfill_tipos_funcoes_processo` | - | ✅ | ❌ | ❌ |
| 13 | 3563 | `registrar_andamento_processo` | processo_id, tipo_andamento, descricao, ... (+3) | ✅ | ❌ | ❌ |
| 14 | 3579 | `listar_andamentos_processo` | processo_id | ✅ | ❌ | ❌ |
| 15 | 3634 | `atualizar_status_detalhado_processo` | processo_id, novo_status, observacoes, ... (+1) | ❌ | ❌ | ❌ |
| 16 | 3648 | `obter_status_detalhado_processo` | processo_id | ❌ | ❌ | ❌ |
| 17 | 3666 | `gerar_relatorio_processo` | processo_id | ❌ | ❌ | ❌ |
| 18 | 3795 | `calcular_prazo_por_processo` | processo_id | ✅ | ❌ | ❌ |
| 19 | 4004 | `listar_processos_com_prazos` | search_term, page, per_page, ... (+1) | ✅ | ❌ | ❌ |
| 20 | 4457 | `listar_todos_processos_com_prazos` | - | ❌ | ❌ | ❌ |
| 21 | 4558 | `obter_status_processo` | - | ✅ | ❌ | ❌ |
| 22 | 7150 | `obter_tipos_processo_para_mapa` | - | ✅ | ❌ | ❌ |

### AUTH (12 funções)

| # | Linha | Nome | Parâmetros | DB | Guard Login | Guard Admin |
|---|-------|------|------------|----|--------------|--------------| 
| 1 | 707 | `obter_usuario_por_id` | user_id, user_type | ✅ | ❌ | ❌ |
| 2 | 766 | `cadastrar_usuario` | tipo_usuario, posto_graduacao, nome, ... (+6) | ✅ | ❌ | ❌ |
| 3 | 1032 | `listar_usuarios` | search_term, page, per_page | ✅ | ❌ | ❌ |
| 4 | 1037 | `listar_todos_usuarios` | - | ✅ | ❌ | ❌ |
| 5 | 1132 | `obter_usuario_detalhado` | user_id, user_type | ❌ | ❌ | ❌ |
| 6 | 1171 | `atualizar_usuario` | user_id, user_type, tipo_usuario, ... (+8) | ✅ | ❌ | ❌ |
| 7 | 1228 | `atualizar_usuario_old` | user_id, user_type, posto_graduacao, ... (+5) | ✅ | ❌ | ❌ |
| 8 | 1254 | `delete_user` | user_id, user_type | ✅ | ❌ | ❌ |
| 9 | 4779 | `obter_estatisticas_usuario` | user_id, user_type | ✅ | ❌ | ❌ |
| 10 | 4959 | `obter_processos_usuario_responsavel` | user_id | ✅ | ❌ | ❌ |
| 11 | 4994 | `obter_processos_usuario_escrivao` | user_id | ✅ | ❌ | ❌ |
| 12 | 5029 | `obter_processos_usuario_envolvido` | user_id | ✅ | ❌ | ❌ |

### OUTROS (10 funções)

| # | Linha | Nome | Parâmetros | DB | Guard Login | Guard Admin |
|---|-------|------|------------|----|--------------|--------------| 
| 1 | 1088 | `listar_encarregados_operadores` | - | ✅ | ❌ | ❌ |
| 2 | 1259 | `verificar_admin` | - | ✅ | ❌ | ❌ |
| 3 | 1442 | `obter_ultimos_feitos_encarregado` | encarregado_id | ❌ | ❌ | ❌ |
| 4 | 1515 | `obter_anos_disponiveis` | - | ✅ | ❌ | ❌ |
| 5 | 2161 | `substituir_encarregado` | processo_id, novo_encarregado_id, justificativa | ✅ | ✅ | ❌ |
| 6 | 2267 | `obter_historico_encarregados` | processo_id | ✅ | ❌ | ❌ |
| 7 | 3485 | `adicionar_prorrogacao` | processo_id, dias_prorrogacao, numero_portaria, ... (+4) | ✅ | ❌ | ❌ |
| 8 | 4573 | `obter_opcoes_filtros` | - | ✅ | ❌ | ❌ |
| 9 | 4679 | `listar_transgressoes` | gravidade | ✅ | ❌ | ❌ |
| 10 | 4727 | `buscar_transgressoes` | termo, gravidade | ✅ | ❌ | ❌ |

### PRAZOS_ANDAMENTOS (10 funções)

| # | Linha | Nome | Parâmetros | DB | Guard Login | Guard Admin |
|---|-------|------|------------|----|--------------|--------------| 
| 1 | 3502 | `obter_prazos_vencendo` | dias_antecedencia | ✅ | ❌ | ❌ |
| 2 | 3511 | `obter_prazos_vencidos` | - | ✅ | ❌ | ❌ |
| 3 | 3657 | `obter_dashboard_prazos` | - | ❌ | ❌ | ❌ |
| 4 | 3675 | `gerar_relatorio_prazos` | filtros | ❌ | ❌ | ❌ |
| 5 | 3852 | `adicionar_andamento` | processo_id, texto, usuario_nome | ✅ | ❌ | ❌ |
| 6 | 3912 | `listar_andamentos` | processo_id | ✅ | ❌ | ❌ |
| 7 | 3953 | `remover_andamento` | processo_id, andamento_id | ✅ | ❌ | ❌ |
| 8 | 4470 | `obter_dashboard_prazos_simples` | - | ❌ | ❌ | ❌ |
| 9 | 4520 | `obter_tipos_prazo` | - | ❌ | ❌ | ❌ |
| 10 | 4536 | `obter_tipos_andamento` | - | ✅ | ❌ | ❌ |

### MAPAS_RELATORIOS (8 funções)

| # | Linha | Nome | Parâmetros | DB | Guard Login | Guard Admin |
|---|-------|------|------------|----|--------------|--------------| 
| 1 | 5740 | `gerar_mapa_mensal` | mes, ano, tipo_processo | ✅ | ❌ | ❌ |
| 2 | 5941 | `gerar_mapa_completo` | mes, ano | ✅ | ❌ | ❌ |
| 3 | 6034 | `salvar_mapa_mensal` | dados_mapa, usuario_id | ✅ | ✅ | ❌ |
| 4 | 6119 | `listar_mapas_anteriores` | - | ✅ | ❌ | ❌ |
| 5 | 6161 | `obter_dados_mapa_salvo` | mapa_id | ✅ | ✅ | ❌ |
| 6 | 6200 | `excluir_mapa_salvo` | mapa_id | ✅ | ✅ | ❌ |
| 7 | 6239 | `obter_anos_relatorio_anual` | - | ✅ | ❌ | ❌ |
| 8 | 6265 | `gerar_relatorio_anual` | ano | ✅ | ❌ | ❌ |

### INDICIOS (7 funções)

| # | Linha | Nome | Parâmetros | DB | Guard Login | Guard Admin |
|---|-------|------|------------|----|--------------|--------------| 
| 1 | 5216 | `salvar_indicios_pm_envolvido` | pm_envolvido_id, indicios_data, conn, ... (+1) | ✅ | ❌ | ❌ |
| 2 | 5345 | `carregar_indicios_pm_envolvido` | pm_envolvido_id | ✅ | ❌ | ❌ |
| 3 | 5436 | `listar_pms_envolvidos_com_indicios` | procedimento_id | ✅ | ❌ | ❌ |
| 4 | 5526 | `remover_indicios_pm_envolvido` | pm_envolvido_id | ✅ | ❌ | ❌ |
| 5 | 5556 | `buscar_crimes_para_indicios` | termo | ✅ | ❌ | ❌ |
| 6 | 5623 | `buscar_rdpm_para_indicios` | termo, gravidade | ✅ | ❌ | ❌ |
| 7 | 5676 | `buscar_art29_para_indicios` | termo | ✅ | ❌ | ❌ |

### ESTATISTICAS (2 funções)

| # | Linha | Nome | Parâmetros | DB | Guard Login | Guard Admin |
|---|-------|------|------------|----|--------------|--------------| 
| 1 | 1266 | `obter_estatisticas_encarregados` | - | ✅ | ❌ | ❌ |
| 2 | 1558 | `obter_estatisticas` | - | ✅ | ❌ | ❌ |

### CATALOGOS (1 funções)

| # | Linha | Nome | Parâmetros | DB | Guard Login | Guard Admin |
|---|-------|------|------------|----|--------------|--------------| 
| 1 | 617 | `buscar_municipios_distritos` | termo | ✅ | ❌ | ❌ |

### AUDITORIAS (1 funções)

| # | Linha | Nome | Parâmetros | DB | Guard Login | Guard Admin |
|---|-------|------|------------|----|--------------|--------------| 
| 1 | 5072 | `listar_auditorias` | search_term, page, per_page, ... (+1) | ✅ | ❌ | ✅ |
