export async function prepareEmblem(file: File): Promise<Blob> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5000000
  )
    throw Error("Bitte PNG, JPEG oder WebP bis 5 MB wählen.");
  const bitmap = await createImageBitmap(file);
  try {
    if (
      bitmap.width < 1 ||
      bitmap.height < 1 ||
      bitmap.width > 8192 ||
      bitmap.height > 8192 ||
      bitmap.width * bitmap.height > 16000000
    )
      throw Error(
        "Bild ist zu groß: maximal 16 Megapixel und 8192 Pixel pro Seite.",
      );
    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Bildverarbeitung ist nicht verfügbar.");
    const scale = Math.min(192 / bitmap.width, 192 / bitmap.height);
    ctx.clearRect(0, 0, 192, 192);
    ctx.drawImage(
      bitmap,
      (192 - bitmap.width * scale) / 2,
      (192 - bitmap.height * scale) / 2,
      bitmap.width * scale,
      bitmap.height * scale,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(Error("Wappen konnte nicht konvertiert werden.")),
        "image/webp",
        0.8,
      ),
    );
    if (blob.type !== "image/webp" || blob.size > 200000)
      throw Error("Wappen muss als WebP bis 200 KB vorliegen.");
    return blob;
  } finally {
    bitmap.close();
  }
}
