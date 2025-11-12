"""
Serviço de estatísticas do sistema.

Este módulo contém funções para obter estatísticas gerais do sistema
e estatísticas detalhadas por encarregado.
"""

import psycopg2
import psycopg2.extras
from db_config import get_pg_connection


def obter_estatisticas_encarregados(db_manager):
    """
    Retorna estatísticas detalhadas por encarregado.

    Para cada encarregado ativo, calcula a quantidade de processos/procedimentos
    onde atua em diferentes papéis (responsável, escrivão, presidente, etc).

    Args:
        db_manager: Instância do DatabaseManager

    Returns:
        dict: {
            "sucesso": bool,
            "dados": list[dict] - Lista com estatísticas de cada encarregado,
            "resumo": dict - Resumo geral com totais
        } ou {"sucesso": False, "erro": str}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Primeiro, obter todos os encarregados
        cursor.execute('''
            SELECT id, posto_graduacao, matricula, nome
            FROM usuarios
            WHERE ativo = TRUE AND is_encarregado = TRUE
            ORDER BY posto_graduacao, nome
        ''')
        encarregados = cursor.fetchall()

        estatisticas = []
        total_processos = 0
        mais_ativo = {"nome": "N/A", "total": 0}

        for encarregado in encarregados:
            enc_id = encarregado['id']
            posto = encarregado['posto_graduacao']
            matricula = encarregado['matricula']
            nome = encarregado['nome']
            nome_completo = f"{posto} {matricula} {nome}"

            # Inicializar contadores
            contadores = {
                'sr': 0, 'sv': 0, 'fp': 0, 'ipm': 0, 'escrivao': 0,
                'pads': 0, 'pad': 0, 'cd': 0, 'cj': 0
            }

            # SR e Sindicâncias (como responsável)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos
                WHERE responsavel_id = %s
                AND (tipo_detalhe = 'SR' OR tipo_detalhe = 'SINDICANCIA')
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['sr'] = result['count'] if result else 0

            # SV - Sindicância de Veículo (como responsável)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos
                WHERE responsavel_id = %s
                AND tipo_detalhe = 'SV'
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['sv'] = result['count'] if result else 0

            # FP - Feito Preliminar (como responsável)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos
                WHERE responsavel_id = %s
                AND (tipo_detalhe = 'FP' OR tipo_detalhe = 'FEITO_PRELIMINAR')
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['fp'] = result['count'] if result else 0

            # IPM (como responsável)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos
                WHERE responsavel_id = %s
                AND (tipo_detalhe = 'IPM' OR tipo_detalhe = 'IPPM')
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['ipm'] = result['count'] if result else 0

            # Escrivão (quando foi escrivão em IPM)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos
                WHERE escrivao_id = %s
                AND (tipo_detalhe = 'IPM' OR tipo_detalhe = 'IPPM')
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['escrivao'] = result['count'] if result else 0

            # PADS (como responsável)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos
                WHERE responsavel_id = %s
                AND tipo_detalhe = 'PADS'
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['pads'] = result['count'] if result else 0

            # PAD (como responsável, presidente, interrogante ou escrivão do processo)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos
                WHERE (responsavel_id = %s OR presidente_id = %s OR interrogante_id = %s OR escrivao_processo_id = %s)
                AND tipo_detalhe = 'PAD'
                AND ativo = TRUE
            ''', (enc_id, enc_id, enc_id, enc_id))
            result = cursor.fetchone()
            contadores['pad'] = result['count'] if result else 0

            # CD - Conselho de Disciplina (como responsável, presidente, interrogante ou escrivão do processo)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos
                WHERE (responsavel_id = %s OR presidente_id = %s OR interrogante_id = %s OR escrivao_processo_id = %s)
                AND tipo_detalhe = 'CD'
                AND ativo = TRUE
            ''', (enc_id, enc_id, enc_id, enc_id))
            result = cursor.fetchone()
            contadores['cd'] = result['count'] if result else 0

            # CJ - Conselho de Justificação (como responsável, presidente, interrogante ou escrivão do processo)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos
                WHERE (responsavel_id = %s OR presidente_id = %s OR interrogante_id = %s OR escrivao_processo_id = %s)
                AND tipo_detalhe = 'CJ'
                AND ativo = TRUE
            ''', (enc_id, enc_id, enc_id, enc_id))
            result = cursor.fetchone()
            contadores['cj'] = result['count'] if result else 0

            # PADE - Processo Administrativo Disciplinar Especial (como responsável, presidente, interrogante ou escrivão do processo)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos
                WHERE (responsavel_id = %s OR presidente_id = %s OR interrogante_id = %s OR escrivao_processo_id = %s)
                AND tipo_detalhe = 'PADE'
                AND ativo = TRUE
            ''', (enc_id, enc_id, enc_id, enc_id))
            result = cursor.fetchone()
            contadores['pade'] = result['count'] if result else 0

            # CP - Conselho Permanente (como responsável)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos
                WHERE responsavel_id = %s
                AND tipo_detalhe = 'CP'
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['cp'] = result['count'] if result else 0

            # Calcular total para este encarregado
            total_encarregado = sum(contadores.values())
            total_processos += total_encarregado

            # Verificar se é o mais ativo
            if total_encarregado > mais_ativo["total"]:
                mais_ativo = {"nome": nome_completo, "total": total_encarregado}

            # Adicionar aos resultados
            estatisticas.append({
                'id': enc_id,
                'nome': nome_completo,
                **contadores
            })

        # Preparar resumo
        resumo = {
            'totalEncarregados': len(encarregados),
            'totalProcessos': total_processos,
            'maisAtivo': mais_ativo["nome"] if mais_ativo["total"] > 0 else "N/A"
        }

        conn.close()

        return {
            "sucesso": True,
            "dados": estatisticas,
            "resumo": resumo
        }

    except Exception as e:
        return {"sucesso": False, "erro": str(e)}


def obter_estatisticas(db_manager):
    """
    Retorna estatísticas gerais do sistema.

    Utiliza o método get_stats() do DatabaseManager para obter
    estatísticas consolidadas do sistema.

    Args:
        db_manager: Instância do DatabaseManager

    Returns:
        dict: Estatísticas gerais do sistema (formato depende de db_manager.get_stats())
    """
    return db_manager.get_stats()
