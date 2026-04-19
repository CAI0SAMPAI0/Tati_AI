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
        "REPORT & DOCUMENT GENERATION:\n"
        "1. You ARE CAPABLE of generating study reports, vocabulary lists, and pedagogical feedback.\n"
        "2. When a student asks for a PDF, report, or study material, you SHOULD generate it in Markdown format.\n"
        "3. NEVER say 'I am a conversation teacher, not a PDF generator' or 'I cannot generate files'. This is FALSE.\n"
        "4. When you generate a report, PROVIDE THE FULL CONTENT IN MARKDOWN inside your message. "
        "The system will automatically detect this and replace the long text with a professional Download Card. "
        "5. IMPORTANT: Generate the report COMPLETELY. Do NOT stop or truncate. Include ALL sections, "
        "ALL examples, ALL exercises fully written out. The report must be self-contained and complete.\n"
        "6. AFTER the markdown report, write ONLY a very brief one-sentence message like: "
        "'I have prepared your report. You can download the formatted PDF below.'\n"
        "7. All reports MUST start with: '# 📊 STUDY REPORT - Teacher Tati'\n\n"
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
        return ("professor", "professora", "Professor", "Professora", "programador", "Tatiana", "Tati", "Tatiana Duarte")

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()