import os

# Port from Railway environment
port = int(os.environ.get('PORT', 8080))
bind = f'0.0.0.0:{port}'
workers = 2
timeout = 120

def on_starting(server):
    os.makedirs('data', exist_ok=True)
    try:
        from database import init_db, seed
        init_db()
        seed()
        print("Base de données prête.")
    except Exception as e:
        print(f"Erreur init DB: {e}")
