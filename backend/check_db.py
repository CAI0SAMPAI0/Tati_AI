
import asyncio
from app.core.database import get_client

async def check():
    db = get_client()
    res = db.table('users').select('count', count='exact').execute()
    print(f"Total users in DB: {res.count}")
    
    res = db.table('simulations').select('count', count='exact').execute()
    print(f"Total simulations in DB: {res.count}")

if __name__ == "__main__":
    asyncio.run(check())
