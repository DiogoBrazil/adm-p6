import psycopg2
import psycopg2.extras


def listar_todas_transgressoes(db_manager):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            '''
            SELECT id, artigo, gravidade, inciso, texto, ativo, created_at
            FROM transgressoes 
            ORDER BY artigo, inciso
            '''
        )
        transgressoes = []
        for row in cursor.fetchall():
            transgressoes.append({
                'id': row['id'],
                'artigo': row['artigo'],
                'gravidade': row['gravidade'].title() if row['gravidade'] else '',
                'inciso': row['inciso'],
                'texto': row['texto'],
                'ativo': bool(row['ativo']),
                'created_at': row['created_at']
            })
        conn.close()
        return {'success': True, 'data': transgressoes}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def obter_transgressao_por_id(db_manager, transgressao_id):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            '''
            SELECT id, artigo, gravidade, inciso, texto, ativo, created_at
            FROM transgressoes 
            WHERE id = %s
            ''',
            (transgressao_id,),
        )
        row = cursor.fetchone()
        conn.close()
        if not row:
            return {'success': False, 'error': 'Transgressão não encontrada'}
        return {
            'success': True,
            'data': {
                'id': row['id'],
                'artigo': row['artigo'],
                'gravidade': row['gravidade'],
                'inciso': row['inciso'],
                'texto': row['texto'],
                'ativo': bool(row['ativo']),
                'created_at': row['created_at'],
            },
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def cadastrar_transgressao(db_manager, dados):
    """Insere uma nova transgressão disciplinar e retorna o id gerado."""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            '''
            INSERT INTO transgressoes (artigo, gravidade, inciso, texto, ativo, created_at)
            VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            RETURNING id
            ''',
            (
                dados.get('artigo'),
                dados.get('gravidade'),
                dados.get('inciso'),
                dados.get('texto'),
                bool(dados.get('ativo', True)),
            ),
        )
        row = cursor.fetchone()
        conn.commit()
        conn.close()
        return {'success': True, 'id': row['id'] if row else None}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def atualizar_transgressao(db_manager, dados):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Verificar duplicidade por gravidade+inciso (case-insensitive), excluindo próprio id
        cursor.execute(
            '''
            SELECT id FROM transgressoes
            WHERE LOWER(gravidade) = LOWER(%s) AND UPPER(inciso) = UPPER(%s) AND id != %s
            '''
            , (dados.get('gravidade'), dados.get('inciso'), dados.get('id'))
        )
        if cursor.fetchone():
            conn.close()
            return {'success': False, 'error': 'Já existe transgressão com esta gravidade e inciso.'}
        cursor.execute(
            '''
            UPDATE transgressoes
            SET artigo = %s, gravidade = %s, inciso = %s, texto = %s, ativo = %s
            WHERE id = %s
            '''
            , (
                dados.get('artigo'),
                dados.get('gravidade'),
                dados.get('inciso'),
                dados.get('texto'),
                bool(dados.get('ativo', True)),
                dados.get('id'),
            )
        )
        if cursor.rowcount == 0:
            conn.close()
            return {'success': False, 'error': 'Transgressão não encontrada'}
        conn.commit()
        conn.close()
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def excluir_transgressao(db_manager, transgressao_id):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT 1 FROM transgressoes WHERE id = %s', (transgressao_id,))
        if not cursor.fetchone():
            conn.close()
            return {'success': False, 'error': 'Transgressão não encontrada'}
        cursor.execute('DELETE FROM transgressoes WHERE id = %s', (transgressao_id,))
        conn.commit()
        conn.close()
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}
