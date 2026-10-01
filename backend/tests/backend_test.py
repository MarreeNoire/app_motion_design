"""Backend tests for Agnes Motion Studio API."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://motion-prompt-ai-1.preview.emergentagent.com").rstrip("/")
VALID_KEY = "sk-vYLHAgwoxEGYLhlLkMx3Qm89DmAnrVxGnTQR2h3WMYwEbiDy"


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- /api/agnes/validate ----------
class TestValidate:
    def test_valid_key(self, api):
        r = api.post(f"{BASE_URL}/api/agnes/validate", json={"api_key": VALID_KEY}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["valid"] is True
        assert isinstance(data.get("message"), str) and len(data["message"]) > 0
        # models key optional but should be a list when present
        if "models" in data:
            assert isinstance(data["models"], list)

    def test_invalid_key(self, api):
        r = api.post(f"{BASE_URL}/api/agnes/validate", json={"api_key": "bad-key"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["valid"] is False
        assert isinstance(data["message"], str) and len(data["message"]) > 0

    def test_missing_key(self, api):
        r = api.post(f"{BASE_URL}/api/agnes/validate", json={"api_key": ""}, timeout=30)
        assert r.status_code == 400
        data = r.json()
        assert "detail" in data
        assert "Clé" in data["detail"] or "clé" in data["detail"].lower()


# ---------- /api/agnes/storyboard ----------
class TestStoryboard:
    def test_storyboard_30s(self, api):
        payload = {
            "api_key": VALID_KEY,
            "prompt": "Publicité motion design pour appli de livraison rapide",
            "duration": 30,
            "aspect_ratio": "16:9",
            "brand_name": "SwiftDelivery",
        }
        r = api.post(f"{BASE_URL}/api/agnes/storyboard", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["source"] == "agnes-ai"
        assert data["duration"] == 30
        scenes = data["scenes"]
        assert len(scenes) == 5
        total = 0
        for sc in scenes:
            assert {"start", "end", "duration", "headline", "keywords"}.issubset(sc.keys())
            total += sc["duration"]
        assert abs(total - 30) < 0.5
        assert abs(scenes[-1]["end"] - 30) < 0.5

    def test_storyboard_60s(self, api):
        payload = {
            "api_key": VALID_KEY,
            "prompt": "Publicité motion design pour application fitness premium",
            "duration": 60,
            "aspect_ratio": "16:9",
            "brand_name": "FitPro",
        }
        r = api.post(f"{BASE_URL}/api/agnes/storyboard", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["duration"] == 60
        scenes = data["scenes"]
        assert len(scenes) == 7
        assert abs(scenes[-1]["end"] - 60) < 0.5

    def test_storyboard_missing_key(self, api):
        r = api.post(
            f"{BASE_URL}/api/agnes/storyboard",
            json={"api_key": "", "prompt": "x", "duration": 30},
            timeout=30,
        )
        assert r.status_code == 400
