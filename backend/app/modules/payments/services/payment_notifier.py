import logging

from fastapi import WebSocket


class PaymentConnectionManager:
    def __init__(self):
        # username -> list of websockets
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        if username not in self.active_connections:
            self.active_connections[username] = []
        self.active_connections[username].append(websocket)

    def disconnect(self, websocket: WebSocket, username: str):
        if username in self.active_connections:
            if websocket in self.active_connections[username]:
                self.active_connections[username].remove(websocket)
            if not self.active_connections[username]:
                del self.active_connections[username]

    async def notify_payment_status(
        self, username: str, status: str, payment_id: str, extra_data: dict = None
    ):
        if username in self.active_connections:
            message = {
                "type": "payment_status",
                "status": status,  # "confirmed", "refused", etc.
                "payment_id": payment_id,
                **(extra_data or {}),
            }
            for connection in self.active_connections[username]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logging.info(
                        f"Error sending payment notification to {username}: {e}"
                    )


payment_notifier = PaymentConnectionManager()
