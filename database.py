"""
Base de données — adapte automatiquement SQLite (local) ou PostgreSQL (Railway)
selon la variable d'environnement DATABASE_URL.
"""
import os, sqlite3

DATABASE_URL = os.environ.get('DATABASE_URL', '')

# ── Détection du moteur ───────────────────────────────────────────────────────
USE_POSTGRES = DATABASE_URL.startswith('postgres')

if USE_POSTGRES:
    import psycopg2
    import psycopg2.extras

SQLITE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'attributions.db')

# ── Connexion ─────────────────────────────────────────────────────────────────
def get_db():
    if USE_POSTGRES:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
        return conn
    else:
        os.makedirs(os.path.dirname(SQLITE_PATH), exist_ok=True)
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

def rows(r): return [dict(x) for x in r]
def row(r):  return dict(r) if r else None

# ── Placeholder adapté ────────────────────────────────────────────────────────
PH = '%s' if USE_POSTGRES else '?'

def ph(n=1):
    """Génère n placeholders : ?,?,? ou %s,%s,%s"""
    p = PH
    return ','.join([p]*n)

def q(sql):
    """Adapte une requête SQLite → PostgreSQL si nécessaire"""
    if USE_POSTGRES:
        sql = sql.replace('?', '%s')
        sql = sql.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')
        sql = sql.replace('last_insert_rowid()', 'lastval()')
        sql = sql.replace('PRAGMA foreign_keys = ON', 'SET CONSTRAINTS ALL DEFERRED')
    return sql

def execute(conn, sql, params=None):
    """Exécute une requête avec gestion SQLite/PostgreSQL"""
    sql = q(sql)
    cur = conn.cursor()
    if params:
        cur.execute(sql, params)
    else:
        cur.execute(sql)
    return cur

def fetchall(conn, sql, params=None):
    cur = execute(conn, sql, params)
    return rows(cur.fetchall())

def fetchone(conn, sql, params=None):
    cur = execute(conn, sql, params)
    r = cur.fetchone()
    return row(r) if r else None

def lastid(conn, table=None):
    """Retourne le dernier ID inséré"""
    if USE_POSTGRES:
        cur = conn.cursor()
        cur.execute("SELECT lastval()")
        return cur.fetchone()[0]
    else:
        return conn.execute("SELECT last_insert_rowid()").fetchone()[0]

# ── Schéma ────────────────────────────────────────────────────────────────────
SCHEMA = """
CREATE TABLE IF NOT EXISTS utilisateurs (
    id         SERIAL PRIMARY KEY,
    username   TEXT NOT NULL UNIQUE,
    password   TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'consultation',
    actif      INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS annees (
    id    SERIAL PRIMARY KEY,
    label TEXT NOT NULL UNIQUE,
    actif INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS filieres (
    id      SERIAL PRIMARY KEY,
    nom     TEXT NOT NULL,
    degre   TEXT DEFAULT '',
    ordre   INTEGER DEFAULT 0,
    actif   INTEGER DEFAULT 1,
    couleur TEXT DEFAULT '#378ADD'
);
CREATE TABLE IF NOT EXISTS classes (
    id          SERIAL PRIMARY KEY,
    filiere_id  INTEGER NOT NULL REFERENCES filieres(id),
    nom         TEXT NOT NULL,
    ordre       INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS personnel (
    id          SERIAL PRIMARY KEY,
    acronyme    TEXT NOT NULL UNIQUE,
    prenom      TEXT DEFAULT '',
    nom         TEXT DEFAULT '',
    email       TEXT DEFAULT '',
    statut      TEXT DEFAULT '',
    actif       INTEGER DEFAULT 1,
    heures_min  REAL DEFAULT 0,
    heures_max  REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS titulaires (
    id           SERIAL PRIMARY KEY,
    classe_id    INTEGER NOT NULL REFERENCES classes(id),
    personnel_id INTEGER NOT NULL REFERENCES personnel(id),
    annee        TEXT NOT NULL DEFAULT '2025-2026'
);
CREATE TABLE IF NOT EXISTS cours (
    id              SERIAL PRIMARY KEY,
    filiere_id      INTEGER NOT NULL REFERENCES filieres(id),
    nom             TEXT NOT NULL,
    heures          REAL DEFAULT 0,
    type            TEXT DEFAULT 'FC',
    ordre           INTEGER DEFAULT 0,
    nb_groupes      INTEGER DEFAULT 1,
    coord_cat_id    INTEGER DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS attributions (
    id           SERIAL PRIMARY KEY,
    cours_id     INTEGER NOT NULL REFERENCES cours(id),
    classe_id    INTEGER REFERENCES classes(id),
    personnel_id INTEGER NOT NULL REFERENCES personnel(id),
    annee        TEXT NOT NULL DEFAULT '2025-2026',
    groupe_num   INTEGER DEFAULT 1,
    heures_attr  REAL DEFAULT NULL,
    couleur      TEXT DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS eleves_options (
    id                  SERIAL PRIMARY KEY,
    cours_id            INTEGER NOT NULL REFERENCES cours(id),
    annee               TEXT NOT NULL,
    nb_eleves           INTEGER DEFAULT 0,
    nb_eleves_precedent INTEGER DEFAULT NULL,
    source              TEXT DEFAULT 'manuel'
);
CREATE TABLE IF NOT EXISTS coord_categories (
    id      SERIAL PRIMARY KEY,
    nom     TEXT NOT NULL,
    ordre   INTEGER DEFAULT 0,
    couleur TEXT DEFAULT '#888780'
);
CREATE TABLE IF NOT EXISTS ntpp_categories (
    id        SERIAL PRIMARY KEY,
    nom       TEXT NOT NULL,
    signe     INTEGER DEFAULT 1,
    ordre     INTEGER DEFAULT 0,
    parent_id INTEGER DEFAULT NULL REFERENCES ntpp_categories(id)
);
CREATE TABLE IF NOT EXISTS ntpp_valeurs (
    id           SERIAL PRIMARY KEY,
    categorie_id INTEGER NOT NULL REFERENCES ntpp_categories(id),
    annee        TEXT NOT NULL DEFAULT '2025-2026',
    valeur       REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS mail_config (
    id        SERIAL PRIMARY KEY,
    smtp_host TEXT DEFAULT 'ssl0.ovh.net',
    smtp_port INTEGER DEFAULT 465,
    smtp_user TEXT DEFAULT '',
    smtp_pass TEXT DEFAULT '',
    from_name TEXT DEFAULT '',
    signature TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS mail_templates (
    id    SERIAL PRIMARY KEY,
    nom   TEXT NOT NULL,
    sujet TEXT NOT NULL,
    corps TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nominations (
    id           SERIAL PRIMARY KEY,
    personnel_id INTEGER NOT NULL REFERENCES personnel(id),
    matiere      TEXT NOT NULL,
    heures       REAL DEFAULT 0,
    type_cours   TEXT DEFAULT 'FC'
);

CREATE TABLE IF NOT EXISTS mail_envois (
    id           SERIAL PRIMARY KEY,
    personnel_id INTEGER REFERENCES personnel(id),
    template_id  INTEGER REFERENCES mail_templates(id),
    annee        TEXT,
    date_envoi   TEXT,
    statut       TEXT DEFAULT 'pending',
    erreur       TEXT DEFAULT ''
);
"""

SCHEMA_SQLITE = SCHEMA.replace('SERIAL PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT')

def init_db():
    conn = get_db()
    if USE_POSTGRES:
        conn.autocommit = True
    # Add couleur column if missing (migration)
    try:
        if USE_POSTGRES:
            conn.cursor().execute('ALTER TABLE attributions ADD COLUMN IF NOT EXISTS couleur TEXT DEFAULT NULL')
        else:
            conn.execute('ALTER TABLE attributions ADD COLUMN couleur TEXT DEFAULT NULL')
        conn.commit() if not USE_POSTGRES else None
    except Exception:
        pass
    try:
        if USE_POSTGRES:
            conn.cursor().execute('ALTER TABLE classes ADD COLUMN IF NOT EXISTS commentaire TEXT DEFAULT NULL')
        else:
            conn.execute('ALTER TABLE classes ADD COLUMN commentaire TEXT DEFAULT NULL')
        conn.commit() if not USE_POSTGRES else None
    except Exception:
        pass

    schema = SCHEMA if USE_POSTGRES else SCHEMA_SQLITE
    statements = [s.strip() for s in schema.split(';') if s.strip()]
    cur = conn.cursor()
    for stmt in statements:
        try:
            cur.execute(stmt)
            if not USE_POSTGRES:
                conn.commit()
        except Exception as e:
            if not USE_POSTGRES:
                conn.rollback()
            msg = str(e).lower()
            if 'already exists' not in msg and 'duplicate' not in msg:
                print(f"Warning init_db: {e}")
    if not USE_POSTGRES:
        conn.commit()
    if USE_POSTGRES:
        conn.autocommit = False
    conn.close()
    print("Tables créées.")

def seed():
    """Insère les données initiales si la table est vide"""
    conn = get_db()
    nb = fetchone(conn, "SELECT COUNT(*) as n FROM filieres")['n']
    if nb > 0:
        conn.close()
        return

    from werkzeug.security import generate_password_hash

    # Comptes par défaut
    for uname, pwd, role in [('admin','admin123','admin'),('consultation','consult123','consultation')]:
        try:
            execute(conn, "INSERT INTO utilisateurs(username,password,role) VALUES(?,?,?)",
                    (uname, generate_password_hash(pwd), role))
            conn.commit()
        except Exception:
            conn.rollback()

    # Années
    for lbl, actif in [('2023-2024',0),('2024-2025',0),('2025-2026',1)]:
        try:
            execute(conn, "INSERT INTO annees(label,actif) VALUES(?,?)", (lbl, actif))
            conn.commit()
        except Exception:
            conn.rollback()

    # Filières
    filieres = [
        ('1DD/2DD','1er degré',1,'#6EA8D5'),
        ('1C','1er degré',2,'#6EA8D5'),
        ('2C','1er degré',3,'#6EA8D5'),
        ('2S','1er degré',4,'#6EA8D5'),
        ('3GT/3TT','2e degré GT/TT',5,'#378ADD'),
        ('4GT/4TT','2e degré GT/TT',6,'#378ADD'),
        ('5GT/5TT','3e degré GT/TT',7,'#185FA5'),
        ('6GT/6TT','3e degré GT/TT',8,'#185FA5'),
        ('4TQ','TQ',9,'#639922'),
        ('5TQ','TQ',10,'#639922'),
        ('6TQ','TQ',11,'#639922'),
        ('Coordination','Coordination',12,'#BA7517'),
    ]
    for nom, degre, ordre, couleur in filieres:
        try:
            execute(conn, "INSERT INTO filieres(nom,degre,ordre,couleur) VALUES(?,?,?,?)",
                    (nom, degre, ordre, couleur))
            conn.commit()
        except Exception:
            conn.rollback()

    # Catégories coordination
    for i, (nom, couleur) in enumerate([
        ('Éducateurs','#E24B4A'),('Coordination','#378ADD'),
        ('Mission pilotage','#BA7517'),('Numérique','#639922'),
        ('Remédiation','#7F77DD'),('Comptoir / Missions DS','#1D9E75'),
        ('Autre','#888780'),
    ]):
        try:
            execute(conn, "INSERT INTO coord_categories(nom,ordre,couleur) VALUES(?,?,?)", (nom, i, couleur))
            conn.commit()
        except Exception:
            conn.rollback()

    # NTPP
    ntpp = [
        ('NTPP de base',1,0,None,1601),
        ('Solidarité prélèvement zone',-1,1,None,13),
        ('Période complémentaire primo arrivant',1,2,None,0),
        ('Complémentaire D1',1,3,None,15),
        ('Supplémentaire D1',1,4,None,10),
        ('Solidarité',-1,5,None,19),
        ('École',1,6,None,0),
        ('Expérimenté',1,7,None,16),
        ('Taille des classes',1,8,None,0),
        ('Autre',1,9,None,0),
    ]
    for nom, signe, ordre, parent, val in ntpp:
        try:
            if USE_POSTGRES:
                cur = conn.cursor()
                cur.execute("INSERT INTO ntpp_categories(nom,signe,ordre,parent_id) VALUES(%s,%s,%s,%s) RETURNING id",
                            (nom, signe, ordre, parent))
                nid = cur.fetchone()['id']
                conn.commit()
            else:
                execute(conn, "INSERT INTO ntpp_categories(nom,signe,ordre,parent_id) VALUES(?,?,?,?)",
                        (nom, signe, ordre, parent))
                nid = lastid(conn, 'ntpp_categories')
                conn.commit()
            if val:
                execute(conn, "INSERT INTO ntpp_valeurs(categorie_id,annee,valeur) VALUES(?,?,?)",
                        (nid, '2025-2026', val))
                conn.commit()
        except Exception as ex:
            conn.rollback()
            print(f"Warning ntpp: {ex}")

    # LYSEM
    ecole = fetchone(conn, "SELECT id FROM ntpp_categories WHERE nom=?", ('École',))
    if ecole:
        try:
            execute(conn, "INSERT INTO ntpp_categories(nom,signe,ordre,parent_id) VALUES(?,?,?,?)",
                    ('LYSEM', 1, 0, ecole['id']))
            conn.commit()
        except Exception:
            conn.rollback()

    # Mail
    execute(conn, "INSERT INTO mail_config(smtp_host,smtp_port) VALUES(?,?)", ('ssl0.ovh.net', 465))
    execute(conn, "INSERT INTO mail_templates(nom,sujet,corps) VALUES(?,?,?)", (
        'Attributions annuelles',
        'Vos attributions — {annee}',
        'Bonjour {prenom},\n\n{titulariats}{tableau}\n\nCordialement,\n{signature}'
    ))

    conn.commit()
    conn.close()
    print("Base initialisée.")

if __name__ == '__main__':
    init_db()
    seed()
    print("Prêt.")
