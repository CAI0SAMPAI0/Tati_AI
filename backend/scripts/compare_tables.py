import psycopg2

def compare():
    with open('.env', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    railway_url = lines[33].strip().split('=', 1)[1].strip('"').strip("'")
    supabase_url = lines[153].strip().split('=', 1)[1].strip('"').strip("'")

    r_conn = psycopg2.connect(railway_url)
    s_conn = psycopg2.connect(supabase_url)
    r_cur = r_conn.cursor()
    s_cur = s_conn.cursor()

    r_cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    tables = [r[0] for r in r_cur.fetchall()]

    print(f"{'TABLE':<35} | {'RAILWAY':<8} | {'SUPABASE':<8} | {'STATUS'}")
    print("-" * 65)

    total_r = 0
    total_s = 0
    mismatches = []

    for t in tables:
        r_cur.execute(f'SELECT count(*) FROM public."{t}";')
        cnt_r = r_cur.fetchone()[0]
        total_r += cnt_r

        try:
            s_cur.execute(f'SELECT count(*) FROM public."{t}";')
            cnt_s = s_cur.fetchone()[0]
            total_s += cnt_s
        except Exception as e:
            cnt_s = f"ERR: {e}"
            s_conn.rollback()

        status = "OK" if cnt_r == cnt_s else f"DIFF ({cnt_r - (cnt_s if isinstance(cnt_s, int) else 0)})"
        if status != "OK":
            mismatches.append((t, cnt_r, cnt_s))
            print(f"{t:<35} | {cnt_r:<8} | {str(cnt_s):<8} | {status} <---")
        else:
            if cnt_r > 0:
                print(f"{t:<35} | {cnt_r:<8} | {cnt_s:<8} | {status}")

    print("-" * 65)
    print(f"{'TOTAL':<35} | {total_r:<8} | {total_s:<8} | {'ALL OK' if not mismatches else f'{len(mismatches)} MISMATCHES'}")

    r_conn.close()
    s_conn.close()

if __name__ == '__main__':
    compare()
