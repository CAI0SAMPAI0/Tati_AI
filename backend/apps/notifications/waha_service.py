import os
import logging
import httpx
from typing import Any, Optional

logger = logging.getLogger(__name__)


class WahaService:
    @staticmethod
    def _get_api_url() -> str:
        return os.getenv("WAHA_API_URL", "http://localhost:3010").rstrip("/")

    @staticmethod
    def _get_headers() -> dict[str, str]:
        headers = {}
        api_key = os.getenv("WAHA_API_KEY")
        if api_key:
            headers["X-Api-Key"] = api_key
        return headers

    @classmethod
    def get_sessions(cls) -> list[dict[str, Any]]:
        url = f"{cls._get_api_url()}/api/sessions"
        try:
            with httpx.Client(timeout=5.0) as client:
                res = client.get(url, headers=cls._get_headers())
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            logger.warning(f"[WAHA] Error listing sessions: {e}")
        return [{"name": "default", "status": "STOPPED"}]

    @classmethod
    def start_session(cls, session_name: str = "default") -> dict[str, Any]:
        url = f"{cls._get_api_url()}/api/sessions/{session_name}/start"
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(url, headers=cls._get_headers())
                if res.status_code in (200, 201):
                    return {"success": True, "data": res.json()}
                # Tenta criar antes se não existir
                create_url = f"{cls._get_api_url()}/api/sessions"
                res_create = client.post(create_url, json={"name": session_name}, headers=cls._get_headers())
                if res_create.status_code in (200, 201, 422):
                    res_start = client.post(url, headers=cls._get_headers())
                    return {"success": True, "data": res_start.json() if res_start.status_code in (200, 201) else {}}
        except Exception as e:
            logger.warning(f"[WAHA] Error starting session: {e}")
        return {"success": True, "session": session_name, "status": "STARTING"}

    @classmethod
    def stop_session(cls, session_name: str = "default") -> dict[str, Any]:
        url = f"{cls._get_api_url()}/api/sessions/{session_name}/stop"
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(url, headers=cls._get_headers())
                return {"success": True, "status": "STOPPED"}
        except Exception as e:
            logger.warning(f"[WAHA] Error stopping session: {e}")
        return {"success": True, "status": "STOPPED"}

    @classmethod
    def get_qr_image(cls, session_name: str = "default") -> Optional[bytes]:
        url = f"{cls._get_api_url()}/api/{session_name}/auth/qr"
        try:
            with httpx.Client(timeout=5.0) as client:
                res = client.get(url, headers=cls._get_headers())
                if res.status_code == 200:
                    return res.content
        except Exception as e:
            logger.warning(f"[WAHA] Error fetching QR: {e}")
        return None
