from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class FlashcardCreate(BaseModel):
    level: str
    front: str
    back: str
    explanation: Optional[str] = None
    image_url: Optional[str] = None
    topic: Optional[str] = None
    source_file: Optional[str] = None


class FlashcardResponse(FlashcardCreate):
    id: str
    is_published: bool
    created_at: datetime


class ExerciseCreate(BaseModel):
    level: str
    type: str = "multiple_choice"
    question: str
    options: List[str]
    correct_index: int
    explanation: Optional[str] = None
    topic: Optional[str] = None
    source_file: Optional[str] = None


class ExerciseResponse(ExerciseCreate):
    id: str
    is_published: bool
    created_at: datetime
