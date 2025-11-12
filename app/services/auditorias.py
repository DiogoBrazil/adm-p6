"""
Serviço de auditoria do sistema.

Este módulo contém funções para listar e consultar registros de auditoria,
permitindo rastrear operações realizadas no sistema.
"""

import psycopg2
import psycopg2.extras


def listar_auditorias(db_manager, search_term=None, page=1, per_page=10, filtros=None):
    """
    Lista auditorias com paginação e filtros.

    Permite buscar registros de auditoria por termo de busca (usuário, tabela, registro)
    e aplicar filtros específicos por operação e tabela.

    Args:
        db_manager: Instância do DatabaseManager
        search_term: Termo de busca (usuário, tabela, registro) - opcional
        page: Página atual (default 1)
        per_page: Registros por página (default 10)
        filtros: Dict com filtros opcionais:
            - operacao: Tipo de operação (CREATE, UPDATE, DELETE)
            - tabela: Nome da tabela

    Returns:
        dict: {
            'sucesso': bool,
            'auditorias': list[dict] - Lista de registros de auditoria,
            'total': int - Total de registros,
            'total_pages': int - Total de páginas,
            'current_page': int - Página atual,
            'per_page': int - Registros por página
        } ou {'sucesso': False, 'mensagem': str}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Construir WHERE clause
        where_conditions = []
        params = []

        # Filtro de busca por texto
        if search_term and search_term.strip():
            where_conditions.append("""(
                LOWER(u.nome) LIKE LOWER(%s) OR
                LOWER(a.tabela) LIKE LOWER(%s) OR
                LOWER(a.registro_id) LIKE LOWER(%s)
            )""")
            search_pattern = f"%{search_term.strip()}%"
            params.extend([search_pattern, search_pattern, search_pattern])

        # Filtros específicos
        if filtros:
            if filtros.get('operacao'):
                where_conditions.append("a.operacao = %s")
                params.append(filtros['operacao'])

            if filtros.get('tabela'):
                where_conditions.append("a.tabela = %s")
                params.append(filtros['tabela'])

        where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""

        # Contar total de registros
        count_query = f"""
            SELECT COUNT(*) as total
            FROM auditoria a
            LEFT JOIN usuarios u ON a.usuario_id = u.id
            {where_clause}
        """
        cursor.execute(count_query, params)
        total = cursor.fetchone()['total']
        total_pages = (total + per_page - 1) // per_page

        # Buscar registros da página
        offset = (page - 1) * per_page
        query = f"""
            SELECT
                a.tabela,
                a.registro_id,
                a.operacao,
                a.timestamp,
                COALESCE(u.nome, 'Sistema') as usuario_nome,
                COALESCE(u.posto_graduacao, '') as usuario_posto
            FROM auditoria a
            LEFT JOIN usuarios u ON a.usuario_id = u.id
            {where_clause}
            ORDER BY a.timestamp DESC
            LIMIT %s OFFSET %s
        """
        cursor.execute(query, params + [per_page, offset])
        auditorias = cursor.fetchall()

        conn.close()

        # Formatar resultados
        resultado = []
        for aud in auditorias:
            resultado.append({
                'tabela': aud['tabela'],
                'registro_id': aud['registro_id'],
                'operacao': aud['operacao'],
                'timestamp': aud['timestamp'].isoformat() if aud['timestamp'] else None,
                'usuario_nome': f"{aud['usuario_posto']} {aud['usuario_nome']}".strip() if aud['usuario_posto'] else aud['usuario_nome']
            })

        return {
            'sucesso': True,
            'auditorias': resultado,
            'total': total,
            'total_pages': total_pages,
            'current_page': page,
            'per_page': per_page
        }

    except Exception as e:
        print(f"Erro ao listar auditorias: {e}")
        import traceback
        traceback.print_exc()
        return {
            'sucesso': False,
            'mensagem': f'Erro ao listar auditorias: {str(e)}'
        }
