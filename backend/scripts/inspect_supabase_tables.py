import os
import sys
import psycopg2

supa_url = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")
if not supa_url:
    print("ERRO: Configure a variável de ambiente SUPABASE_DB_URL ou DATABASE_URL.")
    sys.exit(1)

print("Connecting to Supabase...")
conn = psycopg2.connect(supa_url, connect_timeout=15)
cur = conn.cursor()

cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
""")
tables = [row[0] for row in cur.fetchall()]
print(f"Connected successfully! Total public tables: {len(tables)}\n")

for t in tables:
    try:
        cur.execute(f'SELECT count(*) FROM "{t}";')
        cnt = cur.fetchone()[0]
        print(f"  - {t}: {cnt} rows")
    except Exception as e:
        print(f"  - {t}: error: {e}")
        conn.rollback()

cur.close()
conn.close()
