from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Optional, Sequence

from .checker import DEFAULT_ALLOWED_EXTENSIONS, DEFAULT_MAX_SIZE_MB, CheckResult, check_document


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Valida arquivos de documentos.")
    parser.add_argument("paths", nargs="+", type=Path, help="Arquivos para validar.")
    parser.add_argument(
        "--allowed-extension",
        action="append",
        dest="allowed_extensions",
        help="Extensao permitida. Pode ser usada varias vezes. Exemplo: .pdf",
    )
    parser.add_argument(
        "--max-size-mb",
        type=int,
        default=DEFAULT_MAX_SIZE_MB,
        help=f"Tamanho maximo por arquivo em MB. Padrao: {DEFAULT_MAX_SIZE_MB}.",
    )
    parser.add_argument("--json", action="store_true", help="Exibe o resultado em JSON.")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    allowed_extensions = _normalize_extensions(args.allowed_extensions)
    results = [
        check_document(
            path,
            allowed_extensions=allowed_extensions,
            max_size_mb=args.max_size_mb,
        )
        for path in args.paths
    ]

    if args.json:
        print(json.dumps([result.as_dict() for result in results], indent=2, ensure_ascii=False))
    else:
        _print_human_results(results)

    return 0 if all(result.ok for result in results) else 1


def _normalize_extensions(values: list[str] | None) -> frozenset[str]:
    if not values:
        return DEFAULT_ALLOWED_EXTENSIONS

    return frozenset(value.lower() if value.startswith(".") else f".{value.lower()}" for value in values)


def _print_human_results(results: list[CheckResult]) -> None:
    for result in results:
        status = "OK" if result.ok else "ERRO"
        detail = ", ".join(result.errors) if result.errors else "documento valido"
        print(f"{status} {result.path}: {detail}")


if __name__ == "__main__":
    raise SystemExit(main())
