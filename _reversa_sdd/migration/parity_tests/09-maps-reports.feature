# language: pt
# spec-id: PT-009
# rastreabilidade:
#   process_flows: _reversa_sdd/flowcharts/mapas.md; _reversa_sdd/flowcharts/relatorios.md
#   target_architecture: maps_reports
#   paradigma_alvo: Rust/Tauri com queries de agregacao e DTOs

Funcionalidade: Mapas, relatorios e estatisticas
  Como usuario autorizado
  Quero gerar mapas, relatorios e estatisticas
  Para manter a visao gerencial do legado

  @paridade @critico
  Cenário: Gerar mapa mensal por tipo
    Dado procedimentos instaurados, em andamento e concluidos em um mes
    Quando reports.generate_monthly_map recebe mes, ano e tipo de processo
    Então os totais e listas batem com o legado para a mesma base
    E processos concluidos no mes aparecem na categoria correta

  @paridade @critico
  Cenário: Gerar mapa mensal completo
    Dado procedimentos de tipos diferentes no mesmo mes
    Quando reports.generate_complete_monthly_map e executado
    Então o mapa agrega todos os tipos esperados
    E o resultado pode ser salvo como JSON de mapa mensal

  @paridade @critico
  Cenário: Listar, obter e excluir mapas salvos
    Dado mapas mensais salvos
    Quando reports.list_saved_maps e reports.get_saved_map sao executados
    Então metadados e dados JSON retornam equivalentes ao legado
    Quando uma sessao admin executa reports.delete_saved_map
    Então o mapa deixa de aparecer na listagem

  @paridade @critico
  Cenário: Estatisticas de processos preservam agregacoes
    Dado uma base com PAD, IPM, SR, crimes, transgressoes e solucoes
    Quando os comandos de estatisticas de processos sao executados por ano
    Então rankings, contagens e graficos retornam os mesmos agregados do legado

  @paridade
  Cenário: Relatorio anual e exportacoes sao gerados
    Dado uma base com dados do ano selecionado
    Quando reports.generate_annual_report e exportacoes CSV/Excel sao executadas
    Então arquivos sao gerados com conteudo funcionalmente equivalente
    E divergencias de renderizacao binaria nao bloqueiam se o conteudo textual e agregados baterem
