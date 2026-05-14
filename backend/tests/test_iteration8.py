"""Iter 8 backend tests: /api/public-stats + /api/public-settings regression."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://spotd-casting.preview.emergentagent.com").rstrip("/")


# --- /api/public-stats ---
class TestPublicStats:
    def test_public_stats_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/public-stats")
        assert r.status_code == 200, r.text
        data = r.json()
        # exact key set
        for k in ("profile_count", "role_count", "casting_call_count", "founder_count", "founder_remaining"):
            assert k in data, f"missing key {k}"
            assert isinstance(data[k], int), f"{k} should be int, got {type(data[k])}"
        # no _id leak
        assert "_id" not in data

    def test_public_stats_no_negative(self):
        data = requests.get(f"{BASE_URL}/api/public-stats").json()
        assert data["profile_count"] >= 0
        assert data["role_count"] >= 0
        assert data["casting_call_count"] >= 0
        assert data["founder_count"] >= 0
        assert data["founder_remaining"] >= 0
        # founder_remaining + founder_count == 500 (clamped at >=0)
        if data["founder_count"] <= 500:
            assert data["founder_count"] + data["founder_remaining"] == 500

    def test_public_stats_no_auth_header_works(self):
        # Explicitly send no auth
        r = requests.get(f"{BASE_URL}/api/public-stats", headers={})
        assert r.status_code == 200


# --- /api/public-settings regression ---
class TestPublicSettings:
    def test_public_settings_shape(self):
        r = requests.get(f"{BASE_URL}/api/public-settings")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("founder_remaining", "email_mock", "sms_mock"):
            assert k in data, f"missing {k}"
        assert isinstance(data["founder_remaining"], int)
        assert isinstance(data["email_mock"], bool)
        assert isinstance(data["sms_mock"], bool)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
