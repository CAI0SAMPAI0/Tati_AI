from django.contrib import admin
from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = (
        "username",
        "email",
        "name",
        "role",
        "level",
        "is_exempt",
        "is_premium_active",
        "created_at",
    )
    list_filter = ("role", "level", "is_exempt", "is_premium_active")
    search_fields = ("username", "email", "name")
    ordering = ("-created_at",)
    show_full_result_count = False

    fieldsets = (
        ("Identificação", {"fields": ("username", "email", "name", "password")}),
        (
            "Papéis e Acesso",
            {
                "fields": (
                    "role",
                    "level",
                    "is_exempt",
                    "is_premium_active",
                    "plan_type",
                )
            },
        ),
        (
            "Dados Pedagógicos (JSONB)",
            {
                "fields": (
                    "profile",
                    "streak_data",
                    "xp_data",
                    "study_goals",
                    "vocabulary",
                    "weekly_plan",
                )
            },
        ),
        ("Metadados", {"fields": ("created_at", "updated_at")}),
    )
    readonly_fields = ("created_at", "updated_at")
