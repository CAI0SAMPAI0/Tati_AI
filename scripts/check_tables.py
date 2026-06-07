import os
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.core.database import get_client

def test():
    db = get_client()
    for t in ['modules', 'quizzes', 'quiz_questions']:
        try:
            res = db.table(t).select('*').limit(1).execute()
            print(f"Columns in '{t}':", list(res.data[0].keys()) if res.data else "empty table")
        except Exception as e:
            print(f"Error querying table '{t}':", e)

if __name__ == '__main__':
    test()
