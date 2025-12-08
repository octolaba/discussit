#!/usr/bin/env python3
"""Local static preview. Does not serve the vault or execute API mutations."""
import argparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Discuss UX prototype (local static preview)')
    parser.add_argument('--port', type=int, default=47831)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    class Handler(SimpleHTTPRequestHandler):
        def list_directory(self, path):
            self.send_error(403, 'Directory listing disabled')
        def translate_path(self, path):
            candidate = Path(super().translate_path(path)).resolve()
            if not candidate.is_relative_to(root):
                return str(root / '__denied__')
            return str(candidate)
        def end_headers(self):
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Cache-Control', 'no-store')
            super().end_headers()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(root)))
    print(f'Prototype: http://127.0.0.1:{args.port}/prototype/', flush=True)
    print(f'Architecture: http://127.0.0.1:{args.port}/architecture.html', flush=True)
    server.serve_forever()
