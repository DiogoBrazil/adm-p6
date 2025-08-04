# enhanced_security.py - Melhorias de Segurança para o Sistema ADM-P6
import hashlib
import secrets
import bcrypt
import time
from functools import wraps

class PasswordManager:
    """Gerenciador avançado de senhas com bcrypt"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Gera hash seguro da senha usando bcrypt"""
        # Gerar salt aleatório
        salt = bcrypt.gensalt(rounds=12)  # 12 rounds = bom equilíbrio segurança/performance
        
        # Gerar hash
        password_bytes = password.encode('utf-8')
        hashed = bcrypt.hashpw(password_bytes, salt)
        
        return hashed.decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """Verifica se a senha corresponde ao hash"""
        try:
            password_bytes = password.encode('utf-8')
            hashed_bytes = hashed.encode('utf-8')
            return bcrypt.checkpw(password_bytes, hashed_bytes)
        except Exception:
            return False
    
    @staticmethod
    def is_bcrypt_hash(hash_string: str) -> bool:
        """Verifica se o hash é do formato bcrypt"""
        return hash_string.startswith('$2b$') or hash_string.startswith('$2a$') or hash_string.startswith('$2y$')
    
    @staticmethod
    def migrate_legacy_hash(old_hash: str, password: str) -> str:
        """Migra hash legado (SHA-256) para bcrypt se a senha for fornecida"""
        # Verificar se é hash SHA-256 legado
        if len(old_hash) == 64 and all(c in '0123456789abcdef' for c in old_hash.lower()):
            # Verificar se a senha fornecida gera o hash legado
            sha256_hash = hashlib.sha256(password.encode()).hexdigest()
            if sha256_hash == old_hash:
                # Migrar para bcrypt
                return PasswordManager.hash_password(password)
        
        return old_hash  # Retornar hash original se não puder migrar

class SessionManager:
    """Gerenciador de sessões seguras"""
    
    def __init__(self):
        self.sessions = {}
        self.session_timeout = 3600  # 1 hora
    
    def create_session(self, user_id: str) -> str:
        """Cria nova sessão para o usuário"""
        session_token = secrets.token_urlsafe(32)
        
        self.sessions[session_token] = {
            'user_id': user_id,
            'created_at': time.time(),
            'last_activity': time.time()
        }
        
        return session_token
    
    def validate_session(self, session_token: str) -> dict:
        """Valida sessão e retorna dados do usuário"""
        if session_token not in self.sessions:
            return None
        
        session = self.sessions[session_token]
        current_time = time.time()
        
        # Verificar timeout
        if current_time - session['last_activity'] > self.session_timeout:
            del self.sessions[session_token]
            return None
        
        # Atualizar última atividade
        session['last_activity'] = current_time
        
        return session
    
    def destroy_session(self, session_token: str) -> bool:
        """Destroi sessão"""
        if session_token in self.sessions:
            del self.sessions[session_token]
            return True
        return False
    
    def cleanup_expired_sessions(self):
        """Remove sessões expiradas"""
        current_time = time.time()
        expired_sessions = []
        
        for token, session in self.sessions.items():
            if current_time - session['last_activity'] > self.session_timeout:
                expired_sessions.append(token)
        
        for token in expired_sessions:
            del self.sessions[token]

class SecurityValidator:
    """Validador de segurança para senhas e dados"""
    
    @staticmethod
    def validate_password_strength(password: str) -> dict:
        """Valida força da senha"""
        errors = []
        score = 0
        
        # Critérios de validação
        if len(password) < 8:
            errors.append("Senha deve ter pelo menos 8 caracteres")
        else:
            score += 1
        
        if not any(c.isupper() for c in password):
            errors.append("Senha deve conter pelo menos uma letra maiúscula")
        else:
            score += 1
        
        if not any(c.islower() for c in password):
            errors.append("Senha deve conter pelo menos uma letra minúscula")
        else:
            score += 1
        
        if not any(c.isdigit() for c in password):
            errors.append("Senha deve conter pelo menos um número")
        else:
            score += 1
        
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            errors.append("Senha deve conter pelo menos um caractere especial")
        else:
            score += 1
        
        # Verificar sequências comuns
        common_patterns = ['123', 'abc', 'qwerty', 'password', 'admin']
        if any(pattern in password.lower() for pattern in common_patterns):
            errors.append("Senha não pode conter sequências comuns")
            score -= 1
        
        # Determinar nível de força
        if score >= 4:
            strength = "forte"
        elif score >= 3:
            strength = "média"
        elif score >= 2:
            strength = "fraca"
        else:
            strength = "muito fraca"
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "score": max(0, score),
            "strength": strength
        }
    
    @staticmethod
    def sanitize_input(input_string: str) -> str:
        """Sanitiza entrada do usuário"""
        if not input_string:
            return ""
        
        # Remover caracteres perigosos
        dangerous_chars = ['<', '>', '"', "'", '&', '\0', '\r']
        sanitized = input_string
        
        for char in dangerous_chars:
            sanitized = sanitized.replace(char, "")
        
        # Limitar tamanho
        return sanitized.strip()[:1000]  # Máximo 1000 caracteres
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Valida formato de email"""
        import re
        
        if not email:
            return False
        
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None

def rate_limiter(max_attempts: int = 5, window_minutes: int = 15):
    """Decorator para rate limiting"""
    attempts = {}
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Usar IP como chave (em produção, pegar do request)
            key = "default_ip"  # Placeholder
            current_time = time.time()
            
            # Limpar tentativas antigas
            if key in attempts:
                attempts[key] = [
                    timestamp for timestamp in attempts[key]
                    if current_time - timestamp < window_minutes * 60
                ]
            
            # Verificar se excedeu limite
            if key in attempts and len(attempts[key]) >= max_attempts:
                return {
                    "sucesso": False,
                    "mensagem": f"Muitas tentativas. Tente novamente em {window_minutes} minutos."
                }
            
            # Executar função
            result = func(*args, **kwargs)
            
            # Registrar tentativa se houve falha
            if isinstance(result, dict) and not result.get("sucesso", True):
                if key not in attempts:
                    attempts[key] = []
                attempts[key].append(current_time)
            
            return result
        
        return wrapper
    return decorator

class AuditLogger:
    """Logger para auditoria de segurança"""
    
    def __init__(self, db_manager):
        self.db_manager = db_manager
    
    def log_security_event(self, event_type: str, user_id: str = None, 
                          details: str = None, ip_address: str = None):
        """Registra evento de segurança"""
        try:
            conn = self.db_manager.get_connection()
            cursor = conn.cursor()
            
            # Verificar se tabela de auditoria existe
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='auditoria'
            """)
            
            if cursor.fetchone():
                import uuid
                cursor.execute("""
                    INSERT INTO auditoria (
                        id, tabela, registro_id, operacao, 
                        usuario_id, ip_address, observacoes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(uuid.uuid4()),
                    'security_events',
                    event_type,
                    'SECURITY',
                    user_id,
                    ip_address,
                    details
                ))
                
                conn.commit()
            
            conn.close()
            
        except Exception as e:
            print(f"Erro ao registrar evento de segurança: {e}")

# Instâncias globais
password_manager = PasswordManager()
session_manager = SessionManager()
security_validator = SecurityValidator()
