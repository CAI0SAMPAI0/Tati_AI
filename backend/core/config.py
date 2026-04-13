from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # autenticação
    jwt_secret_key: str = 'changeme-insecure'
    jwt_algorithm: str = 'HS256'
    access_token_expire_minutes: int = 21600
    
    # Google OAuth
    google_client_id: str = ''
    
    # Supabase
    supabase_url: str = ''
    supabase_key: str = ''
    
    # LLM - Gemini, Groq, Claude
    llm_provider: str = 'groq'
    claude_model: str = 'claude-3-5-sonnet-20241022'
    gemini_model: str = 'gemini-2.0-flash'
    anthropic_api_key: str = ''
    gemini_api_key: str = ''

    # prompt
    system_prompt: str = (
        "You are TATI, a dedicated, friendly and objective English teacher. "
        "Your goal is to help the student practice conversation and improve their English.\n\n"
        "CRITICAL LANGUAGE RULE:\n"
        "1. ALWAYS write your ENTIRE response in ENGLISH ONLY.\n"
        "2. Do NOT translate the student's message into Portuguese.\n"
        "3. Even if the student writes in Portuguese, respond ONLY in English — "
        "gently remind them to write in English.\n"
        "4. The ONLY exception: if the student explicitly asks 'how do you say X in Portuguese?' "
        "— give only that translation, then continue in English.\n\n"
        "CORRECTION GUIDELINES:\n"
        "5. Always identify grammar, vocabulary, or pronunciation mistakes.\n"
        "6. After your reply, add a short '📝 Feedback' section in English.\n"
        "7. Point out errors gently, adapted to the student's level.\n"
        "8. If no errors, give brief positive reinforcement.\n"
        "9. Keep feedback concise and encouraging.\n\n"
        "Example format:\n"
        "Your conversational reply...\n\n"
        "📝 Feedback:\n"
        "- 'I go to school yesterday' → 'I went to school yesterday' (past tense).\n"
    )
    
    
    # Groq com múltiplas chaves
    groq_api_key: str = ""
    groq_api_key_1: str = ""
    groq_api_key_2: str = ""
    groq_api_key_3: str = ""
    groq_api_key_4: str = ""
    groq_api_key_5: str = ""
    
    # Voz TTS
    elevenlabs_api_key: str = ''
    voice_id: str = '21m00Tcm4TlvDq8ikWAM'
    
    # SMTP - envio de emails personalizados
    smtp_host: str = 'smtp.gmail.com'
    smtp_port: int = 587
    smtp_user: str = ''
    smtp_password: str = ''
    smtp_from: str = ''
    
    # email com resend
    resend_api_key: str = ''

    # Asaas Pagamentos
    api_asaas: str = Field('', validation_alias='API_ASAAS')
    asaas_environment: str = Field('sandbox', validation_alias='ASAAS_ENVIRONMENT')
    asaas_webhook_token: str = "" 


    model_config = SettingsConfigDict(env_file='.env', extra='ignore', case_sensitive=False)

    def __init__(self, **values):
        super().__init__(**values)
        import os
        # Fallback manual reforçado
        if not self.api_asaas:
            self.api_asaas = os.getenv('API_ASAAS', '')
        
        env_val = os.getenv('ASAAS_ENVIRONMENT', '').lower()
        if env_val:
            self.asaas_environment = env_val
        elif not self.asaas_environment:
            self.asaas_environment = 'sandbox'
    
    @property
    def groq_keys(self) -> list[str]:
        # retorna uma lista de chaves do Groq, sem duplicatas ou vazias
        candidates = [
            self.groq_api_key,
            self.groq_api_key_1,
            self.groq_api_key_2,
            self.groq_api_key_3,
            self.groq_api_key_4,
            self.groq_api_key_5,
        ]
        return [k.strip() for k in candidates if k.strip()]
    
    @property
    def smtp_from_address(self) -> str:
        # retorna o endereço de email do remetente para SMTP
        return self.smtp_from or self.smtp_user
    
    @property
    def staff_roles(self) -> tuple[str, ...]:
        # define quais papéis são considerados "staff" para acesso a certas rotas
        return ("professor", "professora", 'Professor', 'Professora', "programador", "Tatiana", "Tati", 'Tatiana Duarte')

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()