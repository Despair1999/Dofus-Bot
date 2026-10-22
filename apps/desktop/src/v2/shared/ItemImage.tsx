import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { useGameAssets } from "../../gameAssets";
export default function ItemImage({
  url: explicitUrl,
  name: explicitName,
  item,
  size = 44,
  iconId,
  itemId,
}: {
  url?: string;
  name?: string;
  size?: number;
  iconId?: number;
  itemId?: number;
  item?: { imageUrl?: string; name: string };
}) {
  const assets = useGameAssets();
  const original = explicitUrl ?? item?.imageUrl;
  const icon =
    iconId ??
    (itemId ? assets?.itemIcons[String(itemId)] : undefined) ??
    Number(original?.match(/\/img\/item\/(\d+)-/)?.[1]);
  const url =
    assets?.items[String(icon)] ??
    original ??
    (icon
      ? `https://api.dofusdu.de/dofus3/v1/img/item/${icon}-64.png`
      : undefined);
  const name = explicitName ?? item?.name ?? "";
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? (
    <img
      className="v2-item-image"
      src={url}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className="v2-item-placeholder"
      style={{ width: size, height: size }}
      role="img"
      aria-label={name ? `Kein Bild für ${name}` : "Kein Bild vorhanden"}
    >
      <Package size={Math.max(16, size * 0.42)} />
    </span>
  );
}
