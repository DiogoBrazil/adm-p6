"""Utility helpers for the application."""

import re


def validar_campos_crime(dados_crime):
    """Valida os campos do crime/contravenção conforme regras de formato.

    Normaliza valores válidos no próprio ``dados_crime`` (parágrafo, inciso, alínea)
    e retorna uma lista de mensagens de erro quando houverem inconsistências.
    """
    errors = []

    # Artigo: apenas números
    artigo = (dados_crime.get('artigo') or '').strip()
    if artigo and not re.match(r'^[0-9]+$', artigo):
        errors.append("Campo 'Artigo' deve conter apenas números")

    # Parágrafo: ordinal (1º, 2º, 3º) ou 'único'
    paragrafo = (dados_crime.get('paragrafo') or '').strip()
    if paragrafo:
        if paragrafo.lower() == 'único':
            dados_crime['paragrafo'] = 'único'
        elif re.match(r'^[0-9]+$', paragrafo):
            dados_crime['paragrafo'] = f"{paragrafo}º"
        elif re.match(r'^[0-9]+º$', paragrafo):
            dados_crime['paragrafo'] = paragrafo
        else:
            errors.append("Campo 'Parágrafo' deve estar no formato ordinal (1º, 2º, 3º) ou 'único'")

    # Inciso: números romanos maiúsculos
    inciso = (dados_crime.get('inciso') or '').strip()
    if inciso:
        if not re.match(r'^[IVXLCDM]+$', inciso):
            errors.append("Campo 'Inciso' deve conter apenas números romanos maiúsculos (I, II, III, IV...)")
        dados_crime['inciso'] = inciso.upper()

    # Alínea: uma letra minúscula
    alinea = (dados_crime.get('alinea') or '').strip()
    if alinea:
        if not re.match(r'^[a-z]$', alinea):
            errors.append("Campo 'Alínea' deve conter apenas uma letra minúscula (a, b, c...)")
        dados_crime['alinea'] = alinea.lower()

    return errors

