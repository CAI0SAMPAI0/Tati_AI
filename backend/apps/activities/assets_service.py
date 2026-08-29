import os
import logging
from typing import Optional
import cloudinary
import cloudinary.uploader

logger = logging.getLogger(__name__)


class CloudinaryService:
    _configured = False

    @classmethod
    def configure(cls):
        if not cls._configured:
            cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
            api_key = os.getenv("CLOUDINARY_API_KEY")
            api_secret = os.getenv("CLOUDINARY_API_SECRET")
            if cloud_name and api_key and api_secret:
                cloudinary.config(
                    cloud_name=cloud_name,
                    api_key=api_key,
                    api_secret=api_secret,
                    secure=True,
                )
                cls._configured = True

    @classmethod
    def upload_file(
        cls, file_content: bytes, filename: Optional[str] = "image.png"
    ) -> str:
        cls.configure()
        try:
            res = cloudinary.uploader.upload(
                file_content,
                folder="tati_ai/flashcards",
                resource_type="image",
            )
            return res.get("secure_url") or res.get("url") or ""
        except Exception as e:
            logger.error(f"[Cloudinary] Error uploading file: {e}")
            raise

    @classmethod
    def upload_from_url(cls, image_url: str) -> str:
        cls.configure()
        try:
            res = cloudinary.uploader.upload(
                image_url,
                folder="tati_ai/flashcards",
                resource_type="image",
            )
            return res.get("secure_url") or res.get("url") or ""
        except Exception as e:
            logger.error(f"[Cloudinary] Error uploading from url: {e}")
            raise
