"""
Outbound requests to addresses a user typed in.

A student's Canvas address is user input, and the server fetches from it. Left
alone, that lets anyone point the server at its own network: the cloud
metadata service, the database, an admin port on localhost. Three rules close
that off:

1. The address must be https on the default port, with a hostname rather than
   an IP literal, and nothing after the host.
2. Every address the hostname resolves to must be a public one. Private,
   loopback, link-local, carrier-grade NAT, multicast and reserved ranges are
   refused.
3. The check happens when the socket is opened, against the very address it
   connects to. Checking once at the start and letting the HTTP library resolve
   again later would let a hostname that resolves to a public address for the
   check and a private one for the request (DNS rebinding) slip through.

Redirects are never followed automatically; callers decide hop by hop.
"""
import ipaddress
import socket
import ssl
from typing import Callable, Iterable, List, Optional
from urllib.parse import urlsplit

import certifi
import httpcore
import httpx


class UnsafeAddress(ValueError):
    """The address is not one the server will fetch from."""


Resolver = Callable[[str, int], List[str]]


def _system_resolve(host: str, port: int) -> List[str]:
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return sorted({info[4][0] for info in infos})


# Swapped out in tests, so they never touch real DNS.
resolve: Resolver = _system_resolve


def is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address.split("%", 1)[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast and not ip.is_reserved


def public_addresses(host: str, port: int = 443) -> List[str]:
    """The host's addresses, if every one of them is public. Raises otherwise."""
    try:
        addresses = resolve(host, port)
    except OSError:
        raise UnsafeAddress(f"Could not find {host}. Check the address.")
    if not addresses:
        raise UnsafeAddress(f"Could not find {host}. Check the address.")
    blocked = [a for a in addresses if not is_public(a)]
    if blocked:
        raise UnsafeAddress(f"{host} points at a private or local network address.")
    return addresses


def normalize_https_origin(raw: str) -> str:
    """
    'canvas.example.edu', 'https://Canvas.Example.edu/' and the like become
    'https://canvas.example.edu'. Anything that is not a plain https origin is
    refused. Does not touch the network.
    """
    value = (raw or "").strip()
    if not value:
        raise UnsafeAddress("Enter your school's Canvas address.")
    if "://" not in value:
        value = "https://" + value

    parts = urlsplit(value)
    if parts.scheme.lower() != "https":
        raise UnsafeAddress("The Canvas address must start with https://.")
    if parts.username or parts.password:
        raise UnsafeAddress("The Canvas address can't contain a username or password.")
    if parts.query or parts.fragment or parts.path not in ("", "/"):
        raise UnsafeAddress("Enter only the Canvas address, like https://canvas.example.edu.")

    host = (parts.hostname or "").rstrip(".").lower()
    if not host or "." not in host:
        raise UnsafeAddress("Enter a full address, like https://canvas.example.edu.")
    try:
        ipaddress.ip_address(host)
        raise UnsafeAddress("Use your school's Canvas hostname, not an IP address.")
    except ValueError as e:
        if isinstance(e, UnsafeAddress):
            raise
    try:
        port = parts.port
    except ValueError:
        raise UnsafeAddress("The Canvas address has an invalid port.")
    if port not in (None, 443):
        raise UnsafeAddress("The Canvas address must use the standard https port.")

    return f"https://{host}"


def check_https_origin(raw: str) -> str:
    """normalize_https_origin, then make sure the host resolves to public addresses only."""
    origin = normalize_https_origin(raw)
    public_addresses(urlsplit(origin).hostname)
    return origin


def check_url(url: str) -> None:
    """A URL (such as a redirect target) is https, on 443, at a public host."""
    parts = urlsplit(url)
    if parts.scheme.lower() != "https" or not parts.hostname:
        raise UnsafeAddress("Refusing to fetch a non-https address.")
    if parts.port not in (None, 443):
        raise UnsafeAddress("Refusing to fetch from a non-standard port.")
    host = parts.hostname.rstrip(".").lower()
    try:
        ipaddress.ip_address(host)
        literal = True
    except ValueError:
        literal = False
    if literal:
        if not is_public(host):
            raise UnsafeAddress("Refusing to fetch from a private address.")
        return
    public_addresses(host)


class GuardedBackend(httpcore.SyncBackend):
    """Opens TCP connections only to public addresses, checked at connect time."""

    def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: Optional[float] = None,
        local_address: Optional[str] = None,
        socket_options: Optional[Iterable] = None,
    ) -> httpcore.NetworkStream:
        try:
            addresses = public_addresses(host, port)
        except UnsafeAddress as e:
            raise httpcore.ConnectError(str(e))
        # Connect to the address that was checked. TLS still verifies the
        # certificate against `host`, which httpcore passes separately.
        return super().connect_tcp(
            addresses[0], port, timeout=timeout,
            local_address=local_address, socket_options=socket_options,
        )


class GuardedTransport(httpx.HTTPTransport):
    """
    httpx's own transport with the connection pool rebuilt on GuardedBackend.

    httpx has no public hook for the network backend, so this replaces the
    pool it builds. test_canvas_security checks the guard is really in the
    path, so an httpx upgrade that changes this fails loudly.
    """

    def __init__(self) -> None:
        super().__init__(trust_env=False)
        self._pool = httpcore.ConnectionPool(
            ssl_context=ssl.create_default_context(cafile=certifi.where()),
            max_connections=10,
            max_keepalive_connections=5,
            keepalive_expiry=5.0,
            network_backend=GuardedBackend(),
        )


def guarded_client(**kwargs) -> httpx.Client:
    """An httpx client that never follows redirects, ignores proxy settings and only reaches public hosts."""
    transport = kwargs.pop("transport", None) or GuardedTransport()
    return httpx.Client(transport=transport, follow_redirects=False, trust_env=False, **kwargs)
