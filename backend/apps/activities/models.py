import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField


class Flashcard(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    level = models.CharField(max_length=20, default='A1')
    front = models.TextField()
    back = models.TextField()
    explanation = models.TextField(blank=True, null=True)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    topic = models.CharField(max_length=100, blank=True, null=True)
    source_file = models.CharField(max_length=255, blank=True, null=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'cefr_flashcards'
        managed = False
        ordering = ['level', 'front']

    def __str__(self):
        return f"[{self.level}] {self.front} -> {self.back}"


class Module(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    level = models.CharField(max_length=20, default='all')
    order = models.IntegerField(default=0)
    is_published = models.BooleanField(default=True)
    flashcards = models.JSONField(default=list, blank=True, null=True)
    levels = models.JSONField(default=list, blank=True, null=True)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    youtube_url = models.URLField(max_length=1000, blank=True, null=True)
    spotify_url = models.URLField(max_length=1000, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'modules'
        managed = False
        ordering = ['order', '-created_at']

    def __str__(self):
        return self.title


class UserFlashcardProgress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.CharField(max_length=150, db_index=True)
    flashcard_id = models.CharField(max_length=255)
    status = models.CharField(max_length=50, default='correct')
    next_review_date = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'user_flashcard_progress'
        managed = False


class UserVocabulary(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, db_index=True)
    word = models.CharField(max_length=255)
    definition = models.TextField(blank=True, default='')
    example_sentence = models.TextField(blank=True, default='')
    easiness_factor = models.FloatField(default=2.5)
    interval = models.IntegerField(default=1)
    repetitions = models.IntegerField(default=0)
    next_review = models.DateTimeField(null=True, blank=True)
    last_score = models.IntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'user_vocabulary'
        managed = False
        ordering = ['-created_at']


class Podcast(models.Model):
    id = models.CharField(primary_key=True, max_length=255)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    level = models.CharField(max_length=50, default='Beginner')
    thumbnail = models.URLField(max_length=1000, blank=True, null=True)
    embed_url = models.URLField(max_length=1000, blank=True, null=True)
    duration = models.CharField(max_length=50, blank=True, default='')
    category = models.CharField(max_length=100, blank=True, default='General')
    source_name = models.CharField(max_length=100, blank=True, default='YouTube')
    source_type = models.CharField(max_length=50, blank=True, default='youtube')
    media_type = models.CharField(max_length=50, blank=True, default='video')
    external_url = models.URLField(max_length=1000, blank=True, null=True)
    transcript_segments = models.JSONField(default=list, blank=True, null=True)
    has_full_transcript = models.BooleanField(default=False)
    theme_tags = models.JSONField(default=list, blank=True, null=True)
    easy_words = models.JSONField(default=list, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'podcasts'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.level})"


class Trophy(models.Model):
    id = models.CharField(primary_key=True, max_length=100)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    icon = models.CharField(max_length=100, default='🏆')
    category = models.CharField(max_length=100, default='general')
    requirement_type = models.CharField(max_length=100, blank=True, default='')
    requirement_value = models.IntegerField(default=1)
    requirement_text = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'trophies'
        managed = False

    def __str__(self):
        return f"{self.icon} {self.name}"


class UserTrophy(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, db_index=True)
    trophy_id = models.CharField(max_length=100)
    unlocked_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'user_trophies'
        managed = False
        unique_together = ('username', 'trophy_id')

    def __str__(self):
        return f"{self.username} unlocked {self.trophy_id}"


class PremiumContent(models.Model):
    id = models.CharField(primary_key=True, max_length=255)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    type = models.CharField(max_length=50, default='book')
    content_source = models.CharField(max_length=500, blank=True, null=True)
    thumbnail_url = models.URLField(max_length=1000, blank=True, null=True)
    emoji = models.CharField(max_length=20, default='📚')
    is_active = models.BooleanField(default=True)
    category = models.CharField(max_length=100, default='materials')
    is_featured = models.BooleanField(default=False)
    is_secure = models.BooleanField(default=True)
    preview_path = models.CharField(max_length=500, blank=True, null=True)
    processing_status = models.CharField(max_length=50, default='completed')
    external_links = models.JSONField(default=dict, blank=True, null=True)
    price_students = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    price_buyers = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'premium_content'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.emoji} {self.title}"


class Game(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    wordwall_url = models.URLField(max_length=1000)
    levels = ArrayField(models.CharField(max_length=50), default=list, blank=True, null=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'games'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class NewsItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    url = models.URLField(max_length=1000)
    description = models.TextField(blank=True, default='')
    levels = ArrayField(models.CharField(max_length=50), default=list, blank=True, null=True)
    thumbnail_url = models.URLField(max_length=1000, blank=True, null=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'news'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class ActivitySubmission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, db_index=True)
    module_id = models.UUIDField(null=True, blank=True)
    activity_type = models.CharField(max_length=50)
    student_answer = models.TextField(blank=True, default='')
    teacher_feedback = models.TextField(blank=True, default='')
    ai_feedback = models.TextField(blank=True, default='')
    score = models.IntegerField(default=100)
    status = models.CharField(max_length=50, default='completed')
    metadata = models.JSONField(default=dict, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'activity_submissions'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.username} - {self.activity_type} ({self.score}%)"


class CEFRSchedule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    active = models.BooleanField(default=True)
    weekdays = models.JSONField(default=list, blank=True, null=True)
    execution_time = models.TimeField(null=True, blank=True)
    weekly_frequency = models.IntegerField(default=1)
    materials_per_execution = models.IntegerField(default=5)
    selected_types = ArrayField(models.CharField(max_length=50), default=list, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'cefr_schedules'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return f"Schedule {self.id} ({self.weekdays} at {self.execution_time})"


class CEFRReference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    filename = models.CharField(max_length=255)
    storage_url = models.URLField(max_length=1000)
    cefr_level = models.CharField(max_length=20, default='A1')
    file_type = models.CharField(max_length=50, default='pdf')
    file_size = models.BigIntegerField(default=0)
    chunks_indexed = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'cefr_references'
        managed = False
        ordering = ['cefr_level', 'filename']

    def __str__(self):
        return f"[{self.cefr_level}] {self.filename}"
