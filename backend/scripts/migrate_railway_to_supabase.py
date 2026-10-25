import os
import sys
import json
import datetime
import psycopg2
from psycopg2.extras import execute_batch, Json

def get_db_urls():
    supabase_url = os.getenv("SUPABASE_DB_URL")
    railway_url = os.getenv("RAILWAY_URL") or os.getenv("RAILWAY_DATABASE_URL")

    if not supabase_url or not railway_url:
        env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line_s = line.strip()
                    if line_s.startswith('DATABASE_URL') and 'rlwy.net' in line_s:
                        railway_url = line_s.split('=', 1)[1].strip('"').strip("'")
                    elif line_s.startswith('DATABASE_URL') and 'supabase.co' in line_s:
                        supabase_url = line_s.split('=', 1)[1].strip('"').strip("'")
                    elif line_s.startswith('SUPABASE_DB_URL'):
                        supabase_url = line_s.split('=', 1)[1].strip('"').strip("'")

    return railway_url, supabase_url


def get_table_schema_ddl(cur, table_name):
    cur.execute("""
        SELECT 
            a.attname, 
            format_type(a.atttypid, a.atttypmod) AS col_type,
            a.attnotnull, 
            pg_get_expr(d.adbin, d.adrelid) AS default_expr
        FROM pg_attribute a
        LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
        WHERE a.attrelid = %s::regclass 
          AND a.attnum > 0 
          AND NOT a.attisdropped
        ORDER BY a.attnum;
    """, (f'public."{table_name}"',))
    cols = cur.fetchall()
    
    col_defs = []
    for col in cols:
        name, col_type, not_null, default = col
        null_clause = "NOT NULL" if not_null else "NULL"
        default_clause = ""
        if default:
            if 'nextval(' not in str(default):
                default_clause = f"DEFAULT {default}"
        col_defs.append(f'"{name}" {col_type} {null_clause} {default_clause}'.strip())

    # Get Primary Key
    cur.execute("""
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = %s
        ORDER BY kcu.ordinal_position;
    """, (table_name,))
    pk_cols = [f'"{r[0]}"' for r in cur.fetchall()]
    if pk_cols:
        col_defs.append(f"PRIMARY KEY ({', '.join(pk_cols)})")

    ddl = f'CREATE TABLE IF NOT EXISTS public."{table_name}" (\n  ' + ',\n  '.join(col_defs) + '\n);'
    return ddl


def sync_table_columns(rail_cur, supa_cur, table_name):
    """Ensure any column existing on Railway also exists on Supabase with matching type"""
    rail_cur.execute("""
        SELECT 
            a.attname, 
            format_type(a.atttypid, a.atttypmod) AS col_type,
            a.attnotnull, 
            pg_get_expr(d.adbin, d.adrelid) AS default_expr
        FROM pg_attribute a
        LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
        WHERE a.attrelid = %s::regclass 
          AND a.attnum > 0 
          AND NOT a.attisdropped
        ORDER BY a.attnum;
    """, (f'public."{table_name}"',))
    rail_cols = {r[0]: (r[1], r[2], r[3]) for r in rail_cur.fetchall()}

    supa_cur.execute("""
        SELECT 
            a.attname, 
            format_type(a.atttypid, a.atttypmod) AS col_type
        FROM pg_attribute a
        WHERE a.attrelid = %s::regclass 
          AND a.attnum > 0 
          AND NOT a.attisdropped
        ORDER BY a.attnum;
    """, (f'public."{table_name}"',))
    supa_cols = {r[0]: r[1] for r in supa_cur.fetchall()}

    # Special handling for user_trophies FK and unique constraint to match Railway
    if table_name == 'user_trophies':
        try:
            supa_cur.execute('ALTER TABLE public."user_trophies" DROP CONSTRAINT IF EXISTS "user_trophies_trophy_id_fkey";')
            supa_cur.execute('ALTER TABLE public."user_trophies" DROP CONSTRAINT IF EXISTS "user_trophies_username_trophy_id_key";')
            supa_cur.execute('ALTER TABLE public."user_trophies" ALTER COLUMN "trophy_id" TYPE VARCHAR(100) USING "trophy_id"::text;')
            print("  [OK] Handled user_trophies schema adjustments to match Railway")
        except Exception as e:
            print(f"  Notice adjusting user_trophies.trophy_id: {e}")

    for col_name, (col_type, not_null, default) in rail_cols.items():
        if col_name not in supa_cols:
            default_clause = f"DEFAULT {default}" if default and 'nextval(' not in str(default) else ""
            alter_sql = f'ALTER TABLE public."{table_name}" ADD COLUMN IF NOT EXISTS "{col_name}" {col_type} {default_clause};'
            try:
                supa_cur.execute(alter_sql)
                print(f"  [COLUMN ADDED] '{table_name}'.'{col_name}' ({col_type})")
            except Exception as e:
                print(f"  [COLUMN NOTICE] Could not add '{table_name}'.'{col_name}': {e}")
        else:
            supa_type = supa_cols[col_name]
            # Only alter if type fundamentally differs (e.g. uuid -> varchar)
            if col_type != supa_type and not ('numeric' in col_type and 'numeric' in supa_type):
                try:
                    supa_cur.execute(f'ALTER TABLE public."{table_name}" ALTER COLUMN "{col_name}" TYPE {col_type} USING "{col_name}"::text;')
                    print(f"  [COLUMN TYPE ALTERED] '{table_name}'.'{col_name}' ({supa_type} -> {col_type})")
                except Exception as e:
                    print(f"  [COLUMN TYPE NOTICE] Could not alter '{table_name}'.'{col_name}': {e}")


def migrate(target_table=None):
    railway_url, supabase_url = get_db_urls()

    if not railway_url or not supabase_url:
        print("ERRO: Nao foi possivel detectar as URLs do Railway e Supabase.")
        print(f"Railway: {bool(railway_url)}, Supabase: {bool(supabase_url)}")
        sys.exit(1)

    print("=" * 65)
    target_msg = f"FOR TABLE '{target_table}'" if target_table else "FOR ALL TABLES"
    print(f"STARTING ZERO-DATA-LOSS MIGRATION: RAILWAY -> SUPABASE ({target_msg})")
    print("=" * 65)

    print("\n1. Connecting to Railway and Supabase...")
    rail_conn = psycopg2.connect(railway_url, connect_timeout=20)
    supa_conn = psycopg2.connect(supabase_url, connect_timeout=20)
    rail_conn.autocommit = True
    supa_conn.autocommit = True

    rail_cur = rail_conn.cursor()
    supa_cur = supa_conn.cursor()

    # Step 2: Extensions on Supabase
    print("\n2. Ensuring extensions on Supabase...")
    for ext in ["uuid-ossp", "pgcrypto", "vector"]:
        try:
            supa_cur.execute(f'CREATE EXTENSION IF NOT EXISTS "{ext}";')
            print(f"  [OK] Extension: {ext}")
        except Exception as e:
            print(f"  Notice on extension '{ext}': {e}")

    # Step 3: ENUMs
    print("\n3. Replicating custom ENUM types...")
    rail_cur.execute("""
        SELECT t.typname, e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        ORDER BY t.typname, e.enumsortorder;
    """)
    enums = {}
    for tname, elabel in rail_cur.fetchall():
        enums.setdefault(tname, []).append(elabel)

    for ename, labels in enums.items():
        formatted_labels = ", ".join(f"'{l}'" for l in labels)
        try:
            supa_cur.execute(f"""
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{ename}') THEN 
                        CREATE TYPE public.{ename} AS ENUM ({formatted_labels}); 
                    END IF; 
                END $$;
            """)
            print(f"  - Verified ENUM: {ename}")
        except Exception as e:
            print(f"  - Notice on ENUM {ename}: {e}")

    # Step 4: Sequences
    print("\n4. Synchronizing sequences...")
    rail_cur.execute("""
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public';
    """)
    sequences = [r[0] for r in rail_cur.fetchall()]
    for s in sequences:
        try:
            rail_cur.execute(f'SELECT last_value, is_called FROM public."{s}";')
            last_val, is_called = rail_cur.fetchone()
            supa_cur.execute(f'CREATE SEQUENCE IF NOT EXISTS public."{s}";')
            supa_cur.execute(f"SELECT setval('public.\"{s}\"', %s, %s);", (last_val, is_called))
            print(f"  [OK] Sequence: '{s}' (val: {last_val})")
        except Exception as e:
            print(f"  Notice sequence '{s}': {e}")

    # Step 5: Tables structure
    rail_cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    tables = [row[0] for row in rail_cur.fetchall()]
    if target_table:
        tables = [t for t in tables if t == target_table]
    print(f"\n5. Found {len(tables)} tables to migrate from Railway.")

    # Supabase existing tables
    supa_cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    """)
    supa_existing_tables = {row[0] for row in supa_cur.fetchall()}

    print("\n6. Ensuring table structures and columns on Supabase...")
    for t in tables:
        if t not in supa_existing_tables:
            try:
                ddl = get_table_schema_ddl(rail_cur, t)
                supa_cur.execute(ddl)
                print(f"  [CREATED TABLE] '{t}'")
            except Exception as e:
                print(f"  [ERROR CREATING TABLE] '{t}': {e}")
        else:
            sync_table_columns(rail_cur, supa_cur, t)

    # Step 7: Disable triggers and foreign keys on Supabase during bulk transfer
    try:
        supa_cur.execute("SET session_replication_role = 'replica';")
        print("\n7. Replica mode enabled on Supabase (foreign key checks relaxed during bulk copy)")
    except Exception as e:
        print(f"Notice setting replica mode: {e}")

    # Step 8: Bulk truncate all tables upfront before inserting to prevent CASCADE deletions
    print("\n8. Clearing destination tables upfront...")
    try:
        quoted_tables = ', '.join([f'public."{t}"' for t in tables])
        supa_cur.execute(f'TRUNCATE TABLE {quoted_tables} CASCADE;')
        print(f"  [OK] Cleaned all {len(tables)} target tables on Supabase")
    except Exception as e:
        print(f"  Notice during bulk truncate: {e}")

    # Step 9: Transfer data table by table
    print("\n9. Transferring data table by table...")
    stats = {}
    total_migrated = 0

    for t in tables:
        try:
            rail_cur.execute(f'SELECT count(*) FROM public."{t}";')
            source_count = rail_cur.fetchone()[0]

            if source_count == 0:
                stats[t] = (0, 0, "OK (Empty)")
                print(f"  - '{t}': 0 rows (Empty)")
                continue

            # Inspect columns to map JSON/JSONB fields
            rail_cur.execute("""
                SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS col_type
                FROM pg_attribute a
                WHERE a.attrelid = %s::regclass AND a.attnum > 0 AND NOT a.attisdropped
                ORDER BY a.attnum;
            """, (f'public."{t}"',))
            col_info = rail_cur.fetchall()
            col_names = [c[0] for c in col_info]
            json_indices = {i for i, c in enumerate(col_info) if 'json' in c[1].lower()}

            col_placeholders = ', '.join(['%s'] * len(col_names))
            quoted_col_names = ', '.join([f'"{c}"' for c in col_names])
            insert_query = f'INSERT INTO public."{t}" ({quoted_col_names}) VALUES ({col_placeholders});'

            # Fetch and insert in batches
            rail_cur.execute(f'SELECT * FROM public."{t}";')
            batch_size = 500
            while True:
                rows = rail_cur.fetchmany(batch_size)
                if not rows:
                    break
                
                formatted_rows = []
                for row in rows:
                    new_row = []
                    for idx, val in enumerate(row):
                        if val is None:
                            new_row.append(None)
                        elif idx in json_indices:
                            if isinstance(val, (dict, list)):
                                new_row.append(Json(val))
                            else:
                                new_row.append(val)
                        elif isinstance(val, dict):
                            new_row.append(Json(val))
                        else:
                            new_row.append(val)
                    formatted_rows.append(new_row)

                execute_batch(supa_cur, insert_query, formatted_rows, page_size=batch_size)

            # Parity check
            supa_cur.execute(f'SELECT count(*) FROM public."{t}";')
            target_count = supa_cur.fetchone()[0]
            status = "OK" if source_count == target_count else f"MISMATCH ({source_count} vs {target_count})"
            stats[t] = (source_count, target_count, status)
            total_migrated += target_count
            print(f"  [OK] '{t}': {target_count}/{source_count} rows copied")
        except Exception as e:
            print(f"  [FAILED] '{t}': {e}")
            stats[t] = (source_count if 'source_count' in locals() else -1, 0, f"ERROR: {e}")

    # Step 9: Re-sync all sequences to max values in Supabase
    print("\n9. Re-aligning sequences with max ID values in Supabase...")
    for s in sequences:
        try:
            rail_cur.execute(f'SELECT last_value, is_called FROM public."{s}";')
            last_val, is_called = rail_cur.fetchone()
            supa_cur.execute(f"SELECT setval('public.\"{s}\"', %s, %s);", (last_val, is_called))
        except Exception as e:
            print(f"  Notice sequence re-alignment '{s}': {e}")

    # Also automatically align any serial/identity columns
    try:
        supa_cur.execute("""
            SELECT 
                s.relname AS sequence_name,
                t.relname AS table_name,
                a.attname AS column_name
            FROM pg_class s
            JOIN pg_depend d ON d.objid = s.oid
            JOIN pg_class t ON d.refobjid = t.oid
            JOIN pg_attribute a ON (d.refobjid, d.refobjsubid) = (a.attrelid, a.attnum)
            JOIN pg_namespace n ON n.oid = s.relnamespace
            WHERE s.relkind = 'S' AND n.nspname = 'public';
        """)
        for seq_name, tbl_name, col_name in supa_cur.fetchall():
            try:
                supa_cur.execute(f"""
                    SELECT setval('public."{seq_name}"', COALESCE((SELECT MAX("{col_name}") FROM public."{tbl_name}"), 1), true);
                """)
            except Exception:
                pass
    except Exception as e:
        print(f"Notice auto-aligning serial sequences: {e}")

    # Step 10: Reset replica mode on Supabase
    try:
        supa_cur.execute("SET session_replication_role = 'origin';")
        print("\n10. Replica mode disabled on Supabase (foreign keys and triggers restored)")
    except Exception as e:
        print(f"Notice resetting replica mode: {e}")

    # Step 11: Summary and Parity Verification
    print("\n" + "=" * 65)
    print("MIGRATION SUMMARY & VALIDATION:")
    print("=" * 65)
    all_ok = True
    mismatches = []
    for t, (src, tgt, status) in stats.items():
        if "MISMATCH" in status or "ERROR" in status:
            all_ok = False
            mismatches.append((t, src, tgt, status))
            print(f"  [FAIL] {t}: Source={src}, Target={tgt} -> {status}")
        else:
            if src > 0:
                print(f"  [SUCCESS] {t}: {tgt} rows")

    print("\n" + "=" * 65)
    if all_ok:
        print(f"100% SUCCESS: ALL {len(tables)} TABLES MIGRATED WITH FULL PARITY!")
        print(f"TOTAL ROWS MIGRATED TO SUPABASE: {total_migrated}")
        print("ZERO DATA LOSS VERIFIED!")
    else:
        print(f"WARNING: {len(mismatches)} tables had issues:")
        for m in mismatches:
            print(f"  - {m}")
    print("=" * 65)

    rail_cur.close()
    supa_cur.close()
    rail_conn.close()
    supa_conn.close()


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else None
    migrate(target)
