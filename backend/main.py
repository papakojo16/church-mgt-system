import os
import sys
from pathlib import Path

# Ensure this backend folder is importable as a top-level package (routers import
# sibling modules like `config`, `database`, `deps` without a package prefix).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import APP_NAME, APP_VERSION, WEB_HOST, WEB_PORT
from database import init_db, is_online
from deps import get_current_user
from routers import (
    auth_routes,
    members_routes,
    finance_routes,
    content_routes,
    receipts_routes,
    stats_routes,
    admin_routes,
    church_routes,
    sync_routes,
)

BASE_DIR = Path(__file__).resolve().parent.parent
# Frontend build output and static assets, used for SPA hosting.
DIST_DIR = BASE_DIR / "frontend" / "dist"
STATIC_DIR = BASE_DIR / "frontend" / "public"

app = FastAPI(title=APP_NAME, version=APP_VERSION)

# Permissive CORS so the separately-hosted frontend can call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(members_routes.router)
app.include_router(finance_routes.router)
app.include_router(content_routes.router)
app.include_router(receipts_routes.router)
app.include_router(stats_routes.router)
app.include_router(admin_routes.router)
app.include_router(church_routes.router)
app.include_router(sync_routes.router)


@app.get("/api/status")
def api_status():
    # Lightweight health check; lets the frontend know if the DB is reachable.
    return {"online": is_online()}


@app.on_event("startup")
def on_startup():
    # Create missing tables/columns on boot so the app works after a fresh deploy.
    init_db()


def _index_file():
    index = DIST_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    # Fallback page shown when the frontend has not been built yet.
    return Response(
        "<html><body><h1>Mt.Olivet Methodist Church</h1><p>Frontend not built yet. "
        "Run <code>npm install && npm run build</code> inside the <code>frontend</code> folder.</p></body></html>",
        media_type="text/html",
    )


@app.get("/", include_in_schema=False)
def root():
    return _index_file()


if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")
else:
    # Mount an empty dir so the /assets path doesn't 404 during development.
    try:
        from fastapi.staticfiles import StaticFiles as SF

        assets_dir = DIST_DIR / "assets"
        assets_dir.mkdir(parents=True, exist_ok=True)
        app.mount("/assets", SF(directory=str(assets_dir)), name="assets")
    except OSError:
        # Read-only filesystem (e.g. serverless runtimes like Vercel): skip
        # the empty mount; the SPA fallback route still works.
        pass


@app.get("/{path:path}", include_in_schema=False)
def spa_fallback(path: str):
    # SPA catch-all: serve real files if they exist, otherwise fall back to
    # index.html so client-side routing (e.g. /admin, /login) keeps working.
    if DIST_DIR.exists():
        candidate = DIST_DIR / path
        if candidate.is_file():
            return FileResponse(candidate)
        public_candidate = STATIC_DIR / path
        if public_candidate.is_file():
            return FileResponse(public_candidate)
        return _index_file()
    public_candidate = STATIC_DIR / path
    if public_candidate.is_file():
        return FileResponse(public_candidate)
    return _index_file()


def main():
    import uvicorn

    # Entry point for `python backend/main.py`; also importable as a WSGI app.
    print(f"Mt.Olivet Methodist Church web app: http://{WEB_HOST}:{WEB_PORT}")
    uvicorn.run(app, host=WEB_HOST, port=WEB_PORT, log_level="info")


if __name__ == "__main__":
    main()
