import flet as ft


class AppColors:
    PRIMARY = "#6366F1"  # Indigo
    SECONDARY = "#EC4899"  # Pink
    ACCENT = "#10B981"  # Emerald
    BACKGROUND = "#0F172A"  # Slate 900
    SURFACE = "#1E293B"  # Slate 800
    TEXT_PRIMARY = "#F8FAFC"
    TEXT_SECONDARY = "#94A3B8"
    ERROR = "#EF4444"


class AppStyles:
    HEADER_TEXT = ft.TextStyle(
        size=32,
        weight=ft.FontWeight.BOLD,
        color=AppColors.TEXT_PRIMARY,
        font_family="Outfit",
    )

    SUBHEADER_TEXT = ft.TextStyle(
        size=18,
        weight=ft.FontWeight.W_500,
        color=AppColors.TEXT_SECONDARY,
        font_family="Inter",
    )

    CARD_STYLE = {
        "bgcolor": AppColors.SURFACE,
        "border_radius": 16,
        "padding": 20,
        "shadow": ft.BoxShadow(
            blur_radius=10,
            color=ft.colors.with_opacity(0.2, "black"),
            offset=ft.Offset(0, 4),
        ),
    }
