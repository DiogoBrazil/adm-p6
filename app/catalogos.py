import psycopg2
import psycopg2.extras
import uuid


def listar_crimes_contravencoes(db_manager):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('''
            SELECT 
                id,
                tipo,
                dispositivo_legal,
                artigo,
                descricao_artigo,
                paragrafo,
                inciso,
                alinea,
                ativo
            FROM crimes_contravencoes
            ORDER BY tipo, dispositivo_legal, artigo
        ''')
        crimes = cursor.fetchall()
        conn.close()

        result = []
        for crime in crimes:
            result.append({
                'id': crime['id'],
                'tipo': crime['tipo'],
                'dispositivo_legal': crime['dispositivo_legal'],
                'artigo': crime['artigo'],
                'descricao_artigo': crime['descricao_artigo'],
                'paragrafo': crime['paragrafo'] if crime['paragrafo'] else '',
                'inciso': crime['inciso'] if crime['inciso'] else '',
                'alinea': crime['alinea'] if crime['alinea'] else '',
                'ativo': bool(crime['ativo'])
            })

        return {'success': True, 'data': result}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def obter_crime_por_id(db_manager, crime_id):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('''
            SELECT 
                id,
                tipo,
                dispositivo_legal,
                artigo,
                descricao_artigo,
                paragrafo,
                inciso,
                alinea,
                ativo
            FROM crimes_contravencoes
            WHERE id = %s
        ''', (crime_id,))
        crime = cursor.fetchone()
        conn.close()

        if not crime:
            return {'success': False, 'error': 'Crime não encontrado'}

        result = {
            'id': crime['id'],
            'tipo': crime['tipo'],
            'dispositivo_legal': crime['dispositivo_legal'],
            'artigo': crime['artigo'],
            'descricao_artigo': crime['descricao_artigo'],
            'paragrafo': crime['paragrafo'] if crime['paragrafo'] else '',
            'inciso': crime['inciso'] if crime['inciso'] else '',
            'alinea': crime['alinea'] if crime['alinea'] else '',
            'ativo': bool(crime['ativo'])
        }
        return {'success': True, 'data': result}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def cadastrar_crime(db_manager, dados_crime):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        crime_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO crimes_contravencoes 
            (id, tipo, dispositivo_legal, artigo, descricao_artigo, 
             paragrafo, inciso, alinea, ativo)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            crime_id,
            dados_crime['tipo'],
            dados_crime['dispositivo_legal'],
            dados_crime['artigo'],
            dados_crime['descricao_artigo'],
            dados_crime.get('paragrafo', ''),
            dados_crime.get('inciso', ''),
            dados_crime.get('alinea', ''),
            dados_crime.get('ativo', True)
        ))
        conn.commit()
        conn.close()
        return {'success': True, 'message': 'Crime/contravenção cadastrado com sucesso', 'id': crime_id}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def atualizar_crime(db_manager, dados_crime):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('''
            UPDATE crimes_contravencoes 
            SET tipo = %s, dispositivo_legal = %s, artigo = %s, descricao_artigo = %s,
                paragrafo = %s, inciso = %s, alinea = %s, ativo = %s
            WHERE id = %s
        ''', (
            dados_crime['tipo'],
            dados_crime['dispositivo_legal'],
            dados_crime['artigo'],
            dados_crime['descricao_artigo'],
            dados_crime.get('paragrafo', ''),
            dados_crime.get('inciso', ''),
            dados_crime.get('alinea', ''),
            dados_crime.get('ativo', True),
            dados_crime['id']
        ))
        if cursor.rowcount == 0:
            conn.close()
            return {'success': False, 'error': 'Crime não encontrado'}
        conn.commit()
        conn.close()
        return {'success': True, 'message': 'Crime/contravenção atualizado com sucesso'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def excluir_crime_contravencao(db_manager, crime_id):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('''
            UPDATE crimes_contravencoes 
            SET ativo = FALSE 
            WHERE id = %s
        ''', (crime_id,))
        if cursor.rowcount == 0:
            conn.close()
            return {'success': False, 'error': 'Crime não encontrado'}
        conn.commit()
        conn.close()
        return {'success': True, 'message': 'Crime/contravenção desativado com sucesso'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

