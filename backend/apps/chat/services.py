import json
import logging
import os
import re
import uuid
import warnings
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

with warnings.catch_warnings():
    warnings.simplefilter("ignore", category=FutureWarning)
    try:
        import google.generativeai as genai
    except Exception:
        genai = None
from groq import Groq

from .models import Conversation, Message
from .schemas import (
    ConversationOut,
    CreateConversationInput,
    MessageOut,
)
from apps.authentication.models import User
from apps.users.services import XPService, StreakService
from .audio_service import strip_emojis

logger = logging.getLogger(__name__)

# Configuração dos clientes de IA
HF_TOKEN_LLAMA = (
    os.getenv("HF_TOKEN_LLAMA")
    or os.getenv("HF_TOKEN")
    or os.getenv("HUGGING_FACE_KEY")
)
LLAMA_MODEL_NAME = "meta-llama/Llama-3.1-8B-Instruct:novita"

GROQ_API_KEY = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_API_KEY_1")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY_1")

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception as e:
        logger.warning(f"Erro ao configurar Gemini: {e}")


def call_meta_llama(
    messages_payload: list, temperature: float = 0.7, max_tokens: int = 500
) -> Optional[str]:
    """
    Executa a chamada prioritária ao modelo Meta Llama 3.1 8B Instruct via Hugging Face Router API.
    Tenta primeiro via InferenceClient e possui fallback HTTP nativo via httpx.
    """
    token = (
        os.getenv("HF_TOKEN_LLAMA")
        or os.getenv("HF_TOKEN")
        or os.getenv("HUGGING_FACE_KEY")
    )
    if not token:
        logger.warning("[AI] HF_TOKEN_LLAMA não configurado. Pulando Meta Llama.")
        return None

    # 1. Tentativa via huggingface_hub InferenceClient
    try:
        from huggingface_hub import InferenceClient

        client = InferenceClient(
            base_url="https://router.huggingface.co/v1",
            api_key=token,
            timeout=15.0,
        )
        completion = client.chat.completions.create(
            model=LLAMA_MODEL_NAME,
            messages=messages_payload,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if completion and completion.choices and completion.choices[0].message:
            candidate = completion.choices[0].message.content or ""
            candidate = strip_emojis(candidate.strip())
            if candidate:
                return candidate
    except Exception as hf_err:
        logger.warning(
            f"[AI] Meta Llama via InferenceClient falhou: {hf_err}. Tentando via router httpx..."
        )

    # 2. Fallback direto via endpoint OpenAI-compatible do Hugging Face Router
    try:
        url = "https://router.huggingface.co/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        data = {
            "model": LLAMA_MODEL_NAME,
            "messages": messages_payload,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        with httpx.Client(timeout=15.0) as http_client:
            resp = http_client.post(url, headers=headers, json=data)
            if resp.status_code == 200:
                body = resp.json()
                choices = body.get("choices") or []
                if choices:
                    candidate = choices[0].get("message", {}).get("content", "")
                    candidate = strip_emojis(candidate.strip())
                    if candidate:
                        return candidate
            else:
                logger.warning(
                    f"[AI] Meta Llama via httpx retornou status {resp.status_code}: {resp.text[:200]}"
                )
    except Exception as http_err:
        logger.warning(f"[AI] Meta Llama via httpx falhou: {http_err}")

    return None


def get_tati_system_prompt(user: User, difficulty: str = None, memory_summary: str = "") -> str:
    """
    Prompt Humanizado Anti-IA da Teacher Tatiana Duarte (Teacher Tati).
    Proíbe respostas robóticas, proíbe emojis (nem no texto nem no áudio),
    adapta dinamicamente ao nível CEFR e espelha a cadência natural do aluno.
    """
    level = (difficulty or getattr(user, "level", None) or "A1").upper()
    name = getattr(user, "name", None) or getattr(user, "username", "there")

    level_guidelines = {
        "A1": (
            "Use very simple, friendly English with short sentences (5 to 10 words). "
            "Stick to present simple, common everyday words, and basic questions. "
            "If introducing a key new phrase, you may provide a brief 2-3 word Portuguese translation in parentheses. "
            "Never overwhelm the student."
        ),
        "A2": (
            "Speak clearly in simple everyday English. Practice past simple, basic future plans, and daily routines. "
            "Keep sentences straightforward. Only use Portuguese if explaining a tricky false cognate."
        ),
        "B1": (
            "Speak 100% in natural, conversational English. Help the student connect ideas (using because, although, however) "
            "and practice natural phrasal verbs. Encourage them to give their opinion."
        ),
        "B2": (
            "Speak in fluid, nuanced native-like English. Introduce natural idioms, conditional phrases, and abstract topics. "
            "Ask thought-provoking questions that require more detailed answers."
        ),
        "C1": (
            "Speak with advanced fluency, sophisticated vocabulary, subtle humor, and deep idiomatic expressions. "
            "Discuss complex and professional themes naturally."
        ),
        "C2": (
            "Engage in native-level mastery with complete spontaneity, cultural references, and intellectual depth."
        ),
    }.get(level, "Speak in clear, natural, level-appropriate English.")

    prompt = f"""You are Tatiana Duarte (Teacher Tati) — an authentic, warm, charismatic, and expert human English teacher from Brazil.
You are talking 1-on-1 with your student, {name}, who is at CEFR Level: {level}.

=== MANIFESTO ANTI-IA (REGRAS DE HUMANIZAÇÃO ABSOLUTA) ===
1. NUNCA USE EMOJIS NEM SÍMBOLOS sob nenhuma hipótese (terminantemente proibido 👉, 😊, 👍, 🚀, 🤖, etc.). Fale exclusivamente através de palavras e pontuação padrão.
2. ZERO JARGÕES DE ROBÔ OU ASSISTENTE DE IA:
   - Proibido clichês como: "Certainly!", "Sure thing!", "As an AI language model...", "Here is a breakdown:", "I hope this helps!", "Let's dive in!", "Great question!".
   - NUNCA formate mensagens de conversa com listas de marcadores (bullet points), tabelas ou tópicos artificiais. Escreva em parágrafos de conversa reais.
3. CONVERSE COMO UMA PROFESSORA REAL NO DIA A DIA:
   - Responda como uma pessoa de verdade conversando no WhatsApp ou no café: direta, acolhedora e concisa (máximo de 1 a 2 parágrafos curtos, 3 a 5 frases no total).
   - ESPELHAMENTO: se o aluno responder curto ou informal, responda na mesma energia; se ele for expressivo, acompanhe o ritmo.
   - FAÇA APENAS UMA PERGUNTA no final da sua fala para manter a conversa fluindo com naturalidade. Nunca faça várias perguntas na mesma resposta.
4. CORREÇÃO PEDAGÓGICA SUTIL:
   - Se o aluno cometer um erro de inglês, não dê uma palestra gramatical. Demonstre carinhosamente a forma natural em apenas 1 frase rápida e continue a conversa normalmente.
5. ADAPTAÇÃO AO NÍVEL ({level}):
   {level_guidelines}
"""
    if memory_summary:
        prompt += f"""
=== RETENÇÃO DE CONTEXTO E MEMÓRIA DO ALUNO ===
Fatos e tópicos anteriores que você lembra sobre este aluno (use naturalmente sem parecer que leu um relatório):
{memory_summary}
"""
    return prompt.strip()


def build_conversation_context(conversation_id: str, max_recent: int = 8) -> tuple[str, list]:
    """
    Compressão e Retenção de Dados:
    - Retém os fatos e tópicos de mensagens anteriores para evitar o 'erro de esquecimento'.
    - Mantém as últimas mensagens intactas para preservar o fluxo imediato da conversa.
    - Otimiza o consumo de tokens e previne limites de contexto.
    """
    all_msgs = list(
        Message.objects.filter(session_id=conversation_id).order_by("created_at")[:60]
    )
    if not all_msgs:
        return "", []

    if len(all_msgs) <= max_recent:
        return "", [{"role": m.role, "content": strip_emojis(m.content)} for m in all_msgs]

    older_msgs = all_msgs[:-max_recent]
    recent_msgs = all_msgs[-max_recent:]

    # Compacta mensagens anteriores em notas chave de memória
    memory_notes = []
    for m in older_msgs:
        content_clean = strip_emojis(m.content.strip())
        if len(content_clean) > 3:
            if m.role == "user":
                memory_notes.append(f"Student: {content_clean[:120]}")
            elif m.role == "assistant":
                memory_notes.append(f"Tati: {content_clean[:80]}")

    compressed_memory = " | ".join(memory_notes[-8:])
    active_dialog = [{"role": m.role, "content": strip_emojis(m.content)} for m in recent_msgs]

    return compressed_memory, active_dialog


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
            model=data.model or "groq/openai/gpt-oss-20b",
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
                    model="openai/gpt-oss-20b",
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
        cls,
        user: User,
        conversation_id: str,
        user_text: str,
        difficulty: str = None,
        files: Optional[List[Dict[str, Any]]] = None,
        accent: Optional[str] = None,
        origin: Optional[str] = "chat",
    ) -> dict:
        # Verifica se esta conversa é uma sessão de nivelamento ativa
        from .leveling_service import LevelingService
        from .document_service import DocumentService

        # Verifica se o usuário digitou o comando /finish
        clean_user_lower = user_text.strip().lower()
        if clean_user_lower in ["/finish", "/fim", "/encerrar", "/end", "/stop"] or clean_user_lower.startswith("/finish"):
            if LevelingService.is_leveling_conversation(user, conversation_id):
                return LevelingService.finish_leveling_early(user, conversation_id, accent=accent)

        if LevelingService.is_leveling_conversation(user, conversation_id):
            return LevelingService.process_leveling_step(user, conversation_id, user_text, accent=accent)

        clean_user_text = strip_emojis(user_text.strip())

        # Processamento e leitura integral de arquivos enviados (máximo 3)
        files_extracted_text = ""
        generated_doc = None
        if files:
            files_extracted_text = DocumentService.read_uploaded_files(files)

        # Determina se deve gerar um documento formatado (PDF, DOCX, PPTX)
        should_gen, target_format = DocumentService.should_generate_document(
            user_text=user_text,
            num_files=len(files or []),
        )

        if should_gen:
            try:
                student_name = getattr(user, "name", None) or getattr(user, "username", "there")
                generated_doc = DocumentService.generate_document_from_instruction(
                    user_text=user_text,
                    files_extracted_text=files_extracted_text,
                    student_name=student_name,
                    target_format=target_format,
                )
            except Exception as doc_err:
                logger.error(f"[AIService] Erro ao gerar documento formatado: {doc_err}")

        # 1. Salva mensagem do usuário
        Message.objects.create(
            session_id=conversation_id,
            username=user.username,
            role="user",
            content=clean_user_text or user_text,
        )

        # 2. Constrói histórico com Compressão e Retenção de Dados
        memory_summary, active_dialog = build_conversation_context(conversation_id, max_recent=8)

        sys_prompt = get_tati_system_prompt(user, difficulty, memory_summary=memory_summary)
        
        if generated_doc:
            sys_prompt += (
                f"\n\n=== NOTIFICAÇÃO DE DOCUMENTO GERADO ===\n"
                f"Você acabou de gerar e formatar com sucesso o arquivo '{generated_doc['filename']}' no formato {generated_doc['format'].upper()}.\n"
                f"Avise o aluno de forma calorosa e natural que o documento está pronto para abrir no navegador ou baixar logo abaixo."
            )

        messages_payload = [{"role": "system", "content": sys_prompt}]

        for m in active_dialog:
            messages_payload.append({"role": m["role"], "content": m["content"]})

        # Se houver arquivos lidos nesta rodada, anexa ao conteúdo do prompt do usuário
        current_user_turn = clean_user_text
        if files_extracted_text:
            current_user_turn = f"{clean_user_text}\n\n{files_extracted_text}"

        if messages_payload and messages_payload[-1]["role"] == "user":
            messages_payload[-1]["content"] = current_user_turn
        else:
            messages_payload.append({"role": "user", "content": current_user_turn})

        reply_text = ""
        model_used = ""

        # 3. Tentativa prioritária: Meta Llama 3.1-8B-Instruct via Hugging Face Router
        try:
            candidate = call_meta_llama(messages_payload, temperature=0.7, max_tokens=500)
            if candidate:
                reply_text = candidate
                model_used = LLAMA_MODEL_NAME
                print(f"[AI Model] Resposta gerada via Meta Llama: {LLAMA_MODEL_NAME}")
                logger.info(f"[AI Model] Resposta gerada via Meta Llama: {LLAMA_MODEL_NAME}")
        except Exception as llama_err:
            logger.warning(f"[AI] Falha inesperada no Meta Llama: {llama_err}")

        # 4. Fallback: Groq (com rotação de chaves e proteção contra Rate Limits)
        if not reply_text:
            if HF_TOKEN_LLAMA:
                print(f"[AI Model] Meta Llama indisponível ou falhou. Ativando fallback para Groq...")
                logger.warning(f"[AI Model] Meta Llama indisponível ou falhou. Ativando fallback para Groq...")

            keys = get_groq_keys()
            groq_models = [
                "openai/gpt-oss-20b",
                "openai/gpt-oss-120b",
                "qwen/qwen3.6-27b",
                "qwen/qwen3.8-27b",
            ]

            for g_model in groq_models:
                if reply_text:
                    break
                for key in keys:
                    try:
                        client = Groq(api_key=key, timeout=12.0)
                        chat_completion = client.chat.completions.create(
                            messages=messages_payload,
                            model=g_model,
                            temperature=0.7,
                            max_tokens=500,
                        )
                        candidate = chat_completion.choices[0].message.content or ""
                        candidate = strip_emojis(candidate.strip())
                        if candidate:
                            reply_text = candidate
                            model_used = f"groq/{g_model}"
                            print(f"[AI Model] Resposta gerada via Groq: {g_model}")
                            logger.info(f"[AI Model] Resposta gerada via Groq: {g_model}")
                            break
                    except Exception as mod_err:
                        logger.warning(
                            f"[AI] Groq model {g_model} failed with key {key[:10]}: {mod_err}"
                        )

        # 5. Fallback: Gemini (caso Groq esteja sob limite ou indisponível)
        if not reply_text and GEMINI_API_KEY and genai:
            print(f"[AI Model] Groq indisponível. Ativando fallback para Gemini...")
            logger.warning(f"[AI Model] Groq indisponível. Ativando fallback para Gemini...")
            gemini_models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"]
            for gem_model in gemini_models:
                try:
                    model = genai.GenerativeModel(gem_model)
                    prompt_full = f"{sys_prompt}\n\nUser: {current_user_turn}\nTeacher Tati:"
                    response = model.generate_content(prompt_full)
                    candidate = strip_emojis(response.text.strip())
                    if candidate:
                        reply_text = candidate
                        model_used = f"gemini/{gem_model}"
                        print(f"[AI Model] Resposta gerada via Gemini: {gem_model}")
                        logger.info(f"[AI Model] Resposta gerada via Gemini: {gem_model}")
                        break
                except Exception as e:
                    logger.warning(f"[AI] Gemini model {gem_model} failed: {e}")

        # 6. Fallback de contingência humanizado (Teacher Tati acolhedora, zero emojis, zero erro)
        if not reply_text:
            model_used = "contingency/humanized"
            print(f"[AI Model] Resposta gerada via Contingência Humanizada")
            logger.info(f"[AI Model] Resposta gerada via Contingência Humanizada")
            student_first_name = (user.name or user.username or "there").split()[0]
            level = getattr(user, "level", "A1") or "A1"
            if generated_doc:
                reply_text = (
                    f"Here is your formatted {generated_doc['format'].upper()} document, {student_first_name}! "
                    f"I processed your request and organized everything. You can open it in your browser or download it below."
                )
            elif level in ("A1", "A2"):
                reply_text = (
                    f"I hear you, {student_first_name}! Let us keep practicing together. "
                    f"Could you tell me a little bit more about that?"
                )
            else:
                reply_text = (
                    f"That is a great point, {student_first_name}. "
                    f"How does that usually work out in your experience?"
                )

        # 6. Garante remoção total de emojis no texto final
        reply_text = strip_emojis(reply_text)

        # 7. Anexa a tag de documento para persistência perene no histórico do banco
        if generated_doc:
            doc_meta_json = json.dumps({
                "id": generated_doc["id"],
                "filename": generated_doc["filename"],
                "format": generated_doc["format"],
                "url": generated_doc["url"],
                "preview_url": generated_doc.get("preview_url", generated_doc["url"]),
                "size": generated_doc["size"],
                "title": generated_doc["title"],
            })
            reply_text = f"{reply_text}\n\n[ATTACHED_DOCUMENT:{doc_meta_json}]"

        # 8. Gera áudio via Edge TTS (com texto limpo de emojis e com o sotaque selecionado)
        from .audio_service import AudioService

        user_accent = accent
        if not user_accent or user_accent.lower() in ["default", ""]:
            if user and hasattr(user, "profile") and isinstance(user.profile, dict):
                user_accent = user.profile.get("preferred_accent") or user.profile.get("accent") or "en-US"
            else:
                user_accent = "en-US"

        clean_tts_reply = re.sub(r"\[ATTACHED_DOCUMENT:.*?\]", "", reply_text, flags=re.DOTALL).strip()
        audio_b64 = AudioService.text_to_speech(clean_tts_reply, accent=user_accent)

        # 9. Salva resposta da Teacher Tati no banco de dados
        msg = Message.objects.create(
            session_id=conversation_id,
            username=user.username,
            role="assistant",
            content=reply_text,
            audio_b64=audio_b64,
        )

        # 10. Atualiza XP e Streak (30 XP para modo voz, 15 XP para chat)
        if origin == "voice":
            XPService.award_xp(user, 30, "Conversação no Modo Voz com a Teacher Tati")
        else:
            XPService.award_xp(user, 15, "Conversação no Chat da Teacher Tati")
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
            "model": model_used,
            "document": generated_doc,
            "pdf_b64": generated_doc.get("pdf_b64", "") if generated_doc else "",
        }
