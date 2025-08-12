# prazos_andamentos_manager.py - Gerenciador de Prazos e Andamentos
import sqlite3
import uuid
from datetime import datetime, timedelta
import json

class PrazosAndamentosManager:
    """Gerenciador de prazos e andamentos dos processos"""
    
    def __init__(self, db_path='usuarios.db'):
        self.db_path = db_path
    
    def get_connection(self):
        """Retorna conexão com o banco"""
        return sqlite3.connect(self.db_path)
    
    # ============================================
    # GERENCIAMENTO DE PRAZOS
    # ============================================
    
    def adicionar_prazo_inicial(self, processo_id, data_inicio, dias_prazo, motivo=None, autorizado_por=None, autorizado_tipo=None):
        """Adiciona prazo inicial para um processo"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Calcular data de vencimento
            data_inicio_obj = datetime.strptime(data_inicio, "%Y-%m-%d")
            data_vencimento = data_inicio_obj + timedelta(days=dias_prazo)
            
            prazo_id = str(uuid.uuid4())
            
            cursor.execute('''
                INSERT INTO prazos_processo (
                    id, processo_id, tipo_prazo, data_inicio, data_vencimento, 
                    dias_adicionados, motivo, autorizado_por, autorizado_tipo, ativo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            cursor = conn.cursor()

            # Garantir colunas novas (numero_portaria, data_portaria, ordem_prorrogacao)
            try:
                cursor.execute("PRAGMA table_info(prazos_processo)")
                cols = [c[1] for c in cursor.fetchall()]
                if 'numero_portaria' not in cols:
                    cursor.execute("ALTER TABLE prazos_processo ADD COLUMN numero_portaria TEXT")
                if 'data_portaria' not in cols:
                    cursor.execute("ALTER TABLE prazos_processo ADD COLUMN data_portaria DATE")
                if 'ordem_prorrogacao' not in cols:
                    cursor.execute("ALTER TABLE prazos_processo ADD COLUMN ordem_prorrogacao INTEGER")
                conn.commit()
            except Exception:
                pass
            
            # Buscar prazo atual
            cursor.execute('''
                SELECT id, data_vencimento, dias_adicionados 
                FROM prazos_processo 
                WHERE processo_id = ? AND ativo = 1
            ''', (processo_id,))
            
            prazo_atual = cursor.fetchone()
            if not prazo_atual:
                # Tentar criar prazo inicial automaticamente com base na data_recebimento e regras
                cursor.execute("""
                    SELECT tipo_detalhe, documento_iniciador, data_recebimento
                    FROM processos_procedimentos
                    WHERE id = ? AND ativo = 1
                """, (processo_id,))
                proc = cursor.fetchone()
                if not proc:
                    return {"sucesso": False, "mensagem": "Processo não encontrado ou inativo"}
                tipo_detalhe, documento_iniciador, data_recebimento = proc
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
                data_inicio_obj = datetime.strptime(data_recebimento, "%Y-%m-%d")
                data_vencimento_ini = data_inicio_obj + timedelta(days=dias_base)
                prazo_id_ini = str(uuid.uuid4())
                cursor.execute('''
                    INSERT INTO prazos_processo (
                        id, processo_id, tipo_prazo, data_inicio, data_vencimento,
                        dias_adicionados, motivo, autorizado_por, autorizado_tipo, ativo
                    ) VALUES (?, ?, 'inicial', ?, ?, ?, ?, ?, ?, 1)
                ''', (
                    prazo_id_ini, processo_id, data_recebimento, data_vencimento_ini.strftime("%Y-%m-%d"),
                    dias_base, 'Prazo inicial automático', autorizado_por, autorizado_tipo
                ))
                conn.commit()
                # Recarregar prazo atual
                cursor.execute('''
                    SELECT id, data_vencimento, dias_adicionados 
                    FROM prazos_processo 
                    WHERE processo_id = ? AND ativo = 1
                ''', (processo_id,))
                prazo_atual = cursor.fetchone()
                if not prazo_atual:
                    return {"sucesso": False, "mensagem": "Não foi possível iniciar prazo do processo"}
            
            # Desativar prazo atual
            cursor.execute('''
                UPDATE prazos_processo 
                SET ativo = 0, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            ''', (prazo_atual[0],))
            
            # Calcular nova data de vencimento
            # Dia inicial da contagem é o dia seguinte ao vencimento atual
            data_vencimento_atual = datetime.strptime(prazo_atual[1], "%Y-%m-%d")
            inicio_prorrogacao = data_vencimento_atual + timedelta(days=1)
            nova_data_vencimento = inicio_prorrogacao + timedelta(days=dias_prorrogacao - 1) if dias_prorrogacao and dias_prorrogacao > 0 else inicio_prorrogacao

            # Calcular a ordem da prorrogação (nº sequencial)
            cursor.execute('''
                SELECT COALESCE(MAX(ordem_prorrogacao), 0)
                FROM prazos_processo
                WHERE processo_id = ? AND tipo_prazo = 'prorrogacao'
            ''', (processo_id,))
            ordem_atual = cursor.fetchone()[0] or 0
            proxima_ordem = ordem_atual + 1
            
            # Criar novo prazo (prorrogação)
            novo_prazo_id = str(uuid.uuid4())
            cursor.execute('''
                INSERT INTO prazos_processo (
                    id, processo_id, tipo_prazo, data_inicio, data_vencimento,
                    dias_adicionados, motivo, autorizado_por, autorizado_tipo, ativo,
                    numero_portaria, data_portaria, ordem_prorrogacao
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                novo_prazo_id, processo_id, 'prorrogacao', 
                data_vencimento_atual.strftime("%Y-%m-%d"), nova_data_vencimento.strftime("%Y-%m-%d"),
                dias_prorrogacao, motivo, autorizado_por, autorizado_tipo, 1,
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
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, tipo_prazo, data_inicio, data_vencimento, dias_adicionados,
                       motivo, autorizado_por, autorizado_tipo, ativo,
                       numero_portaria, data_portaria, ordem_prorrogacao, created_at
                FROM prazos_processo
                WHERE processo_id = ?
                ORDER BY 
                    CASE tipo_prazo WHEN 'inicial' THEN 0 ELSE 1 END,
                    COALESCE(ordem_prorrogacao, 0)
            ''', (processo_id,))
            rows = cursor.fetchall()
            conn.close()
            result = []
            for r in rows:
                result.append({
                    "id": r[0],
                    "tipo_prazo": r[1],
                    "data_inicio": r[2],
                    "data_vencimento": r[3],
                    "dias_adicionados": r[4],
                    "motivo": r[5],
                    "autorizado_por": r[6],
                    "autorizado_tipo": r[7],
                    "ativo": bool(r[8]),
                    "numero_portaria": r[9],
                    "data_portaria": r[10],
                    "ordem_prorrogacao": r[11],
                    "created_at": r[12]
                })
            return result
        except Exception as e:
            print(f"Erro ao listar prazos do processo: {e}")
            return []
    
    def obter_prazos_vencendo(self, dias_antecedencia=7):
        """Retorna processos com prazos vencendo"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT 
                    p.id, p.numero, p.tipo_detalhe,
                    pr.data_vencimento, pr.tipo_prazo,
                    JULIANDAY(pr.data_vencimento) - JULIANDAY(DATE('now')) as dias_restantes,
                    COALESCE(o.nome, e.nome, 'Desconhecido') as responsavel
                FROM processos_procedimentos p
                INNER JOIN prazos_processo pr ON p.id = pr.processo_id AND pr.ativo = 1
                LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
                LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
                WHERE p.ativo = 1 
                  AND pr.data_vencimento <= DATE('now', '+{} days')
                ORDER BY pr.data_vencimento ASC
            '''.format(dias_antecedencia))
            
            prazos = cursor.fetchall()
            conn.close()
            
            return [{
                "processo_id": prazo[0],
                "numero": prazo[1],
                "tipo": prazo[2],
                "data_vencimento": prazo[3],
                "tipo_prazo": prazo[4],
                "dias_restantes": int(prazo[5]) if prazo[5] else 0,
                "responsavel": prazo[6],
                "situacao": "vencido" if prazo[5] < 0 else "vencendo"
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
            cursor = conn.cursor()
            
            andamento_id = str(uuid.uuid4())
            
            cursor.execute('''
                INSERT INTO andamentos_processo (
                    id, processo_id, data_movimentacao, tipo_andamento, descricao,
                    destino_origem, usuario_responsavel_id, usuario_responsavel_tipo,
                    observacoes, documento_anexo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT 
                    a.id, a.data_movimentacao, a.tipo_andamento, a.descricao,
                    a.destino_origem, a.observacoes, a.documento_anexo, a.created_at,
                    COALESCE(o.nome, e.nome, 'Sistema') as usuario_nome,
                    COALESCE(o.posto_graduacao, e.posto_graduacao, '') as posto_graduacao
                FROM andamentos_processo a
                LEFT JOIN operadores o ON a.usuario_responsavel_id = o.id AND a.usuario_responsavel_tipo = 'operador'
                LEFT JOIN encarregados e ON a.usuario_responsavel_id = e.id AND a.usuario_responsavel_tipo = 'encarregado'
                WHERE a.processo_id = ?
                ORDER BY a.data_movimentacao DESC, a.created_at DESC
            ''', (processo_id,))
            
            andamentos = cursor.fetchall()
            conn.close()
            
            return [{
                "id": and_[0],
                "data_movimentacao": and_[1],
                "tipo_andamento": and_[2],
                "descricao": and_[3],
                "destino_origem": and_[4],
                "observacoes": and_[5],
                "documento_anexo": and_[6],
                "created_at": and_[7],
                "usuario_nome": and_[8],
                "posto_graduacao": and_[9],
                "usuario_completo": f"{and_[9]} {and_[8]}".strip()
            } for and_ in andamentos]
            
        except Exception as e:
            print(f"Erro ao listar andamentos: {e}")
            return []
    
    def obter_ultimo_andamento(self, processo_id):
        """Retorna o último andamento de um processo"""
        andamentos = self.listar_andamentos_processo(processo_id)
        return andamentos[0] if andamentos else None
    
    # ============================================
    # RELATÓRIOS E CONSULTAS
    # ============================================
    
    def relatorio_processos_por_prazo(self, data_inicio=None, data_fim=None):
        """Relatório de processos agrupados por situação de prazo"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            where_clause = "WHERE p.ativo = 1"
            params = []
            
            if data_inicio and data_fim:
                where_clause += " AND p.data_instauracao BETWEEN ? AND ?"
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
                LEFT JOIN prazos_processo pr ON p.id = pr.processo_id AND pr.ativo = 1
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
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT 
                    a.tipo_andamento,
                    COUNT(*) as total,
                    COUNT(DISTINCT a.processo_id) as processos_distintos
                FROM andamentos_processo a
                WHERE a.data_movimentacao BETWEEN ? AND ?
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
