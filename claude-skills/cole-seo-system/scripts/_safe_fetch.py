"""Shared loader for the cole-seo-system scripts.

- URLs: http(s) only; every DNS lookup made while fetching (including
  redirects) must return public IPs only (no loopback, private, link-local,
  reserved, metadata); env proxies are ignored.
- Response size is capped.
- Loaded HTML has C0/C1 control characters removed (no ANSI escapes in output).
- one_line() flattens page-derived values before they are printed.
- tag_attr() reads a head tag attribute regardless of attribute order.
"""

from __future__ import annotations

import ipaddress
import re
import socket
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

try:
    import requests
except Exception:
    requests = None

MAX_BYTES = 5 * 1024 * 1024
MAX_REDIRECTS = 5
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


_real_getaddrinfo = socket.getaddrinfo


def _public_getaddrinfo(host, *args, **kwargs):
    """getaddrinfo that refuses non-public results.

    Installed for the whole fetch, so the check runs on the same lookup the
    connection uses (no DNS-rebinding gap between check and connect).
    """
    try:
        infos = _real_getaddrinfo(host, *args, **kwargs)
    except socket.gaierror as exc:
        raise SystemExit(f"Cannot resolve {host}: {exc}")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if not ip.is_global:
            raise SystemExit(f"Refusing non-public address {ip} for {host}")
    return infos


def _fetch(url: str) -> str:
    if requests is None:
        raise SystemExit("requests is required for URL fetching")
    session = requests.Session()
    session.trust_env = False  # no env proxies: the guarded lookup must be the real one
    socket.getaddrinfo = _public_getaddrinfo
    try:
        for _ in range(MAX_REDIRECTS + 1):
            if urlparse(url).scheme not in ("http", "https"):
                raise SystemExit(f"Refusing URL (http/https only): {url}")
            with session.get(
                url,
                timeout=20,
                allow_redirects=False,
                stream=True,
                headers={"User-Agent": "cole-seo-system/0.1"},
            ) as resp:
                if resp.is_redirect:
                    url = urljoin(url, resp.headers.get("Location", ""))
                    continue
                resp.raise_for_status()
                body = b""
                for chunk in resp.iter_content(65536):
                    body += chunk
                    if len(body) > MAX_BYTES:
                        raise SystemExit(f"Response larger than {MAX_BYTES} bytes: {url}")
                return body.decode(resp.encoding or "utf-8", errors="replace")
        raise SystemExit(f"Too many redirects: {url}")
    finally:
        socket.getaddrinfo = _real_getaddrinfo


def load_source(url_or_path: str) -> str:
    if url_or_path.startswith(("http://", "https://")):
        text = _fetch(url_or_path)
    else:
        text = Path(url_or_path).read_text(encoding="utf-8")
    return _CONTROL.sub("", text)


def one_line(value: str, limit: int = 200) -> str:
    value = re.sub(r"\s+", " ", _CONTROL.sub("", value)).strip()
    return value if len(value) <= limit else value[:limit] + "…"


class _TagFinder(HTMLParser):
    def __init__(self, tag: str, key: str, value: str, want: str) -> None:
        super().__init__()
        self.tag, self.key, self.value, self.want = tag, key, value, want
        self.found: str | None = None

    def handle_starttag(self, tag, attrs):
        if self.found is not None or tag != self.tag:
            return
        a = {k.lower(): (v or "") for k, v in attrs}
        if self.value in a.get(self.key, "").lower().split() and self.want in a:
            self.found = a[self.want].strip()

    handle_startendtag = handle_starttag


def tag_attr(html: str, tag: str, key: str, value: str, want: str) -> str:
    """First <tag key~=value> attribute `want`, e.g. meta name=description content."""
    finder = _TagFinder(tag, key, value, want)
    finder.feed(html)
    return finder.found or ""
