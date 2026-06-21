import os
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.core.database import get_client

def test():
    db = get_client()
    try:
        res = db.table('users').select('username, email, profile').eq('username', 'caio.sampaio').execute()
        print("User caio.sampaio:", res.data)
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    test()
