"""Actual downloaded-model integration test; refuses network during inference.

Run with bundled Python and PYTHONPATH pointing at companion-deps. Optional
COMPANION_ARGOS_ARCHIVES uses already downloaded official packages for setup.
"""
import pathlib, os, sys, importlib.util, io, json, time, socket
sys.stdout.reconfigure(encoding="utf8")
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.argv = [str(ROOT / "apps/backend/runtime/translator.py"), str(ROOT / ".data/translation-models")]
sys.stdin = io.StringIO("")
spec = importlib.util.spec_from_file_location("companion_translator", ROOT / "apps/backend/runtime/translator.py")
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
archive_folder = os.environ.get("COMPANION_ARGOS_ARCHIVES")
if archive_folder:
    for pair, (version, url) in list(worker.SPECS.items()):
        archive = pathlib.Path(archive_folder).resolve() / ("translate-" + pair.replace("-", "_") + ".argosmodel")
        if archive.exists():
            worker.SPECS[pair] = (version, archive.as_uri())
worker.install("setup")
def denied(*args, **kwargs):
    raise AssertionError("External network access during offline translation")
socket.socket = denied
socket.create_connection = denied
messages = {
    "de": "Kannst du mir helfen, die Quest abzuschließen? Ich bin in fünf Minuten bereit.",
    "en": "I need help with the dungeon boss. I will be ready in five minutes.",
    "fr": "Salut, tu veux venir faire le donjon avec nous ? Je suis prêt dans cinq minutes.",
}
results = []
for source in messages:
    for target in messages:
        if source == target: continue
        start = time.monotonic()
        result = worker.translate({"source": source, "target": target, "text": messages[source]})
        assert result["text"].strip() and result["text"] != messages[source]
        assert "▁" not in result["text"]
        assert "5" in result["text"] or any(word in result["text"].lower() for word in ("five", "fünf", "cinq"))
        result["elapsedSeconds"] = round(time.monotonic() - start, 3)
        results.append(result)
for text in ["On cherche un cra pour le dj.", "T'as combien de PA et PM ?", "Rendez-vous à [21,14] dans 5 minutes."]:
    result = worker.translate({"source": "fr", "target": "de", "text": text})
    results.append({**result, "input": text})
report = {"testedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "networkBlockedDuringInference": True,
          "directions": 6, "status": worker.status(), "results": results}
(ROOT / ".data/translator-offline-results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), "utf8")
print(json.dumps(report, ensure_ascii=False, indent=2))
