from __future__ import annotations
from logging.config import fileConfig
import os
from pathlib import Path
from alembic import context
from sqlalchemy import create_engine, pool

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None


def _load_env_from_dotenv():
    """Load environment variables from a .env file at project root (if present).

    Simple parser: lines in KEY=VALUE format; ignores comments (#) and blanks;
    strips surrounding single/double quotes from VALUE. Does not override existing env vars.
    """
    try:
        # alembic/env.py lives in <project>/alembic/env.py -> root is parent of this dir
        root = Path(__file__).resolve().parents[1]
        env_path = root / ".env"
        if not env_path.exists():
            return
        for raw in env_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith('#'):
                continue
            if '=' not in line:
                continue
            key, val = line.split('=', 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            # do not override existing
            if key and os.getenv(key) is None:
                os.environ[key] = val
    except Exception:
        # best-effort; do not fail migrations due to .env issues
        pass


def _get_db_url() -> str:
    _load_env_from_dotenv()
    return os.getenv("DATABASE_URL") or config.get_main_option("sqlalchemy.url")


def run_migrations_offline():
    url = _get_db_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    url = _get_db_url()
    connectable = create_engine(url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
