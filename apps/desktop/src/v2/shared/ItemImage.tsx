import { useEffect, useState } from "react";
import { Package } from "lucide-react";
export default function ItemImage({
  url,
  name = "",
  size = 44,
}: {
  url?: string;
  name?: string;
  size?: number;
}) {
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
