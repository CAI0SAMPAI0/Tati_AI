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
        cls,
        file_content: bytes,
        filename: Optional[str] = "image.png",
        folder: str = "tati_ai/materials",
    ) -> str:
        cls.configure()
        try:
            ext = os.path.splitext(filename or "")[1].lower()
            if ext in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]:
                res_type = "image"
            elif ext in [".mp4", ".mov", ".avi", ".webm", ".mp3", ".wav", ".m4a"]:
                res_type = "video"
            else:
                # PDF, PPTX, PPT, DOCX, DOC, ZIP, etc.
                res_type = "raw"

            res = cloudinary.uploader.upload(
                file_content,
                folder=folder,
                resource_type=res_type,
                use_filename=True,
                unique_filename=True,
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
