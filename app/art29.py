import psycopg2
import psycopg2.extras


def listar_infracoes_estatuto_art29(db_manager):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            """
            SELECT id, inciso, texto, ativo
            FROM infracoes_estatuto_art29 
            WHERE ativo = TRUE
            ORDER BY 
                CASE 
                    WHEN inciso ~ '^[IVXLC]' THEN LENGTH(inciso)
                    ELSE 999
                END,
                inciso
            """
        )
        infracoes = cursor.fetchall()
        conn.close()
        resultado = []
        for infracao in infracoes:
            resultado.append(
                {
                    'id': infracao['id'],
                    'inciso': infracao['inciso'],
                    'texto': infracao['texto'],
                    'ativo': bool(infracao['ativo']),
                }
            )
        return {'success': True, 'data': resultado}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def obter_infracao_estatuto_art29(db_manager, infracao_id):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            """
            SELECT id, inciso, texto, ativo
            FROM infracoes_estatuto_art29 
            WHERE id = %s
            """,
            (infracao_id,),
        )
        infracao = cursor.fetchone()
        conn.close()
        if not infracao:
            return {'success': False, 'error': 'Infração não encontrada'}
        return {
            'success': True,
            'data': {
                'id': infracao['id'],
                'inciso': infracao['inciso'],
                'texto': infracao['texto'],
                'ativo': bool(infracao['ativo']),
            },
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def criar_infracao_estatuto_art29(db_manager, inciso: str, texto: str):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Verificar duplicidade de inciso
        cursor.execute(
            """
            SELECT id FROM infracoes_estatuto_art29 
            WHERE UPPER(inciso) = UPPER(%s) AND ativo = TRUE
            """,
            (inciso,),
        )
        if cursor.fetchone():
            conn.close()
            return {'success': False, 'error': f'Já existe uma infração com o inciso "{inciso}"'}

        import uuid as _uuid
        novo_id = str(_uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO infracoes_estatuto_art29 (id, inciso, texto, ativo)
            VALUES (%s, %s, %s, TRUE)
            """,
            (novo_id, inciso, texto),
        )
        conn.commit()
        conn.close()
        return {'success': True, 'id': novo_id}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def editar_infracao_estatuto_art29(db_manager, infracao_id: str, inciso: str, texto: str):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Verificar se existe
        cursor.execute(
            "SELECT id FROM infracoes_estatuto_art29 WHERE id = %s",
            (infracao_id,),
        )
        if not cursor.fetchone():
            conn.close()
            return {'success': False, 'error': 'Infração não encontrada'}

        # Verificar duplicidade de inciso em outra infração
        cursor.execute(
            """
            SELECT id FROM infracoes_estatuto_art29 
            WHERE UPPER(inciso) = UPPER(%s) AND id != %s AND ativo = TRUE
            """,
            (inciso, infracao_id),
        )
        if cursor.fetchone():
            conn.close()
            return {'success': False, 'error': f'Já existe outra infração com o inciso "{inciso}"'}

        cursor.execute(
            """
            UPDATE infracoes_estatuto_art29 
            SET inciso = %s, texto = %s
            WHERE id = %s
            """,
            (inciso, texto, infracao_id),
        )
        conn.commit()
        conn.close()
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def excluir_infracao_estatuto_art29(db_manager, infracao_id: str):
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            """
            SELECT inciso FROM infracoes_estatuto_art29 
            WHERE id = %s AND ativo = TRUE
            """,
            (infracao_id,),
        )
        infracao = cursor.fetchone()
        if not infracao:
            conn.close()
            return {'success': False, 'error': 'Infração não encontrada'}

        cursor.execute(
            """
            UPDATE infracoes_estatuto_art29 
            SET ativo = FALSE
            WHERE id = %s
            """,
            (infracao_id,),
        )
        conn.commit()
        conn.close()
        return {'success': True, 'inciso': infracao['inciso']}
    except Exception as e:
        return {'success': False, 'error': str(e)}
