"""Tests for HMAC-SHA256 origin shielding and URL verification."""

import time
from reanime import shield


def test_sign_and_verify():
    raw_url = "https://stream.cluster.io/hls/master.m3u8"
    signed_url = shield.sign(raw_url, ttl_seconds=3600)

    assert "t=" in signed_url
    assert "e=" in signed_url
    assert shield.validate_request(signed_url) is True


def test_tampered_token():
    raw_url = "https://stream.cluster.io/hls/master.m3u8"
    signed_url = shield.sign(raw_url, ttl_seconds=3600)

    # Tamper token
    tampered_url = signed_url.replace("t=", "t=tampered")
    assert shield.validate_request(tampered_url) is False


def test_tampered_url_path():
    raw_url = "https://stream.cluster.io/hls/master.m3u8"
    signed_url = shield.sign(raw_url, ttl_seconds=3600)

    # Change the path
    tampered_url = signed_url.replace("/master.m3u8", "/secret.m3u8")
    assert shield.validate_request(tampered_url) is False


def test_expired_token():
    raw_url = "https://stream.cluster.io/hls/master.m3u8"
    # Negative TTL to simulate an expired token
    expired_url = shield.sign(raw_url, ttl_seconds=-10)
    assert shield.validate_request(expired_url) is False


def test_unsigned_url():
    raw_url = "https://stream.cluster.io/hls/master.m3u8"
    assert shield.validate_request(raw_url) is False
