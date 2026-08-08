import os

from dotenv import load_dotenv

# Load .env from the project root (one level above backend/) so secrets and
# overrides live outside the codebase.
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

# MySQL connection settings, overridable via environment variables.
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "church_management")

APP_NAME = "Mt.Olivet Methodist Church"
APP_VERSION = "2.0.0"

WEB_HOST = os.getenv("WEB_HOST", "0.0.0.0")
WEB_PORT = int(os.getenv("WEB_PORT", 8080))

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    # Fail fast on startup: signing tokens without a secret would be insecure.
    raise RuntimeError(
        "JWT_SECRET is not set. Add a strong JWT_SECRET to the .env file "
        "(generate with: python -c \"import secrets; print(secrets.token_hex(32))\")."
    )
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", 1440))  # 24h session lifetime

MIN_PASSWORD_LENGTH = 8
