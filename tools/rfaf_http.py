"""One public RFAF cookie session for all club competitions."""
import http.cookiejar
import re
import subprocess
import tempfile
import threading
import time
import urllib.request
from urllib.parse import urlsplit

HOME = 'https://www.rfaf.es/pnfg/NPortada'


class PublicHTTPReader:
    def __init__(self, browser_reader=None):
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        self.browser_reader = browser_reader
        self.initialized = False
        self.request_lock = threading.Lock()
        self.last_request = 0.0

    def _request(self, url):
        request = urllib.request.Request(url, headers={
            'Accept': 'text/html,application/xhtml+xml',
        })
        # A single cookie session needs serialized requests. Keep a modest
        # interval instead of sending bursts from the round/profile pools.
        with self.request_lock:
            delay = 1.0-(time.monotonic()-self.last_request)
            if delay>0:
                time.sleep(delay)
            self.last_request=time.monotonic()
            with self.opener.open(request, timeout=40) as response:
                return response.read(3_000_000)

    @staticmethod
    def _empty(raw):
        # RFAF sometimes returns an empty HTML shell with HTTP 200, not
        # literally zero bytes. That is also a failed public session.
        content=re.sub(rb'(?is)<!--.*?-->|<head\b[^>]*>.*?</head>|<(script|style)\b[^>]*>.*?</\1>',b'',raw)
        content=re.sub(rb'<[^>]+>',b'',content).strip()
        return not content or b'No se ha aceptado el cookie' in raw

    def _curl(self, url):
        with tempfile.TemporaryDirectory() as directory:
            path = directory+'/public-cookies.txt'
            jar = http.cookiejar.MozillaCookieJar(path)
            for cookie in self.cookies:
                jar.set_cookie(cookie)
            jar.save(ignore_discard=True, ignore_expires=True)
            raw = subprocess.check_output([
                'curl', '--fail', '--silent', '--show-error', '--location',
                '--max-time', '40', '--cookie', path, '--cookie-jar', path,
                '--referer', HOME, url,
            ], timeout=45)
            # A fallback for an unpublished round must not replace the main
            # session's cookies while other round requests are using them.
            return raw

    def get(self, url, encoding='iso-8859-15'):
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or parsed.hostname != 'www.rfaf.es' or not parsed.path.startswith('/pnfg/'):
            raise ValueError('Unexpected public RFAF page')
        if not self.initialized:
            self._request(HOME)
            self.initialized = True
            print('Public session initialized', flush=True)
        raw = self._request(url)
        # A successful HTTP status can still mean the public cookie handshake
        # was lost. Retry that handshake before using a rendered page.
        if self._empty(raw):
            self._request(HOME)
            raw = self._request(url)
        if self._empty(raw):
            try:
                raw = self._curl(url)
            except (subprocess.SubprocessError, OSError) as error:
                raise OSError('Public RFAF request failed: '+parsed.path) from error
        if self._empty(raw) and self.browser_reader and parsed.path.startswith('/pnfg/NPcd/NFG_'):
            raw = self.browser_reader.read(url).encode(encoding, errors='xmlcharrefreplace')
        if self._empty(raw):
            raise OSError('Public RFAF session returned no data: '+parsed.path)
        return raw.decode(encoding)
