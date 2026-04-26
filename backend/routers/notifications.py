from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from routers.deps import get_current_user
from services.database import get_client
from services.push_notifications import (
    disable_push_subscription,
    get_public_vapid_key,
    save_push_subscription,
)

router = APIRouter()


class PushSubscriptionBody(BaseModel):
    endpoint: str
    keys: dict


@router.get("/")
async def get_notifications(user: dict = Depends(get_current_user)):
    try:
        username = user["username"]
        rows = (
            get_client()
            .table("notifications")
            .select("*")
            .eq("username", username)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
            .data
        )
        unread = sum(1 for r in rows if not r.get("read", False))
        return {"notifications": rows, "unread": unread}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def notifications_config(user: dict = Depends(get_current_user)):
    return {
        "vapid_public_key": get_public_vapid_key(),
    }


@router.post("/subscribe")
async def subscribe_push(
    body: PushSubscriptionBody,
    request: Request,
    user: dict = Depends(get_current_user),
):
    endpoint = str(body.endpoint or "").strip()
    keys = body.keys if isinstance(body.keys, dict) else {}
    p256dh = str(keys.get("p256dh") or "").strip()
    auth = str(keys.get("auth") or "").strip()
    if not endpoint or not p256dh or not auth:
        raise HTTPException(status_code=400, detail="invalid_subscription")

    ok = save_push_subscription(
        username=user["username"],
        endpoint=endpoint,
        p256dh=p256dh,
        auth=auth,
        user_agent=request.headers.get("user-agent", ""),
    )
    if not ok:
        raise HTTPException(status_code=500, detail="subscription_failed")
    return {"ok": True}


@router.post("/unsubscribe")
async def unsubscribe_push(body: PushSubscriptionBody, user: dict = Depends(get_current_user)):
    endpoint = str(body.endpoint or "").strip()
    if not endpoint:
        raise HTTPException(status_code=400, detail="invalid_subscription")
    disable_push_subscription(username=user["username"], endpoint=endpoint)
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    try:
        get_client().table("notifications").update({"read": True})\
            .eq("username", user["username"]).eq("read", False).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(get_current_user)):
    try:
        get_client().table("notifications").update({"read": True})\
            .eq("id", notif_id).eq("username", user["username"]).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
