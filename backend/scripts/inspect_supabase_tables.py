import psycopg2

supa_url = "postgresql://postgres.gkziqqjswecteekanwnv:supermamaco089@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"

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
