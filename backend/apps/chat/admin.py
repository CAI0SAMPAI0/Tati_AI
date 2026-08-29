from django.contrib import admin
from .models import Conversation, Message, SimulationScenario


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "title", "is_simulation", "created_at")
    list_filter = ("is_simulation",)
    search_fields = ("username", "title")
    show_full_result_count = False


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "session_id", "username", "role", "created_at")
    list_filter = ("role", "created_at")
    search_fields = ("username", "content")
    ordering = ("-created_at",)
    show_full_result_count = False


@admin.register(SimulationScenario)
class SimulationScenarioAdmin(admin.ModelAdmin):
    list_display = ("name", "difficulty", "slug")
    list_filter = ("difficulty",)
    search_fields = ("name", "description")
    show_full_result_count = False
