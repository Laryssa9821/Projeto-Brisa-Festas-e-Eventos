# create_db.py
import sqlite3, os, sys

SQL = 'schema.sql'
DB = 'db.sqlite3'

if not os.path.exists(SQL):
    print("Erro: schema.sql não encontrado nesta pasta.")
    sys.exit(1)

with open(SQL, 'r', encoding='utf-8') as f:
    sql = f.read()

conn = sqlite3.connect(DB)
try:
    conn.executescript(sql)
    conn.commit()
    print("Schema aplicado com sucesso em", DB)
except Exception as e:
    print("Erro ao aplicar schema:", e)
finally:
    conn.close()
