"""
Script de migration — SQLite local → PostgreSQL Railway

Usage :
  1. Avoir DATABASE_URL pointant vers PostgreSQL dans les variables d'environnement
  2. Avoir le fichier SQLite dans data/attributions.db
  3. Lancer : python3 migrate_sqlite_to_pg.py

Ce script transfère toutes les données de la base SQLite locale
vers PostgreSQL sur Railway.
"""
import os, sqlite3, sys

SQLITE_PATH = os.path.join(os.path.dirname(__file__), 'data', 'attributions.db')
DATABASE_URL = os.environ.get('DATABASE_URL', '')

if not DATABASE_URL.startswith('postgres'):
    print("❌ DATABASE_URL n'est pas configuré ou ne pointe pas vers PostgreSQL")
    print("   Définissez DATABASE_URL=postgres://... avant de lancer ce script")
    sys.exit(1)

if not os.path.exists(SQLITE_PATH):
    print(f"❌ Base SQLite introuvable : {SQLITE_PATH}")
    sys.exit(1)

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("❌ psycopg2 non installé. Lancez : pip install psycopg2-binary")
    sys.exit(1)

print("🔄 Migration SQLite → PostgreSQL")
print(f"   Source : {SQLITE_PATH}")
print(f"   Destination : {DATABASE_URL[:40]}...")

# Connexions
sqlite_conn = sqlite3.connect(SQLITE_PATH)
sqlite_conn.row_factory = sqlite3.Row
pg_conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
pg_cur = pg_conn.cursor()

# Ordre des tables (respecter les FK)
TABLES = [
    'annees', 'filieres', 'classes', 'personnel',
    'coord_categories', 'ntpp_categories',
    'cours', 'titulaires', 'attributions',
    'eleves_options', 'ntpp_valeurs',
    'mail_config', 'mail_templates', 'mail_envois',
    'utilisateurs',
]

total = 0
for table in TABLES:
    # Check if table exists in SQLite
    exists = sqlite_conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    if not exists:
        print(f"   ⏭  {table} (absente dans SQLite)")
        continue

    rows = sqlite_conn.execute(f"SELECT * FROM {table}").fetchall()
    if not rows:
        print(f"   ⏭  {table} (vide)")
        continue

    cols = rows[0].keys()
    placeholders = ','.join(['%s'] * len(cols))
    col_names = ','.join(cols)

    # Clear existing data in PG
    pg_cur.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE")

    # Insert
    for row in rows:
        pg_cur.execute(
            f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})",
            [row[c] for c in cols]
        )

    pg_conn.commit()
    print(f"   ✓  {table} — {len(rows)} lignes")
    total += len(rows)

# Reset sequences
for table in TABLES:
    try:
        pg_cur.execute(f"""
            SELECT setval(pg_get_serial_sequence('{table}', 'id'),
                   COALESCE(MAX(id), 1)) FROM {table}
        """)
        pg_conn.commit()
    except:
        pg_conn.rollback()

sqlite_conn.close()
pg_conn.close()

print(f"\n✅ Migration terminée — {total} lignes transférées")
print("   L'application Railway utilisera maintenant ces données.")
