import psycopg2

def inspect():
    with open('.env', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    railway_url = lines[33].strip().split('=', 1)[1].strip('"').strip("'")
    conn = psycopg2.connect(railway_url)
    cur = conn.cursor()

    print("RAILWAY trophies columns:")
    cur.execute("""
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'trophies';
    """)
    for r in cur.fetchall():
        print(" ", r)

    print("\nRAILWAY user_trophies columns:")
    cur.execute("""
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'user_trophies';
    """)
    for r in cur.fetchall():
        print(" ", r)

    print("\nRAILWAY user_trophies constraints:")
    cur.execute("""
        SELECT conname, pg_get_constraintdef(c.oid)
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'user_trophies';
    """)
    for r in cur.fetchall():
        print(" ", r)

    cur.close()
    conn.close()

if __name__ == '__main__':
    inspect()
