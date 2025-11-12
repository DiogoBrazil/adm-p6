"""
Serviço de gestão de indícios de PMs envolvidos em procedimentos.

Este módulo contém funções para salvar, carregar, listar e remover
indícios (categorias, crimes, transgressões RDPM e infrações Art.29)
associados a policiais militares envolvidos em procedimentos disciplinares.
"""

import json
import uuid
import traceback
import psycopg2.extras


def salvar_indicios_pm_envolvido(db_manager, pm_envolvido_id, indicios_data, conn=None, cursor=None):
    """
    Salva os indícios específicos de um PM envolvido em um procedimento.

    Esta função gerencia a persistência de todos os tipos de indícios associados
    a um PM: categorias, crimes/contravenções, transgressões RDPM e infrações Art.29.

    Args:
        db_manager: Gerenciador de conexões com banco de dados
        pm_envolvido_id (str): ID do PM na tabela procedimento_pms_envolvidos
        indicios_data (dict): Dados dos indícios com estrutura:
            {
                'categorias': ['categoria1', 'categoria2'],
                'crimes': [{'id': 'crime_id1'}, {'id': 'crime_id2'}],
                'rdpm': [{'id': 'trans_id1'}, {'id': 'trans_id2'}],
                'art29': [{'id': 'art29_id1'}, {'id': 'art29_id2'}]
            }
        conn: Conexão com o banco (opcional, cria uma nova se não fornecida)
        cursor: Cursor do banco (opcional, cria um novo se não fornecido)

    Returns:
        dict: Resultado da operação com estrutura:
            {
                'sucesso': bool,
                'mensagem': str
            }
    """
    try:
        print("="*80)
        print("FUNÇÃO salvar_indicios_pm_envolvido CHAMADA!")
        print("="*80)
        print(f"PM Envolvido ID: {pm_envolvido_id}")
        print(f"Tipo dos dados recebidos: {type(indicios_data)}")
        print(f"Dados recebidos completos:")
        print(json.dumps(indicios_data, indent=2, ensure_ascii=False))

        # Usar conexão fornecida ou criar nova
        fechar_conexao = False
        if conn is None:
            conn = db_manager.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            fechar_conexao = True
        elif cursor is None:
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Verificar se o PM envolvido existe
        cursor.execute("SELECT procedimento_id FROM procedimento_pms_envolvidos WHERE id = %s", (pm_envolvido_id,))
        pm_data = cursor.fetchone()
        if not pm_data:
            conn.close()
            return {"sucesso": False, "mensagem": "PM envolvido não encontrado"}

        procedimento_id = pm_data['procedimento_id']
        print(f"Procedimento ID: {procedimento_id}")

        # Buscar ID do registro de indícios existente (se houver)
        cursor.execute("SELECT id FROM pm_envolvido_indicios WHERE pm_envolvido_id = %s AND ativo = TRUE", (pm_envolvido_id,))
        indicios_registro = cursor.fetchone()

        if indicios_registro:
            # Atualizar registro existente
            pm_indicios_id = indicios_registro['id']
            print(f"Atualizando registro de indícios existente: {pm_indicios_id}")
            print(f"Removendo vínculos antigos...")

            # Limpar apenas os vínculos de crimes/rdpm/art29
            cursor.execute("DELETE FROM pm_envolvido_crimes WHERE pm_indicios_id = %s", (pm_indicios_id,))
            cursor.execute("DELETE FROM pm_envolvido_rdpm WHERE pm_indicios_id = %s", (pm_indicios_id,))
            cursor.execute("DELETE FROM pm_envolvido_art29 WHERE pm_indicios_id = %s", (pm_indicios_id,))
        else:
            # Criar novo registro de indícios
            pm_indicios_id = str(uuid.uuid4())
            print(f"Criando novo registro de indícios: {pm_indicios_id}")

            cursor.execute("""
                INSERT INTO pm_envolvido_indicios (id, pm_envolvido_id, procedimento_id, categorias_indicios, categoria, ativo)
                VALUES (%s, %s, %s, '[]', '', TRUE)
            """, (pm_indicios_id, pm_envolvido_id, procedimento_id))

        # Atualizar categorias no registro principal
        categorias = indicios_data.get('categorias', [])
        categorias_json = json.dumps(categorias, ensure_ascii=False)
        primeira_categoria = categorias[0] if categorias else ''

        cursor.execute("""
            UPDATE pm_envolvido_indicios
            SET categorias_indicios = %s, categoria = %s
            WHERE id = %s
        """, (categorias_json, primeira_categoria, pm_indicios_id))

        # Salvar crimes/contravenções
        crimes = indicios_data.get('crimes', [])
        print(f"Crimes recebidos ({len(crimes)}): {crimes}")
        for crime in crimes:
            crime_id = crime.get('id') if isinstance(crime, dict) else crime
            print(f"  - Inserindo crime ID: {crime_id}")
            cursor.execute("""
                INSERT INTO pm_envolvido_crimes (id, pm_indicios_id, crime_id)
                VALUES (%s, %s, %s)
            """, (str(uuid.uuid4()), pm_indicios_id, crime_id))

        # Salvar transgressões RDPM
        rdpm = indicios_data.get('rdpm', [])
        print(f"RDPM recebidas ({len(rdpm)}): {rdpm}")
        for trans in rdpm:
            trans_id = trans.get('id') if isinstance(trans, dict) else trans
            print(f"  - Inserindo RDPM ID: {trans_id}")
            cursor.execute("""
                INSERT INTO pm_envolvido_rdpm (id, pm_indicios_id, transgressao_id)
                VALUES (%s, %s, %s)
            """, (str(uuid.uuid4()), pm_indicios_id, trans_id))

        # Salvar infrações Art. 29
        art29 = indicios_data.get('art29', [])
        print(f"Art.29 recebidas ({len(art29)}): {art29}")
        for infracao in art29:
            art29_id = infracao.get('id') if isinstance(infracao, dict) else infracao
            print(f"  - Inserindo Art.29 ID: {art29_id}")
            cursor.execute("""
                INSERT INTO pm_envolvido_art29 (id, pm_indicios_id, art29_id)
                VALUES (%s, %s, %s)
            """, (str(uuid.uuid4()), pm_indicios_id, art29_id))

        # Só fazer commit e fechar se criamos a conexão localmente
        if fechar_conexao:
            conn.commit()
            conn.close()

        print(f"Indícios salvos: {len(categorias)} categorias, {len(crimes)} crimes, {len(rdpm)} RDPM, {len(art29)} Art.29")
        return {"sucesso": True, "mensagem": "Indícios salvos com sucesso"}

    except Exception as e:
        print(f"Erro ao salvar indícios do PM: {e}")
        traceback.print_exc()
        return {"sucesso": False, "mensagem": f"Erro ao salvar indícios: {str(e)}"}


def carregar_indicios_pm_envolvido(db_manager, pm_envolvido_id):
    """
    Carrega os indícios específicos de um PM envolvido em um procedimento.

    Retorna todos os indícios cadastrados para o PM especificado, incluindo
    categorias, crimes/contravenções, transgressões RDPM e infrações Art.29,
    com seus respectivos detalhes completos.

    Args:
        db_manager: Gerenciador de conexões com banco de dados
        pm_envolvido_id (str): ID do PM na tabela procedimento_pms_envolvidos

    Returns:
        dict: Resultado da operação com estrutura:
            {
                'sucesso': bool,
                'indicios': {
                    'categorias': list,
                    'crimes': list[dict],
                    'rdpm': list[dict],
                    'art29': list[dict]
                },
                'mensagem': str (apenas em caso de erro)
            }
    """
    try:
        print(f"Carregando indícios para PM envolvido: {pm_envolvido_id}")

        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        indicios = {
            'categorias': [],
            'crimes': [],
            'rdpm': [],
            'art29': []
        }

        # Carregar categorias
        cursor.execute("SELECT categoria FROM pm_envolvido_indicios WHERE pm_envolvido_id = %s", (pm_envolvido_id,))
        indicios['categorias'] = [row['categoria'] for row in cursor.fetchall() if row['categoria']]

        # Carregar crimes/contravenções com detalhes
        cursor.execute("""
            SELECT c.id, c.tipo, c.dispositivo_legal, c.artigo, c.descricao_artigo,
                   c.paragrafo, c.inciso, c.alinea
            FROM pm_envolvido_crimes pec
            JOIN crimes_contravencoes c ON c.id = pec.crime_id
            WHERE pec.pm_envolvido_id = %s
        """, (pm_envolvido_id,))

        for row in cursor.fetchall():
            indicios['crimes'].append({
                'id': row['id'],
                'tipo': row['tipo'],
                'dispositivo_legal': row['dispositivo_legal'],
                'artigo': row['artigo'],
                'descricao_artigo': row['descricao_artigo'],
                'paragrafo': row['paragrafo'] or '',
                'inciso': row['inciso'] or '',
                'alinea': row['alinea'] or ''
            })

        # Carregar transgressões RDPM com detalhes
        cursor.execute("""
            SELECT t.id, t.artigo, t.gravidade, t.inciso, t.texto, per.natureza
            FROM pm_envolvido_rdpm per
            JOIN transgressoes t ON t.id = per.transgressao_id
            WHERE per.pm_envolvido_id = %s
        """, (pm_envolvido_id,))

        for row in cursor.fetchall():
            indicios['rdpm'].append({
                'id': row['id'],
                'artigo': row['artigo'],
                'gravidade': row['gravidade'],
                'inciso': row['inciso'],
                'texto': row['texto'],
                'natureza': row.get('natureza', row['gravidade'])
            })

        # Carregar infrações Art. 29 com detalhes
        cursor.execute("""
            SELECT a.id, a.inciso, a.texto
            FROM pm_envolvido_art29 pea
            JOIN infracoes_estatuto_art29 a ON a.id = pea.art29_id
            WHERE pea.pm_envolvido_id = %s
        """, (pm_envolvido_id,))

        for row in cursor.fetchall():
            indicios['art29'].append({
                'id': row['id'],
                'inciso': row['inciso'],
                'texto': row['texto']
            })

        conn.close()

        print(f"Indícios carregados: {len(indicios['categorias'])} categorias, {len(indicios['crimes'])} crimes, {len(indicios['rdpm'])} RDPM, {len(indicios['art29'])} Art.29")
        return {"sucesso": True, "indicios": indicios}

    except Exception as e:
        print(f"Erro ao carregar indícios do PM: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao carregar indícios: {str(e)}"}


def listar_pms_envolvidos_com_indicios(db_manager, procedimento_id):
    """
    Lista todos os PMs envolvidos em um procedimento com seus indícios.

    Retorna uma lista completa de todos os policiais militares envolvidos no
    procedimento especificado, incluindo dados pessoais e um resumo quantitativo
    dos indícios cadastrados para cada um.

    Args:
        db_manager: Gerenciador de conexões com banco de dados
        procedimento_id (str): ID do procedimento

    Returns:
        dict: Resultado da operação com estrutura:
            {
                'sucesso': bool,
                'pms_envolvidos': list[dict],
                'mensagem': str (apenas em caso de erro)
            }

            Cada item em 'pms_envolvidos' contém:
            - Dados do PM (id, nome, posto, matrícula, etc.)
            - resumo_indicios: contadores de categorias, crimes, rdpm, art29
    """
    try:
        print(f"Listando PMs envolvidos com indícios para procedimento: {procedimento_id}")

        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Buscar PMs envolvidos
        cursor.execute("""
            SELECT pme.id, pme.pm_id, pme.pm_tipo, pme.ordem, pme.status_pm,
                   COALESCE(u.nome, '') as nome,
                   COALESCE(u.posto_graduacao, '') as posto,
                   COALESCE(u.matricula, '') as matricula
            FROM procedimento_pms_envolvidos pme
            LEFT JOIN usuarios u ON pme.pm_id = u.id
            WHERE pme.procedimento_id = %s
            ORDER BY pme.ordem
        """, (procedimento_id,))

        pms_envolvidos = []
        for row in cursor.fetchall():
            pm_envolvido_id, pm_id, pm_tipo, ordem, status_pm, nome, posto, matricula = row

            # Montar nome completo
            nome_completo = f"{posto} {matricula} {nome}".strip()

            # Carregar resumo dos indícios
            cursor.execute("SELECT COUNT(*) FROM pm_envolvido_indicios WHERE pm_envolvido_id = %s", (pm_envolvido_id,))
            total_categorias = cursor.fetchone()['count']

            # Para crimes, rdpm e art29, precisamos buscar via pm_indicios_id
            cursor.execute("""
                SELECT COUNT(*) FROM pm_envolvido_crimes pec
                JOIN pm_envolvido_indicios pei ON pec.pm_indicios_id = pei.id
                WHERE pei.pm_envolvido_id = %s
            """, (pm_envolvido_id,))
            total_crimes = cursor.fetchone()['count']

            cursor.execute("""
                SELECT COUNT(*) FROM pm_envolvido_rdpm per
                JOIN pm_envolvido_indicios pei ON per.pm_indicios_id = pei.id
                WHERE pei.pm_envolvido_id = %s
            """, (pm_envolvido_id,))
            total_rdpm = cursor.fetchone()['count']

            cursor.execute("""
                SELECT COUNT(*) FROM pm_envolvido_art29 pea
                JOIN pm_envolvido_indicios pei ON pea.pm_indicios_id = pei.id
                WHERE pei.pm_envolvido_id = %s
            """, (pm_envolvido_id,))
            total_art29 = cursor.fetchone()['count']

            pms_envolvidos.append({
                'pm_envolvido_id': pm_envolvido_id,
                'pm_id': pm_id,
                'pm_tipo': pm_tipo,
                'ordem': ordem,
                'status_pm': status_pm,
                'nome': nome,
                'posto_graduacao': posto,
                'matricula': matricula,
                'nome_completo': nome_completo,
                'resumo_indicios': {
                    'categorias': total_categorias,
                    'crimes': total_crimes,
                    'rdpm': total_rdpm,
                    'art29': total_art29,
                    'total': total_categorias + total_crimes + total_rdpm + total_art29
                }
            })

        conn.close()

        print(f"{len(pms_envolvidos)} PMs envolvidos encontrados")
        return {"sucesso": True, "pms_envolvidos": pms_envolvidos}

    except Exception as e:
        print(f"Erro ao listar PMs envolvidos: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao listar PMs envolvidos: {str(e)}"}


def remover_indicios_pm_envolvido(db_manager, pm_envolvido_id):
    """
    Remove todos os indícios de um PM envolvido em um procedimento.

    Esta função realiza a exclusão completa de todos os registros de indícios
    (categorias, crimes, transgressões RDPM e infrações Art.29) associados ao
    PM especificado.

    Args:
        db_manager: Gerenciador de conexões com banco de dados
        pm_envolvido_id (str): ID do PM na tabela procedimento_pms_envolvidos

    Returns:
        dict: Resultado da operação com estrutura:
            {
                'sucesso': bool,
                'mensagem': str
            }
    """
    try:
        print(f"Removendo indícios do PM envolvido: {pm_envolvido_id}")

        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Remover todos os indícios
        cursor.execute("DELETE FROM pm_envolvido_indicios WHERE pm_envolvido_id = %s", (pm_envolvido_id,))
        cursor.execute("DELETE FROM pm_envolvido_crimes WHERE pm_envolvido_id = %s", (pm_envolvido_id,))
        cursor.execute("DELETE FROM pm_envolvido_rdpm WHERE pm_envolvido_id = %s", (pm_envolvido_id,))
        cursor.execute("DELETE FROM pm_envolvido_art29 WHERE pm_envolvido_id = %s", (pm_envolvido_id,))

        conn.commit()
        conn.close()

        print(f"Indícios removidos para PM envolvido: {pm_envolvido_id}")
        return {"sucesso": True, "mensagem": "Indícios removidos com sucesso"}

    except Exception as e:
        print(f"Erro ao remover indícios do PM: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao remover indícios: {str(e)}"}


def buscar_crimes_para_indicios(db_manager, termo=''):
    """
    Busca crimes e contravenções para seleção de indícios.

    Realiza busca no catálogo de crimes/contravenções, permitindo filtrar
    por termo de pesquisa nos campos: artigo, descrição e dispositivo legal.

    Args:
        db_manager: Gerenciador de conexões com banco de dados
        termo (str, optional): Termo de busca para filtrar resultados. Padrão: ''

    Returns:
        dict: Resultado da operação com estrutura:
            {
                'sucesso': bool,
                'crimes': list[dict],
                'mensagem': str (apenas em caso de erro)
            }

            Cada crime inclui: id, tipo, dispositivo_legal, artigo,
            descricao_artigo, paragrafo, inciso, alinea, texto_completo
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        if termo:
            cursor.execute("""
                SELECT id, tipo, dispositivo_legal, artigo, descricao_artigo,
                       paragrafo, inciso, alinea
                FROM crimes_contravencoes
                WHERE ativo = TRUE
                AND (artigo ILIKE %s OR descricao_artigo ILIKE %s OR dispositivo_legal ILIKE %s)
                ORDER BY tipo, dispositivo_legal, artigo
                LIMIT 50
            """, (f'%{termo}%', f'%{termo}%', f'%{termo}%'))
        else:
            cursor.execute("""
                SELECT id, tipo, dispositivo_legal, artigo, descricao_artigo,
                       paragrafo, inciso, alinea
                FROM crimes_contravencoes
                WHERE ativo = TRUE
                ORDER BY tipo, dispositivo_legal, artigo
                LIMIT 50
            """)

        crimes = []
        for row in cursor.fetchall():
            # Formatar texto para exibição
            texto_completo = f"Art. {row['artigo']}"
            if row['paragrafo']:
                texto_completo += f", {row['paragrafo']}"
            if row['inciso']:
                texto_completo += f", inciso {row['inciso']}"
            if row['alinea']:
                texto_completo += f", alínea {row['alinea']}"
            texto_completo += f" - {row['dispositivo_legal']} - {row['descricao_artigo']}"

            crimes.append({
                'id': row['id'],
                'tipo': row['tipo'],
                'dispositivo_legal': row['dispositivo_legal'],
                'artigo': row['artigo'],
                'descricao_artigo': row['descricao_artigo'],
                'paragrafo': row['paragrafo'] or '',
                'inciso': row['inciso'] or '',
                'alinea': row['alinea'] or '',
                'texto_completo': texto_completo
            })

        conn.close()

        return {"sucesso": True, "crimes": crimes}

    except Exception as e:
        print(f"Erro ao buscar crimes: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao buscar crimes: {str(e)}"}


def buscar_rdpm_para_indicios(db_manager, termo='', gravidade=None):
    """
    Busca transgressões do RDPM para seleção de indícios.

    Realiza busca no catálogo de transgressões disciplinares do Regulamento
    Disciplinar da Polícia Militar, permitindo filtrar por termo de pesquisa
    e/ou gravidade da transgressão.

    Args:
        db_manager: Gerenciador de conexões com banco de dados
        termo (str, optional): Termo de busca para filtrar resultados. Padrão: ''
        gravidade (str, optional): Filtro por gravidade da transgressão. Padrão: None

    Returns:
        dict: Resultado da operação com estrutura:
            {
                'sucesso': bool,
                'transgressoes': list[dict],
                'mensagem': str (apenas em caso de erro)
            }

            Cada transgressão inclui: id, gravidade, inciso, texto, texto_completo
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        params = []
        where_clause = "WHERE ativo = TRUE"

        if termo:
            where_clause += " AND (inciso ILIKE %s OR texto ILIKE %s)"
            params.extend([f'%{termo}%', f'%{termo}%'])

        if gravidade:
            where_clause += " AND gravidade = %s"
            params.append(gravidade)

        cursor.execute(f"""
            SELECT id, gravidade, inciso, texto
            FROM transgressoes
            {where_clause}
            ORDER BY gravidade, inciso
            LIMIT 50
        """, params)

        transgressoes = []
        for row in cursor.fetchall():
            transgressoes.append({
                'id': row['id'],
                'gravidade': row['gravidade'],
                'inciso': row['inciso'],
                'texto': row['texto'],
                'texto_completo': f"Inciso {row['inciso']} ({row['gravidade']}) - {row['texto']}"
            })

        conn.close()

        return {"sucesso": True, "transgressoes": transgressoes}

    except Exception as e:
        print(f"Erro ao buscar transgressões RDPM: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao buscar transgressões: {str(e)}"}


def buscar_art29_para_indicios(db_manager, termo=''):
    """
    Busca infrações do Art. 29 do Estatuto dos Policiais Militares para seleção de indícios.

    Realiza busca no catálogo de infrações previstas no Artigo 29 do Estatuto,
    permitindo filtrar por termo de pesquisa nos campos inciso e texto.

    Args:
        db_manager: Gerenciador de conexões com banco de dados
        termo (str, optional): Termo de busca para filtrar resultados. Padrão: ''

    Returns:
        dict: Resultado da operação com estrutura:
            {
                'sucesso': bool,
                'infracoes': list[dict],
                'mensagem': str (apenas em caso de erro)
            }

            Cada infração inclui: id, inciso, texto, texto_completo
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        if termo:
            cursor.execute("""
                SELECT id, inciso, texto
                FROM infracoes_estatuto_art29
                WHERE ativo = TRUE
                AND (inciso ILIKE %s OR texto ILIKE %s)
                ORDER BY
                    CASE
                        WHEN inciso ~ '^[IVXLC]' THEN LENGTH(inciso)
                        ELSE 999
                    END,
                    inciso
                LIMIT 50
            """, (f'%{termo}%', f'%{termo}%'))
        else:
            cursor.execute("""
                SELECT id, inciso, texto
                FROM infracoes_estatuto_art29
                WHERE ativo = TRUE
                ORDER BY
                    CASE
                        WHEN inciso ~ '^[IVXLC]' THEN LENGTH(inciso)
                        ELSE 999
                    END,
                    inciso
                LIMIT 50
            """)

        infracoes = []
        for row in cursor.fetchall():
            infracoes.append({
                'id': row['id'],
                'inciso': row['inciso'],
                'texto': row['texto'],
                'texto_completo': f"Inciso {row['inciso']} - {row['texto']}"
            })

        conn.close()

        return {"sucesso": True, "infracoes": infracoes}

    except Exception as e:
        print(f"Erro ao buscar infrações Art. 29: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao buscar infrações: {str(e)}"}
