"""
New flashcard unit schema for Sprint 23.
Supports grammar_explanation, exercises, and image_search_term for Unsplash/Pexels integration.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class GrammarExplanation(BaseModel):
    title: str = Field(..., description="Short catchy title")
    rule_summary: str = Field(..., description="Explanation in max 3 sentences focusing on practical usage")
    key_structure: str = Field("", description="E.g. Subject + verb in past / Subject + have/has + Participle")
    tip_teacher_tati: str = Field("", description="Quick memorization or pronunciation tip")


class Flashcard(BaseModel):
    id: int
    word_or_phrase: str
    phonetic: str = ""
    translation: str = ""
    example_sentence: str = ""
    image_search_term: str = Field("", description="Keywords in English for Unsplash/Pexels search")
    image_url: Optional[str] = None


class MultipleChoiceExercise(BaseModel):
    type: str = Field("multiple_choice", const=True)
    id: int
    question: str
    options: List[str]
    correct_answer: str
    explanation_feedback: str = ""


class FillInTheBlanksExercise(BaseModel):
    type: str = Field("fill_in_the_blanks", const=True)
    id: int
    question: str
    correct_answer: str
    explanation_feedback: str = ""


class FlashcardUnit(BaseModel):
    unit_id: str
    cefr_level: str
    topic: str
    target_audience: str = ""
    grammar_explanation: Optional[GrammarExplanation] = None
    flashcards: List[Flashcard] = []
    exercises: List[dict] = []  # Union of MultipleChoiceExercise and FillInTheBlanksExercise


class FlashcardUnitCreate(BaseModel):
    cefr_level: str
    topic: str
    target_audience: str = ""
    grammar_explanation: Optional[GrammarExplanation] = None
    flashcards: List[Flashcard] = []
    exercises: List[dict] = []


class FlashcardUnitResponse(FlashcardUnit):
    id: str
    is_published: bool = False
    created_at: Optional[str] = None
