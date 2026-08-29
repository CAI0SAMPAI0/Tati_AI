from django.contrib import admin
from .models import (
    Flashcard,
    Module,
    Podcast,
    Trophy,
    Game,
    NewsItem,
    ActivitySubmission,
)


@admin.register(Flashcard)
class FlashcardAdmin(admin.ModelAdmin):
    list_display = ("front", "back", "level", "topic", "is_published", "created_at")
    list_filter = ("level", "is_published", "topic")
    search_fields = ("front", "back", "explanation", "topic")
    show_full_result_count = False


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ("title", "level", "order", "is_published", "created_at")
    list_filter = ("level", "is_published")
    search_fields = ("title", "description")
    show_full_result_count = False


@admin.register(Podcast)
class PodcastAdmin(admin.ModelAdmin):
    list_display = ("title", "level", "created_at")
    list_filter = ("level",)
    search_fields = ("title", "description")
    show_full_result_count = False


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ("title", "is_published", "created_at")
    list_filter = ("is_published",)
    search_fields = ("title", "description")
    show_full_result_count = False


@admin.register(NewsItem)
class NewsItemAdmin(admin.ModelAdmin):
    list_display = ("title", "is_published", "created_at")
    list_filter = ("is_published",)
    search_fields = ("title", "description")
    show_full_result_count = False


@admin.register(Trophy)
class TrophyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
        "requirement_type",
        "requirement_value",
        "created_at",
    )
    list_filter = ("category",)
    search_fields = ("name", "description")
    show_full_result_count = False


@admin.register(ActivitySubmission)
class ActivitySubmissionAdmin(admin.ModelAdmin):
    list_display = ("username", "activity_type", "score", "status", "created_at")
    list_filter = ("activity_type", "status", "created_at")
    search_fields = ("username",)
    show_full_result_count = False
