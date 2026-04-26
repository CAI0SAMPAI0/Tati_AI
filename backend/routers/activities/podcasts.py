from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
import json
import re
from typing import Any, Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen
from urllib.parse import parse_qs, quote_plus, urlparse

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field

from routers.deps import get_current_user
from services.database import get_client
from services.llm import stream_llm

router = APIRouter()

AUTO_RECO_PROFILE_KEY = "podcast_recommendations_v3"
AUTO_RECO_TTL_HOURS = 12
MAX_RECOMMENDATIONS = 6
AVAILABILITY_CACHE_TTL_HOURS = 6
DEFAULT_CEFR_LEVEL = "A1"
BEGINNER_SHORT_MAX_SECONDS = 5 * 60
BEGINNER_LEVEL_CODES = {"A1", "A2"}

ALLOWED_EMBED_HOSTS = {
    "www.youtube.com",
    "youtube.com",
    "www.youtube-nocookie.com",
    "player.vimeo.com",
    "open.spotify.com",
    "w.soundcloud.com",
    "embed.ted.com",
    "www.dailymotion.com",
}

_MEDIA_AVAILABILITY_CACHE: Dict[str, Dict[str, Any]] = {}

LEVEL_ALIASES: Dict[str, str] = {
    "a1": "A1",
    "a2": "A2",
    "b1": "B1",
    "b2": "B2",
    "c1": "C1",
    "c2": "C2",
    "beginner": "A1",
    "iniciante": "A1",
    "pre-intermediate": "A2",
    "pre intermediate": "A2",
    "pre_intermediate": "A2",
    "pre intermediario": "A2",
    "pre-intermediario": "A2",
    "intermediate": "B1",
    "intermediario": "B1",
    "business english": "B2",
    "ingles para negocios": "B2",
    "advanced": "C1",
    "avancado": "C1",
}

FOCUS_TERM_MAP: Dict[str, List[str]] = {
    "general conversation": ["conversation", "speaking", "listening", "lifestyle"],
    "business english": ["business", "news", "speaking", "career", "work"],
    "travel english": ["travel", "lifestyle", "listening", "conversation"],
    "academic english": ["education", "study", "news", "academic"],
    "job interviews": ["interview", "career", "speaking", "psychology"],
}

THEME_HINTS: Dict[str, List[str]] = {
    "business": ["career", "work", "meetings", "interview", "negotiation", "empresa", "trabalho"],
    "education": ["study", "school", "learning", "vocabulary", "estudo", "educacao"],
    "health": ["sleep", "food", "wellbeing", "fitness", "saude", "sono", "alimentacao"],
    "travel": ["trip", "airport", "hotel", "tourism", "viagem", "turismo"],
    "technology": ["tech", "software", "ai", "digital", "tecnologia"],
    "news": ["current affairs", "headlines", "politics", "economy", "noticias"],
    "speaking": ["conversation", "pronunciation", "fluency", "small talk", "fala", "conversa"],
    "lifestyle": ["daily routine", "habits", "culture", "routine", "rotina", "estilo"],
    "psychology": ["confidence", "mindset", "behavior", "emocional", "comportamento"],
}


class TranscriptSegment(BaseModel):
    start: str
    source_text: str
    translated_text: str


class Podcast(BaseModel):
    id: str
    title: str
    description: str
    level: str
    thumbnail: str
    embed_url: str
    duration: Optional[str] = "--:--"
    category: str
    source_name: str = "YouTube"
    source_type: str = "youtube"
    media_type: str = "video"
    external_url: Optional[str] = None
    transcript_segments: List[TranscriptSegment] = Field(default_factory=list)
    has_full_transcript: bool = False
    translation_language: str = "pt-BR"
    recommendation_reason: Optional[str] = None
    recommendation_score: Optional[float] = None


PODCASTS_DB = [
    {
        "id": "bbc-sleep-1",
        "title": "BBC 6 Minute English: The secret to better sleep",
        "description": "Learn about the importance of sleep and pick up useful vocabulary.",
        "level": "A1",
        "thumbnail": "https://img.youtube.com/vi/9vS0ZIsFp_s/hqdefault.jpg",
        "embed_url": "https://www.youtube.com/embed/9vS0ZIsFp_s",
        "duration": "06:12",
        "category": "Health",
        "source_name": "YouTube",
        "source_type": "youtube",
        "media_type": "video",
        "easy_words": True,
        "theme_tags": ["health", "sleep", "daily routine"],
        "external_url": "https://www.youtube.com/watch?v=9vS0ZIsFp_s",
        "transcript_segments": [
            {
                "start": "00:22",
                "source_text": "Sleep helps your brain organize memories and recover from stress.",
                "translated_text": "O sono ajuda seu cerebro a organizar memorias e se recuperar do estresse.",
            },
            {
                "start": "01:14",
                "source_text": "A good routine before bed can improve your mood the next day.",
                "translated_text": "Uma boa rotina antes de dormir pode melhorar seu humor no dia seguinte.",
            },
            {
                "start": "03:32",
                "source_text": "Try to avoid screens and caffeine late in the evening.",
                "translated_text": "Tente evitar telas e cafeina no fim da noite.",
            },
        ],
    },
    {
        "id": "bbc-hangry-1",
        "title": "BBC 6 Minute English: Is being 'hangry' real?",
        "description": "Neil and Sam discuss why some people get angry when they are hungry.",
        "level": "A1",
        "thumbnail": "https://img.youtube.com/vi/S69E5k1-VlY/hqdefault.jpg",
        "embed_url": "https://www.youtube.com/embed/S69E5k1-VlY",
        "duration": "06:15",
        "category": "Lifestyle",
        "source_name": "YouTube",
        "source_type": "youtube",
        "media_type": "video",
        "easy_words": True,
        "theme_tags": ["lifestyle", "food", "habits"],
        "external_url": "https://www.youtube.com/watch?v=S69E5k1-VlY",
        "transcript_segments": [
            {
                "start": "00:33",
                "source_text": "People often say they become hangry when blood sugar drops.",
                "translated_text": "As pessoas costumam dizer que ficam irritadas quando a glicose cai.",
            },
            {
                "start": "02:05",
                "source_text": "Small snacks can help you stay focused and calm.",
                "translated_text": "Pequenos lanches podem ajudar voce a manter foco e calma.",
            },
            {
                "start": "04:11",
                "source_text": "Language changes quickly when new words become popular.",
                "translated_text": "A lingua muda rapido quando novas palavras ficam populares.",
            },
        ],
    },
    {
        "id": "vimeo-confidence-talk",
        "title": "English Listening Practice - Daily Conversation",
        "description": "Natural English conversation practice for listening and speaking rhythm.",
        "level": "A2",
        "thumbnail": "https://img.youtube.com/vi/p_kF_SDB0-c/hqdefault.jpg",
        "embed_url": "https://www.youtube.com/embed/p_kF_SDB0-c?start=75",
        "duration": "09:20",
        "category": "Speaking",
        "source_name": "YouTube",
        "source_type": "youtube",
        "media_type": "video",
        "easy_words": True,
        "theme_tags": ["conversation", "speaking", "small talk"],
        "external_url": "https://youtu.be/p_kF_SDB0-c?si=VSpRaKpjGaoC7Bkd&t=75",
        "transcript_segments": [
            {
                "start": "00:18",
                "source_text": "Confidence starts with short, clear sentences.",
                "translated_text": "A confianca comeca com frases curtas e claras.",
            },
            {
                "start": "01:27",
                "source_text": "Pause between ideas so your listener can follow your message.",
                "translated_text": "Pause entre ideias para que o ouvinte acompanhe sua mensagem.",
            },
            {
                "start": "02:42",
                "source_text": "Practice out loud every day for five minutes.",
                "translated_text": "Pratique em voz alta todos os dias por cinco minutos.",
            },
        ],
    },
    {
        "id": "spotify-english-audio-1",
        "title": "English Learning Podcast (Spotify Episode)",
        "description": "Audio-first listening practice with clear intermediate-level dialogues.",
        "level": "A2",
        "thumbnail": "",
        "embed_url": "https://open.spotify.com/embed/episode/0ofXAdFIQQRsCYj9754UFx",
        "duration": "08:10",
        "category": "Listening",
        "source_name": "Spotify",
        "source_type": "spotify",
        "media_type": "audio",
        "easy_words": True,
        "theme_tags": ["listening", "conversation", "daily routine"],
        "external_url": "https://open.spotify.com/episode/0ofXAdFIQQRsCYj9754UFx",
        "transcript_segments": [
            {
                "start": "00:45",
                "source_text": "Today we talk about small daily habits for better English.",
                "translated_text": "Hoje falamos sobre pequenos habitos diarios para melhorar o ingles.",
            },
            {
                "start": "03:10",
                "source_text": "Repeat useful chunks instead of isolated words.",
                "translated_text": "Repita blocos uteis em vez de palavras isoladas.",
            },
            {
                "start": "06:04",
                "source_text": "Use what you learn in short real conversations.",
                "translated_text": "Use o que aprendeu em conversas curtas e reais.",
            },
        ],
    },
    {
        "id": "bbc-sleep-quick-1",
        "title": "Quick English Clip: Better Sleep Habits",
        "description": "Short and easy listening about sleep routines and healthy habits.",
        "level": "A1",
        "thumbnail": "https://img.youtube.com/vi/9vS0ZIsFp_s/hqdefault.jpg",
        "embed_url": "https://www.youtube.com/embed/9vS0ZIsFp_s?start=20&end=295",
        "duration": "04:35",
        "category": "Health",
        "source_name": "YouTube",
        "source_type": "youtube",
        "media_type": "video",
        "easy_words": True,
        "theme_tags": ["health", "sleep", "daily routine"],
        "external_url": "https://www.youtube.com/watch?v=9vS0ZIsFp_s",
        "transcript_segments": [
            {
                "start": "00:28",
                "source_text": "A bedtime routine helps your body relax faster.",
                "translated_text": "Uma rotina antes de dormir ajuda seu corpo a relaxar mais rapido.",
            },
            {
                "start": "02:05",
                "source_text": "Small healthy habits improve sleep quality.",
                "translated_text": "Pequenos habitos saudaveis melhoram a qualidade do sono.",
            },
        ],
    },
    {
        "id": "bbc-hangry-quick-1",
        "title": "Quick English Clip: Why we get hangry",
        "description": "Easy vocabulary about hunger, mood, and daily food habits.",
        "level": "A1",
        "thumbnail": "https://img.youtube.com/vi/S69E5k1-VlY/hqdefault.jpg",
        "embed_url": "https://www.youtube.com/embed/S69E5k1-VlY?start=32&end=295",
        "duration": "04:23",
        "category": "Lifestyle",
        "source_name": "YouTube",
        "source_type": "youtube",
        "media_type": "video",
        "easy_words": True,
        "theme_tags": ["lifestyle", "food", "habits"],
        "external_url": "https://www.youtube.com/watch?v=S69E5k1-VlY",
        "transcript_segments": [
            {
                "start": "00:35",
                "source_text": "People can feel angry when they are very hungry.",
                "translated_text": "As pessoas podem ficar irritadas quando estao com muita fome.",
            },
            {
                "start": "02:20",
                "source_text": "Eating small snacks can improve your mood.",
                "translated_text": "Comer pequenos lanches pode melhorar seu humor.",
            },
        ],
    },
    {
        "id": "conversation-quick-1",
        "title": "Quick English Clip: Everyday Conversation",
        "description": "Short speaking practice for simple questions and answers.",
        "level": "A2",
        "thumbnail": "https://img.youtube.com/vi/p_kF_SDB0-c/hqdefault.jpg",
        "embed_url": "https://www.youtube.com/embed/p_kF_SDB0-c?start=74&end=365",
        "duration": "04:51",
        "category": "Speaking",
        "source_name": "YouTube",
        "source_type": "youtube",
        "media_type": "video",
        "easy_words": True,
        "theme_tags": ["speaking", "conversation", "small talk"],
        "external_url": "https://youtu.be/p_kF_SDB0-c?si=VSpRaKpjGaoC7Bkd&t=75",
        "transcript_segments": [
            {
                "start": "00:16",
                "source_text": "Use short phrases and speak clearly.",
                "translated_text": "Use frases curtas e fale com clareza.",
            },
            {
                "start": "02:10",
                "source_text": "Repeat common expressions to build fluency.",
                "translated_text": "Repita expressoes comuns para ganhar fluencia.",
            },
        ],
    },
    {
        "id": "spotify-english-audio-quick-1",
        "title": "Quick Audio: Easy English Dialogues",
        "description": "Audio-only episode with easy words for daily listening.",
        "level": "A2",
        "thumbnail": "",
        "embed_url": "https://open.spotify.com/embed/episode/0ofXAdFIQQRsCYj9754UFx",
        "duration": "04:48",
        "category": "Listening",
        "source_name": "Spotify",
        "source_type": "spotify",
        "media_type": "audio",
        "easy_words": True,
        "theme_tags": ["listening", "conversation", "daily routine"],
        "external_url": "https://open.spotify.com/episode/0ofXAdFIQQRsCYj9754UFx",
        "transcript_segments": [
            {
                "start": "00:41",
                "source_text": "Listen and repeat short dialogues every day.",
                "translated_text": "Ouva e repita dialogos curtos todos os dias.",
            },
            {
                "start": "03:05",
                "source_text": "Simple vocabulary helps you speak faster.",
                "translated_text": "Vocabulario simples ajuda voce a falar mais rapido.",
            },
        ],
    },
    {
        "id": "ted-body-language",
        "title": "TED: Your body language may shape who you are",
        "description": "Amy Cuddy shows how 'power posing' can boost confidence levels.",
        "level": "B1",
        "thumbnail": "https://img.youtube.com/vi/Ks-_Mh1QhMc/hqdefault.jpg",
        "embed_url": "https://www.youtube.com/embed/Ks-_Mh1QhMc",
        "duration": "21:02",
        "category": "Psychology",
        "source_name": "YouTube",
        "source_type": "youtube",
        "media_type": "video",
        "theme_tags": ["psychology", "confidence", "career"],
        "external_url": "https://www.youtube.com/watch?v=Ks-_Mh1QhMc",
        "transcript_segments": [
            {
                "start": "01:11",
                "source_text": "Your posture can influence how you feel before important moments.",
                "translated_text": "Sua postura pode influenciar como voce se sente antes de momentos importantes.",
            },
            {
                "start": "08:40",
                "source_text": "Tiny changes in behavior can alter your confidence.",
                "translated_text": "Pequenas mudancas de comportamento podem alterar sua confianca.",
            },
            {
                "start": "19:08",
                "source_text": "Fake it until you become it.",
                "translated_text": "Finja ate se tornar isso.",
            },
        ],
    },
    {
        "id": "ted-embed-creativity",
        "title": "TED: Do schools kill creativity?",
        "description": "A TED talk about education and creative confidence.",
        "level": "B1",
        "thumbnail": "https://img.youtube.com/vi/iG9CE55wbtY/hqdefault.jpg",
        "embed_url": "https://www.youtube.com/embed/iG9CE55wbtY",
        "duration": "19:21",
        "category": "Education",
        "source_name": "YouTube",
        "source_type": "youtube",
        "media_type": "video",
        "theme_tags": ["education", "creativity", "school"],
        "external_url": "https://www.youtube.com/watch?v=iG9CE55wbtY",
        "transcript_segments": [
            {
                "start": "00:52",
                "source_text": "Creativity is as important as literacy in education.",
                "translated_text": "A criatividade e tao importante quanto a alfabetizacao na educacao.",
            },
            {
                "start": "07:14",
                "source_text": "Children are not afraid of being wrong when they try new ideas.",
                "translated_text": "Criancas nao tem medo de errar quando testam novas ideias.",
            },
            {
                "start": "17:58",
                "source_text": "Our job is to educate the whole human being.",
                "translated_text": "Nosso trabalho e educar o ser humano por inteiro.",
            },
        ],
    },
    {
        "id": "bbc-reading-1",
        "title": "BBC 6 Minute English: The benefits of reading",
        "description": "Why reading is good for your brain and mental health.",
        "level": "B2",
        "thumbnail": "https://img.youtube.com/vi/vVj_fE5v1E8/hqdefault.jpg",
        "embed_url": "https://www.youtube.com/embed/vVj_fE5v1E8",
        "duration": "06:00",
        "category": "Education",
        "source_name": "YouTube",
        "source_type": "youtube",
        "media_type": "video",
        "theme_tags": ["education", "reading", "vocabulary"],
        "external_url": "https://www.youtube.com/watch?v=vVj_fE5v1E8",
        "transcript_segments": [
            {
                "start": "00:31",
                "source_text": "Reading expands vocabulary and improves concentration.",
                "translated_text": "Ler amplia vocabulario e melhora a concentracao.",
            },
            {
                "start": "02:18",
                "source_text": "Books can reduce stress and improve emotional intelligence.",
                "translated_text": "Livros podem reduzir estresse e melhorar inteligencia emocional.",
            },
            {
                "start": "05:22",
                "source_text": "Even ten minutes per day can make a difference.",
                "translated_text": "Ate dez minutos por dia podem fazer diferenca.",
            },
        ],
    },
    {
        "id": "ted-happiness-1",
        "title": "TED: What makes a good life?",
        "description": "Lessons from the longest study on happiness.",
        "level": "B2",
        "thumbnail": "https://img.youtube.com/vi/8KkKuTC9nYI/hqdefault.jpg",
        "embed_url": "https://www.youtube.com/embed/8KkKuTC9nYI",
        "duration": "12:46",
        "category": "Well-being",
        "source_name": "YouTube",
        "source_type": "youtube",
        "media_type": "video",
        "theme_tags": ["wellbeing", "psychology", "relationships"],
        "external_url": "https://www.youtube.com/watch?v=8KkKuTC9nYI",
        "transcript_segments": [
            {
                "start": "00:39",
                "source_text": "Good relationships keep us healthier and happier.",
                "translated_text": "Boas relacoes nos mantem mais saudaveis e felizes.",
            },
            {
                "start": "05:04",
                "source_text": "Loneliness can be as dangerous as smoking or alcoholism.",
                "translated_text": "A solidao pode ser tao perigosa quanto fumar ou alcoolismo.",
            },
            {
                "start": "11:18",
                "source_text": "Invest in connection, not only in achievement.",
                "translated_text": "Invista em conexao, nao apenas em conquista.",
            },
        ],
    },
    {
        "id": "daily-global-briefing",
        "title": "Global English Briefing",
        "description": "Current affairs vocabulary with guided listening prompts.",
        "level": "B2",
        "thumbnail": "https://img.youtube.com/vi/9R7wq7t6v6M/hqdefault.jpg",
        "embed_url": "https://www.youtube.com/embed/9R7wq7t6v6M",
        "duration": "07:24",
        "category": "News",
        "source_name": "YouTube",
        "source_type": "youtube",
        "media_type": "video",
        "theme_tags": ["news", "current affairs", "business"],
        "external_url": "https://www.youtube.com/watch?v=9R7wq7t6v6M",
        "transcript_segments": [
            {
                "start": "00:29",
                "source_text": "Headlines are easier when you identify key nouns and verbs first.",
                "translated_text": "Noticias ficam mais faceis quando voce identifica substantivos e verbos principais.",
            },
            {
                "start": "02:47",
                "source_text": "Context clues help you infer meaning from unfamiliar words.",
                "translated_text": "Pistas de contexto ajudam a inferir significados de palavras desconhecidas.",
            },
            {
                "start": "06:10",
                "source_text": "Summarize each section in one sentence to improve retention.",
                "translated_text": "Resuma cada secao em uma frase para melhorar retencao.",
            },
        ],
    },
]


def _is_allowed_embed_url(embed_url: str) -> bool:
    try:
        parsed = urlparse(embed_url)
    except Exception:
        return False

    if parsed.scheme != "https":
        return False

    return parsed.netloc.lower() in ALLOWED_EMBED_HOSTS


def _normalize_transcript_segments(raw_segments: Any) -> List[Dict[str, str]]:
    if not isinstance(raw_segments, list):
        return []

    valid_segments: List[Dict[str, str]] = []
    for segment in raw_segments:
        if not isinstance(segment, dict):
            continue

        start = str(segment.get("start", "")).strip() or "--:--"
        source_text = str(segment.get("source_text", "")).strip()
        translated_text = str(segment.get("translated_text", "")).strip()

        if not source_text or not translated_text:
            continue

        valid_segments.append(
            {
                "start": start,
                "source_text": source_text,
                "translated_text": translated_text,
            }
        )

    return valid_segments


def _sanitize_podcast_entry(raw_entry: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    embed_url = str(raw_entry.get("embed_url", "")).strip()
    if not _is_allowed_embed_url(embed_url):
        return None

    raw_theme_tags = raw_entry.get("theme_tags", [])
    theme_tags: List[str] = []
    if isinstance(raw_theme_tags, list):
        seen = set()
        for tag in raw_theme_tags:
            cleaned = " ".join(str(tag or "").strip().lower().split())
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                theme_tags.append(cleaned)

    normalized = dict(raw_entry)
    normalized["embed_url"] = embed_url
    normalized["thumbnail"] = str(raw_entry.get("thumbnail", "")).strip()
    normalized["easy_words"] = bool(raw_entry.get("easy_words", False))
    normalized["theme_tags"] = theme_tags
    normalized["transcript_segments"] = _normalize_transcript_segments(
        raw_entry.get("transcript_segments", [])
    )
    normalized["has_full_transcript"] = bool(raw_entry.get("has_full_transcript", False))
    normalized["translation_language"] = "pt-BR"
    return normalized


def _extract_json_blob(raw_text: str) -> str:
    clean_text = raw_text.strip()
    if "```json" in clean_text:
        return clean_text.split("```json", 1)[1].split("```", 1)[0].strip()
    if "```" in clean_text:
        return clean_text.split("```", 1)[1].split("```", 1)[0].strip()

    first_brace = clean_text.find("{")
    last_brace = clean_text.rfind("}")
    if first_brace >= 0 and last_brace > first_brace:
        return clean_text[first_brace : last_brace + 1]

    return clean_text


def _fallback_exercises(podcast_title: str, ui_lang: str = "pt-BR") -> Dict[str, List[Dict[str, Any]]]:
    writing_q1 = _pick_lang(
        f"Qual é a ideia principal de '{podcast_title}'?",
        f"What is the main idea of '{podcast_title}'?",
        ui_lang,
    )
    choice_q = _pick_lang(
        "Qual estratégia ajuda você a entender áudio mais rápido?",
        "Which strategy helps you understand audio faster?",
        ui_lang,
    )
    opt_1 = _pick_lang("Ouça uma vez e não revise", "Listen once and never review", ui_lang)
    opt_2 = _pick_lang(
        "Ignore o contexto e foque só na gramática",
        "Ignore context and focus only on grammar",
        ui_lang,
    )
    opt_3 = _pick_lang(
        "Anote palavras-chave e faça um resumo",
        "Take notes of keywords and summarize",
        ui_lang,
    )
    opt_4 = _pick_lang(
        "Traduza cada palavra antes de ouvir",
        "Translate every word before listening",
        ui_lang,
    )
    hint_1 = _pick_lang(
        "Escreva em inglês e use uma frase de exemplo do episódio.",
        "Write your answer in English and include one example sentence from the episode.",
        ui_lang,
    )
    hint_2 = _pick_lang(
        "Eu consigo entender mais quando foco nas ideias principais.",
        "I can understand more when I focus on key ideas.",
        ui_lang,
    )
    writing_q2 = _pick_lang(
        "Escreva duas palavras novas que você aprendeu e explique cada uma.",
        "Write two new words you learned and explain each one.",
        ui_lang,
    )
    hint_3 = _pick_lang(
        "Escreva em inglês e inclua uma frase para cada palavra.",
        "Write in English and include one sentence for each word.",
        ui_lang,
    )
    hint_4 = _pick_lang(
        "Prática diária de escuta melhora minha pronúncia.",
        "Daily listening practice improves my pronunciation.",
        ui_lang,
    )

    return {
        "exercises": [
            {
                "type": "writing",
                "question": writing_q1,
                "translation_hint": hint_1,
            },
            {
                "type": "choice",
                "question": choice_q,
                "options": [
                    opt_1,
                    opt_2,
                    opt_3,
                    opt_4,
                ],
                "correct_index": 2,
            },
            {
                "type": "voice",
                "phrase": "I can understand more when I focus on key ideas.",
                "translation_hint": hint_2,
            },
            {
                "type": "writing",
                "question": writing_q2,
                "translation_hint": hint_3,
            },
            {
                "type": "voice",
                "phrase": "Daily listening practice improves my pronunciation.",
                "translation_hint": hint_4,
            },
        ]
    }


def _normalize_exercises_payload(
    payload: Any,
    podcast_title: str,
    ui_lang: str = "pt-BR",
) -> Dict[str, List[Dict[str, Any]]]:
    if not isinstance(payload, dict):
        return _fallback_exercises(podcast_title, ui_lang)

    raw_exercises = payload.get("exercises")
    if not isinstance(raw_exercises, list):
        return _fallback_exercises(podcast_title, ui_lang)

    normalized_exercises: List[Dict[str, Any]] = []
    for exercise in raw_exercises:
        if not isinstance(exercise, dict):
            continue

        ex_type = str(exercise.get("type", "")).strip().lower()
        if ex_type == "choice":
            options = exercise.get("options")
            if not isinstance(options, list) or len(options) != 4:
                continue

            try:
                correct_index = int(exercise.get("correct_index", 0))
            except (TypeError, ValueError):
                correct_index = 0
            correct_index = min(max(correct_index, 0), 3)

            normalized_exercises.append(
                {
                    "type": "choice",
                    "question": str(exercise.get("question", "Choose the best answer.")).strip(),
                    "options": [str(option) for option in options],
                    "correct_index": correct_index,
                }
            )
        elif ex_type == "voice":
            phrase = str(exercise.get("phrase", "")).strip()
            if not phrase:
                continue

            normalized_exercises.append(
                {
                    "type": "voice",
                    "phrase": phrase,
                    "translation_hint": str(exercise.get("translation_hint", "")).strip(),
                }
            )
        else:
            question = str(exercise.get("question", "")).strip()
            if not question:
                continue

            normalized_exercises.append(
                {
                    "type": "writing",
                    "question": question,
                    "translation_hint": str(exercise.get("translation_hint", "")).strip(),
                }
            )

    if len(normalized_exercises) < 3:
        return _fallback_exercises(podcast_title, ui_lang)

    return {"exercises": normalized_exercises[:5]}


def _normalize_evaluation_payload(payload: Any, ui_lang: str = "pt-BR") -> Dict[str, Any]:
    default_feedback = _pick_lang(
        "Boa resposta! Continue praticando.",
        "Good answer! Keep practicing.",
        ui_lang,
    )
    if not isinstance(payload, dict):
        return {"score": 85, "feedback": default_feedback}

    try:
        score = int(payload.get("score", 85))
    except (TypeError, ValueError):
        score = 85
    score = min(max(score, 0), 100)

    feedback = str(payload.get("feedback", "")).strip()
    if not feedback:
        feedback = default_feedback

    return {"score": score, "feedback": feedback}


def _normalize_user_level(user_level: str) -> str:
    raw_level = str(user_level or "").strip()
    if not raw_level:
        return DEFAULT_CEFR_LEVEL

    normalized_key = (
        raw_level.lower()
        .replace("_", " ")
        .replace("-", " ")
    )
    normalized_key = " ".join(normalized_key.split())

    if normalized_key in LEVEL_ALIASES:
        return LEVEL_ALIASES[normalized_key]
    return LEVEL_ALIASES.get(raw_level.lower(), DEFAULT_CEFR_LEVEL)


def _focus_key(value: str) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _focus_terms_for_profile(user_focus: str) -> List[str]:
    focus_key = _focus_key(user_focus)
    return list(FOCUS_TERM_MAP.get(focus_key, []))


def _merge_interest_terms(primary: List[str], secondary: List[str]) -> List[str]:
    merged: List[str] = []
    seen = set()
    for term in [*(primary or []), *(secondary or [])]:
        cleaned = str(term or "").strip().lower()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        merged.append(cleaned)
    return merged[:8]


def _duration_to_seconds(duration: str) -> Optional[int]:
    parts = [part.strip() for part in str(duration or "").strip().split(":") if part.strip()]
    if len(parts) not in {2, 3}:
        return None
    if not all(part.isdigit() for part in parts):
        return None

    if len(parts) == 2:
        minutes, seconds = (int(parts[0]), int(parts[1]))
        return (minutes * 60) + seconds

    hours, minutes, seconds = (int(parts[0]), int(parts[1]), int(parts[2]))
    return (hours * 3600) + (minutes * 60) + seconds


def _podcast_text_terms(podcast: Dict[str, Any]) -> set[str]:
    text_parts = [
        str(podcast.get("title", "")),
        str(podcast.get("description", "")),
        str(podcast.get("category", "")),
    ]
    theme_tags = podcast.get("theme_tags", [])
    if isinstance(theme_tags, list):
        text_parts.extend(str(tag) for tag in theme_tags)

    blob = " ".join(text_parts).lower()
    return set(re.findall(r"[a-z0-9]{3,}", blob))


def _expand_interest_terms(interests: List[str]) -> List[str]:
    expanded: List[str] = []
    seen = set()

    def _push(term: str) -> None:
        cleaned = " ".join(str(term or "").strip().lower().split())
        if not cleaned or cleaned in seen:
            return
        seen.add(cleaned)
        expanded.append(cleaned)

    for term in interests or []:
        _push(term)

    snapshot = list(expanded)
    for term in snapshot:
        singular = term[:-1] if term.endswith("s") and len(term) > 4 else term
        plural = f"{term}s" if not term.endswith("s") and len(term) > 3 else term
        _push(singular)
        _push(plural)

    for theme, aliases in THEME_HINTS.items():
        group = [theme, *aliases]
        should_expand = False
        for seed in list(expanded):
            seed_tokens = set(re.findall(r"[a-z0-9]{3,}", seed))
            for member in group:
                member_tokens = set(re.findall(r"[a-z0-9]{3,}", member))
                if seed == member:
                    should_expand = True
                    break
                if seed_tokens and member_tokens and seed_tokens.intersection(member_tokens):
                    should_expand = True
                    break
            if should_expand:
                break

        if should_expand:
            for member in group:
                _push(member)

    return expanded[:24]


def _apply_level_playback_constraints(
    catalog: List[Dict[str, Any]],
    user_level: str,
) -> List[Dict[str, Any]]:
    normalized_level = _normalize_user_level(user_level)
    if normalized_level not in BEGINNER_LEVEL_CODES:
        return catalog

    strict_pool: List[Dict[str, Any]] = []
    for item in catalog:
        item_level = _normalize_user_level(str(item.get("level", "")))
        if item_level not in BEGINNER_LEVEL_CODES:
            continue
        duration_sec = _duration_to_seconds(str(item.get("duration", "")))
        if duration_sec is None or duration_sec > BEGINNER_SHORT_MAX_SECONDS:
            continue
        if not bool(item.get("easy_words")):
            continue
        strict_pool.append(item)
    if strict_pool:
        return strict_pool

    short_pool = [
        item
        for item in catalog
        if _normalize_user_level(str(item.get("level", ""))) in BEGINNER_LEVEL_CODES
        and (_duration_to_seconds(str(item.get("duration", ""))) or 10**9) <= BEGINNER_SHORT_MAX_SECONDS
    ]
    if short_pool:
        return short_pool

    return [item for item in catalog if _normalize_user_level(str(item.get("level", ""))) in BEGINNER_LEVEL_CODES]


def _visible_levels_for_user(user_level: str) -> List[str]:
    level_map = ["A1", "A2", "B1", "B2", "C1", "C2"]
    normalized_level = _normalize_user_level(user_level)
    try:
        idx = level_map.index(normalized_level)
    except ValueError:
        idx = 0
    return level_map[max(0, idx - 1) : idx + 2]


def _level_distance(a_level: str, b_level: str) -> int:
    level_map = ["A1", "A2", "B1", "B2", "C1", "C2"]
    norm_a = _normalize_user_level(a_level)
    norm_b = _normalize_user_level(b_level)
    try:
        a_idx = level_map.index(norm_a)
    except ValueError:
        a_idx = 0
    try:
        b_idx = level_map.index(norm_b)
    except ValueError:
        b_idx = 0
    return abs(a_idx - b_idx)


def _tokenize_interest_keywords(messages: List[str]) -> List[str]:
    if not messages:
        return []

    stop_words = {
        "about",
        "would",
        "could",
        "should",
        "there",
        "their",
        "after",
        "before",
        "where",
        "which",
        "while",
        "have",
        "with",
        "from",
        "that",
        "this",
        "what",
        "when",
        "like",
        "want",
        "need",
        "please",
        "help",
        "learn",
        "english",
        "practice",
        "teacher",
        "tati",
    }
    words: List[str] = []
    for msg in messages:
        words.extend(re.findall(r"[a-zA-Z]{4,}", msg.lower()))

    freq = Counter(word for word in words if word not in stop_words)
    return [word for word, _ in freq.most_common(6)]


async def _extract_interest_keywords(messages: List[str]) -> tuple[List[str], str]:
    if not messages:
        return [], "none"

    history_text = "\n".join(messages[:20])
    prompt = (
        "You are an English learning assistant. "
        "Extract up to 5 student interests from the messages below.\n"
        "Return strict JSON only: {\"interests\": [\"word1\", \"word2\"]}.\n"
        "Use lowercase one or two-word tags.\n"
        f"Messages:\n{history_text}\n"
    )

    try:
        raw = ""
        async for token in stream_llm(prompt, []):
            raw += token
        payload = json.loads(_extract_json_blob(raw))
        interests = payload.get("interests", [])
        if not isinstance(interests, list):
            raise ValueError("invalid interests type")
        normalized = []
        for item in interests:
            cleaned = str(item).strip().lower()
            if cleaned and cleaned not in normalized:
                normalized.append(cleaned)
        if normalized:
            return normalized[:5], "llm"
    except Exception:
        pass

    return _tokenize_interest_keywords(messages), "heuristic"


def _compose_recommendation_reason(
    podcast: Dict[str, Any],
    matched_interests: List[str],
    user_level: str,
    ui_lang: str,
) -> str:
    if matched_interests:
        terms = ", ".join(matched_interests[:2])
        return _pick_lang(
            f"Combina com seus temas recentes ({terms}) e está adequado ao nível {user_level}.",
            f"It matches your recent topics ({terms}) and fits your {user_level} level.",
            ui_lang,
        )

    category = str(podcast.get("category", "General")).lower()
    return _pick_lang(
        f"Conteúdo de {category} recomendado para reforçar escuta no nível {user_level}.",
        f"{category.title()} content recommended to reinforce listening at level {user_level}.",
        ui_lang,
    )


def _rank_personalized_recommendations(
    catalog: List[Dict[str, Any]],
    user_level: str,
    interests: List[str],
    ui_lang: str,
    display_level: Optional[str] = None,
) -> List[Dict[str, Any]]:
    interests_lower = _expand_interest_terms(interests)
    level_label = str(display_level or user_level)
    ranked: List[Dict[str, Any]] = []

    for podcast in catalog:
        text_blob = " ".join(
            [
                str(podcast.get("title", "")),
                str(podcast.get("description", "")),
                str(podcast.get("category", "")),
                " ".join(str(tag) for tag in podcast.get("theme_tags", []) if tag),
            ]
        ).lower()
        text_terms = _podcast_text_terms(podcast)
        matched = []
        for term in interests_lower:
            if not term:
                continue
            if " " in term:
                if term in text_blob:
                    matched.append(term)
                continue
            if term in text_terms:
                matched.append(term)

        level_score = 32 - (_level_distance(user_level, str(podcast.get("level", "A1"))) * 10)
        interest_score = min(len(matched), 4) * 22
        transcript_bonus = 6 if podcast.get("transcript_segments") else 0
        easy_bonus = 6 if bool(podcast.get("easy_words")) and _normalize_user_level(user_level) in BEGINNER_LEVEL_CODES else 0
        score = level_score + interest_score + transcript_bonus + easy_bonus

        enriched = dict(podcast)
        enriched["recommendation_score"] = max(score, 0)
        enriched["_sort_level_distance"] = _level_distance(user_level, str(podcast.get("level", "A1")))
        enriched["_sort_duration_seconds"] = _duration_to_seconds(str(podcast.get("duration", ""))) or 10**6
        enriched["recommendation_reason"] = _compose_recommendation_reason(
            podcast,
            matched,
            level_label,
            ui_lang,
        )
        ranked.append(enriched)

    ranked.sort(
        key=lambda item: (
            -(float(item.get("recommendation_score") or 0)),
            int(item.get("_sort_level_distance") or 0),
            int(item.get("_sort_duration_seconds") or 10**6),
            str(item.get("title") or ""),
        )
    )
    for item in ranked:
        item.pop("_sort_level_distance", None)
        item.pop("_sort_duration_seconds", None)
    return ranked


def _parse_iso_datetime(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            value = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


def _normalize_ui_lang(accept_language: Optional[str]) -> str:
    value = (accept_language or "").strip().lower()
    if not value:
        return "pt-BR"
    first_token = value.split(",")[0].strip()
    if first_token.startswith("en-gb") or first_token.startswith("en-uk"):
        return "en-UK"
    if first_token.startswith("en"):
        return "en-US"
    return "pt-BR"


def _is_english_lang(ui_lang: str) -> bool:
    return str(ui_lang).lower().startswith("en")


def _pick_lang(pt_text: str, en_text: str, ui_lang: str) -> str:
    return en_text if _is_english_lang(ui_lang) else pt_text


def _is_recent(dt: Optional[datetime], hours: int) -> bool:
    if not dt:
        return False
    return dt >= (datetime.now(timezone.utc) - timedelta(hours=hours))


def _http_fetch_ok(url: str, timeout_sec: float = 2.5) -> bool:
    if not url:
        return False
    req = UrlRequest(url, headers={"User-Agent": "Mozilla/5.0 TeacherTati/1.0"})
    try:
        with urlopen(req, timeout=timeout_sec) as response:
            status = int(getattr(response, "status", 200) or 200)
            return 200 <= status < 400
    except (HTTPError, URLError, TimeoutError, ValueError):
        return False


def _extract_youtube_watch_url(item: Dict[str, Any]) -> Optional[str]:
    external_url = str(item.get("external_url", "")).strip()
    if external_url:
        parsed_external = urlparse(external_url)
        host = parsed_external.netloc.lower()
        if "youtube.com" in host:
            query = parse_qs(parsed_external.query)
            video_id = (query.get("v") or [""])[0].strip()
            if video_id:
                return f"https://www.youtube.com/watch?v={video_id}"
        elif "youtu.be" in host:
            video_id = parsed_external.path.strip("/").split("/", 1)[0].strip()
            if video_id:
                return f"https://www.youtube.com/watch?v={video_id}"

    embed_url = str(item.get("embed_url", "")).strip()
    if not embed_url:
        return None
    parsed = urlparse(embed_url)
    host = parsed.netloc.lower()
    if "youtube" not in host:
        return None
    if "/embed/" not in parsed.path:
        return None
    video_id = parsed.path.split("/embed/", 1)[1].split("/", 1)[0].split("?", 1)[0].strip()
    if not video_id:
        return None
    return f"https://www.youtube.com/watch?v={video_id}"


def _is_media_available(item: Dict[str, Any]) -> bool:
    cache_key = str(item.get("id") or item.get("embed_url") or "")
    if not cache_key:
        return False

    cached = _MEDIA_AVAILABILITY_CACHE.get(cache_key)
    if cached and _is_recent(_parse_iso_datetime(str(cached.get("checked_at", ""))), AVAILABILITY_CACHE_TTL_HOURS):
        return bool(cached.get("ok"))

    source_type = str(item.get("source_type", "")).lower()
    ok = False
    if source_type == "youtube":
        watch_url = _extract_youtube_watch_url(item)
        if watch_url:
            oembed_url = f"https://www.youtube.com/oembed?url={quote_plus(watch_url)}&format=json"
            ok = _http_fetch_ok(oembed_url)
    elif source_type == "spotify":
        embed_url = str(item.get("embed_url", "")).strip()
        ok = embed_url.startswith("https://open.spotify.com/embed/")
    else:
        external_url = str(item.get("external_url", "")).strip()
        ok = _http_fetch_ok(external_url) if external_url else False

    _MEDIA_AVAILABILITY_CACHE[cache_key] = {
        "ok": ok,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
    return ok


def _filter_unavailable_video_items(
    catalog: List[Dict[str, Any]],
    availability_checker=_is_media_available,
) -> List[Dict[str, Any]]:
    filtered: List[Dict[str, Any]] = []
    for item in catalog:
        media_type = str(item.get("media_type", "video")).lower()
        if media_type == "video" and not availability_checker(item):
            continue
        filtered.append(item)
    return filtered


def invalidate_podcast_recommendations_cache(username: str) -> None:
    if not username:
        return
    db = get_client()
    try:
        profile_rows = (
            db.table("users")
            .select("profile")
            .eq("username", username)
            .limit(1)
            .execute()
            .data
        )
        if not profile_rows:
            return
        profile = profile_rows[0].get("profile") or {}
        if AUTO_RECO_PROFILE_KEY not in profile:
            return
        profile.pop(AUTO_RECO_PROFILE_KEY, None)
        db.table("users").update({"profile": profile}).eq("username", username).execute()
    except Exception as exc:
        print(f"[podcast] failed to invalidate recommendation cache: {exc}")


def _serialize_recommendation_meta(recommendations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    serialized: List[Dict[str, Any]] = []
    for item in recommendations[:MAX_RECOMMENDATIONS]:
        serialized.append(
            {
                "id": item.get("id"),
                "recommendation_score": float(item.get("recommendation_score") or 0),
                "recommendation_reason": str(item.get("recommendation_reason") or "").strip(),
            }
        )
    return serialized


def _load_cached_recommendations(
    profile: Dict[str, Any],
    user_level: str,
    ui_lang: str,
    user_focus: str = "",
) -> Optional[List[Dict[str, Any]]]:
    if not isinstance(profile, dict):
        return None

    cache_blob = profile.get(AUTO_RECO_PROFILE_KEY)
    if not isinstance(cache_blob, dict):
        return None

    cached_level = str(cache_blob.get("level_code") or cache_blob.get("user_level") or "").strip().upper()
    if cached_level != str(user_level).strip().upper():
        return None
    if str(cache_blob.get("ui_lang", "")).strip().lower() != str(ui_lang).strip().lower():
        return None
    expected_focus = _focus_key(user_focus)
    cached_focus = _focus_key(str(cache_blob.get("focus_key", "")))
    if expected_focus and cached_focus != expected_focus:
        return None

    generated_at = _parse_iso_datetime(str(cache_blob.get("generated_at", "")))
    if not generated_at:
        return None

    ttl_cutoff = datetime.now(timezone.utc) - timedelta(hours=AUTO_RECO_TTL_HOURS)
    if generated_at < ttl_cutoff:
        return None

    items = cache_blob.get("items")
    if not isinstance(items, list) or not items:
        return None
    return [item for item in items if isinstance(item, dict) and item.get("id")]


def _hydrate_cached_recommendations(
    visible_catalog: List[Dict[str, Any]],
    cached_items: List[Dict[str, Any]],
    ui_lang: str,
) -> List[Dict[str, Any]]:
    by_id = {item["id"]: item for item in visible_catalog}
    result: List[Dict[str, Any]] = []

    for cached in cached_items:
        podcast_id = str(cached.get("id"))
        if podcast_id not in by_id:
            continue
        enriched = dict(by_id[podcast_id])
        enriched["recommendation_score"] = float(cached.get("recommendation_score") or 0)
        enriched["recommendation_reason"] = str(cached.get("recommendation_reason") or "").strip() or None
        result.append(enriched)

    used_ids = {item["id"] for item in result}
    for catalog_item in visible_catalog:
        if catalog_item["id"] in used_ids:
            continue
        fallback = dict(catalog_item)
        fallback["recommendation_reason"] = _pick_lang(
            f"Conteúdo aderente ao nível {catalog_item.get('level', 'A1')} para manter rotina de escuta.",
            f"Content aligned with level {catalog_item.get('level', 'A1')} to keep your listening routine.",
            ui_lang,
        )
        fallback["recommendation_score"] = 0.0
        result.append(fallback)

    return result[:MAX_RECOMMENDATIONS]


def _save_recommendations_cache(
    db: Any,
    username: str,
    profile: Dict[str, Any],
    user_level: str,
    ui_lang: str,
    user_focus: str,
    interests: List[str],
    analysis_source: str,
    recommendations: List[Dict[str, Any]],
) -> None:
    if not username:
        return
    updated_profile = dict(profile or {})
    updated_profile[AUTO_RECO_PROFILE_KEY] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "user_level": user_level,
        "level_code": user_level,
        "ui_lang": ui_lang,
        "focus_key": _focus_key(user_focus),
        "interests": interests[:5],
        "analysis_source": analysis_source,
        "items": _serialize_recommendation_meta(recommendations),
    }
    try:
        db.table("users").update({"profile": updated_profile}).eq("username", username).execute()
    except Exception as exc:
        print(f"[podcast] failed to persist auto recommendations: {exc}")


@router.get("/recommendations", response_model=List[Podcast])
async def get_podcast_recommendations(
    user: dict = Depends(get_current_user),
    lang: str | None = None,
    accept_language: str | None = Header(default=None),
):
    user_level_raw = str(user.get("level", DEFAULT_CEFR_LEVEL))
    user_level = _normalize_user_level(user_level_raw)
    user_focus = str(user.get("focus") or "")
    username = user.get("username")
    ui_lang = _normalize_ui_lang(lang or accept_language)

    db = get_client()

    safe_catalog = [
        safe_entry for safe_entry in (_sanitize_podcast_entry(entry) for entry in PODCASTS_DB) if safe_entry
    ]
    visible_levels = _visible_levels_for_user(user_level)
    visible_catalog = [item for item in safe_catalog if item.get("level") in visible_levels]
    if not visible_catalog:
        visible_catalog = safe_catalog[:MAX_RECOMMENDATIONS]

    visible_catalog = _apply_level_playback_constraints(visible_catalog, user_level)
    visible_catalog = _filter_unavailable_video_items(visible_catalog)
    if not visible_catalog:
        fallback_catalog = _apply_level_playback_constraints(safe_catalog, user_level)
        visible_catalog = _filter_unavailable_video_items(fallback_catalog)
    if not visible_catalog:
        visible_catalog = [
            item for item in safe_catalog if str(item.get("media_type", "")).lower() != "video"
        ][:MAX_RECOMMENDATIONS] or safe_catalog[:MAX_RECOMMENDATIONS]

    profile: Dict[str, Any] = {}
    try:
        profile_rows = (
            db.table("users")
            .select("profile")
            .eq("username", username)
            .limit(1)
            .execute()
            .data
        )
        if profile_rows:
            profile = profile_rows[0].get("profile") or {}
    except Exception:
        profile = {}

    cached_items = _load_cached_recommendations(
        profile,
        user_level,
        ui_lang,
        user_focus=user_focus,
    )
    if cached_items:
        return _hydrate_cached_recommendations(visible_catalog, cached_items, ui_lang)

    recent_msgs: List[str] = []
    try:
        message_rows = (
            db.table("messages")
            .select("content")
            .eq("username", username)
            .eq("role", "user")
            .order("created_at", desc=True)
            .limit(30)
            .execute()
            .data
        )
        recent_msgs = [str(row.get("content", "")).strip() for row in message_rows if row.get("content")]
    except Exception:
        recent_msgs = []

    interests, analysis_source = await _extract_interest_keywords(recent_msgs)
    focus_terms = _focus_terms_for_profile(user_focus)
    merged_interests = _merge_interest_terms(interests, focus_terms)

    recommendations = _rank_personalized_recommendations(
        visible_catalog,
        user_level,
        merged_interests,
        ui_lang,
        display_level=user_level_raw,
    )[:MAX_RECOMMENDATIONS]

    _save_recommendations_cache(
        db=db,
        username=str(username),
        profile=profile,
        user_level=user_level,
        ui_lang=ui_lang,
        user_focus=user_focus,
        interests=merged_interests,
        analysis_source=analysis_source,
        recommendations=recommendations,
    )
    return recommendations


@router.get("/{podcast_id}/exercises")
async def generate_podcast_exercises(
    podcast_id: str,
    user: dict = Depends(get_current_user),
    lang: str | None = None,
    accept_language: str | None = Header(default=None),
):
    podcast = next((item for item in PODCASTS_DB if item["id"] == podcast_id), None)
    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found")

    user_level = user.get("level", "A1")
    ui_lang = _normalize_ui_lang(lang or accept_language)
    ui_language_name = "English" if _is_english_lang(ui_lang) else "Brazilian Portuguese"
    transcript_context = "\n".join(
        (
            f"- {segment.get('start', '--:--')} | EN: {segment.get('source_text', '')} "
            f"| PT: {segment.get('translated_text', '')}"
        )
        for segment in podcast.get("transcript_segments", [])[:4]
    )

    system_prompt = (
        f"You are Teacher Tati. Generate 5 exercises for the podcast '{podcast['title']}'.\n"
        f"The student level is {user_level}. Keep the difficulty appropriate.\n"
        f"UI language is {ui_language_name}. Write all 'question' and 'translation_hint' text in {ui_language_name}.\n"
        "Use the bilingual transcript snippets below to build contextual questions and pronunciation prompts.\n"
        f"Transcript snippets:\n{transcript_context}\n"
        "Generate exactly 5 exercises in JSON with a mix of types:\n"
        "- writing: include 'question' and optional 'translation_hint'.\n"
        "- choice: include 'question', 4 'options', and 'correct_index'.\n"
        "- voice: include 'phrase' in English and optional 'translation_hint' in UI language.\n"
        "Strict format: { \"exercises\": [ ... ] }"
    )

    full_text = ""
    async for token in stream_llm(system_prompt, []):
        full_text += token

    try:
        clean_json = _extract_json_blob(full_text)
        payload = json.loads(clean_json)
        return _normalize_exercises_payload(payload, podcast["title"], ui_lang)
    except Exception as exc:
        print(f"Error parsing LLM response: {exc}")
        return _fallback_exercises(podcast["title"], ui_lang)


class EvaluationRequest(BaseModel):
    podcast_id: str
    type: str
    user_answer: str


@router.post("/evaluate")
async def evaluate_podcast_exercise(
    req: EvaluationRequest,
    user: dict = Depends(get_current_user),
    lang: str | None = None,
    accept_language: str | None = Header(default=None),
):
    user_level = user.get("level", "A1")
    ui_lang = _normalize_ui_lang(lang or accept_language)
    ui_language_name = "English" if _is_english_lang(ui_lang) else "Brazilian Portuguese"

    system_prompt = (
        f"You are Teacher Tati. Evaluate the student's answer for an exercise about the podcast ID {req.podcast_id}.\n"
        f"Exercise type: {req.type}\n"
        f"Student answer: {req.user_answer}\n"
        f"Student level: {user_level}\n"
        f"Provide a score (0-100) and brief feedback in {ui_language_name} (as Teacher Tati would say).\n"
        "Return JSON: { \"score\": 85, \"feedback\": \"...\" }"
    )

    full_text = ""
    async for token in stream_llm(system_prompt, []):
        full_text += token

    try:
        clean_json = _extract_json_blob(full_text)
        payload = json.loads(clean_json)
        return _normalize_evaluation_payload(payload, ui_lang)
    except Exception:
        return _normalize_evaluation_payload({}, ui_lang)
