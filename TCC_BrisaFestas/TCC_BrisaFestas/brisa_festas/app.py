# app.py
import os
import io
import sqlite3
import datetime
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Flask, request, jsonify, g, session, redirect, render_template, send_file
from flask_cors import CORS

# PDF
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

# ================== PATHS ==================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)  # caso templates/static estejam fora da pasta
TEMPLATE_DIR = os.path.join(PROJECT_DIR, 'templates')
STATIC_DIR = os.path.join(PROJECT_DIR, 'static')
DB_PATH = os.path.join(BASE_DIR, 'db.sqlite3')

# ================== FLASK APP ==================
app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
CORS(app)
app.secret_key = os.environ.get('SECRET_KEY', 'troque_essa_chave_em_producao')

# ================== DEBUG ==================
print("BASE_DIR:", BASE_DIR)
print("PROJECT_DIR:", PROJECT_DIR)
print("TEMPLATE_DIR:", TEMPLATE_DIR)
print("STATIC_DIR:", STATIC_DIR)
try:
    print("Templates encontrados:", os.listdir(TEMPLATE_DIR))
except Exception:
    print("Templates não encontrados no TEMPLATE_DIR (verifique caminho).")

# ================== DATABASE HELPERS ==================
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(error):
    if 'db' in g:
        g.db.close()

def row_to_dict(row):
    return {k: row[k] for k in row.keys()}

# ================== SCHEMA (cria tabela pedidos se não existir) ==================
def criar_tabela_pedidos():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            cpf TEXT,
            telefone TEXT,
            email TEXT,
            tipo_festa TEXT,
            data_evento TEXT,
            qtd_convidados INTEGER,
            itens_contratados TEXT,
            observacoes TEXT,
            valor_orcado REAL,
            valor_final REAL,
            status TEXT DEFAULT 'Novo',
            criado_em TEXT,
            atualizado_em TEXT
        )
    """)
    db.commit()

with app.app_context():
    try:
        criar_tabela_pedidos()
        print("Tabela 'pedidos' existe ou foi criada.")
    except Exception as e:
        print("Erro criando tabela pedidos:", e)

# ================== ADMIN BOOTSTRAP OPCIONAL ==================
def create_admin_if_not_exists():
    try:
        db = get_db()
        cur = db.execute("SELECT * FROM usuarios WHERE email = ?", ("admin@meusite.com",))
        if cur.fetchone() is None:
            hash_pw = generate_password_hash("senha123")
            db.execute("""
                INSERT INTO usuarios (nome_usuario, email, senha_hash, is_admin)
                VALUES (?, ?, ?, ?)
            """, ("Administrador", "admin@meusite.com", hash_pw, 1))
            db.commit()
            print("✅ Admin criado: admin@meusite.com / senha123")
    except Exception as e:
        print("⚠️ create_admin_if_not_exists: tabela usuarios pode não existir:", e)

with app.app_context():
    create_admin_if_not_exists()

# ================== AUTENTICAÇÃO / DECORATOR ==================
def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({"error": "Login necessário"}), 401
        if not session.get('is_admin'):
            return jsonify({"error": "Acesso restrito"}), 403
        return f(*args, **kwargs)
    return wrapper

# ================== FRONTEND ROUTES ==================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/admin')
def admin_page():
    if not session.get('user_id') or not session.get('is_admin'):
        return redirect('/login')
    return render_template('admin.html')

# ================== LOGIN API (usa tabela usuarios) ==================
@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON required"}), 400

    email = data.get('email')
    senha = data.get('password')
    db = get_db()
    cur = db.execute("SELECT * FROM usuarios WHERE email = ?", (email,))
    user = cur.fetchone()
    if not user or not check_password_hash(user['senha_hash'], senha):
        return jsonify({"error": "Credenciais inválidas"}), 401

    session['user_id'] = user['id_usuario']
    session['user_name'] = user['nome_usuario']
    session['is_admin'] = bool(user['is_admin'])
    return jsonify({"ok": True, "is_admin": session['is_admin']})

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"ok": True})

# ================== API PÚBLICA: CRIAR PEDIDO (cliente envia) ==================
@app.route('/api/pedido', methods=['POST'])
def novo_pedido():
    data = request.get_json() or {}
    nome = data.get('nome')
    cpf = data.get('cpf')
    telefone = data.get('telefone')
    email = data.get('email')
    tipo_festa = data.get('tipo_festa')
    data_evento = data.get('data_evento')
    qtd_convidados = data.get('qtd_convidados')
    itens = data.get('itens_contratados')  # string JSON ou CSV
    observacoes = data.get('observacoes')

    now = datetime.datetime.utcnow().isoformat()

    db = get_db()
    db.execute("""
        INSERT INTO pedidos (
            nome, cpf, telefone, email, tipo_festa, data_evento,
            qtd_convidados, itens_contratados, observacoes,
            valor_orcado, valor_final, status, criado_em, atualizado_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        nome, cpf, telefone, email, tipo_festa, data_evento,
        qtd_convidados, itens, observacoes,
        None, None, 'Novo', now, now
    ))
    db.commit()
    return jsonify({"ok": True}), 201

# ================== API ADMIN: LISTAR PEDIDOS ==================
@app.route('/api/pedidos', methods=['GET'])
@admin_required
def listar_pedidos():
    db = get_db()
    cur = db.execute("SELECT * FROM pedidos ORDER BY criado_em DESC")
    rows = cur.fetchall()
    return jsonify([row_to_dict(r) for r in rows])

# ================== API ADMIN: OBTER PEDIDO ==================
@app.route('/api/pedidos/<int:pedido_id>', methods=['GET'])
@admin_required
def get_pedido(pedido_id):
    db = get_db()
    cur = db.execute("SELECT * FROM pedidos WHERE id = ?", (pedido_id,))
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "Pedido não encontrado"}), 404
    return jsonify(row_to_dict(row))

# ================== API ADMIN: ATUALIZAR PEDIDO ==================
@app.route('/api/pedidos/<int:pedido_id>', methods=['PUT'])
@admin_required
def atualizar_pedido(pedido_id):
    data = request.get_json() or {}
    # campos permitidos para atualizar:
    campos = {
        'nome': data.get('nome'),
        'cpf': data.get('cpf'),
        'telefone': data.get('telefone'),
        'email': data.get('email'),
        'tipo_festa': data.get('tipo_festa'),
        'data_evento': data.get('data_evento'),
        'qtd_convidados': data.get('qtd_convidados'),
        'itens_contratados': data.get('itens_contratados'),
        'observacoes': data.get('observacoes'),
        'valor_orcado': data.get('valor_orcado'),
        'valor_final': data.get('valor_final'),
        'status': data.get('status')
    }

    # build dynamic query (somente campos que não são None)
    updates = []
    values = []
    for k, v in campos.items():
        if v is not None:
            updates.append(f"{k} = ?")
            values.append(v)

    if not updates:
        return jsonify({"error": "Nada para atualizar"}), 400

    values.append(datetime.datetime.utcnow().isoformat())  # atualizado_em
    values.append(pedido_id)

    sql = f"UPDATE pedidos SET {', '.join(updates)}, atualizado_em = ? WHERE id = ?"
    db = get_db()
    db.execute(sql, tuple(values))
    db.commit()
    return jsonify({"ok": True})

# ================== API ADMIN: DELETAR PEDIDO ==================
@app.route('/api/pedidos/<int:pedido_id>', methods=['DELETE'])
@admin_required
def deletar_pedido(pedido_id):
    db = get_db()
    db.execute("DELETE FROM pedidos WHERE id = ?", (pedido_id,))
    db.commit()
    return jsonify({"ok": True})

# ================== GERAR CONTRATO (PDF) ==================
@app.route('/admin/gerar-contrato/<int:pedido_id>', methods=['GET'])
@admin_required
def gerar_contrato(pedido_id):
    db = get_db()
    cur = db.execute("SELECT * FROM pedidos WHERE id = ?", (pedido_id,))
    pedido = cur.fetchone()
    if not pedido:
        return "Pedido não encontrado", 404

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)

    largura, altura = A4
    margem = 50
    y = altura - margem

    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(margem, y, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS - BRISA FESTAS")
    y -= 30

    pdf.setFont("Helvetica", 11)
    def linha(text):
        nonlocal y
        pdf.drawString(margem, y, text)
        y -= 18

    linha(f"Cliente: {pedido['nome'] or ''}")
    linha(f"CPF: {pedido['cpf'] or ''}")
    linha(f"Telefone: {pedido['telefone'] or ''}")
    linha(f"E-mail: {pedido['email'] or ''}")
    linha(f"Tipo de festa: {pedido['tipo_festa'] or ''}")
    linha(f"Data do evento: {pedido['data_evento'] or ''}")
    linha(f"Quantidade de convidados: {pedido['qtd_convidados'] or ''}")
    linha("")
    linha("Itens contratados:")
    itens_text = pedido['itens_contratados'] or ''
    # quebra simples de linha se for muito longo
    for chunk in [itens_text[i:i+80] for i in range(0, len(itens_text), 80)]:
        linha(chunk)
    linha("")
    linha(f"Valor orçado: R$ {pedido['valor_orcado'] or '0.00'}")
    linha(f"Valor final: R$ {pedido['valor_final'] or '0.00'}")
    linha("")
    linha("Condições:")
    linha("1) Sinal para reserva: conforme acordado entre as partes.")
    linha("2) Política de cancelamento: a combinar (ver contrato).")
    y -= 30
    linha("Assinatura do contratante: _________________________________")
    linha("Assinatura da contratada: _________________________________")

    pdf.showPage()
    pdf.save()
    buffer.seek(0)

    filename = f"contrato_pedido_{pedido_id}.pdf"
    return send_file(buffer, as_attachment=True, download_name=filename, mimetype='application/pdf')

# ================== RUN ==================
if __name__ == '__main__':
    app.run(debug=True, port=5000)
