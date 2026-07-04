import logging
import httpx
from app.core.celery_app import celery_app


@celery_app.task(name="app.core.tasks.keepalive")
def keepalive():
    import asyncio
    from app.core.database import keep_alive_ping
    asyncio.run(keep_alive_ping())


@celery_app.task(name="app.core.tasks.waha_keepalive")
def waha_keepalive():
    """Pings the WAHA Space to prevent it from being paused by Hugging Face inactivity policy."""
    from app.core.config import settings
    url = f"{settings.waha_api_url}/api/server/status"
    headers = {"X-Api-Key": settings.waha_api_key}
    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.get(url, headers=headers)
            logging.info(f"[WAHA Keepalive] Ping to {url} -> status {res.status_code}")
    except Exception as e:
        logging.warning(f"[WAHA Keepalive] Ping failed: {e}")