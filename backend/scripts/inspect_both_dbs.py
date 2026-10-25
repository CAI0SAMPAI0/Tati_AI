import os
import psycopg2

def inspect():
    with open('.env', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    railway_url = lines[33].strip().split('=', 1)[1].strip('"').strip("'")
    supabase_url = lines[153].strip().split('=', 1)[1].strip('"').strip("'")

    print("=" * 60)
    print("CHECKING RAILWAY (SOURCE)...")
    try:
        r_conn = psycopg2.connect(railway_url, connect_timeout=15)
        r_cur = r_conn.cursor()
        r_cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        r_tables = [r[0] for r in r_cur.fetchall()]
        print(f"Railway connected! Public tables: {len(r_tables)}")
        total_railway_rows = 0
        for t in r_tables:
            r_cur.execute(f'SELECT count(*) FROM public."{t}";')
            cnt = r_cur.fetchone()[0]
            if cnt > 0:
                print(f"  [Railway] {t}: {cnt} rows")
            total_railway_rows += cnt
        print(f"Total rows on Railway: {total_railway_rows}")
        r_conn.close()
    except Exception as e:
        print(f"Error on Railway: {e}")

    print("\n" + "=" * 60)
    print("CHECKING SUPABASE (DESTINATION)...")
    try:
        s_conn = psycopg2.connect(supabase_url, connect_timeout=15)
        s_cur = s_conn.cursor()
        s_cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        s_tables = [s[0] for s in s_cur.fetchall()]
        print(f"Supabase connected! Public tables: {len(s_tables)}")
        total_supabase_rows = 0
        for t in s_tables:
            s_cur.execute(f'SELECT count(*) FROM public."{t}";')
            cnt = s_cur.fetchone()[0]
            if cnt > 0:
                print(f"  [Supabase] {t}: {cnt} rows")
            total_supabase_rows += cnt
        print(f"Total rows on Supabase: {total_supabase_rows}")
        s_conn.close()
    except Exception as e:
        print(f"Error on Supabase: {e}")
    print("=" * 60)

if __name__ == '__main__':
    inspect()
