"""
Endpoint for resolving image_search_term to image URLs via Unsplash/Pexels/Pixabay.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.dependencies.auth import get_current_user
from app.modules.cefr.services.image_service import resolve_image, resolve_images_batch

router = APIRouter()


class ResolveImageRequest(BaseModel):
    term: str


class ResolveImagesBatchRequest(BaseModel):
    terms: List[str]


@router.post('/resolve')
async def resolve_single_image(
    req: ResolveImageRequest,
    user=Depends(get_current_user),
):
    """Resolve a single image_search_term to an image URL."""
    url = await resolve_image(req.term)
    if not url:
        raise HTTPException(status_code=404, detail=f"No image found for term: {req.term}")
    return {"term": req.term, "url": url}


@router.post('/resolve-batch')
async def resolve_batch_images(
    req: ResolveImagesBatchRequest,
    user=Depends(get_current_user),
):
    """Resolve multiple image_search_term values in parallel."""
    results = await resolve_images_batch(req.terms)
    return {"results": results}
