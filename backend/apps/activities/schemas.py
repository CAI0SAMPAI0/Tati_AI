from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import uuid


class FlashcardOut(BaseModel):
    id: uuid.UUID
    level: str
    front: str
    back: str
    explanation: Optional[str] = None
    image_url: Optional[str] = None
    topic: Optional[str] = None


class FlashcardReviewInput(BaseModel):
    card_id: str
    quality: int = Field(..., ge=0, le=5)  # 0 to 5 for SuperMemo SRS


class FlashcardReviewOut(BaseModel):
    success: bool = True
    next_review_days: int = 1
    xp_earned: int = 10
    total_xp: int = 0


class PodcastOut(BaseModel):
    id: str
    title: str
    description: str
    level: str
    thumbnail: Optional[str] = None
    embed_url: Optional[str] = None
    duration: str = ""
    category: str = "General"
    source_name: str = "YouTube"
    has_full_transcript: bool = False
    easy_words: Optional[List[str]] = []


class GameOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    wordwall_url: str
    levels: Optional[List[str]] = []


class NewsOut(BaseModel):
    id: uuid.UUID
    title: str
    url: str
    description: str
    levels: Optional[List[str]] = []
    thumbnail_url: Optional[str] = None


class HubMaterialOut(BaseModel):
    id: str
    title: str
    description: str
    price: float
    type: str
    thumbnail_url: Optional[str] = None
    emoji: str
    category: str
    is_featured: bool = False
    is_secure: bool = True
    has_access: bool = False
    price_students: Optional[float] = None
    price_buyers: Optional[float] = None


class TrophyOut(BaseModel):
    id: str
    name: str
    title: Optional[str] = None
    description: str
    icon: str
    category: str
    is_unlocked: bool = False
    unlocked: bool = False
    unlocked_at: Optional[str] = None
    progress: int = 0
    target: int = 1


class RankingUserOut(BaseModel):
    position: int
    username: str
    name: str
    total_xp: int
    level: str
    avatar_url: Optional[str] = None
    streak_count: int = 0
    is_current_user: bool = False


class SubmissionInput(BaseModel):
    activity_type: Optional[str] = "exercise"
    activity_id: Optional[str] = None
    module_id: Optional[str] = None
    score: Optional[int] = 100
    metadata: Optional[Dict[str, Any]] = None
    details: Optional[Dict[str, Any]] = None


class SubmissionOut(BaseModel):
    success: bool = True
    xp_earned: int = 15
    new_total_xp: int
    streak_count: int


class WordResultOut(BaseModel):
    word: str
    score: float
    accuracy: str
    error_type: Optional[str] = None
    tip: Optional[str] = None # dica para alguma palavra, como coloque a língua entre os dentes


class PronunciationVerifyInput(BaseModel):
    audio: Optional[str] = None
    reference_text: Optional[str] = None
    target_phrase: Optional[str] = None
    spoken_phrase: Optional[str] = None
    accuracy_threshold: Optional[float] = 70.0
    accent: Optional[str] = "en-US"



class PronunciationVerifyOut(BaseModel):
    score: float
    transcription: Optional[str] = ""
    words: Optional[List[WordResultOut]] = []
    feedback: str
    pedagogical_tip: Optional[str] = "" # Dica prática da Teacher Tati em português/inglês
    suggested_sentence: Optional[str] = "" # Frase correta e natural sugerida pela Teacher Tati
    correct_audio: Optional[str] = ""
    target: Optional[str] = ""
    recognized: Optional[str] = ""
    is_correct: Optional[bool] = True
    metadata: Optional[Dict[str, Any]] = None


class TrimestralExamStatusOut(BaseModel):
    can_start: bool
    status: str
    days_remaining: int
    next_available_date: Optional[datetime] = None
    last_exam_date: Optional[datetime] = None
    active_exam_id: Optional[str] = None
    current_level: str
    last_exam_evolution: Optional[Dict[str, Any]] = None


class ExamQuestionOut(BaseModel):
    id: str
    type: str  # "listening" | "reading" | "grammar" | "vocabulary" | "writing"
    question: str
    points: int
    options: Optional[List[str]] = []
    audio_url: Optional[str] = None
    audio_text: Optional[str] = None
    reading_text: Optional[str] = None
    image_url: Optional[str] = None


class TrimestralExamStartInput(BaseModel):
    num_questions: Optional[int] = 10
    force: Optional[bool] = False


class TrimestralExamStartOut(BaseModel):
    exam_id: str
    level: str
    total_questions: int
    started_at: datetime
    questions: List[ExamQuestionOut]


class StudentAnswerItem(BaseModel):
    question_id: str
    answer: str  # Texto selecionado ou resposta escrita


class TrimestralExamSubmitInput(BaseModel):
    exam_id: str
    answers: List[StudentAnswerItem]


class ExamCorrectionItem(BaseModel):
    question_id: str
    question: str
    type: str
    student_answer: str
    correct_answer: str
    is_correct: bool
    points_earned: int
    explanation: str


class TrimestralExamResultOut(BaseModel):
    exam_id: str
    score: int  # 0 a 100
    passed: bool
    recommended_level: Optional[str] = None
    xp_earned: int
    next_exam_date: datetime
    summary_feedback: str
    can_do_statements: Optional[List[str]] = []
    points_to_improve: Optional[List[str]] = []
    skills_breakdown: Optional[Dict[str, Any]] = {}
    corrections: List[ExamCorrectionItem]


class CheckoutInput(BaseModel):
    content_id: str
    name: Optional[str] = ""
    email: Optional[str] = ""
    cpf: Optional[str] = ""
    billingType: Optional[str] = "PIX"
