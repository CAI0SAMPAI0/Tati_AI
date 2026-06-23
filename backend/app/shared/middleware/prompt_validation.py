import re
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

# Simple list of known jailbreak patterns (can be extended)
JAILBREAK_PATTERNS = [
    r"ignore previous instructions",
    r"act as",
    r"you are a (\w+ )?assistant",
    r"pretend you are",
    r"disregard all safety",
    r"bypass.*filter",
]

compiled_patterns = [re.compile(p, re.IGNORECASE) for p in JAILBREAK_PATTERNS]

class PromptValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                body = await request.json()
            except Exception:
                body = {}
            # Assume user prompt is under a field named 'prompt' or 'message'
            prompt = body.get("prompt") or body.get("message") or ""
            if isinstance(prompt, str):
                for pattern in compiled_patterns:
                    if pattern.search(prompt):
                        raise HTTPException(status_code=400, detail="Prompt contains prohibited content.")
        response = await call_next(request)
        return response
