from dataclasses import dataclass
from typing import Optional, List, Dict, Any


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


CATALOG: List[GrammarEntry] = [
    # ── A1 ──────────────────────────────────────────────────────────
    GrammarEntry(
        topic="present_simple",
        level="A1",
        title="Present Simple",
        rule_summary="We use the Present Simple for habits, facts and routines. Add -s/-es for he/she/it (3rd person singular).",
        key_structure="Subject + verb (+ s/es for he/she/it)",
        tip_teacher_tati="Don't forget the -s for he/she/it: 'He plays soccer every Saturday.'",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a1/present-simple/",
    ),
    GrammarEntry(
        topic="present_continuous",
        level="A1",
        title="Present Continuous",
        rule_summary="We use it for actions happening now. Structure: verb to be + verb-ing.",
        key_structure="Subject + am/is/are + verb-ing",
        tip_teacher_tati="Use 'now', 'at the moment' to make it clear the action is happening right now.",
        source_name="BBC Learning English",
        source_url="https://www.bbc.co.uk/learningenglish/english/features/tenses_with_georgie",
    ),
    GrammarEntry(
        topic="articles",
        level="A1",
        title="Articles: a / an / the",
        rule_summary="'a' before a consonant sound, 'an' before a vowel sound. 'the' for something already known or unique.",
        key_structure="a/an + singular countable noun | the + specific noun",
        tip_teacher_tati="It's the SOUND that matters: 'an hour' (silent h), 'a university' (sounds like 'you').",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a1/a-an-the-no-article/",
    ),
    GrammarEntry(
        topic="be_verb",
        level="A1",
        title="Verb to Be: am / is / are",
        rule_summary="The verb 'to be' describes identity, states and location. I am, he/she/it is, you/we/they are.",
        key_structure="I am / He-she-it is / You-we-they are",
        tip_teacher_tati="'I'm' = short form. 'I am' = full form. Both are correct!",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a1/verb-to-be/",
    ),
    GrammarEntry(
        topic="possessive_adjectives",
        level="A1",
        title="Possessive Adjectives: my, your, his, her...",
        rule_summary="Possessive adjectives show who something belongs to. They go before the noun.",
        key_structure="my book / your name / his car / her phone",
        tip_teacher_tati="Don't confuse 'his' (male) and 'her' (female) — they are NOT interchangeable!",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a1/possessive-adjectives/",
    ),
    # ── A2 ──────────────────────────────────────────────────────────
    GrammarEntry(
        topic="past_simple",
        level="A2",
        title="Past Simple: Regular and Irregular Verbs",
        rule_summary="Use Past Simple for completed actions in the past. Regular verbs end in -ed; irregular verbs change completely.",
        key_structure="Subject + verb-ed (regular) / 2nd column (irregular)",
        tip_teacher_tati="Use time markers: yesterday, last week, in 2020. 'Did' takes the infinitive: 'Did you go?' NOT 'Did you went?'",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/a2/past-simple/",
    ),
    GrammarEntry(
        topic="comparatives_superlatives",
        level="A2",
        title="Comparatives and Superlatives",
        rule_summary="Short adjectives: add -er/-est (taller, the tallest). Long adjectives: more/the most (more beautiful, the most beautiful).",
        key_structure="A is taller than B | A is the tallest in the group",
        tip_teacher_tati="Don't say 'more bigger' — choose either -er OR 'more', never both!",
        source_name="BBC Learning English",
        source_url="https://www.bbc.co.uk/learningenglish/english/course/towards-advanced/unit-1/session-2",
    ),
    # ── B1 ──────────────────────────────────────────────────────────
    GrammarEntry(
        topic="present_perfect",
        level="B1",
        title="Present Perfect: have/has + past participle",
        rule_summary="Used for experiences, recent actions with a present result, or actions that started in the past and continue now.",
        key_structure="Subject + have/has + past participle (V3)",
        tip_teacher_tati="Use 'since' for a starting point (since 2010), 'for' for a duration (for 5 years).",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/b1/present-perfect/",
    ),
    GrammarEntry(
        topic="first_conditional",
        level="B1",
        title="First Conditional: Real Future Possibility",
        rule_summary="If + Present Simple, will + base verb. Describes real and possible future situations.",
        key_structure="If + Present Simple, will + base verb",
        tip_teacher_tati="NEVER use 'will' in the if-clause: 'If it rains...' NOT 'If it will rain...'",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/b1/first-conditional/",
    ),
    # ── B2 ──────────────────────────────────────────────────────────
    GrammarEntry(
        topic="second_conditional",
        level="B2",
        title="Second Conditional: Hypothetical / Imaginary Situations",
        rule_summary="If + Past Simple, would + base verb. For imaginary, unlikely or counter-factual situations now or in the future.",
        key_structure="If + Past Simple, would + base verb",
        tip_teacher_tati="In formal English, use 'were' for all persons: 'If I were you, I would take the offer.'",
        source_name="test-english.com",
        source_url="https://test-english.com/grammar-points/b2/second-conditional/",
    ),
    GrammarEntry(
        topic="passive_voice",
        level="B2",
        title="Passive Voice",
        rule_summary="Focus is on the action/object rather than who performed it. Form: be + past participle.",
        key_structure="Object + appropriate form of 'be' + past participle (+ by agent)",
        tip_teacher_tati="Use passive when the doer is unknown, obvious or less important than the result.",
        source_name="BBC Learning English",
        source_url="https://www.bbc.co.uk/learningenglish/english/course/towards-advanced/unit-16/session-1",
    ),
    # ── C1 ──────────────────────────────────────────────────────────
    GrammarEntry(
        topic="inversion",
        level="C1",
        title="Inversion for Emphasis",
        rule_summary="Invert subject and auxiliary after negative/restrictive adverbs (Never, Seldom, Rarely, Not only).",
        key_structure="Negative adverb + auxiliary + subject + main verb",
        tip_teacher_tati="Use inversion in formal writing: 'Rarely have I seen such dedication.'",
        source_name="BBC Learning English",
        source_url="https://www.bbc.co.uk/learningenglish/english/course/upper-intermediate/unit-28/session-1",
    ),
]


class GrammarService:
    @staticmethod
    def get_grammar(topic: Optional[str] = None, level: Optional[str] = None) -> dict:
        if topic:
            for entry in CATALOG:
                if entry.topic == topic:
                    return {
                        "topic": entry.topic,
                        "level": entry.level,
                        "title": entry.title,
                        "rule_summary": entry.rule_summary,
                        "key_structure": entry.key_structure,
                        "tip_teacher_tati": entry.tip_teacher_tati,
                        "source_name": entry.source_name,
                        "source_url": entry.source_url,
                    }
        
        filtered = CATALOG
        if level and level.upper() not in ("ALL", "ANY"):
            filtered = [e for e in CATALOG if e.level.upper() == level.upper()]

        return {
            "topics": [
                {
                    "topic": e.topic,
                    "level": e.level,
                    "title": e.title,
                    "rule_summary": e.rule_summary,
                    "key_structure": e.key_structure,
                    "tip_teacher_tati": e.tip_teacher_tati,
                    "source_name": e.source_name,
                    "source_url": e.source_url,
                }
                for e in filtered
            ]
        }
