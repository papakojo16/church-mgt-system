import os

from dotenv import load_dotenv

# Load .env from the project root (one level above backend/) so secrets and
# overrides live outside the codebase.
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

# MySQL connection settings, overridable via environment variables. Values are
# trimmed: Vercel (and .env editors) often leave a trailing newline on pasted
# values, which silently breaks hostnames and database names.
DB_HOST = os.getenv("DB_HOST", "localhost").strip()
DB_PORT = int(os.getenv("DB_PORT", "3306").strip())
DB_USER = os.getenv("DB_USER", "root").strip()
DB_PASSWORD = os.getenv("DB_PASSWORD", "").strip()
DB_NAME = os.getenv("DB_NAME", "church_management").strip()

APP_NAME = "Mt.Olivet Methodist Church"
APP_VERSION = "2.0.0"

WEB_HOST = os.getenv("WEB_HOST", "0.0.0.0").strip()
WEB_PORT = int(os.getenv("WEB_PORT", "8080").strip())

# CORS: explicit list of allowed browser origins. Never use "*" together with
# credentials. Comma-separated in CORS_ORIGINS; defaults to local dev origins.
_CORS_RAW = os.getenv("CORS_ORIGINS", "http://localhost:*,http://127.0.0.1:*")
CORS_ORIGINS = [o.strip() for o in _CORS_RAW.split(",") if o.strip()]

JWT_SECRET = os.getenv("JWT_SECRET").strip() if os.getenv("JWT_SECRET") else None
if not JWT_SECRET:
    # Fail fast on startup: signing tokens without a secret would be insecure.
    raise RuntimeError(
        "JWT_SECRET is not set. Add a strong JWT_SECRET to the .env file "
        "(generate with: python -c \"import secrets; print(secrets.token_hex(32))\")."
    )
JWT_ALGORITHM = "HS256"
# Access tokens are short-lived; refresh tokens live longer and can be rotated/revoked.
JWT_ACCESS_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_EXPIRE_MINUTES", "15").strip())
JWT_REFRESH_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "7").strip())
# Kept for backward compatibility with older deployments; retires in favour of the above.
JWT_EXPIRE_MINUTES = JWT_ACCESS_EXPIRE_MINUTES

MIN_PASSWORD_LENGTH = 8
