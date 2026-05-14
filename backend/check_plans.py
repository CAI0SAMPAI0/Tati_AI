
import asyncio
from app.core.database import get_client

async def check_plans():
    db = get_client()
    res = db.table('plans').select('*').execute()
    print("Plans in DB:")
    for plan in res.data:
        print(plan)

if __name__ == "__main__":
    asyncio.run(check_plans())
