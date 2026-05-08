from datetime import datetime, timezone
from services.database import get_client


def _now() -> str:
    """Retorna timestamp atual como string ISO."""
    return datetime.now(timezone.utc).isoformat()


def _make_conv_id(username: str) -> str:
    """Gera id no mesmo padrão do banco: YYYYMMDD_HHMMSS."""
    return datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S') + f'_{username[:6]}'


# ─── Conversations ────────────────────────────────────────────────────────────


async def create_conversation(
    username: str,
    title: str = 'Nova conversa',
    model: str = 'claude',
    is_simulation: bool = False,
    simulation_id: str | None = None,
) -> dict:
    db = get_client()
    new_id = _make_conv_id(username)
    data = {
        'id': new_id,
        'username': username,
        'title': title,
        'model': model,
        'is_simulation': is_simulation,
        'created_at': _now(),
        'updated_at': _now(),
    }
    
    try:
        # Tenta inserir com simulation_id se disponível
        payload = {**data}
        if simulation_id:
            payload['simulation_id'] = simulation_id
        
        result = db.table('conversations').insert(payload).execute()
    except Exception as e:
        err_msg = str(e).lower()
        if 'simulation_id' in err_msg or 'column' in err_msg:
            print(f"[History] Coluna simulation_id falhou ou não existe. Tentando fallback...")
            # Fallback: remove simulation_id e tenta de novo
            result = db.table('conversations').insert(data).execute()
        else:
            print(f"[History] Erro inesperado ao criar conversa: {e}")
            raise e

    conv = result.data[0]

    # Se for simulação, injeta saudação inicial
    if is_simulation and simulation_id:
        try:
            print(f"[History] Injetando saudação para {new_id}")
            sim_data = db.table('simulations').select('greeting, system_prompt').eq('id', simulation_id).limit(1).execute().data
            
            greeting = None
            if sim_data:
                greeting = sim_data[0].get('greeting')
                if not greeting and sim_data[0].get('system_prompt'):
                    from services.llm import groq_chat
                    prompt = [
                        {'role': 'system', 'content': f"You are a character in this scenario: {sim_data[0]['system_prompt']}"},
                        {'role': 'user', 'content': "Generate a very short greeting (max 10 words) to start the conversation. English only."}
                    ]
                    greeting = await groq_chat(prompt, max_tokens=30)

            if greeting:
                from services.llm import text_to_speech
                audio_b64 = await text_to_speech(greeting)
                await save_message(new_id, username, 'assistant', greeting, audio_b64=audio_b64)
                print(f"[History] Saudação injetada com sucesso.")
        except Exception as e:
            print(f"[History] Erro ao injetar saudação: {e}")

    return conv


async def list_conversations(username: str) -> list[dict]:
    db = get_client()
    result = (
        db.table('conversations')
        .select('id, title, model, created_at, updated_at')
        .eq('username', username)
        .eq('is_simulation', False)
        .order('updated_at', desc=True)
        .execute()
    )
    return result.data


async def delete_conversation(conversation_id: str, username: str) -> bool:
    db = get_client()
    # Tenta deletar mensagens primeiro
    try:
        db.table('messages').delete().eq('session_id', conversation_id).execute()
    except Exception:
        pass

    result = (
        db.table('conversations')
        .delete()
        .eq('id', conversation_id)
        .eq('username', username)
        .execute()
    )
    return len(result.data) > 0


async def rename_conversation(
    conversation_id: str, username: str, new_title: str
) -> dict | None:
    db = get_client()
    result = (
        db.table('conversations')
        .update({'title': new_title, 'updated_at': _now()})
        .eq('id', conversation_id)
        .eq('username', username)
        .execute()
    )
    return result.data[0] if result.data else None


# ─── Messages ─────────────────────────────────────────────────────────────────


async def load_history(conversation_id: str) -> list[dict]:
    """Carrega mensagens no formato esperado pela LLM: role + content."""
    try:
        db = get_client()
        # O nome da coluna link no seu banco é session_id (tipo text)
        result = (
            db.table('messages')
            .select('role, content, audio_b64, created_at')
            .eq('session_id', conversation_id)
            .order('created_at', desc=True)
            .limit(100) # Reduce history limit to prevent TPM errors and prevent message loss
            .execute()
        )
        
        messages = result.data or []
        # messages.reverse() # chronological order
        
        history = []
        for msg in messages:
            content = msg.get('content') or ''
            if len(content) > 2000:
                content = content[:2000] + '\n\n[Texto truncado devido ao limite de tamanho]'
            history.append({'role': msg.get('role', 'user'), 'content': content})
            
        return history
    except Exception as e:
        print(f'ERROR [load_history]: {e}')
        return []


async def save_message(
    conversation_id: str, username: str, role: str, content: str, audio_b64: str = None
) -> dict:
    if not conversation_id:
        print(f'WARNING [save_message]: Skipping save as conversation_id is null for user {username}')
        return {}
        
    try:
        db = get_client()
        now = datetime.now(timezone.utc)
        content = content.replace('\x00', '').replace('\u0000', '')
        msg = {
            'session_id': conversation_id,
            'username': username,
            'role': role,
            'content': content,
            'date': now.strftime('%Y-%m-%d'),
        }

        # Salva áudio se fornecido
        if audio_b64:
            msg['audio_b64'] = audio_b64

        result = db.table('messages').insert(msg).execute()

        # Atualiza updated_at da conversa
        db.table('conversations').update({'updated_at': _now()}).eq(
            'id', conversation_id
        ).execute()

        return result.data[0] if result.data else {}
    except Exception as e:
        print(f'ERROR [save_message]: {e}')
        # Se falhar por FK com 'sessions', avisamos o log
        if 'sessions' in str(e).lower():
            print(
                "CRITICAL: A tabela 'messages' tem uma FK para 'sessions' mas estamos tentando linkar com 'conversations'."
            )
        raise e


async def auto_title(conversation_id: str, username: str, first_message: str) -> None:
    title = first_message.strip()[:60]
    if len(first_message.strip()) > 60:
        title += '…'
    await rename_conversation(conversation_id, username, title)
