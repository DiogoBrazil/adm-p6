# prazos_andamentos_manager.py - Gerenciador de Prazos e Andamentos
import psycopg2
import psycopg2.extras
from db_config import get_pg_connection
import uuid
from datetime import datetime, timedelta
import json

class PrazosAndamentosManager:
    """Gerenciador de prazos e andamentos dos processos"""
    
    def __init__(self):
        # PostgreSQL não usa db_path - conexão gerenciada pelo db_config
        pass
    
    def get_connection(self):
        """Retorna conexão com o banco PostgreSQL"""
        return get_pg_connection()
        """Retorna conexão com o banco"""
        return get_pg_connection()
    
    # ============================================
    # GERENCIAMENTO DE PRAZOS
    # ============================================
    
    def adicionar_prazo_inicial(self, processo_id, data_inicio, dias_prazo, motivo=None, autorizado_por=None, autorizado_tipo=None):
        """Adiciona prazo inicial para um processo"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            # Calcular data de vencimento
            data_inicio_obj = datetime.strptime(data_inicio, "%Y-%m-%d")
            data_vencimento = data_inicio_obj + timedelta(days=dias_prazo)
            
            prazo_id = str(uuid.uuid4())
            
            cursor.execute('''
                INSERT INTO prazos_processo (
                    id, processo_id, tipo_prazo, data_inicio, data_vencimento, 
                    dias_adicionados, motivo, autorizado_por, autorizado_tipo, ativo
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                prazo_id, processo_id, 'inicial', data_inicio, 
                data_vencimento.strftime("%Y-%m-%d"), dias_prazo, 
                motivo, autorizado_por, autorizado_tipo, 1
            ))
            
            conn.commit()
            conn.close()
            
            return {"sucesso": True, "mensagem": "Prazo inicial adicionado com sucesso!", "prazo_id": prazo_id}
            
        except Exception as e:
            return {"sucesso": False, "mensagem": f"Erro ao adicionar prazo: {str(e)}"}
    
    def prorrogar_prazo(self, processo_id, dias_prorrogacao, motivo, autorizado_por, autorizado_tipo, numero_portaria=None, data_portaria=None):
        """Prorroga o prazo de um processo.
        Regra: somar a quantidade de dias a partir do primeiro dia após o vencimento atual.
        Armazena número e data da portaria e a ordem da prorrogação."""
        try:
            if not dias_prorrogacao or dias_prorrogacao <= 0:
                return {"sucesso": False, "mensagem": "Dias de prorrogação deve ser maior que zero."}

            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            # PostgreSQL não precisa garantir colunas (já existem via migrations)
            # Código SQLite removido (PRAGMA não funciona no PostgreSQL)
            
            # Buscar prazo atual
            cursor.execute('''
                SELECT id, data_vencimento, dias_adicionados 
                FROM prazos_processo 
                WHERE processo_id = %s AND ativo = TRUE
            ''', (processo_id,))
            
            prazo_atual = cursor.fetchone()
            if not prazo_atual:
                # Tentar criar prazo inicial automaticamente com base na data_recebimento e regras
                cursor.execute("""
                    SELECT tipo_detalhe, documento_iniciador, data_recebimento
                    FROM processos_procedimentos
                    WHERE id = %s AND ativo = TRUE
                """, (processo_id,))
                proc = cursor.fetchone()
                if not proc:
                    return {"sucesso": False, "mensagem": "Processo não encontrado ou inativo"}
                tipo_detalhe = proc['tipo_detalhe']
                documento_iniciador = proc['documento_iniciador']
                data_recebimento = proc['data_recebimento']
                if not data_recebimento:
                    return {"sucesso": False, "mensagem": "Processo não possui data de recebimento para iniciar prazo"}
                # Regras básicas de prazo
                prazos_base = {
                    'SV': 15, 'SR': 30, 'IPM': 40, 'FP': 30, 'CP': 30,
                    'PAD': 30, 'PADE': 30, 'CD': 30, 'CJ': 30, 'PADS': 30,
                    'Feito Preliminar': 15
                }
                dias_base = 30
                if documento_iniciador == 'Feito Preliminar':
                    dias_base = prazos_base['Feito Preliminar']
                elif tipo_detalhe in prazos_base:
                    dias_base = prazos_base[tipo_detalhe]
                # Inserir prazo inicial
                # Converter data_recebimento para string se for objeto date
                if hasattr(data_recebimento, 'strftime'):
                    data_recebimento_str = data_recebimento.strftime("%Y-%m-%d")
                else:
                    data_recebimento_str = str(data_recebimento)
                data_inicio_obj = datetime.strptime(data_recebimento_str, "%Y-%m-%d")
                data_vencimento_ini = data_inicio_obj + timedelta(days=dias_base)
                prazo_id_ini = str(uuid.uuid4())
                cursor.execute('''
                    INSERT INTO prazos_processo (
                        id, processo_id, tipo_prazo, data_inicio, data_vencimento,
                        dias_adicionados, motivo, autorizado_por, autorizado_tipo, ativo
                    ) VALUES (%s, %s, 'inicial', %s, %s, %s, %s, %s, %s, TRUE)
                ''', (
                    prazo_id_ini, processo_id, data_recebimento_str, data_vencimento_ini.strftime("%Y-%m-%d"),
                    dias_base, 'Prazo inicial automático', autorizado_por, autorizado_tipo
                ))
                conn.commit()
                # Recarregar prazo atual
                cursor.execute('''
                    SELECT id, data_vencimento, dias_adicionados 
                    FROM prazos_processo 
                    WHERE processo_id = %s AND ativo = TRUE
                ''', (processo_id,))
                prazo_atual = cursor.fetchone()
                if not prazo_atual:
                    return {"sucesso": False, "mensagem": "Não foi possível iniciar prazo do processo"}
            
            # Desativar prazo atual
            cursor.execute('''
                UPDATE prazos_processo 
                SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP 
                WHERE id = %s
            ''', (prazo_atual['id'],))
            
            # Calcular nova data de vencimento
            # Dia inicial da contagem é o dia seguinte ao vencimento atual
            data_venc_value = prazo_atual['data_vencimento']
            # Converter para string se for objeto date
            if hasattr(data_venc_value, 'strftime'):
                data_venc_str = data_venc_value.strftime("%Y-%m-%d")
            else:
                data_venc_str = str(data_venc_value)
            data_vencimento_atual = datetime.strptime(data_venc_str, "%Y-%m-%d")
            inicio_prorrogacao = data_vencimento_atual + timedelta(days=1)
            nova_data_vencimento = inicio_prorrogacao + timedelta(days=dias_prorrogacao - 1) if dias_prorrogacao and dias_prorrogacao > 0 else inicio_prorrogacao

            # Calcular a ordem da prorrogação (nº sequencial)
            cursor.execute('''
                SELECT COALESCE(MAX(ordem_prorrogacao), 0) as max_ordem
                FROM prazos_processo
                WHERE processo_id = %s AND tipo_prazo = 'prorrogacao'
            ''', (processo_id,))
            resultado_ordem = cursor.fetchone()
            ordem_atual = resultado_ordem['max_ordem'] if resultado_ordem else 0
            proxima_ordem = ordem_atual + 1
            
            # Criar novo prazo (prorrogação)
            novo_prazo_id = str(uuid.uuid4())
            cursor.execute('''
                INSERT INTO prazos_processo (
                    id, processo_id, tipo_prazo, data_inicio, data_vencimento,
                    dias_adicionados, motivo, autorizado_por, autorizado_tipo, ativo,
                    numero_portaria, data_portaria, ordem_prorrogacao
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                novo_prazo_id, processo_id, 'prorrogacao', 
                data_vencimento_atual.strftime("%Y-%m-%d"), nova_data_vencimento.strftime("%Y-%m-%d"),
                dias_prorrogacao, motivo, autorizado_por, autorizado_tipo, True,
                numero_portaria, data_portaria, proxima_ordem
            ))
            
            conn.commit()
            conn.close()
            
            return {
                "sucesso": True, 
                "mensagem": f"Prazo prorrogado por {dias_prorrogacao} dias",
                "nova_data_vencimento": nova_data_vencimento.strftime("%d/%m/%Y"),
                "prazo_id": novo_prazo_id,
                "ordem_prorrogacao": proxima_ordem
            }
            
        except Exception as e:
            return {"sucesso": False, "mensagem": f"Erro ao prorrogar prazo: {str(e)}"}

    def listar_prazos_processo(self, processo_id):
        """Lista histórico de prazos (inicial e prorrogações) com sequência e portaria"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cursor.execute('''
                SELECT id, tipo_prazo, data_inicio, data_vencimento, dias_adicionados,
                       motivo, autorizado_por, autorizado_tipo, ativo,
                       numero_portaria, data_portaria, ordem_prorrogacao, created_at
                FROM prazos_processo
                WHERE processo_id = %s
                ORDER BY 
                    CASE tipo_prazo WHEN 'inicial' THEN 0 ELSE 1 END,
                    COALESCE(ordem_prorrogacao, 0)
            ''', (processo_id,))
            rows = cursor.fetchall()
            conn.close()
            result = []
            for r in rows:
                result.append({
                    "id": r['id'],
                    "tipo_prazo": r['tipo_prazo'],
                    "data_inicio": r['data_inicio'],
                    "data_vencimento": r['data_vencimento'],
                    "dias_adicionados": r['dias_adicionados'],
                    "motivo": r['motivo'],
                    "autorizado_por": r['autorizado_por'],
                    "autorizado_tipo": r['autorizado_tipo'],
                    "ativo": bool(r['ativo']),
                    "numero_portaria": r['numero_portaria'],
                    "data_portaria": r['data_portaria'],
                    "ordem_prorrogacao": r['ordem_prorrogacao'],
                    "created_at": r['created_at']
                })
            return result
        except Exception as e:
            print(f"Erro ao listar prazos do processo: {e}")
            return []
    
    def obter_prazos_vencendo(self, dias_antecedencia=7):
        """Retorna processos com prazos vencendo"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            cursor.execute('''
                SELECT 
                    p.id, p.numero, p.tipo_detalhe,
                    pr.data_vencimento, pr.tipo_prazo,
                    JULIANDAY(pr.data_vencimento) - JULIANDAY(DATE('now')) as dias_restantes,
                    COALESCE(u.nome, 'Desconhecido') as responsavel
                FROM processos_procedimentos p
                INNER JOIN prazos_processo pr ON p.id = pr.processo_id AND pr.ativo = TRUE
                LEFT JOIN usuarios u ON p.responsavel_id = u.id
                WHERE p.ativo = TRUE 
                  AND pr.data_vencimento <= DATE('now', '+{} days')
                ORDER BY pr.data_vencimento ASC
            '''.format(dias_antecedencia))
            
            prazos = cursor.fetchall()
            conn.close()
            
            return [{
                "processo_id": prazo['processo_id'],
                "numero": prazo['numero'],
                "tipo": prazo['tipo'],
                "data_vencimento": prazo['data_vencimento'],
                "tipo_prazo": prazo['tipo_prazo'],
                "dias_restantes": int(prazo['dias_restantes']) if prazo['dias_restantes'] else 0,
                "responsavel": prazo['responsavel'],
                "situacao": "vencido" if prazo['dias_restantes'] < 0 else "vencendo"
            } for prazo in prazos]
            
        except Exception as e:
            print(f"Erro ao obter prazos vencendo: {e}")
            return []
    
    # ============================================
    # GERENCIAMENTO DE ANDAMENTOS
    # ============================================
    
    def adicionar_andamento(self, processo_id, data_movimentacao, tipo_andamento, descricao, 
                           destino_origem=None, usuario_id=None, usuario_tipo=None, 
                           observacoes=None, documento_anexo=None):
        """Adiciona um andamento ao processo"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            andamento_id = str(uuid.uuid4())
            
            cursor.execute('''
                INSERT INTO andamentos_processo (
                    id, processo_id, data_movimentacao, tipo_andamento, descricao,
                    destino_origem, usuario_responsavel_id, usuario_responsavel_tipo,
                    observacoes, documento_anexo
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                andamento_id, processo_id, data_movimentacao, tipo_andamento, descricao,
                destino_origem, usuario_id, usuario_tipo, observacoes, documento_anexo
            ))
            
            conn.commit()
            conn.close()
            
            return {"sucesso": True, "mensagem": "Andamento adicionado com sucesso!", "andamento_id": andamento_id}
            
        except Exception as e:
            return {"sucesso": False, "mensagem": f"Erro ao adicionar andamento: {str(e)}"}
    
    def listar_andamentos_processo(self, processo_id):
        """Lista todos os andamentos de um processo"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            cursor.execute('''
                SELECT 
                    a.id, a.data_movimentacao, a.tipo_andamento, a.descricao,
                    a.destino_origem, a.observacoes, a.documento_anexo, a.created_at,
                    COALESCE(u.nome, 'Sistema') as usuario_nome,
                    COALESCE(u.posto_graduacao, '') as posto_graduacao
                FROM andamentos_processo a
                LEFT JOIN usuarios u ON a.usuario_responsavel_id = u.id
                WHERE a.processo_id = %s
                ORDER BY a.data_movimentacao DESC, a.created_at DESC
            ''', (processo_id,))
            
            andamentos = cursor.fetchall()
            conn.close()
            
            return [{
                "id": and_['id'],
                "data_movimentacao": and_['data_movimentacao'],
                "tipo_andamento": and_['tipo_andamento'],
                "descricao": and_['descricao'],
                "destino_origem": and_['destino_origem'],
                "observacoes": and_['observacoes'],
                "documento_anexo": and_['documento_anexo'],
                "created_at": and_['created_at'],
                "usuario_nome": and_['usuario_nome'],
                "posto_graduacao": and_['posto_graduacao'],
                "usuario_completo": f"{and_['posto_graduacao']} {and_['usuario_nome']}".strip()
            } for and_ in andamentos]
            
        except Exception as e:
            print(f"Erro ao listar andamentos: {e}")
            return []
    
    def obter_ultimo_andamento(self, processo_id):
        """Retorna o último andamento de um processo"""
        andamentos = self.listar_andamentos_processo(processo_id)
        return andamentos[0] if andamentos else None
    
    # ============================================
    # ADAPTAÇÕES PARA CHAMADAS EXISTENTES NO MAIN
    # ============================================
    def _descobrir_usuario_tipo(self, cursor, usuario_id):
        """Retorna 'usuario' ou None baseado no id informado."""
        if not usuario_id:
            return None
        try:
            cursor.execute("SELECT 1 FROM usuarios WHERE id = %s AND ativo = TRUE", (usuario_id,))
            if cursor.fetchone():
                return 'usuario'
        except Exception:
            pass
        return None
    
    def registrar_andamento(self, processo_id, tipo_andamento, descricao, data_andamento=None, responsavel_id=None, observacoes=None):
        """Compatível com main: cria um andamento (tabela andamentos_processo)."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            # Normalizar tipo para respeitar o CHECK constraint
            tipos_validos = {
                'abertura', 'recebimento', 'encaminhamento', 'retorno',
                'conclusao', 'arquivamento', 'prorrogacao', 'outro'
            }
            tipo_norm = (tipo_andamento or 'outro').strip().lower()
            if tipo_norm not in tipos_validos:
                tipo_norm = 'outro'
            
            # Data padrão: hoje
            from datetime import datetime as _dt
            data_mov = data_andamento or _dt.now().strftime("%Y-%m-%d")
            
            # Descobrir tipo do usuário
            usuario_tipo = self._descobrir_usuario_tipo(cursor, responsavel_id)
            
            andamento_id = str(uuid.uuid4())
            cursor.execute('''
                INSERT INTO andamentos_processo (
                    id, processo_id, data_movimentacao, tipo_andamento, descricao,
                    destino_origem, usuario_responsavel_id, usuario_responsavel_tipo,
                    observacoes, documento_anexo
                ) VALUES (%s, %s, %s, %s, %s, NULL, %s, %s, %s, NULL)
            ''', (
                andamento_id, processo_id, data_mov, tipo_norm, descricao,
                responsavel_id, usuario_tipo, observacoes
            ))
            conn.commit()
            conn.close()
            return {"sucesso": True, "mensagem": "Andamento registrado com sucesso", "andamento_id": andamento_id}
        except Exception as e:
            return {"sucesso": False, "mensagem": f"Erro ao registrar andamento: {str(e)}"}
    
    def concluir_prazo(self, prazo_id, observacoes=None, responsavel_id=None):
        """Compatível com main: marca um prazo como concluído (desativa)."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            # Obter dados do prazo para log/andamento
            cursor.execute("SELECT processo_id, data_vencimento FROM prazos_processo WHERE id = %s", (prazo_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return {"sucesso": False, "mensagem": "Prazo não encontrado"}
            proc_id, data_venc = row['processo_id'], row['data_vencimento']
            
            # Desativar prazo
            cursor.execute("UPDATE prazos_processo SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = %s", (prazo_id,))
            
            # Registrar andamento de conclusão (opcional)
            try:
                msg = f"Prazo concluído. Vencimento: {data_venc}."
                if observacoes:
                    msg += f" Observações: {observacoes}"
                usuario_tipo = self._descobrir_usuario_tipo(cursor, responsavel_id)
                andamento_id = str(uuid.uuid4())
                from datetime import datetime as _dt
                cursor.execute('''
                    INSERT INTO andamentos_processo (
                        id, processo_id, data_movimentacao, tipo_andamento, descricao,
                        destino_origem, usuario_responsavel_id, usuario_responsavel_tipo,
                        observacoes, documento_anexo
                    ) VALUES (%s, %s, %s, 'conclusao', %s, NULL, %s, %s, %s, NULL)
                ''', (
                    andamento_id, proc_id, _dt.now().strftime("%Y-%m-%d"), msg,
                    responsavel_id, usuario_tipo, observacoes
                ))
            except Exception:
                # Não falhar por causa do andamento
                pass
            
            conn.commit()
            conn.close()
            return {"sucesso": True, "mensagem": "Prazo concluído com sucesso"}
        except Exception as e:
            return {"sucesso": False, "mensagem": f"Erro ao concluir prazo: {str(e)}"}
    
    # ============================================
    # STATUS DETALHADO (TABELA DEDICADA)
    # ============================================
    def atualizar_status_detalhado(self, processo_id, novo_status, observacoes=None, responsavel_id=None):
        """Ativa um novo status detalhado (desativa o anterior)."""
        try:
            if not novo_status:
                return {"sucesso": False, "mensagem": "Status inválido"}
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            # Garantir status na tabela de catálogo
            cursor.execute("SELECT 1 FROM status_processo WHERE codigo = %s", (novo_status,))
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO status_processo (id, codigo, descricao, ativo) VALUES (%s, %s, %s, 1)",
                    (str(uuid.uuid4()), novo_status, novo_status)
                )
            # Desativar status atual
            cursor.execute(
                "UPDATE status_detalhado_processo SET ativo = FALSE WHERE processo_id = %s AND ativo = TRUE",
                (processo_id,)
            )
            # Inserir novo status
            from datetime import datetime as _dt
            usuario_tipo = self._descobrir_usuario_tipo(cursor, responsavel_id)
            sid = str(uuid.uuid4())
            cursor.execute('''
                INSERT INTO status_detalhado_processo (
                    id, processo_id, status_codigo, data_alteracao, usuario_id, usuario_tipo, observacoes, ativo
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, 1)
            ''', (sid, processo_id, novo_status, _dt.now().strftime("%Y-%m-%d"), responsavel_id, usuario_tipo, observacoes))
            conn.commit()
            conn.close()
            return {"sucesso": True, "mensagem": "Status atualizado"}
        except Exception as e:
            return {"sucesso": False, "mensagem": f"Erro ao atualizar status: {str(e)}"}
    
    def obter_status_detalhado(self, processo_id):
        """Retorna o histórico de status detalhado (mais recente primeiro)."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cursor.execute('''
                SELECT s.id, s.status_codigo, s.data_alteracao, s.observacoes, s.ativo,
                       COALESCE(u.nome, 'Sistema') as usuario_nome
                FROM status_detalhado_processo s
                LEFT JOIN usuarios u ON s.usuario_id = u.id
                WHERE s.processo_id = %s
                ORDER BY s.data_alteracao DESC, s.created_at DESC
            ''', (processo_id,))
            rows = cursor.fetchall()
            conn.close()
            return [{
                "id": r['id'], "status": r['status_codigo'], "data": r['data_alteracao'], "observacoes": r['observacoes'], "ativo": bool(r['ativo']), "usuario": r['usuario_nome']
            } for r in rows]
        except Exception as e:
            return []
    
    # ============================================
    # DASHBOARD E RELATÓRIOS
    # ============================================
    def obter_dashboard_prazos(self):
        """Resumo para dashboard com base no prazo ativo (ou ausência dele)."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cursor.execute('''
                SELECT 
                    CASE 
                        WHEN pr.data_vencimento IS NULL THEN 'sem_prazo'
                        WHEN pr.data_vencimento < DATE('now') THEN 'vencido'
                        WHEN pr.data_vencimento <= DATE('now', '+7 days') THEN 'vencendo'
                        ELSE 'no_prazo'
                    END as situacao,
                    COUNT(*)
                FROM processos_procedimentos p
                LEFT JOIN prazos_processo pr ON p.id = pr.processo_id AND pr.ativo = TRUE
                WHERE p.ativo = TRUE
                GROUP BY situacao
            ''')
            mapa = { 'vencido': 0, 'vencendo': 0, 'no_prazo': 0, 'sem_prazo': 0 }
            total = 0
            for row in cursor.fetchall():
                mapa[row[0]] = row[1]
                total += row[1]
            conn.close()
            return {
                "total_processos": total,
                "vencidos": mapa['vencido'],
                "vencendo_7_dias": mapa['vencendo'],
                "em_dia": mapa['no_prazo'],
                "sem_prazo": mapa['sem_prazo']
            }
        except Exception as e:
            return {
                "total_processos": 0,
                "vencidos": 0,
                "vencendo_7_dias": 0,
                "em_dia": 0,
                "sem_prazo": 0
            }
    
    def gerar_relatorio_processo(self, processo_id):
        """Relatório consolidado de um processo/procedimento."""
        try:
            conn = self.get_connection()
            c = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            c.execute('''
                SELECT id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                       data_instauracao, data_recebimento, concluido, data_conclusao,
                       responsavel_id, responsavel_tipo, local_origem
                FROM processos_procedimentos
                WHERE id = %s AND ativo = TRUE
            ''', (processo_id,))
            p = c.fetchone()
            if not p:
                conn.close()
                return {"sucesso": False, "mensagem": "Processo não encontrado"}
            # Prazo ativo
            c.execute("SELECT data_inicio, data_vencimento, dias_adicionados, tipo_prazo, numero_portaria, data_portaria, ordem_prorrogacao FROM prazos_processo WHERE processo_id = %s AND ativo = TRUE", (processo_id,))
            prazo_ativo = c.fetchone()
            # Prorrogações
            c.execute("SELECT data_inicio, data_vencimento, dias_adicionados, numero_portaria, data_portaria, ordem_prorrogacao FROM prazos_processo WHERE processo_id = %s AND tipo_prazo = 'prorrogacao' ORDER BY COALESCE(ordem_prorrogacao,0)", (processo_id,))
            prorrogs = c.fetchall()
            # Últimos andamentos
            c.execute("SELECT data_movimentacao, tipo_andamento, descricao FROM andamentos_processo WHERE processo_id = %s ORDER BY data_movimentacao DESC, created_at DESC LIMIT 5", (processo_id,))
            and5 = c.fetchall()
            conn.close()
            return {
                "sucesso": True,
                "processo": {
                    "id": p[0], "numero": p[1], "tipo_geral": p[2], "tipo_detalhe": p[3],
                    "documento_iniciador": p[4], "data_instauracao": p[5], "data_recebimento": p[6],
                    "concluido": bool(p[7]) if p[7] is not None else False, "data_conclusao": p[8],
                    "responsavel_id": p[9], "responsavel_tipo": p[10], "local_origem": p[11]
                },
                "prazo_ativo": None if not prazo_ativo else {
                    "data_inicio": prazo_ativo[0], "data_vencimento": prazo_ativo[1], "dias": prazo_ativo[2],
                    "tipo": prazo_ativo[3], "numero_portaria": prazo_ativo[4], "data_portaria": prazo_ativo[5],
                    "ordem_prorrogacao": prazo_ativo[6]
                },
                "prorrogacoes": [{
                    "data_inicio": r[0], "data_vencimento": r[1], "dias": r[2],
                    "numero_portaria": r[3], "data_portaria": r[4], "ordem_prorrogacao": r[5]
                } for r in prorrogs],
                "andamentos_recent": [{"data": a[0], "tipo": a[1], "descricao": a[2]} for a in and5]
            }
        except Exception as e:
            return {"sucesso": False, "mensagem": f"Erro ao gerar relatório: {str(e)}"}
    
    def gerar_relatorio_prazos(self, filtros=None):
        """Relatório agregado de prazos; usa o agrupamento por situação de prazo."""
        try:
            # Reaproveitar o relatório já existente
            data_inicio = filtros.get('data_inicio') if filtros else None
            data_fim = filtros.get('data_fim') if filtros else None
            grupos = self.relatorio_processos_por_prazo(data_inicio, data_fim)
            total = sum(g.get('total', 0) for g in grupos)
            return {"total": total, "grupos": grupos}
        except Exception as e:
            return {"total": 0, "grupos": [], "erro": str(e)}
    
    # ============================================
    # RELATÓRIOS E CONSULTAS
    # ============================================
    
    def relatorio_processos_por_prazo(self, data_inicio=None, data_fim=None):
        """Relatório de processos agrupados por situação de prazo"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            where_clause = "WHERE p.ativo = TRUE"
            params = []
            
            if data_inicio and data_fim:
                where_clause += " AND p.data_instauracao BETWEEN %s AND %s"
                params.extend([data_inicio, data_fim])
            
            cursor.execute(f'''
                SELECT 
                    CASE 
                        WHEN pr.data_vencimento IS NULL THEN 'sem_prazo'
                        WHEN pr.data_vencimento < DATE('now') THEN 'vencido'
                        WHEN pr.data_vencimento <= DATE('now', '+7 days') THEN 'vencendo'
                        ELSE 'no_prazo'
                    END as situacao_prazo,
                    COUNT(*) as total,
                    COUNT(CASE WHEN p.tipo_geral = 'processo' THEN 1 END) as processos,
                    COUNT(CASE WHEN p.tipo_geral = 'procedimento' THEN 1 END) as procedimentos
                FROM processos_procedimentos p
                LEFT JOIN prazos_processo pr ON p.id = pr.processo_id AND pr.ativo = TRUE
                {where_clause}
                GROUP BY situacao_prazo
                ORDER BY 
                    CASE situacao_prazo 
                        WHEN 'vencido' THEN 1 
                        WHEN 'vencendo' THEN 2 
                        WHEN 'no_prazo' THEN 3 
                        WHEN 'sem_prazo' THEN 4 
                    END
            ''', params)
            
            resultado = cursor.fetchall()
            conn.close()
            
            return [{
                "situacao_prazo": row[0],
                "total": row[1],
                "processos": row[2],
                "procedimentos": row[3]
            } for row in resultado]
            
        except Exception as e:
            print(f"Erro no relatório por prazo: {e}")
            return []
    
    def relatorio_andamentos_por_periodo(self, data_inicio, data_fim):
        """Relatório de andamentos por período"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            cursor.execute('''
                SELECT 
                    a.tipo_andamento,
                    COUNT(*) as total,
                    COUNT(DISTINCT a.processo_id) as processos_distintos
                FROM andamentos_processo a
                WHERE a.data_movimentacao BETWEEN %s AND %s
                GROUP BY a.tipo_andamento
                ORDER BY total DESC
            ''', (data_inicio, data_fim))
            
            resultado = cursor.fetchall()
            conn.close()
            
            return [{
                "tipo_andamento": row[0],
                "total_andamentos": row[1],
                "processos_distintos": row[2]
            } for row in resultado]
            
        except Exception as e:
            print(f"Erro no relatório de andamentos: {e}")
            return []

# Instância global para uso no main.py
prazos_andamentos_manager = PrazosAndamentosManager()
