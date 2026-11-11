"""Static server that applies the headers from vercel.json (for local checks)."""
import json, sys, http.server, functools, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
cfg = json.loads((root / "vercel.json").read_text())
hdrs = [(h["key"], h["value"]) for h in cfg["headers"][0]["headers"]]
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        for k, v in hdrs: self.send_header(k, v)
        super().end_headers()
    def log_message(self, *a): pass
port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(H, directory=str(root / "public"))).serve_forever()
