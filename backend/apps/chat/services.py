import os
import logging
import uuid
from datetime import datetime, timezone
from typing import List
import warnings

warnings.filterwarnings("ignore", category=FutureWarning, module="google.generativeai")
import google.generativeai as genai
from groq import Groq

from .models import Conversation, Message
from .schemas import (
    ConversationOut,
    CreateConversationInput,
    MessageOut,
)
from apps.authentication.models import User
from apps.users.services import XPService, StreakService

logger = logging.getLogger(__name__)

# Configuração dos clientes de IA
GROQ_API_KEY = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_API_KEY_1")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY_1")

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception as e:
        logger.warning(f"Erro ao configurar Gemini: {e}")


def get_tati_system_prompt(user: User, difficulty: str = None) -> str:
    level = user.level or "A1"
    name = user.name or user.username
    return f"""You are Teacher Tatiana Duarte (Teacher Tati), a warm, charismatic, and expert English teacher from Brazil.
You are speaking directly with your student, {name}, who is currently at CEFR Level: {level}.

Your Guidelines:
1. Speak predominantly in natural, clear English adapted strictly to the student's {level} proficiency.
2. If the student makes a grammatical, vocabulary, or pronunciation mistake, gently provide a quick correction with an encouraging tip.
3. If the student is a beginner (A1/A2), you may provide brief Portuguese explanations in parentheses when introducing new expressions.
4. Keep answers engaging, concise (1-3 short paragraphs), and ask an open question to stimulate speaking and conversational practice.
5. Emphasize real-world communicative confidence and active listening.
"""


def get_groq_keys() -> List[str]:
    keys = []
    if os.getenv("GROQ_KEYS"):
        keys.extend([k.strip() for k in os.getenv("GROQ_KEYS").split(",") if k.strip()])
    for env_var in [
        "GROQ_API_KEY",
        "GROQ_API_KEY_1",
        "GROQ_API_KEY_2",
        "GROQ_API_KEY_3",
        "GROQ_API_KEY_4",
    ]:
        val = os.getenv(env_var)
        if val and val.strip() and val.strip() not in keys:
            keys.append(val.strip())
    return keys


class ConversationService:
    @staticmethod
    def list_conversations(user: User) -> List[ConversationOut]:
        convs = Conversation.objects.filter(username=user.username).only(
            "id", "title", "model", "is_simulation", "created_at", "updated_at"
        )[:50]
        return [
            ConversationOut(
                id=c.id,
                title=c.title,
                model=c.model,
                is_simulation=bool(c.is_simulation),
                created_at=str(c.created_at),
                updated_at=str(c.updated_at),
            )
            for c in convs
        ]

    @staticmethod
    def create_conversation(
        user: User, data: CreateConversationInput
    ) -> ConversationOut:
        now_str = datetime.now(timezone.utc).isoformat()
        new_id = str(uuid.uuid4())
        conv = Conversation.objects.create(
            id=new_id,
            username=user.username,
            title=data.title or "Nova Conversa com a Teacher Tati",
            model=data.model or "groq/openai/gpt-oss-120b",
            is_simulation=data.is_simulation,
            simulation_id=data.simulation_id,
            created_at=now_str,
            updated_at=now_str,
        )
        return ConversationOut(
            id=conv.id,
            title=conv.title,
            model=conv.model,
            is_simulation=bool(conv.is_simulation),
            created_at=conv.created_at,
            updated_at=conv.updated_at,
        )

    @staticmethod
    def get_messages(user: User, conversation_id: str) -> List[MessageOut]:
        msgs = Message.objects.filter(session_id=conversation_id)
        if user and hasattr(user, "username") and user.username:
            user_msgs = msgs.filter(username=user.username)
            if user_msgs.exists():
                msgs = user_msgs
        return [
            MessageOut(
                id=m.id,
                session_id=m.session_id,
                role=m.role,
                content=m.content,
                audio_b64=m.audio_b64,
                created_at=m.created_at.isoformat() if m.created_at else None,
            )
            for m in msgs
        ]

    @staticmethod
    def delete_conversation(user: User, conversation_id: str) -> dict:
        Conversation.objects.filter(id=conversation_id, username=user.username).delete()
        Message.objects.filter(
            session_id=conversation_id, username=user.username
        ).delete()
        return {"ok": True, "message": "Conversa removida com sucesso."}

    @staticmethod
    def get_summary(user: User, conversation_id: str, lang: str = "pt") -> dict:
        msgs = Message.objects.filter(session_id=conversation_id).order_by(
            "created_at"
        )[:25]
        if not msgs:
            return {
                "summary": "Nenhuma mensagem encontrada nesta conversa para resumir."
            }

        history_text = "\n".join([f"{m.role.upper()}: {m.content}" for m in msgs])
        prompt = (
            f"Please generate a structured, encouraging summary of this English practice session between Teacher Tatiana and student {user.name or user.username}. "
            f"Highlight key vocabulary/expressions learned, main grammar concepts practiced, and 2 helpful tips for further study. "
            f"Write the response in {lang}.\n\nConversation:\n{history_text}"
        )

        keys = get_groq_keys()
        summary_text = ""
        for key in keys:
            try:
                client = Groq(api_key=key)
                res = client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=600,
                    temperature=0.5,
                )
                summary_text = res.choices[0].message.content.strip()
                if summary_text:
                    break
            except Exception as e:
                logger.warning(f"[Summary AI] Key {key[:10]} failed: {e}")

        if not summary_text:
            summary_text = f"Sessão de conversação em inglês com a Teacher Tati abordando vocabulário prático e conversação para o nível {user.level or 'A1'}."

        return {"summary": summary_text}


class AIService:
    @classmethod
    def generate_reply(
        cls, user: User, conversation_id: str, user_text: str, difficulty: str = None
    ) -> dict:
        # Verifica se esta conversa é uma sessão de nivelamento ativa
        from .leveling_service import LevelingService

        if LevelingService.is_leveling_conversation(user, conversation_id):
            return LevelingService.process_leveling_step(user, conversation_id, user_text)

        # 1. Salva mensagem do usuário
        Message.objects.create(
            session_id=conversation_id,
            username=user.username,
            role="user",
            content=user_text,
        )

        # 2. Constrói histórico de mensagens
        history_msgs = Message.objects.filter(session_id=conversation_id).order_by(
            "-created_at"
        )[:10]
        history = list(reversed(history_msgs))

        sys_prompt = get_tati_system_prompt(user, difficulty)
        messages_payload = [{"role": "system", "content": sys_prompt}]

        for m in history:
            messages_payload.append({"role": m.role, "content": m.content})

        reply_text = ""

        # 3. Tenta todas as chaves Groq em cascata
        keys = get_groq_keys()
        groq_models = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b"]

        for key in keys:
            if reply_text:
                break
            try:
                client = Groq(api_key=key)
                for g_model in groq_models:
                    try:
                        chat_completion = client.chat.completions.create(
                            messages=messages_payload,
                            model=g_model,
                            temperature=0.7,
                            max_tokens=600,
                        )
                        reply_text = chat_completion.choices[0].message.content
                        if reply_text:
                            break
                    except Exception as mod_err:
                        logger.warning(
                            f"[AI] Groq model {g_model} failed with key {key[:10]}: {mod_err}"
                        )
            except Exception as key_err:
                logger.warning(
                    f"[AI] Groq client failed with key {key[:10]}: {key_err}"
                )

        # 4. Fallback: Gemini
        if not reply_text and GEMINI_API_KEY:
            gemini_models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-3.6-flash"]
            for gem_model in gemini_models:
                try:
                    model = genai.GenerativeModel(gem_model)
                    prompt_full = f"{sys_prompt}\n\nUser: {user_text}\nTeacher Tati:"
                    response = model.generate_content(prompt_full)
                    reply_text = response.text
                    if reply_text:
                        break
                except Exception as e:
                    logger.warning(f"[AI] Gemini model {gem_model} failed: {e}")

        # 5. Fallback estático de contingência
        if not reply_text:
            reply_text = f"Hello {user.name or user.username}! I am glad to practice with you today. What topic would you like to explore in English?"

        # 6. Gera áudio via Edge TTS
        from .audio_service import AudioService

        audio_b64 = AudioService.text_to_speech(reply_text)

        # 7. Salva resposta da Teacher Tati
        msg = Message.objects.create(
            session_id=conversation_id,
            username=user.username,
            role="assistant",
            content=reply_text,
            audio_b64=audio_b64,
        )

        # 8. Atualiza XP e Streak
        XPService.award_xp(user, 5, "Conversação no Chat da Teacher Tati")
        StreakService.record_activity(user)

        # Atualiza timestamp da conversa
        Conversation.objects.filter(id=conversation_id).update(
            updated_at=datetime.now(timezone.utc).isoformat()
        )

        return {
            "reply": reply_text,
            "audio_b64": audio_b64,
            "audio": audio_b64,
            "id": str(msg.id),
        }
