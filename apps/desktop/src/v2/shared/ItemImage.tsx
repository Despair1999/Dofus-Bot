import { useEffect, useState } from "react";
import { recordAssetFailure } from "../../ui/assetDiagnostics";
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
  const candidates = [
    ...new Set(
      [
        assets?.items[String(icon)],
        original,
        icon
          ? `https://api.dofusdu.de/dofus3/v1/img/item/${icon}-64.png`
          : undefined,
      ].filter((v): v is string => !!v),
    ),
  ];
  const key = candidates.join("|");
  const [attempt, setAttempt] = useState({ key, index: 0 });
  const index = attempt.key === key ? attempt.index : 0;
  const url = candidates[index];
  const name = explicitName ?? item?.name ?? "";
  useEffect(() => setAttempt({ key, index: 0 }), [key]);
  return url ? (
    <img
      className="v2-item-image"
      src={url}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => {
        recordAssetFailure(url);
        setAttempt({ key, index: index + 1 });
      }}
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
