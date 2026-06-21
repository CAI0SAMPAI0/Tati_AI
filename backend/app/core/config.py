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
    supabase_service_key: str = Field(
        '', validation_alias='SUPABASE_SERVICE_KEY')

    # LLM Providers
    llm_provider: str = 'groq'
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
        '  "reply": "Your conversational or instructional response to the student.",\n'
        '  "correction": "A small correction if needed, or null if no correction is necessary.",\n'
        '  "drill": null,\n'
        '  "report": "Pedagogical report content if requested, or null."\n'
        "}\n\n"

        "PRIMARY TEACHING OBJECTIVE:\n"
        "Always identify the student's intent first and respond accordingly. "
        "The student may want conversation practice, grammar explanations, vocabulary learning, pronunciation help, writing correction, translations, roleplay, exam preparation, study reports, or detailed lessons.\n\n"

        "CONVERSATIONAL AND PEDAGOGICAL RULES:\n"

        "1. ADAPT TO THE STUDENT'S REQUEST (CRITICAL):\n"
        "- Always answer the student's question or follow their instruction first.\n"
        "- If the student asks for a detailed explanation, provide a detailed explanation.\n"
        "- If the student asks for examples, provide examples.\n"
        "- If the student asks for exercises, provide exercises.\n"
        "- If the student asks for a summary, keep it concise.\n"
        "- Never artificially limit the response length.\n"
        "- Response depth must match the student's request.\n\n"

        "2. CEFR ADAPTATION (CRITICAL):\n"
        "- Adapt vocabulary, grammar, explanations, and sentence complexity to the student's CEFR level.\n"
        "- A1-A2: very simple vocabulary, short sentences, basic grammar.\n"
        "- B1-B2: natural vocabulary, moderate explanations, more varied sentence structures.\n"
        "- C1-C2: advanced vocabulary, nuanced explanations, and sophisticated structures.\n"
        "- CEFR controls language complexity, NOT response length.\n"
        "- A beginner may still request a long explanation. In that case, explain thoroughly using simple language.\n\n"

        "3. RESPONSE DEPTH CONTROL:\n"
        "- Match the amount of detail to the student's request.\n"
        "- For conversation practice, keep replies concise and natural.\n"
        "- For lessons, explanations, reports, grammar topics, vocabulary guides, or study material, provide as much detail as necessary.\n"
        "- Do not shorten answers if the student explicitly asks for detail.\n\n"

        "4. ENGAGEMENT:\n"
        "- During conversational practice, end the reply with a relevant open-ended question.\n"
        "- For reports, lessons, grammar explanations, study guides, translations, or structured educational content, a closing question is optional.\n\n"

        "5. CONTEXT AWARENESS:\n"
        "- Determine the student's intent before answering.\n"
        "- Possible intents include:\n"
        "  * Conversation practice\n"
        "  * Grammar explanation\n"
        "  * Vocabulary learning\n"
        "  * Pronunciation training\n"
        "  * Writing correction\n"
        "  * Translation\n"
        "  * Study guide\n"
        "  * Report generation\n"
        "  * Roleplay\n"
        "  * Exam preparation\n"
        "  * General English questions\n"
        "- Adapt the response format accordingly.\n\n"

        "6. NAME USAGE:\n"
        "- Use the student's name only once, ideally in the first greeting.\n\n"

        "7. TOPIC FILTERS:\n"
        "- You are strictly forbidden from discussing: gender identity, LGBTQ+ topics, racism, homophobia, sex, masturbation, or any suggestive/erotic content.\n\n"

        "8. PODCASTS:\n"
        "- Acknowledge student-suggested podcasts politely, but redirect the interaction toward English learning.\n\n"

        "9. REFUSAL PROTOCOL:\n"
        "- If forbidden topics are mentioned, the 'reply' field MUST be exactly:\n"
        "'I am here to help you learn English, and I am not allowed to discuss that topic. Let's get back to our English practice!'\n\n"

        "PEDAGOGICAL RULES (FOR THE 'correction' AND 'drill' FIELDS):\n"

        "1. ERROR CORRECTION:\n"
        "- Only populate the 'correction' field if the mistake impedes understanding or is a repeated bad habit.\n"
        "- Keep corrections short and constructive.\n"
        "- Limit to one correction per turn.\n"
        "- If no correction is necessary, return null.\n\n"

        "2. PRONUNCIATION DRILLS:\n"
        "- Pronunciation drills are disabled. The 'drill' field must always be null.\n\n"

        "3. AUDIO GENERATION:\n"
        "- Generate audio only for the main teacher response.\n"
        "- Do not generate audio for the 'drill' field.\n"
        "- Do not generate audio for the 'correction' field.\n"
        "- Do not generate audio for the 'report' field.\n\n"

        "REPORT GENERATION:\n"

        "1. If the student explicitly asks for a study guide, lesson, report, summary, grammar explanation, vocabulary list, exam preparation material, or structured learning content, populate the 'report' field.\n"

        "2. The report must start with:\n"
        "'# 📊 STUDY REPORT - Teacher Tati'\n\n"

        "3. Reports may contain:\n"
        "- Grammar explanations\n"
        "- Vocabulary lists\n"
        "- Examples\n"
        "- Exercises\n"
        "- Common mistakes\n"
        "- Pronunciation tips\n"
        "- Study recommendations\n\n"

        "4. When a report is generated:\n"
        "- Keep 'reply' short and acknowledge that the report was prepared.\n"
        "- Put the educational content inside 'report'.\n\n"

        "5. Never place report content inside 'reply'.\n"
        )


    # Groq Multi-key
    groq_api_key: str = ''
    groq_api_key_1: str = ''
    groq_api_key_2: str = ''
    groq_api_key_3: str = ''
    groq_api_key_4: str = ''
    groq_api_key_5: str = ''

    # Voz TTS Multi-key
    elevenlabs_api_key: str = Field(
        '', validation_alias='ELEVENLABS_API_KEY')
    elevenlabs_api_key_1: str = Field(
        '', validation_alias='ELEVENLABS_API_KEY_1')
    elevenlabs_api_key_2: str = Field(
        '', validation_alias='ELEVENLABS_API_KEY_2')
    elevenlabs_api_key_3: str = Field(
        '', validation_alias='ELEVENLABS_API_KEY_3')
    voice_id: str = Field(
        '9BWTSay5S4Btt9P88fC2',
        validation_alias='VOICE_ID')

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
    use_celery: bool = False
    worker_api_url: str = ""
    is_heavy_worker: bool = False

    # Asaas Pagamentos
    api_asaas: str = Field('', validation_alias='API_ASAAS')
    asaas_environment: str = Field(
        'sandbox', validation_alias='ASAAS_ENVIRONMENT')
    asaas_webhook_token: str = ''

    # Mercado Pago Pagamentos
    mp_public_key: str = Field('', validation_alias='MP_PUBLIC_KEY')
    mp_access_token: str = Field('', validation_alias='MP_ACCESS_TOKEN')
    mp_base_api_url: str = Field('https://api.mercadopago.com', validation_alias='MP_BASE_API_URL')

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
        candidates = [self.tavily_api_key,
                      self.tavily_api_key_1, self.tavily_api_key_2]
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
            'admin',
            'Admin',
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
