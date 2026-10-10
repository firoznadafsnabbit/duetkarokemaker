import os
import sys
import re
import json
import base64
import time
import tempfile
import subprocess
import hashlib
import hmac
import secrets
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

# ==========================================
# 1. ENVIRONMENT CONFIGURATION & .ENV LOADER
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def load_env():
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

load_env()

PORT = int(os.environ.get("PORT", 3000))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
TEMP_DIR = os.path.join(tempfile.gettempdir(), "duet-karaoke")
os.makedirs(TEMP_DIR, exist_ok=True)

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "feroznadafm@gmail.com").lower().strip()
ADMIN_PASSWORD_HASH = os.environ.get("ADMIN_PASSWORD_HASH", "")
ADMIN_SESSION_SECRET = os.environ.get("ADMIN_SESSION_SECRET", secrets.token_hex(32))
ALLOWED_ORIGINS = [
    o.strip().lower() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()
]

_ffmpeg_cached = None

UNIVERSAL_MP4_ARGS = [
    "-c:v", "libx264", "-preset", "veryfast",
    "-profile:v", "high", "-level", "4.1",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-ar", "44100", "-ac", "2",
    "-movflags", "+faststart"
]

# ==========================================
# 2. RATE LIMITER
# ==========================================
class RateLimiter:
    def __init__(self, window_sec, max_hits):
        self.window_sec = window_sec
        self.max_hits = max_hits
        self.hits = {}

    def is_allowed(self, ip):
        now = time.time()
        records = [t for t in self.hits.get(ip, []) if now - t < self.window_sec]
        if len(records) >= self.max_hits:
            self.hits[ip] = records
            return False
        records.append(now)
        self.hits[ip] = records
        return True

global_limiter = RateLimiter(60, 120)
render_limiter = RateLimiter(300, 10)
auth_limiter = RateLimiter(900, 5)

# ==========================================
# 3. AUTHENTICATION HELPERS
# ==========================================
def verify_admin_password(password: str) -> bool:
    if not ADMIN_PASSWORD_HASH or not password:
        return False
    try:
        parts = ADMIN_PASSWORD_HASH.split(":")
        if len(parts) != 2:
            return False
        salt_hex, hash_hex = parts
        salt = bytes.fromhex(salt_hex)
        dk = hashlib.pbkdf2_hmac("sha512", password.encode("utf-8"), salt, 100000, 64)
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False

def create_admin_token(email: str) -> str:
    exp = int(time.time() + 7200) # 2 hours
    payload = base64.urlsafe_b64encode(json.dumps({"email": email, "exp": exp}).encode("utf-8")).decode("utf-8").rstrip("=")
    sig = hmac.new(ADMIN_SESSION_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"

def verify_admin_token(token: str) -> dict:
    if not token or "." not in token:
        return None
    try:
        payload_b64, sig = token.split(".", 1)
        expected_sig = hmac.new(ADMIN_SESSION_SECRET.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        padding = "=" * (-len(payload_b64) % 4)
        data = json.loads(base64.urlsafe_b64decode((payload_b64 + padding).encode("utf-8")).decode("utf-8"))
        if data.get("exp", 0) < time.time():
            return None
        return data
    except Exception:
        return None

def get_ffmpeg_path():
    global _ffmpeg_cached
    if _ffmpeg_cached and os.path.exists(_ffmpeg_cached):
        return _ffmpeg_cached

    try:
        cmd = "where ffmpeg" if sys.platform == "win32" else "which ffmpeg"
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if res.returncode == 0 and res.stdout.strip():
            _ffmpeg_cached = res.stdout.strip().splitlines()[0].strip()
            return _ffmpeg_cached
    except Exception:
        pass

    if sys.platform == "win32":
        local_app = os.environ.get("LOCALAPPDATA", "")
        winget_pkg = os.path.join(local_app, "Microsoft", "WinGet", "Packages")
        if os.path.isdir(winget_pkg):
            for d in os.listdir(winget_pkg):
                if "ffmpeg" in d.lower():
                    pkg_path = os.path.join(winget_pkg, d)
                    try:
                        for sd in os.listdir(pkg_path):
                            candidate = os.path.join(pkg_path, sd, "bin", "ffmpeg.exe")
                            if os.path.isfile(candidate):
                                _ffmpeg_cached = candidate
                                return _ffmpeg_cached
                    except Exception:
                        pass
    return None

def check_ffmpeg():
    return get_ffmpeg_path() is not None

def clean_files(*paths):
    for p in paths:
        if p and os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass

def decode_base64_payload(data_uri_or_raw):
    raw_b64 = data_uri_or_raw.split(",")[-1]
    return base64.b64decode(raw_b64)

def escape_ass_path(path):
    escaped = path.replace("\\", "/")
    if sys.platform == "win32":
        escaped = escaped.replace(":", r"\:")
    return escaped


# ==========================================
# 4. HTTP REQUEST HANDLER
# ==========================================
class KaraokeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        if "directory" not in kwargs:
            kwargs["directory"] = PUBLIC_DIR
        super().__init__(*args, **kwargs)

    def get_client_ip(self):
        x_forwarded = self.headers.get("X-Forwarded-For")
        if x_forwarded:
            return x_forwarded.split(",")[0].strip()
        return self.client_address[0] if self.client_address else "127.0.0.1"

    def apply_security_headers(self):
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: blob: https:; "
            "media-src 'self' blob: data:; "
            "connect-src 'self' https://*.supabase.co https://lrclib.net https://www.youtube.com blob:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; form-action 'self'"
        )
        self.send_header("Content-Security-Policy", csp)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")

    def handle_cors(self):
        origin = self.headers.get("Origin")
        if not origin:
            return
        origin_lower = origin.lower()
        if (
            origin_lower in ALLOWED_ORIGINS
            or origin_lower.startswith("http://localhost:")
            or origin_lower.startswith("http://127.0.0.1:")
        ):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token")

    def send_json(self, status_code, payload, extra_headers=None):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.apply_security_headers()
        self.handle_cors()
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status_code, message, client_details=None):
        payload = {"status": "error", "error": message, "message": message}
        if client_details:
            payload["details"] = client_details
        self.send_json(status_code, payload)

    def parse_json_body(self, max_bytes=50 * 1024 * 1024):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        if length > max_bytes:
            raise ValueError("Payload size exceeds 50MB limit")
        body = self.rfile.read(length)
        return json.loads(body.decode("utf-8"))

    def check_admin_auth(self):
        auth_header = self.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip() if auth_header.startswith("Bearer ") else ""
        if not token:
            token = self.headers.get("X-Admin-Token", "").strip()
        if not token:
            cookie_header = self.headers.get("Cookie", "")
            match = re.search(r'(?:^|;\s*)duet_admin_session=([^;]+)', cookie_header)
            if match:
                token = match.group(1).strip()
        return verify_admin_token(token)

    def do_OPTIONS(self):
        self.send_response(204)
        self.apply_security_headers()
        self.handle_cors()
        self.end_headers()

    def do_GET(self):
        client_ip = self.get_client_ip()
        if not global_limiter.is_allowed(client_ip):
            return self.send_error_json(429, "Too many requests. Please slow down.")

        parsed = urlparse(self.path)

        # Sanitize status endpoint (no absolute paths leaked)
        if parsed.path == "/api/status":
            return self.send_json(200, {
                "status": "ok",
                "ffmpegAvailable": check_ffmpeg()
            })

        # Admin Session Verification
        if parsed.path == "/api/admin/session":
            session = self.check_admin_auth()
            if not session:
                return self.send_error_json(401, "Unauthorized: No active admin session")
            return self.send_json(200, {"authenticated": True, "email": session.get("email")})

        # Secure Download with Path Traversal Prevention
        if parsed.path.startswith("/api/download/"):
            filename = os.path.basename(parsed.path.replace("/api/download/", ""))
            if not re.match(r'^[a-zA-Z0-9_\-.]+\.(mp4|mp3|webm|wav|ogg)$', filename):
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Invalid download filename")
                return

            file_path = os.path.abspath(os.path.join(TEMP_DIR, filename))
            if not file_path.startswith(os.path.abspath(TEMP_DIR)) or not os.path.isfile(file_path):
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"File not found or expired")
                return

            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Cache-Control", "no-cache")
            self.apply_security_headers()
            self.end_headers()
            with open(file_path, "rb") as f:
                self.wfile.write(f.read())
            return

        super().do_GET()

    def do_POST(self):
        client_ip = self.get_client_ip()
        if not global_limiter.is_allowed(client_ip):
            return self.send_error_json(429, "Too many requests. Please slow down.")

        parsed = urlparse(self.path)

        # POST /api/admin/login
        if parsed.path == "/api/admin/login":
            if not auth_limiter.is_allowed(client_ip):
                return self.send_error_json(429, "Too many login attempts. Please wait 15 minutes.")
            try:
                payload = self.parse_json_body(1024 * 64)
                email = (payload.get("email") or "").strip().lower()
                password = payload.get("password") or ""

                if not email or not password:
                    return self.send_error_json(400, "Email and password are required.")

                if email != ADMIN_EMAIL or not verify_admin_password(password):
                    return self.send_error_json(401, "Invalid administrator credentials. Access denied.")

                token = create_admin_token(email)
                cookie_val = f"duet_admin_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200"
                return self.send_json(200, {
                    "success": True,
                    "email": email,
                    "token": token
                }, extra_headers={"Set-Cookie": cookie_val})
            except Exception as err:
                return self.send_error_json(500, "Authentication error occurred.")

        # POST /api/admin/logout
        if parsed.path == "/api/admin/logout":
            cookie_val = "duet_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
            return self.send_json(200, {"success": True}, extra_headers={"Set-Cookie": cookie_val})

        # POST /api/render-ffmpeg
        if parsed.path == "/api/render-ffmpeg":
            if not render_limiter.is_allowed(client_ip):
                return self.send_error_json(429, "Render rate limit exceeded. Please wait.")
            if not check_ffmpeg():
                return self.send_error_json(400, "FFmpeg not found in system PATH")

            try:
                payload = self.parse_json_body()
                audio_b64 = payload.get("audioBase64", "")
                audio_ext = re.sub(r'[^a-zA-Z0-9]', '', payload.get("audioExt", "mp3")).lower()
                ass_content = payload.get("assContent", "")
                server_audio_file = payload.get("serverAudioFile", "")

                if (not audio_b64 and not server_audio_file) or not ass_content:
                    return self.send_error_json(400, "Missing audio data or ASS subtitle content.")

                if audio_ext not in ('mp3', 'wav', 'ogg', 'm4a', 'flac'):
                    return self.send_error_json(400, "Unsupported audio format.")

                job_id = f"karaoke_{int(time.time() * 1000)}_{secrets.token_hex(4)}"
                audio_path = ""
                ass_path = os.path.join(TEMP_DIR, f"{job_id}.ass")
                output_path = os.path.join(TEMP_DIR, f"{job_id}.mp4")
                files_to_clean = [ass_path]

                if server_audio_file:
                    fname = os.path.basename(server_audio_file)
                    existing_path = os.path.join(TEMP_DIR, fname)
                    if os.path.exists(existing_path):
                        audio_path = existing_path

                if not audio_path and audio_b64:
                    audio_path = os.path.join(TEMP_DIR, f"{job_id}.{audio_ext}")
                    with open(audio_path, "wb") as f:
                        f.write(decode_base64_payload(audio_b64))
                    files_to_clean.append(audio_path)

                if not audio_path or not os.path.exists(audio_path):
                    return self.send_error_json(400, "Audio file not found or could not be loaded.")

                with open(ass_path, "w", encoding="utf-8") as f:
                    f.write(ass_content)

                ass_escaped = escape_ass_path(ass_path)
                cmd = [
                    get_ffmpeg_path() or "ffmpeg", "-y",
                    "-f", "lavfi", "-i", "color=c=black:s=1920x1080:r=30",
                    "-i", audio_path,
                    "-vf", f"ass='{ass_escaped}'",
                    "-shortest",
                    *UNIVERSAL_MP4_ARGS,
                    output_path
                ]

                proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                clean_files(*files_to_clean)

                if proc.returncode == 0 and os.path.exists(output_path):
                    return self.send_json(200, {
                        "success": True,
                        "jobId": job_id,
                        "downloadUrl": f"/api/download/{job_id}.mp4"
                    })
                else:
                    return self.send_error_json(500, "FFmpeg render was unable to complete.")
            except Exception as err:
                return self.send_error_json(500, "Render failed. Please check subtitle tags and audio file.")

        # POST /api/convert-recording
        if parsed.path == "/api/convert-recording":
            if not render_limiter.is_allowed(client_ip):
                return self.send_error_json(429, "Conversion limit reached. Please wait.")
            if not check_ffmpeg():
                return self.send_error_json(400, "FFmpeg not found in system PATH")

            try:
                payload = self.parse_json_body()
                video_b64 = payload.get("videoBase64", "")
                mime_type = payload.get("mimeType", "video/webm")
                input_ext = "mp4" if "mp4" in mime_type else "webm"

                job_id = f"recorded_{int(time.time() * 1000)}_{secrets.token_hex(4)}"
                input_path = os.path.join(TEMP_DIR, f"{job_id}_raw.{input_ext}")
                output_path = os.path.join(TEMP_DIR, f"{job_id}.mp4")

                with open(input_path, "wb") as f:
                    f.write(decode_base64_payload(video_b64))

                cmd = [
                    get_ffmpeg_path() or "ffmpeg", "-y",
                    "-i", input_path,
                    *UNIVERSAL_MP4_ARGS,
                    output_path
                ]

                proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                clean_files(input_path)

                if proc.returncode == 0 and os.path.exists(output_path):
                    return self.send_json(200, {
                        "success": True,
                        "jobId": job_id,
                        "downloadUrl": f"/api/download/{job_id}.mp4"
                    })
                else:
                    return self.send_error_json(500, "Conversion process failed.")
            except Exception as err:
                return self.send_error_json(500, "Conversion error occurred.")

        # POST /api/auto-duet
        if parsed.path in ("/api/auto-duet", "/api/youtube-duet"):
            if not render_limiter.is_allowed(client_ip):
                return self.send_error_json(429, "Rate limit exceeded. Please wait.")

            try:
                payload = self.parse_json_body()
                raw_url = (payload.get("url") or "").strip()
                title = (payload.get("title") or "Duet Song").strip()[:120]
                audio_b64 = payload.get("audioBase64") or ""
                raw_ext = re.sub(r'[^a-zA-Z0-9]', '', payload.get("audioExt") or "mp3").lower()
                api_key = os.environ.get("GEMINI_API_KEY") or (payload.get("apiKey") or "").strip()

                script_path = os.path.join(BASE_DIR, "youtube_duet.py")
                cmd = [sys.executable, script_path]

                if raw_url:
                    yt_pattern = r'^https://(?:www\.)?(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)[a-zA-Z0-9_\-]+'
                    if not re.match(yt_pattern, raw_url):
                        return self.send_error_json(400, "Invalid YouTube URL format.")
                    cmd.extend(["--url", raw_url])
                elif audio_b64:
                    job_id = f"duet_upload_{int(time.time() * 1000)}"
                    safe_ext = raw_ext if raw_ext in ('mp3', 'wav', 'ogg', 'm4a', 'flac') else 'mp3'
                    audio_path = os.path.join(TEMP_DIR, f"{job_id}.{safe_ext}")
                    with open(audio_path, "wb") as f:
                        f.write(decode_base64_payload(audio_b64))
                    cmd.extend(["--audio-file", audio_path, "--title", title])
                else:
                    return self.send_error_json(400, "Either a YouTube URL or an audio file is required.")

                if api_key:
                    cmd.extend(["--api-key", api_key])

                proc = subprocess.run(cmd, capture_output=True, text=True)
                stdout = proc.stdout.strip()
                json_idx = stdout.rfind('{"status":')
                if json_idx != -1:
                    stdout = stdout[json_idx:]

                parsed_data = json.loads(stdout)
                return self.send_json(200, parsed_data)
            except Exception as err:
                return self.send_error_json(500, "Audio processing failed.")

        self.send_error(404, "Endpoint not found")


handler = KaraokeHandler
app = KaraokeHandler
application = KaraokeHandler

if __name__ == "__main__":
    server_address = ("127.0.0.1", PORT)
    httpd = HTTPServer(server_address, KaraokeHandler)
    print("====================================================")
    print("   🎤 Duet Karaoke Maker (Secured Python Lite Server) ")
    print("====================================================")
    print(f"[*] Server running at: http://localhost:{PORT}")
    print("[*] Security: Salted PBKDF2, CSP, CORS, & Rate Limiting Active")
    print("[*] RAM footprint: ~20MB (Standard library only)")
    httpd.serve_forever()
