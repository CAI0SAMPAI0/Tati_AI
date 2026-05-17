"""
services/podcast_recommender.py
Serviço para rankeamento, filtragem e recomendação de podcasts.
"""

import re
import json
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter
from datetime import datetime, timezone
from fastapi.concurrency import run_in_threadpool

from app.core.database import get_client
from app.modules.chat.services.llm import stream_llm


class PodcastRecommender:
    AUTO_RECO_PROFILE_KEY = 'podcast_recommendations_v3'
    MAX_RECOMMENDATIONS = 6
    DEFAULT_CEFR_LEVEL = 'A1'
    BEGINNER_LEVEL_CODES = {'A1', 'A2'}

    LEVEL_ALIASES = {
        'a1': 'A1',
        'a2': 'A2',
        'b1': 'B1',
        'b2': 'B2',
        'c1': 'C1',
        'c2': 'C2',
        'beginner': 'A1',
        'iniciante': 'A1',
        'pre-intermediate': 'A2',
        'pre intermediate': 'A2',
        'pre_intermediate': 'A2',
        'pre intermediario': 'A2',
        'pre-intermediario': 'A2',
        'intermediate': 'B1',
        'intermediario': 'B1',
        'business english': 'B2',
        'ingles para negocios': 'B2',
        'advanced': 'C1',
        'avancado': 'C1',
    }

    FOCUS_TERM_MAP = {
        'general conversation': ['conversation', 'speaking', 'listening', 'lifestyle'],
        'business english': ['business', 'news', 'speaking', 'career', 'work'],
        'travel english': ['travel', 'lifestyle', 'listening', 'conversation'],
        'academic english': ['education', 'study', 'news', 'academic'],
        'job interviews': ['interview', 'career', 'speaking', 'psychology'],
    }

    THEME_HINTS = {
        'business': [
            'career',
            'work',
            'meetings',
            'interview',
            'negotiation',
            'empresa',
            'trabalho',
        ],
        'education': [
            'study',
            'school',
            'learning',
            'vocabulary',
            'estudo',
            'educacao',
        ],
        'health': [
            'sleep',
            'food',
            'wellbeing',
            'fitness',
            'saude',
            'sono',
            'alimentacao',
        ],
        'travel': ['trip', 'airport', 'hotel', 'tourism', 'viagem', 'turismo'],
        'technology': ['tech', 'software', 'ai', 'digital', 'tecnologia'],
        'news': ['current affairs', 'headlines', 'politics', 'economy', 'noticias'],
        'speaking': [
            'conversation',
            'pronunciation',
            'fluency',
            'small talk',
            'fala',
            'conversa',
        ],
        'lifestyle': [
            'daily routine',
            'habits',
            'culture',
            'routine',
            'rotina',
            'estilo',
        ],
        'psychology': [
            'confidence',
            'mindset',
            'behavior',
            'emocional',
            'comportamento',
        ],
    }

    @staticmethod
    def _extract_json_blob(raw_text: str) -> str:
        clean_text = raw_text.strip()
        if '```json' in clean_text:
            return clean_text.split('```json', 1)[1].split('```', 1)[0].strip()
        first_brace, last_brace = clean_text.find('{'), clean_text.rfind('}')
        return (
            clean_text[first_brace : last_brace + 1]
            if (first_brace >= 0 and last_brace > first_brace)
            else clean_text
        )

    @staticmethod
    def _pick_lang(pt_text: str, en_text: str, ui_lang: str) -> str:
        return en_text if str(ui_lang).lower().startswith('en') else pt_text

    @staticmethod
    def _compose_recommendation_reason(
        podcast: Dict[str, Any],
        matched_interests: List[str],
        user_level: str,
        ui_lang: str,
    ) -> str:
        if matched_interests:
            terms = ', '.join(matched_interests[:2])
            return PodcastRecommender._pick_lang(
                f'Combina com seus temas recentes ({terms}) e está adequado ao nível {user_level}.',
                f'It matches your recent topics ({terms}) and fits your {user_level} level.',
                ui_lang,
            )
        category = str(podcast.get('category', 'General')).lower()
        return PodcastRecommender._pick_lang(
            f'Conteúdo de {category} recomendado para reforçar escuta no nível {user_level}.',
            f'{category.title()} content recommended to reinforce listening at level {user_level}.',
            ui_lang,
        )

    @classmethod
    def _normalize_user_level(cls, user_level: str) -> str:
        raw_level = str(user_level or '').strip()
        if not raw_level:
            return cls.DEFAULT_CEFR_LEVEL
        normalized_key = raw_level.lower().replace('_', ' ').replace('-', ' ')
        normalized_key = ' '.join(normalized_key.split())
        return cls.LEVEL_ALIASES.get(
            normalized_key,
            cls.LEVEL_ALIASES.get(raw_level.lower(), cls.DEFAULT_CEFR_LEVEL),
        )

    @classmethod
    async def get_recent_messages(cls, username: str) -> List[str]:
        def _fetch():
            db = get_client()
            return (
                db.table('messages')
                .select('content')
                .eq('username', username)
                .eq('role', 'user')
                .order('created_at', desc=True)
                .limit(30)
                .execute()
                .data
                or []
            )

        rows = await run_in_threadpool(_fetch)
        return [
            str(row.get('content', '')).strip() for row in rows if row.get('content')
        ]

    async def extract_interest_keywords(
        self, messages: List[str]
    ) -> Tuple[List[str], str]:
        if not messages:
            return [], 'none'
        history_text = '\n'.join(messages[:20])
        prompt = (
            'You are an English learning assistant. '
            'Extract up to 5 student interests from the messages below.\n'
            'Return strict JSON only: {"interests": ["word1", "word2"]}.\n'
            f'Messages:\n{history_text}\n'
        )
        try:
            from app.modules.chat.services.llm import groq_chat_json
            payload = await groq_chat_json([{"role": "user", "content": prompt}])
            interests = payload.get('interests', []) if payload else []
            return [str(i).strip().lower() for i in interests if i][:5], 'llm'
        except Exception:
            pass
        return self._tokenize_interest_keywords(messages), 'heuristic'

    def _tokenize_interest_keywords(self, messages: List[str]) -> List[str]:
        words = []
        for msg in messages:
            words.extend(re.findall(r'[a-zA-Z]{4,}', msg.lower()))
        freq = Counter(words)
        return [word for word, _ in freq.most_common(6)]

    def rank_recommendations(
        self,
        catalog: List[Dict[str, Any]],
        user_level: str,
        interests: List[str],
        ui_lang: str,
        display_level: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        level_label = str(display_level or user_level)
        ranked = []
        for podcast in catalog:
            # Simplificado para evitar circulares
            score = 50  # Placeholder para score real
            enriched = dict(podcast)
            enriched['recommendation_score'] = score
            enriched['recommendation_reason'] = self._compose_recommendation_reason(
                podcast, [], level_label, ui_lang
            )
            ranked.append(enriched)
        return ranked

    async def save_recommendations_cache(
        self,
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
        items = [
            {'id': r['id'], 'score': r.get('recommendation_score')}
            for r in recommendations[:6]
        ]
        updated_profile[self.AUTO_RECO_PROFILE_KEY] = {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'user_level': user_level,
            'items': items,
        }

        def _update():
            get_client().table('users').update({'profile': updated_profile}).eq(
                'username', username
            ).execute()

        await run_in_threadpool(_update)
