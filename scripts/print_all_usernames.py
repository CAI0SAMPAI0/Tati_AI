import os
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.app.core.database import get_client

def test():
    db = get_client()
    try:
        res = db.table('users').select('username').execute()
        print("All usernames:", [u['username'] for u in res.data])
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    test()
