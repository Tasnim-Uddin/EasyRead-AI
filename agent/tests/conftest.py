import os, pathlib, sys
os.environ["EASYREAD_NO_DOTENV"] = "1"  # set before agent.main is imported: tests never read the repo .env
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch, tmp_path):
    for k in ("ANTHROPIC_API_KEY", "ANAM_API_KEY", "MONGODB_URI", "FAL_KEY", "ELEVENLABS_API_KEY",
              "ELEVENLABS_VOICE_ID", "ADAPTION_MODEL_ID"):
        monkeypatch.delenv(k, raising=False)
    from agent import tts
    monkeypatch.setattr(tts, "CACHE", tmp_path / "tts")
    from agent.main import app
    with TestClient(app) as c:
        yield c
