from flask import Flask, request, jsonify, session, g
import os
import sqlite3
import hashlib
import google.generativeai as genai
from datetime import datetime, timedelta
from flask_cors import CORS
from dotenv import load_dotenv
from threading import Timer

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change_this_key")

CORS(app, resources={r"/*": {"origins": "*"}})

# Configure Gemini AI API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("ERROR: GEMINI_API_KEY is not set!")

genai.configure(api_key=GEMINI_API_KEY)

# Upload settings
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"txt"}

# Database connection
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect("database.db")
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def create_tables():
    with app.app_context():
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE COLLATE NOCASE,
                password TEXT,
                role TEXT DEFAULT 'user',
                credits INTEGER DEFAULT 20,
                last_reset TEXT DEFAULT ''
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                file_path TEXT,
                summary TEXT,
                topics TEXT,
                word_count INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS credit_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                status TEXT DEFAULT 'pending',
                request_time TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.commit()
        conn.close()

def reset_credits():
    with app.app_context():
        conn = get_db()
        cursor = conn.cursor()
        today = datetime.now().strftime('%Y-%m-%d')

        cursor.execute("UPDATE users SET credits = 20, last_reset = ? WHERE last_reset != ?", (today, today))
        conn.commit()
        conn.close()

    Timer(86400, reset_credits).start()

reset_credits()

def analyze_document(text):
    try:
        model = genai.GenerativeModel("gemini-1.5-pro")

        summary_response = model.generate_content(f"Summarize this document:\n{text}")
        summary = summary_response.text if summary_response else "No summary available"

        topics_response = model.generate_content(f"Extract key topics from this document:\n{text}")
        topics = topics_response.text if topics_response else "No topics available"

        return {
            "summary": summary.strip(),
            "topics": topics.strip(),
            "word_count": len(text.split())
        }
    except Exception as e:
        return {"error": str(e)}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username", "").strip().lower()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"message": "Username and password required"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username=?", (username,))

    if cursor.fetchone():
        return jsonify({"message": "User already exists"}), 409

    cursor.execute("INSERT INTO users (username, password, last_reset) VALUES (?, ?, ?)", 
                    (username, hash_password(password), datetime.now().strftime('%Y-%m-%d')))
    conn.commit()
    conn.close()

    return jsonify({"message": "User registered successfully"}), 201

@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username", "").strip().lower()
    password = data.get("password", "").strip()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, password, role, credits FROM users WHERE username=?", (username,))
    user = cursor.fetchone()

    if not user or hash_password(password) != user["password"]:
        return jsonify({"message": "Invalid credentials"}), 401

    session["user_id"] = user["id"]
    return jsonify({"message": "Login successful", "role": user["role"], "credits": user["credits"]}), 200

@app.route("/auth/profile", methods=["GET"])
def get_profile():
    username = request.args.get("username", "").strip().lower()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT username, credits, role FROM users WHERE username=?", (username,))
    user = cursor.fetchone()

    if not user:
        return jsonify({"message": "User not found"}), 404

    return jsonify({"username": user["username"], "credits": user["credits"], "role": user["role"]})

@app.route("/credits/request", methods=["POST"])
def request_credits():
    username = request.json.get("username", "").strip().lower()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE username=?", (username,))
    user = cursor.fetchone()

    if not user:
        return jsonify({"message": "User not found"}), 404

    user_id = user["id"]
    cursor.execute("INSERT INTO credit_requests (user_id) VALUES (?)", (user_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Credit request submitted"}), 200

@app.route("/admin/approve-credit", methods=["POST"])
def approve_credit():
    data = request.get_json()
    request_id = data.get("request_id")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM credit_requests WHERE id=? AND status='pending'", (request_id,))
    request_data = cursor.fetchone()

    if not request_data:
        return jsonify({"message": "Invalid request ID or already approved"}), 400

    user_id = request_data["user_id"]
    cursor.execute("UPDATE users SET credits = credits + 10 WHERE id=?", (user_id,))
    cursor.execute("UPDATE credit_requests SET status='approved' WHERE id=?", (request_id,))
    
    conn.commit()
    conn.close()
    return jsonify({"message": "Credits approved"}), 200

@app.route("/admin/document-stats", methods=["GET"])
def document_stats():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT topics, COUNT(*) as count FROM documents GROUP BY topics ORDER BY count DESC LIMIT 5")
    stats = [{"topic": row["topics"], "count": row["count"]} for row in cursor.fetchall()]
    return jsonify(stats)

if __name__ == "__main__":
    create_tables()
    app.run(host="0.0.0.0", port=8080, debug=True)
