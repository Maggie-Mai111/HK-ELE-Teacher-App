from __future__ import annotations

import argparse
import mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


class Handler(SimpleHTTPRequestHandler):
    root: Path
    base = "/HK-ELE-Teacher-App"
    disable_full_data = False

    def do_GET(self) -> None:
        if self.disable_full_data and urlsplit(self.path).path.startswith(
            f"{self.base}/hkele-data/"
        ):
            self.send_error(503, "Full database deliberately unavailable for fallback QA")
            return
        super().do_GET()

    def translate_path(self, path: str) -> str:
        clean = unquote(urlsplit(path).path)
        if clean == self.base:
            clean = f"{self.base}/"
        if not clean.startswith(f"{self.base}/"):
            return str(self.root / "__outside_base__")
        relative = clean[len(self.base) :].lstrip("/")
        candidate = (self.root / relative).resolve()
        if not str(candidate).startswith(str(self.root.resolve())):
            return str(self.root / "__unsafe__")
        if candidate.is_dir():
            candidate = candidate / "index.html"
        if not candidate.exists() and not Path(relative).suffix:
            candidate = self.root / "404.html"
        return str(candidate)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="dist")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=19078)
    parser.add_argument("--disable-full-data", action="store_true")
    args = parser.parse_args()
    Handler.root = Path(args.root).resolve()
    Handler.disable_full_data = args.disable_full_data
    mimetypes.add_type("application/manifest+json", ".webmanifest")
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(
        f"Serving {Handler.root} at http://{args.host}:{args.port}/HK-ELE-Teacher-App/",
        flush=True,
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
