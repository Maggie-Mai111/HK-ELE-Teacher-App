from __future__ import annotations

import gzip
import json
import re
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_ROOTS = {
    ".git",
    ".expo",
    ".test-dist",
    ".wrangler",
    "android",
    "dist",
    "dist-android",
    "dist-ios",
    "ios",
    "node_modules",
    "reports",
}
TEXT_SUFFIXES = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".py",
    ".ts",
    ".tsx",
    ".txt",
    ".webmanifest",
    ".yml",
    ".yaml",
}
FORBIDDEN_SECRET_SUFFIXES = {".jks", ".keystore", ".p12", ".pfx", ".pem", ".key"}
FORBIDDEN_SECRET_NAMES = {"id_rsa", "id_dsa", "credentials.json"}
PATH_PATTERNS = {
    "windows_absolute_path": re.compile(rb"(?i)(?:^|[^A-Za-z0-9])[A-Z]:[\\/]"),
    "user_home_path": re.compile(rb"(?i)(?:C:[\\/]Users[\\/]|/Users/|/home/)"),
    "local_username": re.compile(rb"(?i)maiji"),
}
SECRET_PATTERNS = {
    "private_key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "github_token": re.compile(rb"(?:github_pat_|gh[pousr]_[A-Za-z0-9]{20,})"),
    "openai_key": re.compile(rb"sk-[A-Za-z0-9_-]{20,}"),
    "aws_access_key": re.compile(rb"AKIA[0-9A-Z]{16}"),
    "assigned_password": re.compile(rb"(?i)\bpassword\s*[:=]\s*['\"][^'\"]+['\"]"),
    "assigned_token": re.compile(rb"(?i)\btoken\s*[:=]\s*['\"][^'\"]+['\"]"),
    "assigned_cookie": re.compile(rb"(?i)\bcookie\s*[:=]\s*['\"][^'\"]+['\"]"),
}
REQUIRED_GITIGNORE = {
    "node_modules/",
    ".expo/",
    ".test-dist/",
    "dist/",
    "dist-android/",
    "dist-ios/",
    "android/",
    "ios/",
    "*.log",
    ".wrangler/",
}
REQUIRED_FILES = {
    ".github/workflows/deploy-pages.yml",
    ".gitignore",
    "app.json",
    "assets/icon.png",
    "data/current-manifest.json",
    "eas.json",
    "package.json",
    "pnpm-lock.yaml",
    "PRIVACY_ZH.md",
    "public/hkele-data/update-manifest.json",
    "public/manifest.webmanifest",
    "public/sw.js",
    "README.md",
    "src/data/repository.web.ts",
    "tests/phase5b1-deployment.test.ts",
    "THIRD_PARTY_NOTICES.md",
}


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def iter_repository_files() -> list[Path]:
    output: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        parts = path.relative_to(ROOT).parts
        if any(part in EXCLUDED_ROOTS for part in parts):
            continue
        output.append(path)
    return sorted(output)


def scan_bytes(label: str, payload: bytes, findings: list[dict[str, str]]) -> None:
    for name, pattern in {**PATH_PATTERNS, **SECRET_PATTERNS}.items():
        if pattern.search(payload):
            findings.append({"type": name, "path": label})


def scan_file(path: Path, findings: list[dict[str, str]]) -> None:
    rel = relative(path)
    if rel == "scripts/validate_public_repository.py":
        return
    lower_name = path.name.lower()
    if path.suffix.lower() in FORBIDDEN_SECRET_SUFFIXES or lower_name in FORBIDDEN_SECRET_NAMES:
        findings.append({"type": "forbidden_sensitive_filename", "path": rel})
    if lower_name.startswith(".env"):
        findings.append({"type": "environment_file", "path": rel})

    suffix = path.suffix.lower()
    if suffix in TEXT_SUFFIXES or path.name in {".gitignore", ".easignore"}:
        scan_bytes(rel, path.read_bytes(), findings)
    elif suffix == ".gz":
        with gzip.open(path, "rb") as handle:
            scan_bytes(f"{rel}::gunzip", handle.read(), findings)
    elif suffix == ".zip":
        with zipfile.ZipFile(path) as archive:
            for item in archive.infolist():
                if item.is_dir():
                    continue
                with archive.open(item) as handle:
                    if item.filename.lower().endswith(".gz"):
                        with gzip.GzipFile(fileobj=handle) as expanded:
                            scan_bytes(f"{rel}::{item.filename}::gunzip", expanded.read(), findings)
                    elif Path(item.filename).suffix.lower() in TEXT_SUFFIXES:
                        scan_bytes(f"{rel}::{item.filename}", handle.read(), findings)


def main() -> None:
    findings: list[dict[str, str]] = []
    # Package82 is deliberately prepared without copying Package81's .git directory.
    # Treat the release-candidate file inventory as the prospective tracked set.
    tracked_files = [relative(path) for path in iter_repository_files()]
    for path in tracked_files:
        if path and Path(path).parts[0] in EXCLUDED_ROOTS:
            findings.append({"type": "forbidden_tracked_path", "path": path})

    for path in sorted(REQUIRED_FILES):
        if not (ROOT / path).is_file():
            findings.append({"type": "missing_required_file", "path": path})

    gitignore = set((ROOT / ".gitignore").read_text(encoding="utf-8").splitlines())
    for entry in sorted(REQUIRED_GITIGNORE - gitignore):
        findings.append({"type": "missing_gitignore_rule", "path": entry})

    files = iter_repository_files()
    for path in files:
        scan_file(path, findings)

    ui_files = [ROOT / "App.tsx", *(ROOT / "src" / "screens").glob("*.tsx"), *(ROOT / "src" / "components").glob("*.tsx")]
    ui_pattern = re.compile(
        rb"(?i)(internal|release candidate|technical demonstration|(?:^|[^A-Za-z0-9])[A-Z]:[\\/])"
    )
    for path in ui_files:
        if ui_pattern.search(path.read_bytes()):
            findings.append({"type": "teacher_ui_internal_marker", "path": relative(path)})

    wrong_target_pattern = re.compile(rb"/HK-ELE/")
    allowed_old_site_docs = {
        "README.md",
        "DEVELOPMENT_AND_RUN_GUIDE.md",
        "GITHUB_PAGES_DEPLOYMENT_GUIDE_ZH.md",
    }
    for path in files:
        rel = relative(path)
        if (
            rel == "scripts/validate_public_repository.py"
            or rel in allowed_old_site_docs
            or path.suffix.lower() not in TEXT_SUFFIXES
        ):
            continue
        if wrong_target_pattern.search(path.read_bytes()):
            findings.append({"type": "old_new_app_deployment_path", "path": rel})

    sizes = [(relative(path), path.stat().st_size) for path in files]
    largest = max(sizes, key=lambda item: item[1])
    report = {
        "schemaVersion": "HK_ELE_PUBLIC_REPOSITORY_STATIC_CHECK_1.0.0",
        "status": "PASS" if not findings else "FAIL",
        "repository": "Maggie-Mai111/HK-ELE-Teacher-App",
        "basePath": "/HK-ELE-Teacher-App/",
        "files": len(files),
        "bytes": sum(size for _, size in sizes),
        "largestFile": {"path": largest[0], "bytes": largest[1]},
        "localAbsolutePathFindings": [
            item for item in findings if item["type"] in PATH_PATTERNS
        ],
        "sensitiveFindings": [
            item
            for item in findings
            if item["type"] in SECRET_PATTERNS
            or item["type"] in {"forbidden_sensitive_filename", "environment_file"}
        ],
        "allFindings": findings,
    }
    report_directory = ROOT / "reports"
    report_directory.mkdir(exist_ok=True)
    (report_directory / "PUBLIC_REPOSITORY_STATIC_CHECK.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if findings:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
