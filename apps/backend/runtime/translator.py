"""Companion JSON-lines worker. Network is used ONLY by explicit model installation.

Argos model packages, CTranslate2 CPU int8 inference and SentencePiece tokenization.
No Argos/Stanza dependency means inference cannot try to download a sentence splitter.
"""
import os
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")
import sys, json, pathlib, hashlib, zipfile, urllib.request, shutil, uuid, re, gc
from collections import OrderedDict

ROOT = pathlib.Path(sys.argv[1]).resolve()
ROOT.mkdir(parents=True, exist_ok=True)
SPECS = {
    "en-fr": ("1_9", "https://argos-net.com/v1/translate-en_fr-1_9.argosmodel"),
    "fr-en": ("1_9", "https://argos-net.com/v1/translate-fr_en-1_9.argosmodel"),
    "en-de": ("1_3", "https://argos-net.com/v1/translate-en_de-1_3.argosmodel"),
    "de-en": ("1_3", "https://argos-net.com/v1/translate-de_en-1_3.argosmodel"),
}
MODELS = OrderedDict()

def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)

def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def status():
    result = []
    for pair, (version, url) in SPECS.items():
        folder = ROOT / pair
        manifest = folder / "companion-manifest.json"
        installed = False
        size = 0
        try:
            info = json.loads(manifest.read_text("utf8"))
            installed = info["version"] == version and all(
                (folder / n).is_file() and (folder / n).stat().st_size == details["size"]
                for n, details in info["files"].items())
            size = sum(x["size"] for x in info["files"].values())
        except (OSError, ValueError, KeyError):
            pass
        result.append({"pair": pair, "version": version, "url": url,
                       "installed": installed, "bytes": size})
    return {"engine": "Argos / CTranslate2 CPU int8", "models": result,
            "ready": all(x["installed"] for x in result),
            "directions": ["de-en", "en-de", "fr-en", "en-fr", "de-fr", "fr-de"],
            "pivotDirections": ["de-fr", "fr-de"]}

def install(request_id):
    # Windows cannot replace model files while CTranslate2 holds their mappings.
    for translator, _tokenizer in MODELS.values():
        translator.unload_model()
    MODELS.clear()
    gc.collect()
    for model in status()["models"]:
        if model["installed"]:
            folder = ROOT / model["pair"]
            info = json.loads((folder / "companion-manifest.json").read_text("utf8"))
            if all(digest(folder / n) == details["sha256"] for n, details in info["files"].items()):
                continue
        pair = model["pair"]
        stage = ROOT / (".install-" + uuid.uuid4().hex)
        stage.mkdir()
        archive = stage / "download.argosmodel"
        try:
            download_request = urllib.request.Request(model["url"], headers={"User-Agent": "DOFUS-Companion/0.4 (local model setup)"})
            with urllib.request.urlopen(download_request, timeout=60) as response, archive.open("wb") as out:
                total = int(response.headers.get("Content-Length", 0))
                received = 0
                while True:
                    block = response.read(1024 * 512)
                    if not block:
                        break
                    received += len(block)
                    if received > 350 * 1024 * 1024:
                        raise ValueError("Sprachmodell überschreitet das Größenlimit.")
                    out.write(block)
                    emit({"id": request_id, "progress": {"pair": pair, "received": received, "total": total}})
            archive_hash = digest(archive)
            extract = stage / "unpacked"
            with zipfile.ZipFile(archive) as z:
                if sum(i.file_size for i in z.infolist()) > 800 * 1024 * 1024:
                    raise ValueError("Sprachmodell ist zu groß.")
                for name in z.namelist():
                    dest = (extract / name).resolve()
                    if not dest.is_relative_to(extract.resolve()):
                        raise ValueError("Ungültiger Pfad im Sprachmodell.")
                z.extractall(extract)
            entries = list(extract.glob("*/metadata.json"))
            if len(entries) != 1:
                raise ValueError("Unbekanntes Argos-Paketformat.")
            content = entries[0].parent
            meta = json.loads(entries[0].read_text("utf8"))
            if meta.get("from_code") + "-" + meta.get("to_code") != pair:
                raise ValueError("Das Sprachmodell hat eine falsche Sprachrichtung.")
            if not (content / "model/model.bin").is_file() or not (content / "sentencepiece.model").is_file():
                raise ValueError("Sprachmodell ist unvollständig.")
            # Validate the actual archive bytes and compiled model before activating.
            import ctranslate2, sentencepiece
            if not ctranslate2.contains_model(str(content / "model")):
                raise ValueError("Kein gültiges CTranslate2-Sprachmodell.")
            sentencepiece.SentencePieceProcessor(model_file=str(content / "sentencepiece.model"))
            files = {str(f.relative_to(content)): {"size": f.stat().st_size, "sha256": digest(f)}
                     for f in content.rglob("*") if f.is_file()}
            (content / "companion-manifest.json").write_text(json.dumps({
                "version": SPECS[pair][0], "archiveSha256": archive_hash, "files": files,
                "source": model["url"], "integrity": "HTTPS + ZIP CRC + local SHA256; no upstream digest published"}), "utf8")
            target = ROOT / pair
            if target.exists():
                shutil.rmtree(target)
            content.rename(target)
        finally:
            shutil.rmtree(stage, ignore_errors=True)
    return status()

def load(pair):
    if pair in MODELS:
        MODELS.move_to_end(pair)
        return MODELS[pair]
    folder = ROOT / pair
    try:
        info = json.loads((folder / "companion-manifest.json").read_text("utf8"))
        # Full integrity once per model load, not on every status poll.
        for name, details in info["files"].items():
            if digest(folder / name) != details["sha256"]:
                raise ValueError("Beschädigtes Sprachmodell. Bitte erneut installieren.")
    except (OSError, KeyError, ValueError) as error:
        raise ValueError("Sprachmodell fehlt oder ist beschädigt. Bitte Sprachmodelle installieren.") from error
    import ctranslate2, sentencepiece
    while len(MODELS) >= 2:
        MODELS.popitem(last=False)
    value = (ctranslate2.Translator(str(folder / "model"), device="cpu", compute_type="int8", intra_threads=2, inter_threads=1),
             sentencepiece.SentencePieceProcessor(model_file=str(folder / "sentencepiece.model")))
    MODELS[pair] = value
    return value

def direct(text, pair):
    translator, tokenizer = load(pair)
    # Preserve paragraphs without a downloadable sentence segmentation runtime.
    output = []
    for line in text.split("\n"):
        if not line.strip():
            output.append("")
            continue
        # Translate sentences separately: these small models can drop a preceding
        # sentence when given a whole chat paragraph. No remote SBD model needed.
        sentences = re.split(r"(?<=[.!?])\s+(?=[A-ZÀ-ÝÄÖÜ0-9])", line)
        translated = []
        for sentence in sentences:
            tokens = tokenizer.encode(sentence, out_type=str)
            if len(tokens) > 450:
                raise ValueError("Bitte kürzere Sätze verwenden (höchstens 450 Modell-Token pro Satz).")
            result = translator.translate_batch([tokens], beam_size=4, replace_unknowns=True, max_decoding_length=512)[0]
            # Argos packages sometimes carry literal SentencePiece space markers
            # in target vocabulary; upstream tokenizer performs this cleanup too.
            translated.append(tokenizer.decode(result.hypotheses[0]).replace("▁", " ").strip())
        output.append(" ".join(translated))
    return "\n".join(output)

def translate(req):
    source, target, text = req["source"], req["target"], req["text"]
    if source not in ("de", "en", "fr") or target not in ("de", "en", "fr") or source == target:
        raise ValueError("Bitte zwei unterschiedliche unterstützte Sprachen wählen.")
    if not isinstance(text, str) or not text.strip() or len(text) > 2000:
        raise ValueError("Bitte 1 bis 2000 Zeichen eingeben.")
    pair = source + "-" + target
    preserve_cra = re.search(r"\bcr[aâ]\b", text, flags=re.I) is not None
    # Small transparent gaming glossary; the neural model still translates all
    # sentences. No placeholder injection that could corrupt model grammar.
    if source == "fr":
        text = re.sub(r"\bdj\b", "donjon", text, flags=re.I)
    expansions = {
        "fr": {"PA": "points d'action", "PM": "points de mouvement"},
        "de": {"AP": "Aktionspunkte", "MP": "Bewegungspunkte"},
        "en": {"AP": "action points", "MP": "movement points"},
    }
    for key, expanded in expansions[source].items():
        text = re.sub(r"\b" + key + r"\b", expanded, text)
    pivot = pair not in SPECS
    if pivot:
        output = direct(direct(text, source + "-en"), "en-" + target)
    else:
        output = direct(text, pair)
    contractions = {
        "de": {r"Aktionspunkte[n]?": "AP", r"Bewegungspunkte[n]?": "MP"},
        "en": {r"action points": "AP", r"movement points": "MP"},
        "fr": {r"points d['’]action": "PA", r"points de mouvement": "PM"},
    }
    for expression, acronym in contractions[target].items():
        output = re.sub(r"\b" + expression + r"\b", acronym, output, flags=re.I)
    if preserve_cra:
        output = re.sub(r"\bcr[aâ]e?\b", "Cra", output, flags=re.I)
    return {"text": output, "source": source, "target": target, "pivot": pivot, "engine": "Argos / CTranslate2 CPU int8"}

for line in sys.stdin:
    request_id = None
    try:
        req = json.loads(line)
        request_id = req["id"]
        op = req["op"]
        result = status() if op == "status" else install(request_id) if op == "install" else translate(req) if op == "translate" else None
        if result is None:
            raise ValueError("Unbekannter Worker-Befehl.")
        emit({"id": request_id, "result": result})
    except Exception as error:
        emit({"id": request_id, "error": str(error)})
