"""Generate synthetic text images; no game screenshots or copyrighted guide material."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root = Path(__file__).parent / 'fixtures'
root.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 42)
fixtures = {
 'de': ['Questjournal', 'Prüfung des Schülers', 'Sprich mit dem Lehrer.', 'Sammle 3 blaue Blumen.'],
 'fr': ['Journal de quêtes', 'Épreuve de l’élève', 'Parlez au professeur.', 'Récoltez 3 fleurs bleues.'],
}
for language, lines in fixtures.items():
 image = Image.new('RGB', (1100, 380), 'white')
 draw = ImageDraw.Draw(image)
 for n, line in enumerate(lines): draw.text((45, 35 + n*75), line, fill='black', font=font)
 image.save(root / f'{language}.png')
Image.new('RGB', (1100,380), 'white').save(root / 'blank.png')
