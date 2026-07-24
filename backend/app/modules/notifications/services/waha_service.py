import asyncio
import logging
from typing import Any

import httpx
from app.core.config import settings


class WahaService:
    @staticmethod
    def _get_headers() -> dict[str, str]:
        headers = {}
        if settings.waha_api_key:
            headers["X-Api-Key"] = settings.waha_api_key
        return headers

    @staticmethod
    async def ensure_awake(retries: int = 8, delay: float = 4.0) -> bool:
        """Wakes up WAHA if sleeping (Railway cold start) and waits until it is ready.
        Returns True if WAHA responds, False if all retries are exhausted."""
        url = f"{settings.waha_api_url}/api/server/status"
        headers = WahaService._get_headers()
        for attempt in range(retries):
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.get(url, headers=headers)
                    if res.status_code in (200, 401):
                        logging.info(f"[WAHA] Awake after {attempt + 1} attempt(s).")
                        return True
            except Exception:
                pass
            logging.info(
                f"[WAHA] Waiting for cold start... attempt {attempt + 1}/{retries}"
            )
            await asyncio.sleep(delay)
        logging.warning("[WAHA] Service did not respond after all retries.")
        return False

    @staticmethod
    async def start_session(session_name: str) -> dict[str, Any]:
        """Creates and starts a WAHA session for the given user."""
        url = f"{settings.waha_api_url}/api/sessions"
        payload = {"name": session_name}
        headers = WahaService._get_headers()

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code in (200, 201):
                    # If successfully created, now start it
                    start_url = (
                        f"{settings.waha_api_url}/api/sessions/{session_name}/start"
                    )
                    start_res = await client.post(start_url, headers=headers)
                    if start_res.status_code in (200, 201):
                        return {"success": True, "data": start_res.json()}
                    return {
                        "success": False,
                        "error": start_res.text,
                        "status_code": start_res.status_code,
                    }

                # If session already exists (status 422), try starting directly
                if res.status_code == 422:
                    start_url = (
                        f"{settings.waha_api_url}/api/sessions/{session_name}/start"
                    )
                    start_res = await client.post(start_url, headers=headers)
                    if start_res.status_code in (200, 201):
                        return {"success": True, "data": start_res.json()}
                    return {
                        "success": False,
                        "error": start_res.text,
                        "status_code": start_res.status_code,
                    }

                return {
                    "success": False,
                    "error": res.text,
                    "status_code": res.status_code,
                }
        except Exception as e:
            logging.error(f"[WAHA] Error starting session {session_name}: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    async def stop_session(session_name: str) -> dict[str, Any]:
        """Para/deleta uma sessão no WAHA, deslogando para limpar as credenciais do banco."""
        logout_url = f"{settings.waha_api_url}/api/sessions/{session_name}/logout"
        url = f"{settings.waha_api_url}/api/sessions/{session_name}"
        headers = WahaService._get_headers()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # 1. Tenta deslogar para limpar chaves no PostgreSQL
                try:
                    await client.post(logout_url, headers=headers)
                    logging.info(
                        f"[WAHA] Logout successful for session {session_name}."
                    )
                except Exception as logout_err:
                    logging.warning(
                        f"[WAHA] Logout request failed (continuing to delete): {logout_err}"
                    )

                # 2. Deleta a sessão da memória do WAHA
                res = await client.delete(url, headers=headers)
                if res.status_code in (200, 204, 404):
                    return {"success": True}
                return {
                    "success": False,
                    "error": res.text,
                    "status_code": res.status_code,
                }
        except Exception as e:
            logging.error(f"[WAHA] Error stopping session {session_name}: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    async def get_sessions() -> list[dict[str, Any]]:
        """Lista todas as sessões e seus status."""
        url = f"{settings.waha_api_url}/api/sessions"
        headers = WahaService._get_headers()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    return res.json()
                logging.error(
                    f"[WAHA] Failed to get sessions, status={res.status_code}: {res.text}"
                )
                return []
        except Exception as e:
            logging.error(f"[WAHA] Error listing sessions: {e}")
            return []

    @staticmethod
    async def get_session(session_name: str) -> dict[str, Any] | None:
        """Busca os detalhes de uma sessão específica."""
        sessions = await WahaService.get_sessions()
        for sess in sessions:
            if sess.get("name") == session_name:
                return sess
        return None

    @staticmethod
    async def get_qr_code_image(session_name: str) -> bytes | None:
        """Busca o QR code da sessão como bytes (imagem PNG/JPEG)."""
        url = f"{settings.waha_api_url}/api/{session_name}/auth/qr?format=image"
        headers = WahaService._get_headers()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    return res.content
                logging.warning(
                    f"[WAHA] QR code image request returned status {res.status_code}"
                )
                return None
        except Exception as e:
            logging.error(f"[WAHA] Error fetching QR code for {session_name}: {e}")
            return None

    @staticmethod
    async def get_screenshot_image(session_name: str) -> bytes | None:
        """Busca um print screen da tela do WhatsApp Web."""
        url1 = f"{settings.waha_api_url}/api/screenshot?session={session_name}"
        url2 = f"{settings.waha_api_url}/api/{session_name}/screenshot"
        headers = WahaService._get_headers()
        for url in (url1, url2):
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.get(url, headers=headers)
                    if res.status_code == 200:
                        return res.content
            except Exception as e:
                logging.warning(f"[WAHA] Screenshot request failed for {url}: {e}")
        return None

    @staticmethod
    def normalize_whatsapp_number(number: str) -> str:
        """Remove caracteres não-numéricos e garante código de país (padrão Brasil 55)."""
        if not number:
            return ""
        digits = "".join(c for c in number if c.isdigit())
        if not digits:
            return ""
        # Se for um número brasileiro sem DDI
        if len(digits) in (10, 11) and not digits.startswith("55"):
            digits = "55" + digits
        return digits

    @staticmethod
    def can_send_to_student(
        sender_username: str, sender_role: str, recipient_username: str
    ) -> bool:
        """
        Aplica regras de restrição de envio:
        - O admin 'programador' (e user caio.sampaio) só pode enviar para o usuário 'caio.sampaio'.
        - Professores/admins em geral podem enviar para qualquer aluno.
        """
        s_user = sender_username.lower().strip()
        s_role = str(sender_role).lower().strip()
        r_user = recipient_username.lower().strip()

        if s_user in ("programador", "caio.sampaio") or s_role == "programador":
            return r_user == "caio.sampaio"
        return True

    @staticmethod
    def _is_tatiana_session(session_name: str) -> bool:
        """Retorna True se o nome da sessão corresponder a Tatiana."""
        name = session_name.lower().strip()
        return name in (
            "tatiana",
            "tatiana.duarte",
            "tati",
            "teacher_tati",
            "professor",
            "professora",
        )

    @staticmethod
    async def send_message(
        recipient_username: str,
        text: str,
        sender_username: str | None = None,
        db=None,
    ) -> dict[str, Any]:
        """
        Envia mensagem de texto via WhatsApp.
        Descobre automaticamente uma sessão conectada se o sender_username não for passado
        ou se a sessão dele não estiver WORKING.
        """
        if not db:
            from app.core.database import get_client

            db = get_client()

        # 1. Obter informações do destinatário
        try:
            rows = (
                db.table("users")
                .select("username, role, profile")
                .eq("username", recipient_username)
                .execute()
                .data
            )
        except Exception as e:
            logging.error(f"[WAHA] Error fetching recipient {recipient_username}: {e}")
            return {"success": False, "error": f"Recipient not found: {e}"}

        if not rows:
            return {"success": False, "error": "Recipient not found in database"}

        recipient = rows[0]
        profile = recipient.get("profile") or {}

        # Verificar se permitiu notificações
        allow_notif = profile.get("allow_whatsapp_notifications")
        whatsapp_number = profile.get("whatsapp_number")

        if not allow_notif or not whatsapp_number:
            return {
                "success": False,
                "error": "User does not have WhatsApp notifications enabled or number is missing",
            }

        normalized_number = WahaService.normalize_whatsapp_number(whatsapp_number)
        if not normalized_number:
            return {"success": False, "error": "Invalid WhatsApp number"}

        # 2. Verificar restrições de envio se houver sender definido
        if sender_username:
            # Buscar role do sender
            try:
                sender_rows = (
                    db.table("users")
                    .select("role")
                    .eq("username", sender_username)
                    .execute()
                    .data
                )
                sender_role = sender_rows[0].get("role", "") if sender_rows else ""
            except Exception:
                sender_role = ""

            if not WahaService.can_send_to_student(
                sender_username, sender_role, recipient_username
            ):
                return {
                    "success": False,
                    "error": f"Sender '{sender_username}' is restricted from sending WhatsApp messages to '{recipient_username}'",
                }

        # 3. Determinar qual sessão usar
        sessions = await WahaService.get_sessions()
        working_sessions = [s for s in sessions if s.get("status") == "WORKING"]

        if not working_sessions:
            return {
                "success": False,
                "error": "No active/connected WhatsApp sessions found in WAHA",
            }

        # Se houver um sender_username, tentar achar a sessão dele
        selected_session = None
        if sender_username:
            for s in working_sessions:
                if s.get("name") == sender_username:
                    selected_session = s
                    break

        # Se não achou ou não foi especificado, pega a primeira disponível
        if not selected_session:
            # Preferência para 'programador' ou 'caio.sampaio' em dev se o recipient for caio.sampaio
            if recipient_username.lower().strip() == "caio.sampaio":
                for s in working_sessions:
                    if s.get("name") in ("programador", "caio.sampaio"):
                        selected_session = s
                        break
            if not selected_session:
                # Caso contrário, prefere a sessão da Tatiana
                for s in working_sessions:
                    if WahaService._is_tatiana_session(s.get("name")):
                        selected_session = s
                        break
            if not selected_session:
                # Fallback: pega a primeira sessão WORKING
                selected_session = working_sessions[0]

        session_name = selected_session.get("name")

        # 4. Enviar a mensagem
        url = f"{settings.waha_api_url}/api/sendText"
        payload = {
            "session": session_name,
            "chatId": f"{normalized_number}@c.us",
            "text": text,
        }
        headers = WahaService._get_headers()

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code in (200, 201):
                    logging.info(
                        f"[WAHA] Message sent successfully to {recipient_username} using session {session_name}"
                    )
                    return {"success": True, "data": res.json()}
                logging.error(
                    f"[WAHA] Failed to send message, status={res.status_code}: {res.text}"
                )
                return {
                    "success": False,
                    "error": res.text,
                    "status_code": res.status_code,
                }
        except Exception as e:
            logging.error(f"[WAHA] Error sending WhatsApp message: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    async def send_file(
        recipient_username: str,
        file_url: str,
        filename: str,
        caption: str | None = None,
        sender_username: str | None = None,
        db=None,
    ) -> dict[str, Any]:
        """
        Envia um arquivo (PDF, imagem, etc.) hospedado em uma URL via WhatsApp usando a API /api/sendFile do WAHA.
        """
        if not db:
            from app.core.database import get_client

            db = get_client()

        # 1. Obter informações do destinatário e normalizar número
        try:
            rows = (
                db.table("users")
                .select("username, role, profile")
                .eq("username", recipient_username)
                .execute()
                .data
            )
        except Exception as e:
            logging.error(
                f"[WAHA] Error fetching recipient {recipient_username} for file: {e}"
            )
            return {"success": False, "error": f"Recipient not found: {e}"}

        if not rows:
            return {"success": False, "error": "Recipient not found in database"}

        recipient = rows[0]
        profile = recipient.get("profile") or {}
        allow_notif = profile.get("allow_whatsapp_notifications")
        whatsapp_number = profile.get("whatsapp_number")

        if not allow_notif or not whatsapp_number:
            return {
                "success": False,
                "error": "WhatsApp notifications disabled or number missing",
            }

        normalized_number = WahaService.normalize_whatsapp_number(whatsapp_number)
        if not normalized_number:
            return {"success": False, "error": "Invalid WhatsApp number"}

        # 2. Determinar qual sessão usar
        sessions = await WahaService.get_sessions()
        working_sessions = [s for s in sessions if s.get("status") == "WORKING"]

        if not working_sessions:
            return {"success": False, "error": "No active WhatsApp sessions found"}

        selected_session = None
        if sender_username:
            for s in working_sessions:
                if s.get("name") == sender_username:
                    selected_session = s
                    break

        if not selected_session:
            if recipient_username.lower().strip() == "caio.sampaio":
                for s in working_sessions:
                    if s.get("name") in ("programador", "caio.sampaio"):
                        selected_session = s
                        break
            if not selected_session:
                for s in working_sessions:
                    if WahaService._is_tatiana_session(s.get("name")):
                        selected_session = s
                        break
            if not selected_session:
                selected_session = working_sessions[0]

        session_name = selected_session.get("name")

        # 3. Enviar o arquivo
        url = f"{settings.waha_api_url}/api/sendFile"

        mimetype = "application/octet-stream"
        fname_lower = filename.lower()
        if fname_lower.endswith(".pdf"):
            mimetype = "application/pdf"
        elif fname_lower.endswith(".epub"):
            mimetype = "application/epub+zip"
        elif fname_lower.endswith((".png", ".jpg", ".jpeg")):
            mimetype = "image/png"

        payload = {
            "session": session_name,
            "chatId": f"{normalized_number}@c.us",
            "file": {"url": file_url, "filename": filename, "mimetype": mimetype},
        }
        if caption:
            payload["caption"] = caption

        headers = WahaService._get_headers()

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code in (200, 201):
                    logging.info(
                        f"[WAHA] File sent successfully to {recipient_username} using session {session_name}"
                    )
                    return {"success": True, "data": res.json()}
                logging.error(
                    f"[WAHA] Failed to send file, status={res.status_code}: {res.text}"
                )
                return {
                    "success": False,
                    "error": res.text,
                    "status_code": res.status_code,
                }
        except Exception as e:
            logging.error(f"[WAHA] Error sending WhatsApp file: {e}")
            return {"success": False, "error": str(e)}
