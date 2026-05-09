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

    # Gemini Multi-key
    gemini_api_key: str = ''
    gemini_api_key_1: str = ''
    gemini_api_key_2: str = ''
    gemini_api_key_3: str = ''

    # Prompt do Sistema
    system_prompt: str = (
        'You are TATI, a dedicated, friendly and professional English teacher. '
        'Your goal is to help the student practice conversation and improve their English.\n\n'
        'STRICT CONVERSATIONAL RULES:\n'
        '1. DO NOT repeat the student\'s name excessively. Use it at most 1 or 2 times per conversation, ideally only once at the beginning. It sounds robotic if you use it too often.\n'
        '2. NEVER discuss or generate content related to: gender identity, LGBTQ+ topics, racism, homophobia, sex, masturbation, or any suggestive/erotic content.\n'
        '3. Do not speak about podcasts suggested by the student. If they mention them, acknowledge but do not engage in discussion about them.\n'
        "4. If the student attempts to discuss these topics, directly or indirectly, you MUST respond with: 'I am here to help you learn English, and I am not allowed to discuss that topic. Let's get back to our English practice!'\n\n"
        'PEDAGOGICAL RULES:\n'
        "1. PRIORITY: Always respond to the student's message first and keep the conversation natural.\n"
        "2. ERROR CORRECTION: Only correct when the mistake is important for understanding or very noticeable. "
        "Do NOT correct every sentence.\n"
        "3. Keep corrections short, subtle, and secondary to the main response. "
        "Use natural phrases like: 'A small correction:' or 'You could also say...'.\n"
        "4. Limit corrections to a maximum of 1 per message.\n"
        "5. For intermediate students (B1), prioritize fluency over perfection. Avoid over-correcting.\n"
        "6. Do NOT interrupt the flow of conversation just to correct. If the message is clear, prioritize engagement.\n"
        '1. When generating study guides, start with: "# 📊 STUDY REPORT - Teacher Tati".\n'
        '2. The report must contain ONLY pedagogical content. No polite filler or conversational closings inside the report.\n'
        'PRONUNCIATION DRILLS:\n'
        '1. When the student makes a pronunciation error, trigger a drill using: "[Phrase to repeat]".\n'
        '2. The drill should be a short, clear phrase that focuses on the specific pronunciation issue, ideally using the student\'s own words to make it more relevant.\n'
    )

    # Groq Multi-key
    groq_api_key: str = ''
    groq_api_key_1: str = ''
    groq_api_key_2: str = ''
    groq_api_key_3: str = ''
    groq_api_key_4: str = ''
    groq_api_key_5: str = ''

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
    smtp_port: int = 465
    smtp_user: str = ''
    smtp_password: str = ''
    smtp_from: str = ''
    resend_api_key: str = ''
    mailjet_api_key: str = ''
    mailjet_secret_key: str = ''

    # Push notifications (Web Push / VAPID)
    vapid_public_key: str = ''
    vapid_private_key: str = ''
    vapid_contact: str = ''
    enable_notification_scheduler: bool = True

    # Asaas Pagamentos
    api_asaas: str = Field('', validation_alias='API_ASAAS')
    asaas_environment: str = Field('sandbox', validation_alias='ASAAS_ENVIRONMENT')
    asaas_webhook_token: str = ''

    # Cloudinary (Imagens)
    cloudinary_cloud_name: str = ''
    cloudinary_api_key: str = ''
    cloudinary_api_secret: str = ''

    # Tavily Search
    tavily_api_key: str = ''
    tavily_api_key_1: str = ''
    tavily_api_key_2: str = ''

    model_config = SettingsConfigDict(
        env_file='.env', extra='ignore', case_sensitive=False
    )

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
    def gemini_keys(self) -> list[str]:
        candidates = [
            self.gemini_api_key,
            self.gemini_api_key_1,
            self.gemini_api_key_2,
            self.gemini_api_key_3,
        ]
        return [k.strip() for k in candidates if k.strip()]

    @property
    def eleven_keys(self) -> list[str]:
        candidates = [
            self.elevenlabs_api_key,
            self.elevenlabs_api_key_1,
            self.elevenlabs_api_key_2,
            self.elevenlabs_api_key_3,
        ]
        return [k.strip() for k in candidates if k.strip()]

    @property
    def tavily_keys(self) -> list[str]:
        candidates = [self.tavily_api_key, self.tavily_api_key_1, self.tavily_api_key_2]
        return [k.strip() for k in candidates if k.strip()]

    @property
    def smtp_from_address(self) -> str:
        return self.smtp_from or self.smtp_user

    @property
    def staff_roles(self) -> tuple[str, ...]:
        return (
            'professor',
            'professora',
            'Professor',
            'Professora',
            'programador',
            'Tatiana',
            'Tati',
            'Tatiana Duarte',
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
