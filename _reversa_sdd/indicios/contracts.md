# Indícios — Contratos Eel (@eel.expose)

## salvar_indicios_pm_envolvido

```
Guard: login
Entrada: pm_envolvido_id: str (UUID),
         indicios_data: {
           categorias: [str],
           crimes:  [{id: UUID}] | [],
           rdpm:    [{id: UUID}] | [],
           art29:   [{id: UUID}] | []
         },
         conn?: conexão (uso interno), cursor?: cursor (uso interno)
Saída ok:  {sucesso: true, mensagem: str}
Saída err: {sucesso: false, mensagem: str}
Efeito:    UPSERT pm_envolvido_indicios; DELETE+INSERT vínculos crimes/rdpm/art29
```

## carregar_indicios_pm_envolvido

```
Guard: login
Entrada: pm_envolvido_id: str (UUID)
Saída ok:  {sucesso: true, indicios: {
             categorias: [str],
             crimes:  [{id, descricao, ...}],
             rdpm:    [{id, descricao, gravidade}],
             art29:   [{id, inciso, texto}]
           }}
Saída err: {sucesso: false, mensagem: str}
```

## listar_pms_envolvidos_com_indicios

```
Guard: login
Entrada: procedimento_id: str (UUID)
Saída ok:  {sucesso: true, pms: [{
             pm_envolvido_id, pm_id, nome_completo, posto_graduacao,
             status_pm,
             indicios: {categorias, crimes, rdpm, art29}
           }]}
Saída err: {sucesso: false, mensagem: str}
```

## remover_indicios_pm_envolvido

```
Guard: login
Entrada: pm_envolvido_id: str (UUID)
Saída ok:  {sucesso: true, mensagem: str}
Saída err: {sucesso: false, mensagem: str}
Efeito:    DELETE vínculos crimes/rdpm/art29; pm_envolvido_indicios ativo=FALSE
```

## buscar_crimes_para_indicios

```
Guard: login
Entrada: termo: str (default '')
Saída: {sucesso: true, crimes: [{id, descricao, tipo, capitulo}]}
```

## buscar_rdpm_para_indicios

```
Guard: login
Entrada: termo: str (default ''), gravidade?: str
Saída: {sucesso: true, transgressoes: [{id, descricao, artigo, gravidade}]}
```

## buscar_art29_para_indicios

```
Guard: login
Entrada: termo: str (default '')
Saída: {sucesso: true, infracoes: [{id, inciso, texto}]}
```

## obter_categorias_indicios

```
Guard: login
Saída: {sucesso: true, categorias: [str]}
Nota: lista de categorias válidas — ex.: ["crimes_cpm", "transgressoes_rdpm",
      "transgressoes_art29", "sem_indicios"]
```

## Padrão de resposta

Todos os contratos usam `sucesso/mensagem` (pt-br).
