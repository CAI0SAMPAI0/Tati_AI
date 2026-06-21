import os
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.core.database import get_client

def test():
    db = get_client()
    try:
        res = db.table('users').select('username, email, profile').limit(5).execute()
        print("Users in database:", res.data)
    except Exception as e:
        print("Error querying table users:", e)

if __name__ == '__main__':
    test()
