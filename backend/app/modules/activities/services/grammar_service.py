from __future__ import annotations

"""
Sprint 20 – Grammar service.

Replaces the old "AI Exercises" tab with a "Grammar" tab that fetches
grammar explanations from curated sources:
  - DW News                     -> https://www.dw.com/en/top-stories/s-9097
  - BBC Learning English        -> https://www.bbc.co.uk/learningenglish/english/grammar
  - test-english.com (by level) -> https://test-english.com/

All content is in English. The catalog covers the most common CEFR topics A1-C1.
When a topic is not in the catalog, a deterministic fallback is returned.
"""

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


# Curated grammar catalog by CEFR level (aligned with Feature 3 sources).
# All text in English.
_CATALOG: list[GrammarEntry] = [
    # ── A1 ──────────────────────────────────────────────────────────
    GrammarEntry(
        topic="present_simple",
        level="A1",
        title="Present Simple",
        rule_summary=(
            "We use the Present Simple for habits, facts and routines. "
            "Add -s/-es for he/she/it (3rd person singular)."
        ),
        key_structure="Subject + verb (+ s/es for he/she/it)",
        tip_teacher_tati="Don't forget the -s for he/she/it: 'He plays soccer every Saturday.'",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a1/present-simple/",
    ),
    GrammarEntry(
        topic="present_continuous",
        level="A1",
        title="Present Continuous",
        rule_summary=(
            "We use it for actions happening now. "
            "Structure: verb to be + verb-ing."
        ),
        key_structure="Subject + am/is/are + verb-ing",
        tip_teacher_tati="Use 'now', 'at the moment' to make it clear the action is happening right now.",
        source_name="BBC Learning English",
        source_url="https://www.bbc.co.uk/learningenglish/english/grammar",
    ),
    GrammarEntry(
        topic="articles",
        level="A1",
        title="Articles: a / an / the",
        rule_summary=(
            "'a' before a consonant sound, 'an' before a vowel sound. "
            "'the' for something already known or unique."
        ),
        key_structure="a/an + singular countable noun | the + specific noun",
        tip_teacher_tati="It's the SOUND that matters: 'an hour' (silent h), 'a university' (sounds like 'you').",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a1/articles/",
    ),
    GrammarEntry(
        topic="be_verb",
        level="A1",
        title="Verb to Be: am / is / are",
        rule_summary=(
            "The verb 'to be' describes identity, states and location. "
            "I am, he/she/it is, you/we/they are."
        ),
        key_structure="I am / He-she-it is / You-we-they are",
        tip_teacher_tati="'I'm' = short form. 'I am' = full form. Both are correct!",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a1/verb-to-be/",
    ),
    GrammarEntry(
        topic="possessive_adjectives",
        level="A1",
        title="Possessive Adjectives: my, your, his, her...",
        rule_summary=(
            "Possessive adjectives show who something belongs to. "
            "They go before the noun."
        ),
        key_structure="my book / your name / his car / her phone",
        tip_teacher_tati="Don't confuse 'his' (male) and 'her' (female) — they are NOT interchangeable!",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a1/possessive-adjectives/",
    ),
    # ── A2 ──────────────────────────────────────────────────────────
    GrammarEntry(
        topic="past_simple",
        level="A2",
        title="Past Simple",
        rule_summary=(
            "For finished actions in the past. "
            "Regular verbs add -ed; irregular verbs have their own past form."
        ),
        key_structure="Subject + verb (-ed) / irregular past form",
        tip_teacher_tati="Learn irregulars gradually: go-went, eat-ate, see-saw, buy-bought.",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a2/past-simple/",
    ),
    GrammarEntry(
        topic="comparatives_superlatives",
        level="A2",
        title="Comparatives & Superlatives",
        rule_summary=(
            "Compare 2 things: adjective + -er + than. "
            "Compare 3+: the + adjective + -est. "
            "Long adjectives: more / most."
        ),
        key_structure="Short: adj+er+than / the+adj+est | Long: more+adj / the most+adj",
        tip_teacher_tati="Good -> better -> the best (irregular — memorize it!).",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a2/comparatives-and-superlatives/",
    ),
    GrammarEntry(
        topic="future_will_going_to",
        level="A2",
        title="Future: will vs going to",
        rule_summary=(
            "will = instant decision / general prediction. "
            "going to = plan / prediction with evidence."
        ),
        key_structure="will: Subject + will + verb | going to: Subject + am/is/are + going to + verb",
        tip_teacher_tati='Look out the window: dark clouds -> "It\'s going to rain." Decision now -> "I\'ll help you."',
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a2/future-forms/",
    ),
    GrammarEntry(
        topic="modal_verbs",
        level="A2",
        title="Modal Verbs: can, must, should",
        rule_summary=(
            "Modals don't take -s or 'to'. "
            "They express possibility, obligation, advice."
        ),
        key_structure="Subject + modal + base verb",
        tip_teacher_tati="I must study (strong obligation). I should study (advice). I can study (ability).",
        source_name="BBC Learning English",
        source_url="https://www.bbc.co.uk/learningenglish/english/grammar",
    ),
    GrammarEntry(
        topic="countable_uncountable",
        level="A2",
        title="Countable & Uncountable Nouns",
        rule_summary=(
            "Countable nouns can be counted (a book, two books). "
            "Uncountable nouns cannot (water, information, music). "
            "Use 'some' for both in affirmatives."
        ),
        key_structure="a/an + countable (singular) | some + countable (plural) / uncountable",
        tip_teacher_tati="'Information' is uncountable — never say 'an information'!",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a2/countable-and-uncountable-nouns/",
    ),
    # ── B1 ──────────────────────────────────────────────────────────
    GrammarEntry(
        topic="present_perfect",
        level="B1",
        title="Present Perfect",
        rule_summary=(
            "Connects the past to the present: actions with a result now "
            "or life experience. Use have/has + past participle."
        ),
        key_structure="Subject + have/has + past participle",
        tip_teacher_tati="Key signals: ever, never, already, yet, just, since, for.",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/b1/",
    ),
    GrammarEntry(
        topic="past_simple_vs_present_perfect",
        level="B1",
        title="Past Simple vs Present Perfect",
        rule_summary=(
            "Past Simple = specific time in the past. "
            "Present Perfect = undefined time or result relevant now."
        ),
        key_structure=(
            "Past Simple: Subject + past verb | "
            "Present Perfect: Subject + have/has + past participle"
        ),
        tip_teacher_tati="If there's a specific time (yesterday, in 2019), use Past Simple. Otherwise, prefer Present Perfect.",
        source_name="BBC Learning English",
        source_url="https://www.bbc.co.uk/learningenglish/english/grammar",
    ),
    GrammarEntry(
        topic="conditionals_zero_first",
        level="B1",
        title="Zero & First Conditional",
        rule_summary=(
            "Zero: general truths (If + present, present). "
            "First: possible future situation (If + present, will + verb)."
        ),
        key_structure="Zero: If + present, present | First: If + present, will + verb",
        tip_teacher_tati="In the if-clause, NEVER use 'will'. Use the present tense.",
        source_name="BBC Learning English",
        source_url="https://www.bbc.co.uk/learningenglish/english/grammar",
    ),
    GrammarEntry(
        topic="used_to",
        level="B1",
        title="Used to + infinitive",
        rule_summary=(
            "We use 'used to' for past habits or states that are no longer true. "
            "Negative: didn't use to. Question: Did you use to...?"
        ),
        key_structure="Subject + used to + base verb",
        tip_teacher_tati="'Used to' is about the PAST only. For current habits, use 'usually' or 'always'.",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/b1/used-to/",
    ),
    GrammarEntry(
        topic="first_conditional",
        level="B1",
        title="First Conditional",
        rule_summary=(
            "For possible future situations. "
            "Structure: If + present, will + base verb."
        ),
        key_structure="If + present tense, subject + will + base verb",
        tip_teacher_tati="Don't say 'If it will rain' — say 'If it rains' (present in the if-clause).",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/b1/first-conditional/",
    ),
    GrammarEntry(
        topic="second_conditional",
        level="B1",
        title="Second Conditional",
        rule_summary=(
            "For hypothetical or unlikely situations in the present/future. "
            "Structure: If + past, would + base verb."
        ),
        key_structure="If + past tense, subject + would + base verb",
        tip_teacher_tati="'If I were' (not 'was') is more formal but both are used in conversation.",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/b1/second-conditional/",
    ),
    # ── B2 ──────────────────────────────────────────────────────────
    GrammarEntry(
        topic="passive_voice",
        level="B2",
        title="Passive Voice",
        rule_summary=(
            "We use passive when the action is more important than who does it. "
            "Structure: subject + be + past participle."
        ),
        key_structure="Subject + am/is/are/was/were + past participle",
        tip_teacher_tati="Passive is common in news and scientific writing: 'The man was arrested yesterday.'",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/b2/passive-voice/",
    ),
    GrammarEntry(
        topic="relative_clauses",
        level="B2",
        title="Relative Clauses",
        rule_summary=(
            "Relative clauses add information about a noun. "
            "Use who (people), which (things), that (both), whose (possession)."
        ),
        key_structure="noun + who/which/that/whose + clause",
        tip_teacher_tati="'That' is very flexible — it can replace 'who' and 'which' in most cases.",
        source_name="BBC Learning English",
        source_url="https://www.bbc.co.uk/learningenglish/english/grammar",
    ),
    GrammarEntry(
        topic="third_conditional",
        level="B2",
        title="Third Conditional",
        rule_summary=(
            "For unreal past situations (things that didn't happen). "
            "Structure: If + past perfect, would have + past participle."
        ),
        key_structure="If + had + past participle, subject + would have + past participle",
        tip_teacher_tati="Third conditional is about REGRETS: 'If I had studied harder, I would have passed.'",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/b2/third-conditional/",
    ),
]


def _normalize_topic(topic: Optional[str]) -> str:
    return (topic or "").strip().lower().replace(" ", "_").replace("-", "_")


class GrammarService:
    """Grammar lookup with Upstash cache."""

    async def get_grammar(
        self,
        topic: Optional[str] = None,
        level: Optional[str] = None,
    ) -> dict:
        """Return grammar explanation for the requested topic/level.

        If no topic is provided, returns a topic index (for the Grammar tab cards).
        """
        topic_key = _normalize_topic(topic)
        level_key = (level or "").strip().upper()

        cache_key = f"grammar:{level_key}:{topic_key}" if topic_key else "grammar:index"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        if not topic_key:
            result = self._build_index(level_key)
        else:
            entry = self._find_entry(topic_key, level_key)
            result = self._serialize(entry, topic_key, level_key)

        await cache_set(cache_key, result, ttl=60 * 60)
        return result

    # ── Helpers ─────────────────────────────────────────────────────
    def _find_entry(self, topic: str, level: str) -> Optional[GrammarEntry]:
        # 1) exact match (topic + level)
        for e in _CATALOG:
            if e.topic == topic and (not level or e.level == level):
                return e
        # 2) topic only
        for e in _CATALOG:
            if e.topic == topic:
                return e
        # 3) partial match
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
            pretty = topic.replace("_", " ").title()
            return {
                "topic": topic,
                "level": level or "General",
                "title": pretty,
                "rule_summary": (
                    f"Explanation for '{pretty}' coming soon. "
                    "Check the sources below for a full explanation."
                ),
                "key_structure": "—",
                "tip_teacher_tati": (
                    "Practice with Teacher Tati in the chat and she will show you real examples of this topic!"
                ),
                "sources": [
                    {"name": "DW News", "url": "https://www.dw.com/en/top-stories/s-9097"},
                    {"name": "BBC Learning English", "url": "https://www.bbc.co.uk/learningenglish/english/grammar"},
                    {"name": "test-english.com", "url": f"https://test-english.com/?s={topic.replace('_', '+')}"},
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
                {"name": "DW News", "url": "https://www.dw.com/en/top-stories/s-9097"},
                {"name": "BBC Learning English", "url": "https://www.bbc.co.uk/learningenglish/english/grammar"},
                {"name": "test-english.com", "url": "https://test-english.com/"},
            ],
        }

    def _build_index(self, level_key: str) -> dict:
        items = _CATALOG
        if level_key and level_key != "ALL":
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
                {"name": "DW News", "url": "https://www.dw.com/en/top-stories/s-9097"},
                {"name": "BBC Learning English", "url": "https://www.bbc.co.uk/learningenglish/english/grammar"},
                {"name": "test-english.com (by level)", "url": "https://test-english.com/"},
            ],
        }


grammar_service = GrammarService()