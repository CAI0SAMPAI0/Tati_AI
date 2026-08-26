import uuid
from django.db import models


class Order(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, db_index=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=50, default='pending')  # pending, paid, cancelled
    payment_method = models.CharField(max_length=50, default='pix')
    asaas_id = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'orders'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return f"Order {self.id} ({self.username}) - R$ {self.total_amount}"


class Subscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, db_index=True)
    plan_type = models.CharField(max_length=50, default='full')
    status = models.CharField(max_length=50, default='active')  # active, past_due, cancelled
    payment_id = models.CharField(max_length=255, blank=True, null=True)
    preferred_due_day = models.IntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'subscriptions'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.username} - Plan: {self.plan_type} ({self.status})"


class PremiumPurchase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, db_index=True)
    content_id = models.CharField(max_length=255)
    status = models.CharField(max_length=50, default='completed')
    asaas_payment_id = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'premium_purchases'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.username} bought {self.content_id}"
