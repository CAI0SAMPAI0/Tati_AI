from datetime import datetime

from pydantic import BaseModel


class FlashcardCreate(BaseModel):
    level: str
    front: str
    back: str
    explanation: str | None = None
    image_url: str | None = None
    topic: str | None = None
    source_file: str | None = None


class FlashcardResponse(FlashcardCreate):
    id: str
    is_published: bool
    created_at: datetime


class ExerciseCreate(BaseModel):
    level: str
    type: str = "multiple_choice"
    question: str
    options: list[str]
    correct_index: int
    explanation: str | None = None
    topic: str | None = None
    source_file: str | None = None


class ExerciseResponse(ExerciseCreate):
    id: str
    is_published: bool
    created_at: datetime
