import asyncio
import logging
from typing import Dict, Any, List, Optional
from app.modules.chat.services.llm import groq_chat_json, search_image_on_internet
from app.core.enums import CEFR_LABELS as _CEFR_LABEL_MAP, normalize_level
from .embeddings import EmbeddingsService


class CEFRGeneratorService:
    CEFR_LABELS = _CEFR_LABEL_MAP

    @staticmethod
    def _build_image_search_query(card: Dict[str, Any]) -> str:
        """Monta uma query de busca curta e em inglês a partir do flashcard."""
        front = (card.get('front') or '').strip()
        back = (card.get('back') or '').strip()
        explanation = (card.get('explanation') or '').strip()

        # Prioriza a resposta e o front; pega um fragmento curto da explicação
        parts = [p for p in (front, back) if p]
        if explanation:
            parts.append(explanation.split('.')[0][:80])

        query = ' '.join(parts)
        # Limita tamanho para não poluir a busca
        return query[:200]

    @staticmethod
    async def _add_image_to_card(card: Dict[str, Any]) -> None:
        """Busca uma imagem relacionada ao flashcard e insere image_url no dict (in-place)."""
        query = CEFRGeneratorService._build_image_search_query(card)
        if not query:
            return
        try:
            img_url = await search_image_on_internet(query)
            if img_url:
                card['image_url'] = img_url
        except Exception as e:
            logging.info(f"[CEFRGenerator] Falha ao buscar imagem para flashcard: {e}")

    @staticmethod
    async def add_images_to_flashcards(flashcards: List[Dict[str, Any]]) -> None:
        """Busca imagens para todos os flashcards em paralelo."""
        if not flashcards:
            return
        await asyncio.gather(*[
            CEFRGeneratorService._add_image_to_card(card)
            for card in flashcards
        ])

    @staticmethod
    async def generate_flashcards(
            level: str, topic: str, count: int = 5, reference_ids: List[str] = None) -> Optional[List[Dict[str, Any]]]:
        """
        Gera flashcards baseados no material do nível CEFR usando o LLM.
        """
        level = normalize_level(level)
        level_label = CEFRGeneratorService.CEFR_LABELS.get(level, level)

        # Busca contexto relevante no pgvector
        context_docs = EmbeddingsService.search_similar_documents(
            query=topic, level=level, top_k=5, reference_ids=reference_ids)

        # Se não encontrou contexto, avisa
        if not context_docs:
            logging.info(
                f"[CEFRGenerator] Aviso: Nenhum contexto encontrado para nível {level} e tópico '{topic}'")
            context_text = "Nenhum material de referência específico encontrado. Use seu conhecimento geral para o nível CEFR."
        else:
            context_text = "\n\n".join(
                [f"Trecho:\n{d.get('content', '')}" for d in context_docs])

        prompt = f"""
        You are an experienced English language teacher creating educational materials for CEFR level {level} ({level_label}).

        Based on the following reference material about the topic '{topic}':

        {context_text}

        Your task: Generate exactly {count} practical educational flashcards about the topic '{topic}' suitable for level {level} ({level_label}).

        CRITICAL CONSTRAINTS:
        1. All fields, texts, titles, descriptions, front, back, and explanation MUST be entirely in English.
        2. NEVER use Portuguese anywhere in the response.
        3. The front (front) must contain a word, phrase, or practical situation in English.
        4. The back (back) must contain the definition or answer in English.
        5. The explanation (explanation) must be entirely in English, explaining the usage, grammar, or context of the expression in a simple way for a {level} level student.
        6. Return ONLY a valid JSON object matching the format below, without any markdown formatting or extra text.

        Expected Output Format (Strict JSON):
        {{
            "flashcards": [
                {{
                    "front": "term or practical situation (English)",
                    "back": "definition or answer (English)",
                    "explanation": "detailed explanation of usage (English)"
                }}
            ]
        }}
        """

        try:
            data = await groq_chat_json(
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=2000,
                temperature=0.3,
            )

            flashcards = data.get('flashcards', [])
            return flashcards
        except Exception as e:
            logging.info(
                f"[CEFRGenerator] Erro ao gerar flashcards: {e}")
            return None

    @staticmethod
    async def generate_exercises(
            level: str, topic: str, count: int = 3, reference_ids: List[str] = None) -> Optional[List[Dict[str, Any]]]:
        """
        Gera exercícios de múltipla escolha baseados no material.
        """
        level = normalize_level(level)
        level_label = CEFRGeneratorService.CEFR_LABELS.get(level, level)

        context_docs = EmbeddingsService.search_similar_documents(
            query=topic, level=level, top_k=5, reference_ids=reference_ids)

        if not context_docs:
            context_text = "Nenhum material de referência específico encontrado."
        else:
            context_text = "\n\n".join(
                [f"Trecho:\n{d.get('content', '')}" for d in context_docs])

        prompt = f"""
        You are a native English teacher creating practical exercises for students at CEFR level {level} ({level_label}).

        Based on the following material about the topic '{topic}':

        {context_text}

        Generate exactly {count} multiple-choice questions focused on the PRACTICAL USE of the language (vocabulary, grammar, or comprehension of real-life situations).
        Do NOT ask theoretical questions about the text. Ask questions as if the student were in that situation practicing English (e.g. "You want to buy some apples. What do you say to the cashier?").

        CRITICAL CONSTRAINTS:
        1. All fields, questions, options, and explanations MUST be entirely in English. Never use Portuguese.
        2. The question (question) must be entirely in English and focus on a situation, fill-in-the-blank, or conversation reply.
        3. The options (options) must be entirely in English. Provide exactly 4 options.
        4. The explanation (explanation) must be entirely in English, explaining why the correct option is right grammatically or contextually.
        5. The correct_index must be an integer from 0 to 3 corresponding to the correct option.
        6. Do NOT use prefixes like A), B), C) in the options, just the plain text of the option.
        7. Return ONLY a valid JSON object matching the format below, without any markdown formatting or extra text.

        Expected Output Format (Strict JSON):
        {{
            "exercises": [
                {{
                    "question": "situational question text (English)",
                    "options": ["option 1 (English)", "option 2 (English)", "option 3 (English)", "option 4 (English)"],
                    "correct_index": 0,
                    "explanation": "detailed explanation (English)"
                }}
            ]
        }}
        """

        try:
            data = await groq_chat_json(
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=2000,
                temperature=0.3,
            )

            return data.get('exercises', [])
        except Exception as e:
            logging.info(
                f"[CEFRGenerator] Erro ao gerar exercícios: {e}")
            return None

    @staticmethod
    async def generate_simulations(
            level: str, topic: str, count: int = 1, reference_ids: List[str] = None) -> Optional[List[Dict[str, Any]]]:
        """
        Gera simulações/cenários de roleplay baseados no material.
        Sempre gera exatamente 1 simulação por requisição (regra de negócio).
        """
        # Regra de negócio: sempre 1 simulação por requisição
        count = 1
        level = normalize_level(level)
        level_label = CEFRGeneratorService.CEFR_LABELS.get(level, level)

        context_docs = EmbeddingsService.search_similar_documents(
            query=topic, level=level, top_k=5, reference_ids=reference_ids)

        if not context_docs:
            context_text = "Nenhum material de referência específico encontrado."
        else:
            context_text = "\n\n".join(
                [f"Trecho:\n{d.get('content', '')}" for d in context_docs])

        prompt = f"""
        You are a native English teacher creating roleplay scenarios (simulations) for students at CEFR level {level} ({level_label}).

        Based on the following material about the topic '{topic}':

        {context_text}

        Generate exactly {count} practical simulation scenarios focused on real-life situations.

        CRITICAL CONSTRAINTS:
        1. All fields, scenario, roles, and goal MUST be entirely in English. Never use Portuguese.
        2. The scenario (scenario) must describe the situation clearly in English.
        3. The roles (roles) must define who the student is (Student) and who the AI is (AI) in English.
        4. The goal (goal) must describe what the student needs to achieve by the end of the simulation in English.
        5. Return ONLY a valid JSON object matching the format below, without any markdown formatting or extra text.

        Expected Output Format (Strict JSON):
        {{
            "simulations": [
                {{
                    "scenario": "description of the situation (English)",
                    "roles": {{"student": "student role (English)", "ai": "AI role (English)"}},
                    "goal": "simulation goal (English)"
                }}
            ]
        }}
        """

        try:
            data = await groq_chat_json(
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=2000,
                temperature=0.3,
            )

            return data.get('simulations', [])
        except Exception as e:
            logging.info(
                f"[CEFRGenerator] Erro ao gerar simulações: {e}")
            return None
