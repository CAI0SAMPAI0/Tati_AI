import os
import sys
import json
import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

def backup_db(db_target="railway"):
    with open('.env', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if db_target == "railway":
        db_url = lines[33].strip().split('=', 1)[1].strip('"').strip("'")
        label = "RAILWAY"
    else:
        db_url = lines[153].strip().split('=', 1)[1].strip('"').strip("'")
        label = "SUPABASE"
    
    backup_dir = os.path.join(os.path.dirname(__file__), '..', 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backup_dir, f'{label.lower()}_backup_{timestamp}.json')
    
    print("=" * 60)
    print(f"STARTING FULL BACKUP OF {label} DATABASE")
    print(f"Destination: {backup_file}")
    print("=" * 60)

    conn = psycopg2.connect(db_url, connect_timeout=20)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    tables = [r['table_name'] for r in cur.fetchall()]
    print(f"Found {len(tables)} tables to backup.")

    data = {
        'timestamp': timestamp,
        'source': f'{label} PostgreSQL',
        'tables': {}
    }

    total_rows = 0
    for t in tables:
        cur.execute(f'SELECT * FROM public."{t}";')
        rows = cur.fetchall()
        def serializer(obj):
            if isinstance(obj, (datetime.date, datetime.datetime)):
                return obj.isoformat()
            if hasattr(obj, '__str__'):
                return str(obj)
            return obj

        serialized_rows = [{k: serializer(v) for k, v in r.items()} for r in rows]
        data['tables'][t] = serialized_rows
        count = len(serialized_rows)
        total_rows += count
        if count > 0:
            print(f"  [BACKUP] {t}: {count} rows")

    print(f"\nWriting backup file to disk ({total_rows} total rows)...")
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    size_mb = os.path.getsize(backup_file) / (1024 * 1024)
    print(f"[SUCCESS] {label} backup saved: {backup_file} ({size_mb:.2f} MB)")
    print("=" * 60)

    cur.close()
    conn.close()

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else "railway"
    backup_db(target)
