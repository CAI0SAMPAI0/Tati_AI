from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async, async_to_sync
from django.contrib.auth import get_user_model


@database_sync_to_async
def aget_user_by_username(username: str):
    User = get_user_model()
    return User.objects.filter(username=username).first()


__all__ = [
    "database_sync_to_async",
    "sync_to_async",
    "async_to_sync",
    "aget_user_by_username",
]
