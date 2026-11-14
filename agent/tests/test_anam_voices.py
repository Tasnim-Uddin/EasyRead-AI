import importlib.util, pathlib

spec = importlib.util.spec_from_file_location("anam_voices", pathlib.Path(__file__).resolve().parents[2] / "tools" / "anam_voices.py")
av = importlib.util.module_from_spec(spec)
spec.loader.exec_module(av)

V = [
    {"id": "1", "displayName": "Marta", "provider": "CARTESIA", "gender": "FEMALE", "description": "Warm and calm", "languages": ["es"]},
    {"id": "2", "displayName": "Luis", "provider": "CARTESIA", "gender": "MALE", "description": "Energetic", "languages": ["es"]},
    {"id": "3", "displayName": "Ana", "provider": "ELEVENLABS", "gender": "FEMALE", "description": None, "languages": ["es", "pl"]},
    {"id": "4", "displayName": "Zara", "provider": "FISH_AUDIO", "gender": "FEMALE", "description": "friendly", "languages": ["ar"]},
]


def test_candidates_filter_and_rank():
    es = av.candidates(V, "es", 2)
    assert [v["id"] for v in es] == ["1", "3"]
    assert [v["id"] for v in av.candidates(V, "pl")] == ["3"]
    assert av.candidates(V, "bn") == []


def test_fetch_all_paginates():
    pages = {1: {"data": V[:2], "meta": {"next": 2}}, 2: {"data": V[2:], "meta": {"next": None}}}

    class R:
        def __init__(self, b): self.b = b
        def raise_for_status(self): pass
        def json(self): return self.b

    class C:
        def get(self, url, params=None, headers=None):
            assert headers["Authorization"] == "Bearer k" and params["perPage"] == 100
            return R(pages[params["page"]])

    assert len(av.fetch_all("k", C())) == 4


def test_main_needs_key(monkeypatch):
    monkeypatch.delenv("ANAM_API_KEY", raising=False)
    assert av.main([]) == 1
