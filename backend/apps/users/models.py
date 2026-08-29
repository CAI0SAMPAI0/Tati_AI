import uuid
from django.db import models


class UserOnboarding(models.Model):
    username = models.CharField(primary_key=True, max_length=150, db_column="username")
    has_seen_onboarding = models.BooleanField(
        default=False, db_column="has_seen_onboarding"
    )
    updated_at = models.DateTimeField(
        auto_now=True, db_column="updated_at", null=True, blank=True
    )

    class Meta:
        db_table = "user_onboarding"
        managed = False

    def __str__(self):
        return f"{self.username} - Onboarding: {self.has_seen_onboarding}"


class UserError(models.Model):
    id = models.UUIDField(
        primary_key=True, default=uuid.uuid4, editable=False, db_column="id"
    )
    username = models.CharField(max_length=150, db_column="username")
    incorrect_text = models.TextField(db_column="incorrect_text", default="")
    correct_text = models.TextField(db_column="correct_text", default="")
    explanation = models.TextField(blank=True, default="", db_column="explanation")
    category = models.CharField(max_length=100, default="grammar", db_column="category")
    created_at = models.DateTimeField(
        auto_now_add=True, db_column="created_at", null=True, blank=True
    )

    class Meta:
        db_table = "user_errors"
        managed = False
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.username} - {self.incorrect_text[:30]}"
