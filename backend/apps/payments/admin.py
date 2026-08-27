from django.contrib import admin
from .models import Order, Subscription, PremiumPurchase

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('username', 'total_amount', 'status', 'payment_method', 'created_at')
    list_filter = ('status', 'payment_method')
    search_fields = ('username', 'asaas_id')
    show_full_result_count = False

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('username', 'plan_type', 'status', 'preferred_due_day', 'created_at', 'expires_at')
    list_filter = ('plan_type', 'status')
    search_fields = ('username', 'payment_id')
    show_full_result_count = False

@admin.register(PremiumPurchase)
class PremiumPurchaseAdmin(admin.ModelAdmin):
    list_display = ('username', 'content_id', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('username', 'content_id')
    show_full_result_count = False
