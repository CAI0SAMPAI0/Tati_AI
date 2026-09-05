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
        api_url = cls._get_api_url()
        headers = cls._get_headers()
        try:
            with httpx.Client(timeout=10.0) as client:
                # 1. Verifica status atual da sessão no WAHA
                status_res = client.get(f"{api_url}/api/sessions/{session_name}", headers=headers)
                current_status = None
                if status_res.status_code == 200:
                    current_status = status_res.json().get("status")

                if current_status in ("WORKING", "CONNECTED"):
                    return {"success": True, "session": session_name, "status": current_status}

                # Se a sessão estava em FAILED, WAHA exige /restart para reiniciar o pareamento
                if current_status == "FAILED":
                    logger.info(f"[WAHA] Sessão {session_name} está em FAILED. Chamando /restart...")
                    res_restart = client.post(f"{api_url}/api/sessions/{session_name}/restart", headers=headers)
                    if res_restart.status_code in (200, 201):
                        return {"success": True, "session": session_name, "status": "STARTING", "data": res_restart.json()}

                # Tenta start normal
                url = f"{api_url}/api/sessions/{session_name}/start"
                res = client.post(url, headers=headers)
                if res.status_code in (200, 201):
                    res_json = res.json()
                    if res_json.get("status") == "FAILED":
                        res_restart = client.post(f"{api_url}/api/sessions/{session_name}/restart", headers=headers)
                        if res_restart.status_code in (200, 201):
                            return {"success": True, "session": session_name, "status": "STARTING", "data": res_restart.json()}
                    return {"success": True, "session": session_name, "status": res_json.get("status", "STARTING"), "data": res_json}

                # Tenta criar antes se não existir (404 / 422)
                create_url = f"{api_url}/api/sessions"
                res_create = client.post(
                    create_url, json={"name": session_name}, headers=headers
                )
                if res_create.status_code in (200, 201, 422):
                    res_start = client.post(url, headers=headers)
                    return {
                        "success": True,
                        "session": session_name,
                        "status": "STARTING",
                        "data": res_start.json()
                        if res_start.status_code in (200, 201)
                        else {},
                    }
        except Exception as e:
            logger.warning(f"[WAHA] Error starting session {session_name}: {e}")
        return {"success": True, "session": session_name, "status": "STARTING"}

    @classmethod
    def restart_session(cls, session_name: str = "default") -> dict[str, Any]:
        api_url = cls._get_api_url()
        headers = cls._get_headers()
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(f"{api_url}/api/sessions/{session_name}/restart", headers=headers)
                if res.status_code in (200, 201):
                    return {"success": True, "session": session_name, "status": "STARTING", "data": res.json()}
                # Fallback: stop -> start
                client.post(f"{api_url}/api/sessions/{session_name}/stop", headers=headers)
                res_start = client.post(f"{api_url}/api/sessions/{session_name}/start", headers=headers)
                return {
                    "success": True,
                    "session": session_name,
                    "status": "STARTING",
                    "data": res_start.json() if res_start.status_code in (200, 201) else {},
                }
        except Exception as e:
            logger.warning(f"[WAHA] Error restarting session {session_name}: {e}")
        return {"success": False, "error": str(e)}

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
            with httpx.Client(timeout=12.0) as client:
                res = client.get(url, headers=cls._get_headers())
                if res.status_code == 200 and res.content and len(res.content) > 100:
                    return res.content
                elif res.status_code == 422:
                    logger.debug(f"[WAHA] QR endpoint returned 422 for {session_name}: session not in SCAN_QR_CODE")
        except Exception as e:
            logger.warning(f"[WAHA] Error fetching QR for {session_name}: {e}")
        return None

    @classmethod
    def ping_keepalive(cls) -> bool:
        """
        Envia um ping ao WAHA (Render) para impedir que o serviço gratuito
        da Render entre em modo sleep/hibernação.
        """
        api_url = cls._get_api_url()
        if not api_url or "localhost" in api_url:
            return False
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(f"{api_url}/api/sessions", headers=cls._get_headers())
                logger.info(f"[WAHA KeepAlive] Render WAHA ping response: {res.status_code}")
                return res.status_code == 200
        except Exception as e:
            logger.debug(f"[WAHA KeepAlive] Falha no ping de keepalive: {e}")
            return False

    @classmethod
    def get_active_session_name(cls, preferred: str = "default") -> str:
        """
        Retorna o nome da sessão em estado WORKING no WAHA.
        """
        sessions = cls.get_sessions()
        working = [s.get("name") for s in sessions if s.get("status") in ("WORKING", "CONNECTED")]
        if preferred in working:
            return preferred
        if working:
            return working[0]
        return preferred
