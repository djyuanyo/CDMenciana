"""Render public RFAF pages when the plain HTTP response contains no data."""
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit


class PublicBrowserReader:
    def __init__(self):
        self.worker = ThreadPoolExecutor(max_workers=1)
        self.runtime = self.browser = self.page = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.worker.submit(self._close).result()
        self.worker.shutdown()

    def read(self, url):
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or parsed.hostname != 'www.rfaf.es' or not parsed.path.startswith('/pnfg/NPcd/NFG_'):
            raise ValueError('Unexpected public RFAF page')
        # All Playwright operations run on its owning thread, including callers
        # from the calendar and profile worker pools.
        try:
            return self.worker.submit(self._read, url).result()
        except Exception as error:
            # Playwright timeouts are transport failures, like urllib timeouts.
            # Callers can retain verified calendars while optional pages are absent.
            from playwright.sync_api import TimeoutError as BrowserTimeout
            if isinstance(error, BrowserTimeout):
                raise OSError('Public RFAF page did not become available: '+parsed.path) from error
            raise

    def _read(self, url):
        if self.page is None:
            from playwright.sync_api import sync_playwright
            self.runtime = sync_playwright().start()
            self.browser = self.runtime.chromium.launch()
            self.page = self.browser.new_page()
            self.page.goto('https://www.rfaf.es/pnfg/NPortada', wait_until='domcontentloaded', timeout=40000)
        self.page.goto(url, wait_until='domcontentloaded', timeout=40000)
        if '/NLogin' in self.page.url:
            raise ValueError('Public RFAF page requires a session')
        body = self.page.locator('body').inner_text()
        if any(text in body.lower() for text in ('verify you are human', 'checking your browser', 'unusual traffic', 'automated queries')):
            raise ValueError('RFAF browser verification required; keeping saved data')
        # RFAF also publishes player statistics as cards and unpublished rounds
        # as plain text. Requiring a table turned valid pages into 15s timeouts.
        # Return the rendered document; each parser validates its own content.
        return self.page.content()

    def _close(self):
        if self.browser:
            self.browser.close()
        if self.runtime:
            self.runtime.stop()
