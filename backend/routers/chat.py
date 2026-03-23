from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
import os
import json

router = APIRouter()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"

def verify_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

@router.websocket("/ws")
async def chat_ws(
    websocket: WebSocket,
    token: str = Query(...),
):
    payload = verify_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Token inválido")
        return

    await websocket.accept()
    username = payload["sub"]
    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            # Aqui você pode processar a mensagem recebida e enviar respostas
            tipo = msg.get("type")
            conteudo = msg.get("content")

            if tipo == "ping":
                await websocket.send_json({"type": "pong"})

            elif tipo == "text":
                await websocket.send_json({
                    "type": "text",
                    "content": f"Recebi: {conteudo}"
                })

    except WebSocketDisconnect:
        print(f"[WS] {username} desconectou")