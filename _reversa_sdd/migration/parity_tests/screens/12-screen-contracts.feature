# language: pt
# spec-id: PT-012
# rastreabilidade:
#   process_flows: _reversa_sdd/migration/target_screens.md
#   target_architecture: UI Tauri
#   paradigma_alvo: Tauri webview modernizado com comandos tipados

Funcionalidade: Contratos de tela modernizada
  Como usuario do sistema
  Quero telas modernizadas com o mesmo comportamento funcional
  Para substituir o HTML/Eel sem perder capacidade operacional

  @paridade @tela @critico
  Esquema do Cenário: Tela implementa rota, estados e comandos declarados
    Dado a tela "<tela>" especificada em target_screens.md
    Quando a rota "<rota>" e aberta no app Tauri
    Então a tela renderiza os estados idle, loading, error e success
    E todos os comandos Tauri declarados para a tela existem
    E textos de negocio, campos e acoes funcionais da origem "<origem>" estao presentes de forma equivalente
    E acoes de escrita respeitam permissao admin quando existirem

    Exemplos:
      | tela                         | rota                                      | origem                                      |
      | Login                        | /login                                    | web/login.html                              |
      | Dashboard                    | /dashboard                                | web/dashboard.html                          |
      | ProceduresHub                | /procedimentos                            | web/procedures_hub.html                     |
      | ProcedureList                | /procedimentos/lista                      | web/procedure_list.html                     |
      | ProcedureForm                | /procedimentos/novo                       | web/procedure_form.html                     |
      | ProcedureView                | /procedimentos/:id                        | web/procedure_view.html                     |
      | TransgressaoList             | /catalogos/transgressoes                  | web/transgressao_list.html                  |
      | TransgressaoForm             | /catalogos/transgressoes/novo             | web/transgressao_form.html                  |
      | CrimeList                    | /catalogos/crimes                         | web/crime_list.html                         |
      | CrimeForm                    | /catalogos/crimes/novo                    | web/crime_form.html                         |
      | UsersHub                     | /usuarios                                 | web/users_hub.html                          |
      | UserList                     | /usuarios/lista                           | web/user_list.html                          |
      | UserForm                     | /usuarios/novo                            | web/user_form.html                          |
      | UserView                     | /usuarios/:id                             | web/user_view.html                          |
      | AuditoriaList                | /auditoria                                | web/auditoria_list.html                     |
      | EstatisticasEncarregados     | /estatisticas/encarregados                | web/estatisticas_encarregados.html          |
      | EstatisticasEncarregadosNew  | /estatisticas/encarregados/alternativa    | web/estatisticas_encarregados_new.html      |
      | EstatisticasProcessos        | /estatisticas/processos                   | web/estatisticas_processos.html             |
      | MapaMensal                   | /mapas/mensal                             | web/mapa_mensal.html                        |
      | MapasAnteriores              | /mapas/anteriores                         | web/mapas_anteriores.html                   |
      | EstatutoArt29List            | /catalogos/art29                          | web/estatuto_art29.html                     |
      | EstatutoArt29Form            | /catalogos/art29/novo                     | web/estatuto_art29_form.html                |
      | UserFormBackup               | /_legacy/usuarios/form-backup             | web/user_form_backup.html                   |
      | TransgressaoListDebug        | /_legacy/catalogos/transgressoes-debug    | web/transgressao_list_debug.html            |
      | EstatisticasEncarregadosBackup | /_legacy/estatisticas/encarregados-backup | web/estatisticas_encarregados_backup.html |
      | TestExclusao                 | /_legacy/teste-exclusao                   | web/test_exclusao.html                      |

  @paridade @tela @critico
  Cenário: Perfil comum ve telas em modo leitura
    Dado uma sessao com perfil comum
    Quando qualquer tela de CRUD ou relatorio e aberta
    Então listagens, detalhes, graficos e relatorios permitidos continuam visiveis
    E botoes de criar, editar, excluir, salvar e confirmar escrita ficam ocultos ou desabilitados

  @paridade @tela
  Cenário: Falha de comando mostra erro sem quebrar a janela
    Dado uma tela modernizada com comando Tauri declarado
    Quando o comando retorna ok igual a falso com error preenchido
    Então a tela entra no estado error
    E exibe "{{error_message}}" de forma compreensivel
    E permite nova tentativa ou retorno a uma rota segura
