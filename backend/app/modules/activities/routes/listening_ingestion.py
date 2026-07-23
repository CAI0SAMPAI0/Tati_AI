"""
Routes for listening content ingestion from DW, BBC, test-english.com.
Also provides cleanup endpoint for legacy podcast content.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies.auth import get_current_user
from app.modules.activities.services.listening_ingestor import run_listening_ingestion

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post('/ingest')
async def ingest_listening_content(user=Depends(get_current_user)):
    """
    Ingest listening content from DW, BBC Learning English, and test-english.com.
    Only staff can trigger this.
    """
    if not user or user.get('role') not in [
        'admin', 'Admin', 'programador', 'Programador', 'Tatiana', 'Tati', 'professor', 'professora', 'Professora'
    ]:
        raise HTTPException(status_code=403, detail="Staff only")

    try:
        results = await run_listening_ingestion()
        return {
            "message": "Listening content ingestion completed",
            "results": results,
            "total": sum(results.values())
        }
    except Exception as e:
        logger.error(f"Listening ingestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/cleanup-legacy')
async def cleanup_legacy_podcasts(user=Depends(get_current_user)):
    """
    Remove legacy podcast content that has YouTube embed URLs.
    Keeps listening content from DW, BBC, test-english.com.
    """
    if not user or user.get('role') not in [
        'admin', 'Admin', 'programador', 'Programador', 'Tatiana', 'Tati', 'professor', 'professora', 'Professora'
    ]:
        raise HTTPException(status_code=403, detail="Staff only")

    from app.core.database import get_client
    client = get_client()

    try:
        result = client.table('podcasts').delete().or_(
            'embed_url.like.%youtube%,embed_url.like.%youtu.be%,source_type.eq.youtube'
        ).execute()
        deleted_count = len(result.data) if result.data else 0
        logger.info(f"[Cleanup] Removed {deleted_count} legacy YouTube podcasts")
        return {"message": f"Removed {deleted_count} legacy podcast entries", "deleted": deleted_count}
    except Exception as e:
        logger.error(f"Cleanup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
