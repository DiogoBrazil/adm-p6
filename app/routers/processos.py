from app import processos as processos_mod
import psycopg2.extras


def register(eel, db_manager, guard_login, get_usuario_logado):
    """Registra handlers Eel relacionados a Processos/Procedimentos."""

    @eel.expose
    def excluir_processo(processo_id):
        """Exclui um processo/procedimento (soft delete)."""
        g = guard_login()
        if g:
            return g
        r = processos_mod.excluir_processo(db_manager, processo_id)
        if r.get('success'):
            try:
                usuario = get_usuario_logado() or {}
                db_manager.registrar_auditoria('processos_procedimentos', processo_id, 'DELETE', usuario.get('id'))
            except Exception:
                pass
            return {"sucesso": True, "mensagem": "Processo/Procedimento excluído com sucesso!"}
        return {"sucesso": False, "mensagem": r.get('error', 'Erro ao excluir processo/procedimento')}

    @eel.expose
    def obter_estatistica_pads_solucoes(ano=None):
        """Quantidade de PADS concluídos por tipo de solução."""
        g = guard_login()
        if g:
            return g
        try:
            conn = db_manager.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            where_clause = "WHERE tipo_detalhe = 'PADS' AND concluido = TRUE AND ativo = TRUE"
            params = []
            if ano:
                where_clause += " AND TO_CHAR(data_instauracao, 'YYYY') = %s"
                params.append(ano)

            cursor.execute(
                f'''
                SELECT 
                    CASE 
                        WHEN solucao_tipo IS NOT NULL THEN solucao_tipo
                        WHEN penalidade_tipo IS NOT NULL THEN 'Punido'
                        ELSE 'Não Informado'
                    END as solucao,
                    COUNT(*) as quantidade
                FROM processos_procedimentos
                {where_clause}
                GROUP BY solucao
                ORDER BY quantidade DESC
                ''',
                params,
            )
            resultados = cursor.fetchall()
            conn.close()
            dados = [{'solucao': row['solucao'], 'quantidade': row['quantidade']} for row in resultados]
            return {'sucesso': True, 'dados': dados}
        except Exception as e:
            return {'sucesso': False, 'erro': str(e)}

    @eel.expose
    def obter_estatistica_ipm_indicios(ano=None):
        """Quantidade de indícios em IPM/IPPM concluídos por tipo."""
        g = guard_login()
        if g:
            return g
        try:
            conn = db_manager.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            where_clause = "WHERE p.tipo_detalhe IN ('IPM', 'IPPM') AND p.concluido = TRUE AND p.ativo = TRUE"
            params = []
            if ano:
                where_clause += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
                params.append(ano)

            # Contar crimes militares (CPM)
            cursor.execute(
                f'''
                SELECT COUNT(pec.id) as count
                FROM processos_procedimentos p
                INNER JOIN pm_envolvido_indicios i ON i.procedimento_id = p.id
                INNER JOIN pm_envolvido_crimes pec ON pec.pm_indicios_id = i.id
                INNER JOIN crimes_contravencoes cc ON pec.crime_id = cc.id
                {where_clause}
                AND cc.dispositivo_legal = 'Código Penal Militar'
                ''',
                params,
            )
            crime_militar = cursor.fetchone()['count']

            # Contar transgressões (RDPM + Art29)
            cursor.execute(
                f'''
                SELECT COUNT(r.id) as count
                FROM processos_procedimentos p
                INNER JOIN pm_envolvido_indicios i ON i.procedimento_id = p.id
                INNER JOIN pm_envolvido_rdpm r ON r.pm_indicios_id = i.id
                {where_clause}
                ''',
                params,
            )
            rdpm_count = cursor.fetchone()['count']
            
            cursor.execute(
                f'''
                SELECT COUNT(a.id) as count
                FROM processos_procedimentos p
                INNER JOIN pm_envolvido_indicios i ON i.procedimento_id = p.id
                INNER JOIN pm_envolvido_art29 a ON a.pm_indicios_id = i.id
                {where_clause}
                ''',
                params,
            )
            art29_count = cursor.fetchone()['count']
            
            transgressoes = rdpm_count + art29_count

            # Contar indícios com "Não houve indícios"
            cursor.execute(
                f'''
                SELECT COUNT(i.id) as count
                FROM processos_procedimentos p
                INNER JOIN pm_envolvido_indicios i ON i.procedimento_id = p.id
                {where_clause}
                AND (i.categoria ILIKE '%%não houve indícios%%'
                     OR EXISTS (
                         SELECT 1 FROM jsonb_array_elements_text(i.categorias_indicios) AS cat
                         WHERE cat ILIKE '%%não houve indícios%%'
                     ))
                ''',
                params,
            )
            nao_houve = cursor.fetchone()['count']
            
            # Contar processos sem indícios cadastrados (arquivados)
            cursor.execute(
                f'''
                SELECT COUNT(DISTINCT p.id) as count
                FROM processos_procedimentos p
                LEFT JOIN pm_envolvido_indicios i ON i.procedimento_id = p.id
                {where_clause}
                AND i.id IS NULL
                ''',
                params,
            )
            arquivados = cursor.fetchone()['count']
            
            sem_indicios = nao_houve + arquivados

            conn.close()
            dados = [
                {'tipo_indicio': 'Crime Militar', 'quantidade': crime_militar},
                {'tipo_indicio': 'Transgressões Disciplinares', 'quantidade': transgressoes},
                {'tipo_indicio': 'Sem Indícios', 'quantidade': sem_indicios},
            ]
            return {'sucesso': True, 'dados': dados}
        except Exception as e:
            return {'sucesso': False, 'erro': str(e)}

    @eel.expose
    def obter_estatistica_crimes_comuns(ano=None):
        """Contravenções penais e crimes comuns apontados em SR e IPM."""
        g = guard_login()
        if g:
            return g
        try:
            conn = db_manager.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            where_clause = (
                "WHERE p.tipo_detalhe IN ('IPM', 'SR') AND p.ativo = TRUE "
                "AND cc.tipo IN ('Crime', 'Contravenção Penal') "
                "AND pei.categorias_indicios LIKE '%%Indícios de crime comum%%'"
            )
            params = []
            if ano:
                where_clause += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
                params.append(ano)

            cursor.execute(
                f'''
                SELECT cc.artigo, cc.descricao_artigo, cc.tipo, COUNT(DISTINCT pei.procedimento_id) as total
                FROM pm_envolvido_indicios pei
                JOIN pm_envolvido_crimes pec ON pei.id = pec.pm_indicios_id
                JOIN crimes_contravencoes cc ON pec.crime_id = cc.id
                JOIN processos_procedimentos p ON pei.procedimento_id = p.id
                {where_clause}
                GROUP BY cc.artigo, cc.descricao_artigo, cc.tipo
                ORDER BY total DESC, cc.artigo
                ''',
                params,
            )
            resultados = cursor.fetchall()
            conn.close()
            dados = [
                {
                    'artigo': row['artigo'],
                    'descricao': row['descricao_artigo'],
                    'classificacao': 'Crime Comum' if row['tipo'] == 'Crime' else 'Contravenção Penal',
                    'quantidade': row['total'],
                }
                for row in resultados
            ]
            return {'sucesso': True, 'dados': dados}
        except Exception as e:
            return {'sucesso': False, 'erro': str(e)}

    @eel.expose
    def obter_estatistica_sr_indicios(ano=None):
        """Quantidade de indícios em SR concluídos por tipo."""
        g = guard_login()
        if g:
            return g
        try:
            conn = db_manager.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            where_clause = "WHERE p.tipo_detalhe = 'SR' AND p.concluido = TRUE AND p.ativo = TRUE"
            params = []
            if ano:
                where_clause += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
                params.append(ano)

            # Contar crimes comuns (CP + Contravenções)
            cursor.execute(
                f'''
                SELECT COUNT(pec.id) as count
                FROM processos_procedimentos p
                INNER JOIN pm_envolvido_indicios i ON i.procedimento_id = p.id
                INNER JOIN pm_envolvido_crimes pec ON pec.pm_indicios_id = i.id
                INNER JOIN crimes_contravencoes cc ON pec.crime_id = cc.id
                {where_clause}
                AND cc.dispositivo_legal IN ('Código Penal', 'Lei de Contravenções Penais')
                ''',
                params,
            )
            crime_comum = cursor.fetchone()['count']

            # Contar transgressões (RDPM + Art29)
            cursor.execute(
                f'''
                SELECT COUNT(r.id) as count
                FROM processos_procedimentos p
                INNER JOIN pm_envolvido_indicios i ON i.procedimento_id = p.id
                INNER JOIN pm_envolvido_rdpm r ON r.pm_indicios_id = i.id
                {where_clause}
                ''',
                params,
            )
            rdpm_count = cursor.fetchone()['count']
            
            cursor.execute(
                f'''
                SELECT COUNT(a.id) as count
                FROM processos_procedimentos p
                INNER JOIN pm_envolvido_indicios i ON i.procedimento_id = p.id
                INNER JOIN pm_envolvido_art29 a ON a.pm_indicios_id = i.id
                {where_clause}
                ''',
                params,
            )
            art29_count = cursor.fetchone()['count']
            
            transgressoes = rdpm_count + art29_count

            # Contar indícios com "Não houve indícios"
            cursor.execute(
                f'''
                SELECT COUNT(i.id) as count
                FROM processos_procedimentos p
                INNER JOIN pm_envolvido_indicios i ON i.procedimento_id = p.id
                {where_clause}
                AND (i.categoria ILIKE '%%não houve indícios%%'
                     OR EXISTS (
                         SELECT 1 FROM jsonb_array_elements_text(i.categorias_indicios) AS cat
                         WHERE cat ILIKE '%%não houve indícios%%'
                     ))
                ''',
                params,
            )
            nao_houve = cursor.fetchone()['count']
            
            # Contar processos sem indícios cadastrados (arquivados)
            cursor.execute(
                f'''
                SELECT COUNT(DISTINCT p.id) as count
                FROM processos_procedimentos p
                LEFT JOIN pm_envolvido_indicios i ON i.procedimento_id = p.id
                {where_clause}
                AND i.id IS NULL
                ''',
                params,
            )
            arquivados = cursor.fetchone()['count']
            
            sem_indicios = nao_houve + arquivados

            conn.close()
            dados = [
                {'tipo_indicio': 'Crime Comum', 'quantidade': crime_comum},
                {'tipo_indicio': 'Transgressões Disciplinares', 'quantidade': transgressoes},
                {'tipo_indicio': 'Sem Indícios', 'quantidade': sem_indicios},
            ]
            return {'sucesso': True, 'dados': dados}
        except Exception as e:
            return {'sucesso': False, 'erro': str(e)}

    @eel.expose
    def obter_top10_transgressoes(ano=None):
        """Top 10 transgressões (RDPM e Art. 29) em IPM/SR concluídos."""
        g = guard_login()
        if g:
            return g
        try:
            conn = db_manager.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            where_clause_ipm = "WHERE p.tipo_detalhe IN ('IPM', 'IPPM') AND p.concluido = TRUE AND p.ativo = TRUE"
            where_clause_sr = "WHERE p.tipo_detalhe = 'SR' AND p.concluido = TRUE AND p.ativo = TRUE"
            params = []
            if ano:
                where_clause_ipm += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
                where_clause_sr += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
                params = [ano, ano]

            cursor.execute(
                f'''
                SELECT t.id, t.inciso, t.gravidade, t.texto, COUNT(*) as ocorrencias
                FROM (
                    SELECT r.transgressao_id, i.procedimento_id
                    FROM pm_envolvido_rdpm r
                    INNER JOIN pm_envolvido_indicios i ON r.pm_indicios_id = i.id
                    INNER JOIN processos_procedimentos p ON i.procedimento_id = p.id
                    {where_clause_ipm}
                    UNION ALL
                    SELECT r.transgressao_id, i.procedimento_id
                    FROM pm_envolvido_rdpm r
                    INNER JOIN pm_envolvido_indicios i ON r.pm_indicios_id = i.id
                    INNER JOIN processos_procedimentos p ON i.procedimento_id = p.id
                    {where_clause_sr}
                ) as trans
                INNER JOIN transgressoes t ON trans.transgressao_id = t.id
                GROUP BY t.id, t.inciso, t.gravidade, t.texto
                ORDER BY ocorrencias DESC
                LIMIT 10
                ''',
                params,
            )
            resultados = cursor.fetchall()

            gravidade_map = {'leve': '15', 'media': '16', 'grave': '17'}
            dados = []
            for row in resultados:
                artigo = gravidade_map.get((row['gravidade'] or '').lower(), '%s')
                dados.append({
                    'transgressao_id': row['id'],
                    'artigo_label': f"Art. {artigo}, Inciso {row['inciso']}",
                    'descricao_curta': row['texto'][:50] + '...' if len(row['texto']) > 50 else row['texto'],
                    'quantidade': row['ocorrencias'],
                })

            cursor.execute(
                f'''
                SELECT t.id, t.inciso, t.texto, COUNT(*) as ocorrencias
                FROM (
                    SELECT a.art29_id as transgressao_id, i.procedimento_id
                    FROM pm_envolvido_art29 a
                    INNER JOIN pm_envolvido_indicios i ON a.pm_indicios_id = i.id
                    INNER JOIN processos_procedimentos p ON i.procedimento_id = p.id
                    {where_clause_ipm}
                    UNION ALL
                    SELECT a.art29_id as transgressao_id, i.procedimento_id
                    FROM pm_envolvido_art29 a
                    INNER JOIN pm_envolvido_indicios i ON a.pm_indicios_id = i.id
                    INNER JOIN processos_procedimentos p ON i.procedimento_id = p.id
                    {where_clause_sr}
                ) as trans
                INNER JOIN infracoes_estatuto_art29 t ON trans.transgressao_id = t.id
                GROUP BY t.id, t.inciso, t.texto
                ORDER BY ocorrencias DESC
                LIMIT 10
                ''',
                params,
            )
            art29_resultados = cursor.fetchall()

            for row in art29_resultados:
                dados.append({
                    'transgressao_id': row['id'],
                    'artigo_label': f"Art. 29, Inciso {row['inciso']}",
                    'descricao_curta': row['texto'][:50] + '...' if len(row['texto']) > 50 else row['texto'],
                    'quantidade': row['ocorrencias'],
                })

            dados = sorted(dados, key=lambda x: x['quantidade'], reverse=True)[:10]
            conn.close()
            return {'sucesso': True, 'dados': dados}
        except Exception as e:
            return {'sucesso': False, 'erro': str(e)}

    @eel.expose
    def obter_ranking_motoristas_sinistros(ano=None):
        """Ranking de PMs motoristas em sinistros de trânsito."""
        g = guard_login()
        if g:
            return g
        try:
            conn = db_manager.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            where_clause = "WHERE p.motorista_id IS NOT NULL AND p.ativo = TRUE"
            params = []
            if ano:
                where_clause += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
                params.append(ano)

            cursor.execute(
                f'''
                SELECT u.posto_graduacao, u.matricula, u.nome, COUNT(*) as total_sinistros
                FROM processos_procedimentos p
                INNER JOIN usuarios u ON p.motorista_id = u.id
                {where_clause}
                GROUP BY u.id, u.posto_graduacao, u.matricula, u.nome
                ORDER BY total_sinistros DESC
                ''',
                params,
            )
            resultados = cursor.fetchall()
            conn.close()
            dados = [
                {
                    'pm_completo': f"{row['posto_graduacao']} {row['matricula']} {row['nome']}",
                    'total_sinistros': row['total_sinistros'],
                }
                for row in resultados
            ]
            return {'sucesso': True, 'dados': dados}
        except Exception as e:
            return {'sucesso': False, 'erro': str(e)}

    @eel.expose
    def obter_estatistica_naturezas_apuradas(ano=None):
        """Principais naturezas apuradas em procedimentos (em andamento e concluídos)."""
        g = guard_login()
        if g:
            return g
        try:
            conn = db_manager.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            where_clause = (
                "WHERE p.natureza_procedimento IS NOT NULL AND p.natureza_procedimento != '' AND p.ativo = TRUE"
            )
            params = []
            if ano:
                where_clause += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
                params.append(ano)

            cursor.execute(
                f'''
                SELECT p.natureza_procedimento, COUNT(*) as total
                FROM processos_procedimentos p
                {where_clause}
                GROUP BY p.natureza_procedimento
                ORDER BY total DESC
                ''',
                params,
            )
            resultados = cursor.fetchall()
            conn.close()
            dados = [
                {'natureza': row['natureza_procedimento'], 'quantidade': row['total']}
                for row in resultados
            ]
            return {'sucesso': True, 'dados': dados}
        except Exception as e:
            return {'sucesso': False, 'erro': str(e)}

    @eel.expose
    def obter_estatistica_crimes_militares_ipm(ano=None):
        """Crimes militares apontados em IPM (lista agregada por artigo)."""
        g = guard_login()
        if g:
            return g
        try:
            conn = db_manager.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            where_clause = (
                "WHERE p.tipo_detalhe = 'IPM' AND p.ativo = TRUE AND cc.tipo = 'Crime' "
                "AND pei.categorias_indicios LIKE '%%Indícios de crime militar%%'"
            )
            params = []
            if ano:
                where_clause += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
                params.append(ano)

            cursor.execute(
                f'''
                SELECT cc.artigo, cc.descricao_artigo, COUNT(DISTINCT pei.procedimento_id) as total
                FROM pm_envolvido_indicios pei
                JOIN pm_envolvido_crimes pec ON pei.id = pec.pm_indicios_id
                JOIN crimes_contravencoes cc ON pec.crime_id = cc.id
                JOIN processos_procedimentos p ON pei.procedimento_id = p.id
                {where_clause}
                GROUP BY cc.artigo, cc.descricao_artigo
                ORDER BY total DESC, cc.artigo
                ''',
                params,
            )
            resultados = cursor.fetchall()
            conn.close()
            dados = [
                {
                    'artigo': row['artigo'],
                    'descricao': row['descricao_artigo'],
                    'quantidade': row['total'],
                }
                for row in resultados
            ]
            return {'sucesso': True, 'dados': dados}
        except Exception as e:
            return {'sucesso': False, 'erro': str(e)}

    @eel.expose
    def obter_estatisticas_processos_andamento():
        """Retorna estatísticas dos processos em andamento por tipo."""
        g = guard_login()
        if g:
            return g
        try:
            conn = db_manager.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            cursor.execute(
                '''
                SELECT tipo_detalhe, COUNT(*) as total
                FROM processos_procedimentos
                WHERE ativo = TRUE AND data_conclusao IS NULL
                AND (concluido = FALSE OR concluido IS NULL)
                GROUP BY tipo_detalhe
                ORDER BY total DESC
                '''
            )
            resultados = cursor.fetchall()

            estatisticas = {}
            total_geral = 0
            for row in resultados:
                tipo = row['tipo_detalhe']
                quantidade = row['total']
                if tipo:
                    estatisticas[tipo] = quantidade
                    total_geral += quantidade
            estatisticas['TOTAL'] = total_geral

            cursor.execute(
                '''
                SELECT COUNT(*) as count FROM processos_procedimentos
                WHERE ativo = TRUE AND data_conclusao IS NOT NULL
                '''
            )
            concluidos = cursor.fetchone()['count']

            cursor.execute('SELECT COUNT(*) FROM processos_procedimentos WHERE ativo = TRUE')
            total_processos = cursor.fetchone()['count']

            conn.close()
            return {
                'sucesso': True,
                'andamento': estatisticas,
                'concluidos': concluidos,
                'total_processos': total_processos,
            }
        except Exception as e:
            return {'sucesso': False, 'erro': str(e)}
    

