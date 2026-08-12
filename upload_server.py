from http.server import HTTPServer, BaseHTTPRequestHandler
class H(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200); self._cors(); self.end_headers()
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        open('uploaded.pdf', 'wb').write(self.rfile.read(n))
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'ok')
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
    def log_message(self, *a): pass
HTTPServer(('127.0.0.1', 8472), H).serve_forever() &
