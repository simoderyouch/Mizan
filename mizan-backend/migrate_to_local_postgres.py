#!/usr/bin/env python3
import argparse
import asyncio
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

def _to_pg_cli_url(url: str) -> str:
    parsed = urlparse(url)
    scheme = "postgresql" if parsed.scheme.startswith("postgresql+") else parsed.scheme
    params = parse_qsl(parsed.query, keep_blank_values=True)
    normalized_params: list[tuple[str, str]] = []
    for key, value in params:
        if key == "ssl":
            sslmode = value or "require"
            if sslmode.lower() in {"true", "1", "yes", "on"}:
                sslmode = "require"
            normalized_params.append(("sslmode", sslmode))
            continue
        normalized_params.append((key, value))
    normalized_query = urlencode(normalized_params, doseq=True)
    return urlunparse(parsed._replace(scheme=scheme, query=normalized_query))


def _redact_url(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if parsed.port:
        host = f"{host}:{parsed.port}"
    if parsed.username:
        userinfo = parsed.username
        if parsed.password is not None:
            userinfo += ":***"
        host = f"{userinfo}@{host}"
    return urlunparse(parsed._replace(netloc=host))


def _run(command: list[str], safe_command: str | None = None) -> None:
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise RuntimeError(
            f"Missing required command: {command[0]}. Install PostgreSQL client tools first."
        ) from exc
    except subprocess.CalledProcessError as exc:
        displayed_command = safe_command or command[0]
        stderr = (exc.stderr or "").strip()
        if stderr:
            raise RuntimeError(
                f"Command failed with exit code {exc.returncode}: {displayed_command}\n{stderr}"
            ) from exc
        raise RuntimeError(
            f"Command failed with exit code {exc.returncode}: {displayed_command}"
        ) from exc


def _run_docker_pg_tool(
    *,
    tool: str,
    args: list[str],
    mount_path: Path,
    docker_image: str,
    safe_suffix: str,
) -> None:
    if not shutil.which("docker"):
        raise RuntimeError(
            "Docker is not installed. Install PostgreSQL 17 client tools or install Docker."
        )
    _run(
        [
            "docker",
            "run",
            "--rm",
            "--network",
            "host",
            "-v",
            f"{mount_path.resolve()}:/backups",
            docker_image,
            tool,
            *args,
        ],
        safe_command=f"docker run ... {docker_image} {tool} {safe_suffix}",
    )


def _should_fallback_to_docker(exc: RuntimeError) -> bool:
    message = str(exc).lower()
    return (
        "server version mismatch" in message
        or "version mismatch" in message
        or "unsupported version" in message
    )


def _is_benign_pg_restore_error(exc: RuntimeError) -> bool:
    message = str(exc).lower()
    return (
        'unrecognized configuration parameter "transaction_timeout"' in message
        and "errors ignored on restore" in message
    )


def _dump_database(url: str, output_path: Path, docker_image: str) -> None:
    cli_url = _to_pg_cli_url(url)
    command = [
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--file",
        str(output_path),
        cli_url,
    ]
    try:
        _run(command, safe_command=f"pg_dump ... {_redact_url(cli_url)}")
    except RuntimeError as exc:
        if not _should_fallback_to_docker(exc):
            raise
        print("Local pg_dump version mismatch detected, retrying with Docker PostgreSQL tools...")
        _run_docker_pg_tool(
            tool="pg_dump",
            args=[
                "--format=custom",
                "--no-owner",
                "--no-privileges",
                "--file",
                f"/backups/{output_path.name}",
                cli_url,
            ],
            mount_path=output_path.parent,
            docker_image=docker_image,
            safe_suffix=f"... {_redact_url(cli_url)}",
        )


def _restore_database(dump_path: Path, target_url: str, docker_image: str) -> None:
    cli_url = _to_pg_cli_url(target_url)
    command = [
        "pg_restore",
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--dbname",
        cli_url,
        str(dump_path),
    ]
    try:
        _run(command, safe_command=f"pg_restore ... --dbname {_redact_url(cli_url)} {dump_path}")
    except RuntimeError as exc:
        if _is_benign_pg_restore_error(exc):
            print("Ignoring benign pg_restore warning about transaction_timeout; restore completed.")
            return
        if not _should_fallback_to_docker(exc):
            raise
        print("Local pg_restore version mismatch detected, retrying with Docker PostgreSQL tools...")
        try:
            _run_docker_pg_tool(
                tool="pg_restore",
                args=[
                    "--clean",
                    "--if-exists",
                    "--no-owner",
                    "--no-privileges",
                    "--dbname",
                    cli_url,
                    f"/backups/{dump_path.name}",
                ],
                mount_path=dump_path.parent,
                docker_image=docker_image,
                safe_suffix=f"... --dbname {_redact_url(cli_url)} /backups/{dump_path.name}",
            )
        except RuntimeError as docker_exc:
            if _is_benign_pg_restore_error(docker_exc):
                print("Ignoring benign pg_restore warning about transaction_timeout; restore completed.")
                return
            raise


async def _table_counts(db_url: str) -> dict[str, int]:
    engine = create_async_engine(db_url, future=True)
    counts: dict[str, int] = {}
    try:
        async with engine.connect() as conn:
            rows = await conn.execute(
                text(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                    """
                )
            )
            tables = [row[0] for row in rows]
            for table in tables:
                result = await conn.execute(text(f'SELECT COUNT(*) FROM "{table}"'))
                counts[table] = int(result.scalar() or 0)
    finally:
        await engine.dispose()
    return counts


async def _verify(source_url: str, target_url: str) -> None:
    source_counts, target_counts = await asyncio.gather(
        _table_counts(source_url), _table_counts(target_url)
    )
    if source_counts != target_counts:
        source_tables = set(source_counts.keys())
        target_tables = set(target_counts.keys())
        missing_in_target = sorted(source_tables - target_tables)
        extra_in_target = sorted(target_tables - source_tables)
        mismatched = sorted(
            table
            for table in source_tables & target_tables
            if source_counts[table] != target_counts[table]
        )
        lines = ["Verification failed: source/target row counts differ."]
        if missing_in_target:
            lines.append(f"- Missing tables in target: {', '.join(missing_in_target)}")
        if extra_in_target:
            lines.append(f"- Extra tables in target: {', '.join(extra_in_target)}")
        if mismatched:
            details = ", ".join(
                f"{table} ({source_counts[table]} != {target_counts[table]})" for table in mismatched
            )
            lines.append(f"- Row count mismatches: {details}")
        raise RuntimeError("\n".join(lines))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backup remote PostgreSQL DB and restore into a local PostgreSQL DB safely."
    )
    parser.add_argument("--source-url", default=os.getenv("DATABASE_URL", ""))
    parser.add_argument("--target-url", default=os.getenv("LOCAL_DATABASE_URL", ""))
    parser.add_argument("--backup-dir", default="db_backups")
    parser.add_argument("--docker-image", default="postgres:17")
    args = parser.parse_args()

    source_url = args.source_url
    target_url = args.target_url

    if not source_url or not target_url:
        print("Both source and target database URLs are required.", file=sys.stderr)
        return 1
    if source_url == target_url:
        print("Source and target URLs must be different.", file=sys.stderr)
        return 1
    if not source_url.startswith("postgresql") or not target_url.startswith("postgresql"):
        print("This script supports PostgreSQL -> PostgreSQL migration only.", file=sys.stderr)
        return 1

    backup_dir = Path(args.backup_dir)
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    source_backup = backup_dir / f"source_{timestamp}.dump"
    target_backup = backup_dir / f"target_pre_restore_{timestamp}.dump"

    print(f"Creating source backup: {source_backup}")
    _dump_database(source_url, source_backup, args.docker_image)

    print(f"Creating target pre-restore backup: {target_backup}")
    _dump_database(target_url, target_backup, args.docker_image)

    print("Restoring source backup to target...")
    _restore_database(source_backup, target_url, args.docker_image)

    print("Verifying row counts between source and target...")
    asyncio.run(_verify(source_url, target_url))

    print("Migration succeeded.")
    print(f"- Source backup: {source_backup}")
    print(f"- Target pre-restore backup: {target_backup}")
    print("Set USE_LOCAL_DATABASE=true and LOCAL_DATABASE_URL to start using local DB.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
