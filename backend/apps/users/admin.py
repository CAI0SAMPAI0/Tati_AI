from django.contrib import admin
from .models import UserOnboarding, UserError


@admin.register(UserOnboarding)
class UserOnboardingAdmin(admin.ModelAdmin):
    list_display = ("username", "has_seen_onboarding", "updated_at")
    search_fields = ("username",)
    list_filter = ("has_seen_onboarding",)


@admin.register(UserError)
class UserErrorAdmin(admin.ModelAdmin):
    list_display = (
        "username",
        "category",
        "incorrect_text",
        "correct_text",
        "created_at",
    )
    search_fields = ("username", "incorrect_text", "correct_text")
    list_filter = ("category",)
    ordering = ("-created_at",)
