import os
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.app.core.database import get_client

def test():
    db = get_client()
    try:
        res = db.table('users').select('username, email, profile').eq('email', 'cmsampaio71@gmail.com').execute()
        print("User with email cmsampaio71@gmail.com:", res.data)
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    test()
