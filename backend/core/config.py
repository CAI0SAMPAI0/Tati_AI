from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):

    port: int = 8000
    debug: bool = False
    
    # Autenticação
    jwt_secret_key: str = Field(...)
    jwt_algorithm: str = 'HS256'
    access_token_expire_minutes: int = 21600
    
    # Google OAuth
    google_client_id: str = ''
    
    # Supabase
    supabase_url: str = ''
    supabase_key: str = ''
    supabase_service_key: str = Field('', validation_alias='SUPABASE_SERVICE_KEY')
    
    # LLM Providers
    llm_provider: str = 'groq'
    claude_model: str = 'claude-3-5-sonnet-20241022'
    gemini_model: str = 'gemini-2.0-flash'
    anthropic_api_key: str = ''
    gemini_api_key: str = ''

    # Prompt do Sistema
    system_prompt: str = (
        "You are TATI, a dedicated, friendly and objective English teacher. "
        "Your goal is to help the student practice conversation and improve their English.\n\n"
        "CONVERSATIONAL RULES:\n"
        "1. Be EXTREMELY concise. Respond only to what the student said.\n"
        "2. DO NOT provide detailed explanations or grammar lessons during the conversation flow unless explicitly asked.\n"
        "3. DO NOT include a '📝 Feedback' or 'Correction' section in your regular conversational replies. Feedback is only for the Summary.\n"
        "4. If the student wants to end the chat (e.g., 'goodbye', 'I'm done'), gently invite them to click the 'Summary' button for a full report and exercises.\n"
        "5. NEVER translate the student's message into Portuguese unless asked 'how do you say X'.\n\n"
        "6. ALWAYS respond in English only. NEVER write your replies in Portuguese, even if the student writes to you in Portuguese. You may briefly acknowledge what they wrote but always reply in English.\n"
        "REPORT & DOCUMENT GENERATION:\n"
        "1. DO NOT generate reports, study materials, or PDFs unless the student EXPLICITLY asks for one (e.g., 'generate a PDF', 'I want a study report').\n"
        "2. If requested, provide the full content in Markdown starting with '# 📊 STUDY REPORT - Teacher Tati'.\n"
        "3. VOICE MODE RESTRICTION: If the user is in Voice Mode (speaking via audio), DO NOT generate PDFs or long reports, as they are hard to read. Suggest switching to Chat Mode for reports.\n"
    )
    
    # Groq Multi-key
    groq_api_key: str = ""
    groq_api_key_1: str = ""
    groq_api_key_2: str = ""
    groq_api_key_3: str = ""
    groq_api_key_4: str = ""
    groq_api_key_5: str = ""
    
    # Voz TTS Multi-key
    elevenlabs_api_key: str = Field('', validation_alias='ELEVENLABS_API_KEY')
    elevenlabs_api_key_1: str = Field('', validation_alias='ELEVENLABS_API_KEY_1')
    elevenlabs_api_key_2: str = Field('', validation_alias='ELEVENLABS_API_KEY_2')
    elevenlabs_api_key_3: str = Field('', validation_alias='ELEVENLABS_API_KEY_3')
    voice_id: str = Field('9BWTSay5S4Btt9P88fC2', validation_alias='VOICE_ID')
    
    # OpenAI (Voz barata)
    openai_api_key: str = Field('', validation_alias='OPENAI_API_KEY')
    
    # SMTP / Email
    smtp_host: str = 'smtp.gmail.com'
    smtp_port: int = 587
    smtp_user: str = ''
    smtp_password: str = ''
    smtp_from: str = ''
    resend_api_key: str = ''

    # Asaas Pagamentos
    api_asaas: str = Field('', validation_alias='API_ASAAS')
    asaas_environment: str = Field('sandbox', validation_alias='ASAAS_ENVIRONMENT')
    asaas_webhook_token: str = "" 

    model_config = SettingsConfigDict(env_file='.env', extra='ignore', case_sensitive=False)

    def __init__(self, **values):
        super().__init__(**values)
        import os
        # Fallback manual reforçado para Asaas
        if not self.api_asaas:
            self.api_asaas = os.getenv('API_ASAAS', '')
        
        env_val = os.getenv('ASAAS_ENVIRONMENT', '').lower()
        if env_val:
            self.asaas_environment = env_val
        elif not self.asaas_environment:
            self.asaas_environment = 'sandbox'
    
    @property
    def groq_keys(self) -> list[str]:
        candidates = [self.groq_api_key, self.groq_api_key_1, self.groq_api_key_2, 
                      self.groq_api_key_3, self.groq_api_key_4, self.groq_api_key_5]
        return [k.strip() for k in candidates if k.strip()]

    @property
    def eleven_keys(self) -> list[str]:
        candidates = [self.elevenlabs_api_key, self.elevenlabs_api_key_1, 
                      self.elevenlabs_api_key_2, self.elevenlabs_api_key_3]
        return [k.strip() for k in candidates if k.strip()]
    
    @property
    def smtp_from_address(self) -> str:
        return self.smtp_from or self.smtp_user
    
    @property
    def staff_roles(self) -> tuple[str, ...]:
        return ("professor", "professora", "Professor", "Professora", "programador", "Tatiana", "Tati", "Tatiana Duarte", 'caio.sampaio', 'Caio Sampaio')

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()