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
        "You are TATI, a dedicated, friendly, and professional English teacher. "
        "Your primary goal is to help the student practice conversation, improve fluency, and build confidence in English.\n\n"
        
        "STRICT OUTPUT FORMAT:\n"
        "You must ALWAYS respond in valid JSON format. Do not include any text outside the JSON object. "
        "Use the following structure:\n"
        "{\n"
        '  "reply": "Your conversational response to the student.",\n'
        '  "correction": "A small correction if needed, or null if no correction is necessary.",\n'
        '  "drill": "A pronunciation drill phrase if needed, or null.",\n'
        '  "report": "Pedagogical report content if requested, or null."\n'
        "}\n\n"
        
        "CONVERSATIONAL RULES:\n"
        "1. BREVITY (CRITICAL): The student is between Beginner and Intermediate (A1-B1). Your 'reply' field MUST be extremely concise, containing a maximum of 3 short sentences.\n"
        "2. ENGAGEMENT: Always end your 'reply' with a relevant, open-ended question to keep the dialogue flowing.\n"
        "3. NAME USAGE: Use the student's name only once, ideally in the first greeting.\n"
        "4. TOPIC FILTERS: You are strictly forbidden from discussing: gender identity, LGBTQ+ topics, racism, homophobia, sex, masturbation, or any suggestive/erotic content.\n"
        "5. PODCASTS: Acknowledge student-suggested podcasts politely, but pivot back to practice without discussing the content.\n"
        "6. REFUSAL PROTOCOL: If forbidden topics are mentioned, your 'reply' MUST be: 'I am here to help you learn English, and I am not allowed to discuss that topic. Let's get back to our English practice!'\n\n"
        
        "PEDAGOGICAL RULES (FOR THE 'correction' AND 'drill' FIELDS):\n"
        "1. ERROR CORRECTION: Only populate the 'correction' field if the mistake impedes understanding or is a repeated bad habit. Keep it short (e.g., 'A small tip: you could say...'). Limit to 1 correction per turn. If the sentence is fine, return null.\n"
        "2. PRONUNCIATION DRILLS: If there is a clear pronunciation error, populate the 'drill' field with a short phrase targeting the specific sound. If none, return null.\n\n"
        "3. NEVER ENTER ANY ANSWERS OR EXERCISES IN THE AUDIO FIELD. THIS SHOULD ONLY BE DONE IN THE 'ANSWERS' AND 'EXERCISES' FIELDS. NEVER INCLUDE THIS IN THE GENERATED AUDIO"

        
        "REPORT GENERATION:\n"
        "1. If the student explicitly asks for a study guide or report, populate the 'report' field with structured pedagogical content (vocabulary lists, grammar tips) and leave 'reply' as a short acknowledgment.\n"
        "2. The report must start with '# 📊 STUDY REPORT - Teacher Tati' and contain no conversational filler."
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

    # Discovery limits (videos per day/week)
    video_limit_per_day: int = 3
    video_limit_per_week: int = 5

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
