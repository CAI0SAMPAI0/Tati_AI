from __future__ import annotations

"""
Sprint 20 – Serviço de busca de Grammar.

Objetivo: substituir a antiga aba de "AI Exercises" por uma aba "Grammar"
responsável por buscar gramática e sua explicação nas fontes definidas na
Feature 3 do PRD:
  - DW (notícias)                 -> https://www.dw.com/pt-br/noticias/s-7111
  - BBC Learning English          -> https://www.bbc.co.uk/learningenglish/features/easy_english_conversations
  - test-english.com (por nível)  -> https://test-english.com/

Implementação:
  - Mantém um catálogo curado/estático de tópicos de gramática por nível CEFR,
    com a explicação, a estrutura-chave e um link de referência para test-english
    ou BBC Learning English.
  - O catálogo pode ser estendido sob demanda; cobre os tópicos mais procurados
    por alunos A1–B2.
  - Quando um tópico não existe no catálogo, o serviço ainda retorna uma
    explicação gerada de forma determinística (template) para não deixar o
    aluno sem resposta.
"""

import logging
from dataclasses import dataclass
from typing import Optional

from app.shared.services.upstash import cache_get, cache_set


@dataclass
class GrammarEntry:
    topic: str
    level: str
    title: str
    rule_summary: str
    key_structure: str
    tip_teacher_tati: str
    source_name: str
    source_url: str


# Catálogo curado de gramática por nível CEFR (alinhado com as fontes Feature 3).
_CATALOG: list[GrammarEntry] = [
    GrammarEntry(
        topic="present_simple",
        level="A1",
        title="Present Simple",
        rule_summary="Usamos o Present Simple para rotinas, fatos e hábitos. Acrescente -s na 3ª pessoa do singular (he/she/it).",
        key_structure="Sujeito + verbo (+ s/es na 3ª pessoa)",
        tip_teacher_tati="Lembre do 's' no he/she/it: 'He play**s** soccer every Saturday.'",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a1/present-simple/",
    ),
    GrammarEntry(
        topic="present_continuous",
        level="A1",
        title="Present Continuous",
        rule_summary="Usamos para ações acontecendo agora. Estrutura: verbo to be + verbo-ing.",
        key_structure="Sujeito + am/is/are + verbo-ing",
        tip_teacher_tati="Use always 'now', 'at the moment' para deixar claro que é agora.",
        source_name="BBC Learning English",
        source_url="https://www.bbc.co.uk/learningenglish/features/easy_english_conversations",
    ),
    GrammarEntry(
        topic="past_simple",
        level="A2",
        title="Past Simple",
        rule_summary="Para ações terminadas no passado. Verbos regulares ganham -ed; irregulares têm forma própria.",
        key_structure="Sujeito + verbo (-ed) / verbo irregular no passado",
        tip_teacher_tati="Decore os irregulares aos poucos: go-went, eat-ate, see-saw.",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a2/past-simple/",
    ),
    GrammarEntry(
        topic="present_perfect",
        level="B1",
        title="Present Perfect",
        rule_summary="Liga o passado ao presente: ações com resultado agora ou experiência de vida. Use have/has + particípio.",
        key_structure="Sujeito + have/has + particípio passado",
        tip_teacher_tati="Sinais típicos: ever, never, already, yet, just, since, for.",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/b1/present-perfect/",
    ),
    GrammarEntry(
        topic="past_simple_vs_present_perfect",
        level="B1",
        title="Past Simple vs Present Perfect",
        rule_summary="Past Simple = tempo passado definido. Present Perfect = tempo não definido ou com efeito no presente.",
        key_structure="Past Simple: Sujeito + verbo no passado | Present Perfect: Sujeito + have/has + particípio",
        tip_teacher_tati="Se há tempo explícito (yesterday, in 2019), use Past Simple. Sem tempo, prefira Present Perfect.",
        source_name="BBC Learning English",
        source_url="https://www.bbc.co.uk/learningenglish/english-grammar/reference/past-simple-or-present-perfect",
    ),
    GrammarEntry(
        topic="comparatives_superlatives",
        level="A2",
        title="Comparatives & Superlatives",
        rule_summary="Compara 2 coisas: adjetivo + -er + than. Compara 3+: the + adjetivo + -est. Adjetivos longos: more / most.",
        key_structure="Curto: adj+er+than / the+adj+est | Longo: more+adj / the most+adj",
        tip_teacher_tati="Good -> better -> the best (irregular, decore!).",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a2/comparatives-and-superlatives/",
    ),
    GrammarEntry(
        topic="future_will_going_to",
        level="A2",
        title="Future: will vs going to",
        rule_summary="will = decisão na hora / previsão geral. going to = plano / previsão com evidência.",
        key_structure="will: Sujeito + will + verbo | going to: Sujeito + am/is/are + going to + verbo",
        tip_teacher_tati='Olhe pela janela: nuvens escuras -> "It\'s going to rain." Decisão agora -> "I\'ll help you."',
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a2/future-forms/",
    ),
    GrammarEntry(
        topic="conditionals_zero_first",
        level="B1",
        title="Zero & First Conditional",
        rule_summary="Zero: fatos gerais (If + present, present). First: situação possível no futuro (If + present, will + verb).",
        key_structure="Zero: If + presente, presente | First: If + presente, will + verbo",
        tip_teacher_tati="Na cláusula if, nunca use 'will'. Use o presente.",
        source_name="BBC Learning English",
        source_url="https://www.bbc.co.uk/learningenglish/english-grammar/reference/zero-conditional",
    ),
    GrammarEntry(
        topic="articles",
        level="A1",
        title="Articles: a / an / the",
        rule_summary="'a' antes de som consonantal, 'an' antes de som vocálico. 'the' para algo já conhecido ou único.",
        key_structure="a/an + substantivo singular contável | the + substantivo (específico)",
        tip_teacher_tati="É o SOM que importa: 'an hour' (h mudo), 'a university' (soa you).",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a1/articles/",
    ),
    GrammarEntry(
        topic="modals_can_must_should",
        level="A2",
        title="Modal Verbs: can, must, should",
        rule_summary="Modais não ganham -s nem to. Expressam possibilidade, obrigação, conselho.",
        key_structure="Sujeito + modal + verbo na base",
        tip_teacher_tati="I must study (obrigação forte). I should study (conselho). I can study (habilidade).",
        source_name="BBC Learning English",
        source_url="https://www.bbc.co.uk/learningenglish/english-grammar/reference/modal-verbs",
    ),
]


def _normalize_topic(topic: Optional[str]) -> str:
    return (topic or "").strip().lower().replace(" ", "_").replace("-", "_")


class GrammarService:
    """Busca gramática/eventualmente com cache (Upstash)."""

    async def get_grammar(
        self,
        topic: Optional[str] = None,
        level: Optional[str] = None,
    ) -> dict:
        """Retorna a explicação gramatical para o tópico/nível solicitado.

        Se nenhum tópico for informado, retorna um catálogo/index dos temas
        disponíveis (útil para renderizar cards na aba Grammar).
        """
        topic_key = _normalize_topic(topic)
        level_key = (level or "").strip().upper()

        cache_key = f"grammar:{level_key}:{topic_key}"
        if not topic_key:
            cache_key = "grammar:index"

        cached = await cache_get(cache_key)
        if cached:
            return cached

        if not topic_key:
            result = self._build_index(level_key)
            await cache_set(cache_key, result, ttl=60 * 60)
            return result

        entry = self._find_entry(topic_key, level_key)
        result = self._serialize(entry, topic_key, level_key)
        await cache_set(cache_key, result, ttl=60 * 60)
        return result

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _find_entry(self, topic: str, level: str) -> Optional[GrammarEntry]:
        # 1) match exato (topic + level)
        for e in _CATALOG:
            if e.topic == topic and (not level or e.level == level):
                return e
        # 2) match só por topic
        for e in _CATALOG:
            if e.topic == topic:
                return e
        # 3) match parcial por substring
        for e in _CATALOG:
            if topic in e.topic or e.topic in topic:
                return e
        return None

    def _serialize(
        self,
        entry: Optional[GrammarEntry],
        topic: str,
        level: str,
    ) -> dict:
        if not entry:
            # Fallback determinístico: não deixa o aluno sem resposta.
            pretty = topic.replace("_", " ").title()
            return {
                "topic": topic,
                "level": level or "General",
                "title": pretty,
                "rule_summary": (
                    f"Explanação pedagógica para '{pretty}' em construção. "
                    "Consulte as fontes abaixo para uma explicação completa."
                ),
                "key_structure": "—",
                "tip_teacher_tati": (
                    "Pratique com a Tati no chat e ela te mostra exemplos reais deste tópico!"
                ),
                "sources": [
                    {
                        "name": "DW (Notícias)",
                        "url": "https://www.dw.com/pt-br/noticias/s-7111",
                    },
                    {
                        "name": "BBC Learning English",
                        "url": "https://www.bbc.co.uk/learningenglish/features/easy_english_conversations",
                    },
                    {
                        "name": "test-english.com",
                        "url": (
                            f"https://test-english.com/?s={topic.replace('_', '+')}"
                        ),
                    },
                ],
            }

        return {
            "topic": entry.topic,
            "level": entry.level,
            "title": entry.title,
            "rule_summary": entry.rule_summary,
            "key_structure": entry.key_structure,
            "tip_teacher_tati": entry.tip_teacher_tati,
            "sources": [
                {"name": entry.source_name, "url": entry.source_url},
                {
                    "name": "DW (Notícias)",
                    "url": "https://www.dw.com/pt-br/noticias/s-7111",
                },
                {
                    "name": "BBC Learning English",
                    "url": "https://www.bbc.co.uk/learningenglish/features/easy_english_conversations",
                },
                {
                    "name": "test-english.com",
                    "url": "https://test-english.com/",
                },
            ],
        }

    def _build_index(self, level_key: str) -> dict:
        items = _CATALOG
        if level_key:
            items = [e for e in _CATALOG if e.level == level_key]

        return {
            "level": level_key or "ALL",
            "topics": [
                {
                    "topic": e.topic,
                    "level": e.level,
                    "title": e.title,
                    "source_name": e.source_name,
                    "source_url": e.source_url,
                }
                for e in items
            ],
            "sources": [
                {
                    "name": "DW (Notícias)",
                    "url": "https://www.dw.com/pt-br/noticias/s-7111",
                },
                {
                    "name": "BBC Learning English",
                    "url": "https://www.bbc.co.uk/learningenglish/features/easy_english_conversations",
                },
                {
                    "name": "test-english.com (por níveis)",
                    "url": "https://test-english.com/",
                },
            ],
        }


grammar_service = GrammarService()