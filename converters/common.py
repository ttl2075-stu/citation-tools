from __future__ import annotations


def decode_uploaded_text(file_storage) -> str:
    """Decode uploaded text files with UTF-8 first, then common fallbacks."""
    payload = file_storage.read()

    for encoding in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            return payload.decode(encoding)
        except UnicodeDecodeError:
            continue

    return payload.decode("utf-8", errors="replace")

