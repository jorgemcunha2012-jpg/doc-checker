from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Union


DEFAULT_ALLOWED_EXTENSIONS = frozenset({".doc", ".docx", ".odt", ".pdf", ".rtf", ".txt"})
DEFAULT_MAX_SIZE_MB = 20


@dataclass(frozen=True)
class CheckResult:
    path: Path
    ok: bool
    errors: tuple[str, ...] = field(default_factory=tuple)
    size_bytes: Optional[int] = None

    def as_dict(self) -> dict[str, object]:
        return {
            "path": str(self.path),
            "ok": self.ok,
            "errors": list(self.errors),
            "size_bytes": self.size_bytes,
        }


def check_document(
    path: Union[str, Path],
    *,
    allowed_extensions: set[str] | frozenset[str] = DEFAULT_ALLOWED_EXTENSIONS,
    max_size_mb: int = DEFAULT_MAX_SIZE_MB,
) -> CheckResult:
    document_path = Path(path)
    errors: list[str] = []

    normalized_extensions = {extension.lower() for extension in allowed_extensions}
    suffix = document_path.suffix.lower()

    if suffix not in normalized_extensions:
        errors.append(f"extensao_nao_permitida:{suffix or 'sem_extensao'}")

    if not document_path.exists():
        errors.append("arquivo_nao_encontrado")
        return CheckResult(path=document_path, ok=False, errors=tuple(errors))

    if not document_path.is_file():
        errors.append("nao_e_arquivo")
        return CheckResult(path=document_path, ok=False, errors=tuple(errors))

    size_bytes = document_path.stat().st_size
    if size_bytes == 0:
        errors.append("arquivo_vazio")

    max_size_bytes = max_size_mb * 1024 * 1024
    if size_bytes > max_size_bytes:
        errors.append("arquivo_muito_grande")

    return CheckResult(
        path=document_path,
        ok=not errors,
        errors=tuple(errors),
        size_bytes=size_bytes,
    )
