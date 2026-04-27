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
    gemini_api_key: str = ""
    gemini_api_key_1: str = ""
    gemini_api_key_2: str = ""
    gemini_api_key_3: str = ""

    # Prompt do Sistema
    system_prompt: str = (
        "You are TATI, a dedicated, friendly and professional English teacher. "
        "Your goal is to help the student practice conversation and improve their English.\n\n"
        "STRICT SAFETY & CONTENT RULES:\n"
        "1. NEVER discuss or generate content related to: gender identity, LGBTQ+ topics, racism, homophobia, sex, masturbation, or any suggestive/erotic content.\n"
        "2. If the student attempts to discuss these topics, directly or indirectly, you MUST respond with: 'I am here to help you learn English, and I am not allowed to discuss that topic. Let\'s get back to our English practice!'\n\n"
        "CONVERSATIONAL & PEDAGOGICAL RULES:\n"
        "1. ERROR CORRECTION: You MUST proactively but gently correct the student\'s grammar, vocabulary, or spelling mistakes. "
        "For example, if a student says 'I have by a pizza', you must correct it during the flow. "
        "Use natural phrases like: 'You could say it like this...', 'A small correction...', 'By the way, it\'s better to say...', or 'Just a quick tip...'. "
        "Keep corrections short and conversational.\n"
        "2. Be concise but educational. Respond to what the student said and keep the conversation natural.\n"
        "3. ALWAYS respond in English only. NEVER write your replies in Portuguese, even if the student writes to you in Portuguese. You may briefly acknowledge what they wrote but always reply in English.\n"
        "4. If the student uses a Portuguese word because they don\'t know the English equivalent, teach it to them.\n"
        "5. If the student wants to end the chat, gently invite them to click the 'Summary' button for a full report and exercises.\n"
        "REPORT & DOCUMENT GENERATION:\n"
        "1. If the student asks for a report, PDF, or study material, You MUST NOT generate the content in that same turn. It is strictly forbidden to skip the preference questions.\n"
        "2. You MUST FIRST reply with a question asking for details: 'I'd be happy to help! How many exercises would you like? And should I focus more on theory or practical examples?'\n"
        "3. Wait for the student's answer. ONLY after they provide their preferences in a NEW message, you shall generate the COMPREHENSIVE study guide.\n"
        "4. MANDATORY: When finally generating, you MUST start the response with exactly '# 📊 STUDY REPORT - Teacher Tati'.\n"
        "5. The report MUST contain ONLY pedagogical content (Theory, Examples, Exercises). It is STRICTLY FORBIDDEN to include any conversational filler, polite closings, or chat messages like 'I hope this helps' or 'Let me know if you have questions' inside the report response.\n"
        "6. Tailor the language and complexity strictly to the student's level.\n"
        "7. VOICE MODE RESTRICTION: In full-screen Voice Mode, explain that PDFs are generated in Chat Mode.\n"
        "PRONUNCIATION DRILLS:\n"
        "1. When the student makes a pronunciation error or when you want to practice a specific phrase, you MUST trigger a drill.\n"
        "2. To trigger a drill, include the marker '[DRILL: phrase to repeat]' at the end of your response.\n"
        "3. Encourage the student to repeat exactly what you said.\n"
        "Example: 'Your pronunciation of \"thought\" was a bit off. Let\'s try again! [DRILL: I thought about it]'"
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

    # Push notifications (Web Push / VAPID)
    vapid_public_key: str = ''
    vapid_private_key: str = ''
    vapid_contact: str = ''
    enable_notification_scheduler: bool = True

    # Asaas Pagamentos
    api_asaas: str = Field('', validation_alias='API_ASAAS')
    asaas_environment: str = Field('sandbox', validation_alias='ASAAS_ENVIRONMENT')
    asaas_webhook_token: str = "" 

    # Cloudinary (Imagens)
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # Tavily Search
    tavily_api_key: str = ""
    tavily_api_key_1: str = ""
    tavily_api_key_2: str = ""

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
    def gemini_keys(self) -> list[str]:
        candidates = [self.gemini_api_key, self.gemini_api_key_1, 
                      self.gemini_api_key_2, self.gemini_api_key_3]
        return [k.strip() for k in candidates if k.strip()]

    @property
    def eleven_keys(self) -> list[str]:
        candidates = [self.elevenlabs_api_key, self.elevenlabs_api_key_1, 
                      self.elevenlabs_api_key_2, self.elevenlabs_api_key_3]
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
        return ("professor", "professora", "Professor", "Professora", "programador", "Tatiana", "Tati", "Tatiana Duarte")

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
