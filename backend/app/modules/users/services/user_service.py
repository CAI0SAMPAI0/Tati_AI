import logging

"""
services/user_service.py
Serviço para gerenciamento de perfil, vocabulário e dados do usuário.
"""

from datetime import datetime, timezone
from typing import Any

from app.core.dependencies.db import get_db
from app.core.enums import normalize_level
from app.core.exceptions import InvalidDocumentError, UserNotFoundError
from app.shared.services.document_validator import validate_document_auto
from app.shared.services.upstash import cache_delete, cache_get, cache_set
from fastapi import Depends, HTTPException
from fastapi.concurrency import run_in_threadpool


class UserService:
    def __init__(self, db: Any = Depends(get_db)):
        if db is None or str(type(db)).find("Depends") != -1:
            from app.core.database import get_client

            self.db = get_client()
        else:
            self.db = db

    async def get_profile(self, username: str) -> dict[str, Any]:
        cache_key = f"profile:{username}"
        cached = await cache_get(cache_key)
        if cached:
            # Compatibilidade com versões antigas que ainda montavam o modal
            # de WhatsApp. O onboarding foi desativado e não deve bloquear o acesso.
            cached_profile = cached.get("profile") or {}
            cached_profile["whatsapp_onboarded"] = True
            cached["profile"] = cached_profile
            if not cached.get("avatar_url") and isinstance(cached.get("profile"), dict):
                cached["avatar_url"] = cached["profile"].get("avatar_url")
            return cached

        def _fetch():
            try:
                rows = (
                    self.db.table("users")
                    .select(
                        "username, name, email, role, level, focus, created_at, profile, avatar_url, cpf, cpf_cnpj"
                    )
                    .eq("username", username)
                    .limit(1)
                    .execute()
                    .data
                )
            except Exception:
                rows = (
                    self.db.table("users")
                    .select(
                        "username, name, email, role, level, focus, created_at, profile, cpf, cpf_cnpj"
                    )
                    .eq("username", username)
                    .limit(1)
                    .execute()
                    .data
                )

            if not rows:
                return None
            row = rows[0]
            avatar = row.get("avatar_url") or (row.get("profile") or {}).get(
                "avatar_url"
            )
            profile = row.get("profile") or {}
            profile["whatsapp_onboarded"] = True
            row["profile"] = profile
            row["avatar_url"] = avatar
            return row

        result = await run_in_threadpool(_fetch)
        if not result:
            raise UserNotFoundError()

        await cache_set(cache_key, result, ttl=600)
        return result

    async def update_profile(
        self, username: str, body: dict[str, Any]
    ) -> dict[str, Any]:
        def _update():
            rows = (
                self.db.table("users")
                .select("profile")
                .eq("username", username)
                .limit(1)
                .execute()
                .data
            )
            if not rows:
                raise UserNotFoundError()

            doc = body.get("cpf") or body.get("cpf_cnpj")
            if doc:
                v = validate_document_auto(doc)
                if not v["valid"]:
                    raise InvalidDocumentError(v["message"])
                if body.get("cpf"):
                    body["cpf"] = v["formatted"]
                if body.get("cpf_cnpj"):
                    body["cpf_cnpj"] = v["formatted"]

            top_level = {
                k: v
                for k, v in body.items()
                if k in ("name", "email", "level", "focus", "cpf", "cpf_cnpj")
                and v is not None
            }
            profile = rows[0].get("profile") or {}
            for field in (
                "nickname",
                "occupation",
                "responsible_email",
                "whatsapp_number",
                "allow_whatsapp_notifications",
                "whatsapp_onboarded",
            ):
                if body.get(field) is not None:
                    profile[field] = body[field]

            if top_level.get("level"):
                top_level["level"] = normalize_level(top_level["level"])

            update_data = {**top_level, "profile": profile}
            self.db.table("users").update(update_data).eq(
                "username", username
            ).execute()
            return update_data

        res = await run_in_threadpool(_update)
        await cache_delete(f"profile:{username}")
        return res

    async def get_vocabulary(self, username: str) -> dict[str, Any]:
        cache_key = f"vocabulary:{username}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        def _fetch():
            row = (
                self.db.table("users")
                .select("vocabulary")
                .eq("username", username)
                .single()
                .execute()
                .data
            )
            return row.get("vocabulary", []) if row else []

        words = await run_in_threadpool(_fetch)
        res = {"words": words, "total": len(words)}
        await cache_set(cache_key, res, ttl=600)
        return res

    async def add_vocabulary_word(
        self, username: str, word_data: dict[str, Any]
    ) -> dict[str, Any]:
        def _add():
            row = (
                self.db.table("users")
                .select("vocabulary")
                .eq("username", username)
                .single()
                .execute()
                .data
            )
            words = row.get("vocabulary", []) if row else []

            if any(w.get("term") == word_data["term"] for w in words):
                return {"ok": False, "message": "Already exists"}

            word_data["added_at"] = datetime.now(timezone.utc).isoformat()
            words.append(word_data)
            self.db.table("users").update({"vocabulary": words}).eq(
                "username", username
            ).execute()
            return {"ok": True, "total": len(words)}

        res = await run_in_threadpool(_add)
        await cache_delete(f"vocabulary:{username}")
        return res

    async def delete_vocabulary_word(self, username: str, term: str) -> dict[str, Any]:
        def _delete():
            row = (
                self.db.table("users")
                .select("vocabulary")
                .eq("username", username)
                .single()
                .execute()
                .data
            )
            words = row.get("vocabulary", []) if row else []
            new_words = [w for w in words if w.get("term") != term]

            self.db.table("users").update({"vocabulary": new_words}).eq(
                "username", username
            ).execute()
            return {"ok": True, "count": len(new_words)}

        res = await run_in_threadpool(_delete)
        await cache_delete(f"vocabulary:{username}")
        return res

    async def upload_avatar(
        self, username: str, contents: bytes, content_type: str
    ) -> str:
        """Uploads avatar as base64 data URI (resized to 256x256 JPEG) and updates user profile."""
        import base64
        import io

        try:
            from PIL import Image

            img = Image.open(io.BytesIO(contents))
            img = img.convert("RGB")
            img.thumbnail((256, 256))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=75)
            compressed = buf.getvalue()
        except ImportError:
            compressed = contents
        except Exception:
            compressed = contents

        b64 = base64.b64encode(compressed).decode()
        url = f"data:image/jpeg;base64,{b64}"

        def _update_db():
            # Tenta atualizar tanto a coluna profile quanto a coluna
            # top-level avatar_url
            rows = (
                self.db.table("users")
                .select("profile")
                .eq("username", username)
                .execute()
                .data
            )
            profile = (rows[0].get("profile") or {}) if rows else {}
            profile["avatar_url"] = url

            # Tenta atualizar ambos. Se a coluna avatar_url não existir, o Supabase pode dar erro,
            # então fazemos de forma segura ou pegamos a exceção.
            try:
                self.db.table("users").update(
                    {"profile": profile, "avatar_url": url}
                ).eq("username", username).execute()
            except Exception:
                # Fallback: apenas profile
                self.db.table("users").update({"profile": profile}).eq(
                    "username", username
                ).execute()

        try:
            await run_in_threadpool(_update_db)
            await cache_delete(f"profile:{username}")
            return url
        except Exception as e:
            logging.info(f"[UserService] Error uploading avatar: {e}")
            raise HTTPException(500, f"Erro no upload: {e!s}")
