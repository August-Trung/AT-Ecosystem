from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler

from src.core.app_paths import ensure_runtime_dir, runtime_root


def setup_logger(name: str = "at_assistant") -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:  # tránh add handler nhiều lần
        return logger

    logger.setLevel(logging.INFO)

    log_dir = ensure_runtime_dir("logs")

    log_file = log_dir / "app.log"

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = RotatingFileHandler(
        filename=str(log_file),
        maxBytes=2_000_000,  # 2MB
        backupCount=5,
        encoding="utf-8",
    )
    handler.setFormatter(fmt)
    logger.addHandler(handler)

    # console (tùy bạn, để INFO cho dev)
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    logger.addHandler(console)

    # giảm noise từ lib khác
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    return logger
