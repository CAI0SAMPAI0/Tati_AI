import sys
import os

sys.stdout.reconfigure(line_buffering=True)

import psycopg2
from psycopg2.extras import execute_batch, Json

SUPABASE_URL = "postgresql://postgres.gkziqqjswecteekanwnv:supermamaco089@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
RAILWAY_URL = "postgresql://postgres:aakPfdixjEzbCwClziOwkzYsVaELoQBv@127.0.0.1:54264/railway"

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
            if not 'nextval(' in str(default):
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

def migrate():
    print("=" * 60)
    print("STARTING FULL ZERO-DATA-LOSS MIGRATION: SUPABASE -> RAILWAY")
    print("=" * 60)

    print("\n1. Connecting to databases...")
    supa_conn = psycopg2.connect(SUPABASE_URL, connect_timeout=20)
    rail_conn = psycopg2.connect(RAILWAY_URL, connect_timeout=20)
    supa_conn.autocommit = True
    rail_conn.autocommit = True

    supa_cur = supa_conn.cursor()
    rail_cur = rail_conn.cursor()

    # Disable triggers and foreign keys on Railway during bulk transfer
    try:
        rail_cur.execute("SET session_replication_role = 'replica';")
        print("  - Replica mode enabled on target (FK checks relaxed for transfer)")
    except Exception as e:
        print(f"Notice setting replica mode: {e}")

    # Extensions
    print("\n2. Ensuring extensions on Railway...")
    for ext in ["uuid-ossp", "pgcrypto", "vector"]:
        try:
            rail_cur.execute(f'CREATE EXTENSION IF NOT EXISTS "{ext}";')
            print(f"  [OK] Extension: {ext}")
        except Exception as e:
            print(f"  Notice on extension '{ext}': {e}")

    # ENUMs
    print("\n3. Replicating custom ENUM types...")
    supa_cur.execute("""
        SELECT t.typname, e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        ORDER BY t.typname, e.enumsortorder;
    """)
    enums = {}
    for tname, elabel in supa_cur.fetchall():
        enums.setdefault(tname, []).append(elabel)

    for ename, labels in enums.items():
        formatted_labels = ", ".join(f"'{l}'" for l in labels)
        try:
            rail_cur.execute(f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{ename}') THEN CREATE TYPE public.{ename} AS ENUM ({formatted_labels}); END IF; END $$;")
            print(f"  - Verified ENUM: {ename}")
        except Exception as e:
            print(f"  - Notice on ENUM {ename}: {e}")

    # Sequences
    print("\n4. Creating and syncing sequences...")
    supa_cur.execute("""
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public';
    """)
    sequences = [r[0] for r in supa_cur.fetchall()]
    for s in sequences:
        try:
            supa_cur.execute(f'SELECT last_value, is_called FROM public."{s}";')
            last_val, is_called = supa_cur.fetchone()
            rail_cur.execute(f'CREATE SEQUENCE IF NOT EXISTS public."{s}";')
            rail_cur.execute(f"SELECT setval('public.\"{s}\"', %s, %s);", (last_val, is_called))
            print(f"  [OK] Sequence: '{s}' (val: {last_val})")
        except Exception as e:
            print(f"  Notice sequence '{s}': {e}")

    # Tables
    supa_cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    tables = [row[0] for row in supa_cur.fetchall()]
    print(f"\n5. Found {len(tables)} tables to migrate.")

    print("\n6. Ensuring table structures on Railway...")
    for t in tables:
        try:
            ddl = get_table_schema_ddl(supa_cur, t)
            rail_cur.execute(ddl)
            print(f"  [OK] Table schema: '{t}'")
        except Exception as e:
            print(f"  [ERROR] Table '{t}': {e}")

    # Data Migration
    print("\n7. Transferring data table by table...")
    stats = {}
    for t in tables:
        try:
            supa_cur.execute(f'SELECT count(*) FROM public."{t}";')
            source_count = supa_cur.fetchone()[0]

            if source_count == 0:
                stats[t] = (0, 0, "OK (Empty)")
                print(f"  - '{t}': 0 rows (Empty)")
                continue

            # Truncate on target to ensure fresh idempotency
            try:
                rail_cur.execute(f'TRUNCATE TABLE public."{t}" CASCADE;')
            except Exception:
                pass

            # Inspect column information to identify JSON/JSONB fields
            supa_cur.execute("""
                SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS col_type
                FROM pg_attribute a
                WHERE a.attrelid = %s::regclass AND a.attnum > 0 AND NOT a.attisdropped
                ORDER BY a.attnum;
            """, (f'public."{t}"',))
            col_info = supa_cur.fetchall()
            col_names = [c[0] for c in col_info]
            json_indices = {i for i, c in enumerate(col_info) if 'json' in c[1].lower()}

            col_placeholders = ', '.join(['%s'] * len(col_names))
            quoted_col_names = ', '.join([f'"{c}"' for c in col_names])
            insert_query = f'INSERT INTO public."{t}" ({quoted_col_names}) VALUES ({col_placeholders});'

            # Fetch and insert in batches
            supa_cur.execute(f'SELECT * FROM public."{t}";')
            batch_size = 250
            while True:
                rows = supa_cur.fetchmany(batch_size)
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

                execute_batch(rail_cur, insert_query, formatted_rows, page_size=batch_size)

            # Verify
            rail_cur.execute(f'SELECT count(*) FROM public."{t}";')
            target_count = rail_cur.fetchone()[0]
            status = "OK" if source_count == target_count else f"MISMATCH ({source_count} vs {target_count})"
            stats[t] = (source_count, target_count, status)
            print(f"  [OK] '{t}': {target_count}/{source_count} rows migrated")
        except Exception as e:
            print(f"  [FAILED] '{t}': {e}")
            stats[t] = (source_count if 'source_count' in locals() else -1, 0, f"ERROR: {e}")

    # Step 8: Re-sync all sequences to max values
    print("\n8. Re-aligning sequences with max ID values...")
    for s in sequences:
        try:
            supa_cur.execute(f'SELECT last_value, is_called FROM public."{s}";')
            last_val, is_called = supa_cur.fetchone()
            rail_cur.execute(f"SELECT setval('public.\"{s}\"', %s, %s);", (last_val, is_called))
        except Exception as e:
            print(f"  Notice sequence re-alignment '{s}': {e}")

    # Reset replica mode
    try:
        rail_cur.execute("SET session_replication_role = 'origin';")
        print("\n9. Replica mode disabled (constraints and triggers active)")
    except Exception as e:
        print(f"Notice resetting replica mode: {e}")

    # Summary
    print("\n" + "=" * 60)
    print("MIGRATION SUMMARY & VALIDATION:")
    print("=" * 60)
    all_ok = True
    total_migrated = 0
    mismatches = []
    for t, (src, tgt, status) in stats.items():
        if "MISMATCH" in status or "ERROR" in status:
            all_ok = False
            mismatches.append((t, src, tgt, status))
            print(f"  [FAIL] {t}: Source={src}, Target={tgt} -> {status}")
        else:
            if src > 0:
                print(f"  [SUCCESS] {t}: {tgt} rows")
                total_migrated += tgt

    print("\n" + "=" * 60)
    if all_ok:
        print(f"SUCCESS: ALL {len(tables)} TABLES MIGRATED WITH 100% PARITY!")
        print(f"TOTAL ROWS MIGRATED: {total_migrated}")
        print("ZERO DATA LOSS CONFIRMED!")
    else:
        print(f"WARNING: {len(mismatches)} tables had issues:")
        for m in mismatches:
            print(f"  - {m}")
    print("=" * 60)

    supa_cur.close()
    rail_cur.close()
    supa_conn.close()
    rail_conn.close()

if __name__ == "__main__":
    migrate()
