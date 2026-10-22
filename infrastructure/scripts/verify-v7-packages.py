"""Check complete release ZIP CRCs and the exact shipped EXE/service payload."""
import hashlib
import json
import zipfile
from pathlib import Path
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[2]
version = json.loads((root / 'package.json').read_text(encoding='utf8'))['version']

def digest(data):
    return hashlib.sha256(data).hexdigest()

archives = []
for kind in ['setup', 'portable']:
    path = root / 'artifacts' / f'Dofus-Companion-{version}-{kind}.zip'
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, 'ZIP CRC check failed'
        names = {name.replace('\\', '/'): name for name in archive.namelist()}
        assert all('..' not in Path(name).parts and not name.startswith('/') for name in names)
        if kind == 'setup':
            installer = f'DOFUS-Companion-{version}-setup.exe'
            for name in [installer, installer + '.sig']:
                assert digest(archive.read(names[name])) == digest((root / 'artifacts' / name).read_bytes()), name
        else:
            checks = {
                'dofus-companion.exe': root / 'apps/desktop/src-tauri/target/release/dofus-companion.exe',
                'service/backend.mjs': root / 'apps/desktop/src-tauri/resources/backend.mjs',
                'service/world-data.json': root / 'packages/game-data/assets/world-data.json',
                'service/dungeon-data.json': root / 'packages/game-data/assets/dungeon-data.json',
            }
            for name, source in checks.items():
                assert digest(archive.read(names[name])) == digest(source.read_bytes()), name
            assert 'service/translator/python.exe' in names
            assert 'service/node.exe' in names
        archives.append({'name': path.name, 'entries': len(names), 'bytes': path.stat().st_size, 'crcVerified': True})
report = {'version': version, 'testedAt': datetime.now(timezone.utc).isoformat(), 'archives': archives,
          'exactExecutableAndServicePayloadVerified': True, 'setupContainsExactSignedInstaller': True}
(root / 'docs/packages-v7-test.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
print(json.dumps(report))
