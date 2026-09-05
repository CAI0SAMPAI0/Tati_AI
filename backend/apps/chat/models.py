import uuid

from django.db import models
from django.utils import timezone as django_timezone


class Conversation(models.Model):
    id = models.CharField(primary_key=True, max_length=255, default=uuid.uuid4)
    username = models.CharField(max_length=150, db_index=True)
    title = models.CharField(max_length=255, default="Nova Conversa com a Teacher Tati")
    model = models.CharField(max_length=100, default="groq/llama-3.3-70b-versatile")
    is_simulation = models.BooleanField(default=False, null=True, blank=True)
    simulation_id = models.UUIDField(null=True, blank=True)
    created_at = models.CharField(max_length=100, default=django_timezone.now)
    updated_at = models.CharField(max_length=100, default=django_timezone.now)

    class Meta:
        db_table = "conversations"
        managed = False
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.username}: {self.title}"


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id = models.CharField(max_length=255, db_index=True)
    username = models.CharField(max_length=150, db_index=True)
    role = models.CharField(max_length=50)  # user, assistant, system
    content = models.TextField()
    date = models.DateField(auto_now_add=True, null=True, blank=True)
    audio_b64 = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = "messages"
        managed = False
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.role}] {self.content[:40]}"


from django.contrib.postgres.fields import ArrayField


class SimulationScenario(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    name_en = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, default="")
    description_en = models.TextField(blank=True, null=True)
    icon = models.CharField(max_length=100, blank=True, null=True)
    difficulty = models.CharField(max_length=50, default="all")
    system_prompt = models.TextField(blank=True, default="")
    created_by = models.CharField(max_length=150, blank=True, null=True)
    levels = ArrayField(
        models.CharField(max_length=50), default=list, blank=True, null=True
    )
    initial_message = models.TextField(blank=True, null=True)
    initial_message_en = models.TextField(blank=True, null=True)
    slug = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    greeting = models.TextField(blank=True, null=True)
    emoji = models.CharField(max_length=20, default="🎭")
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = "simulations"
        managed = False
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.emoji} {self.name}"


class CEFRSimulation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    level = models.CharField(max_length=20, default="A1")
    topic = models.CharField(max_length=255)
    scenario = models.TextField(blank=True, default="")
    roles = models.JSONField(default=dict, blank=True, null=True)
    goal = models.TextField(blank=True, default="")
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = "cefr_simulations"
        managed = False
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.level}] {self.topic}"
