import { useState } from "react";
import { classAssets } from "@dofus/core";
import { Users } from "lucide-react";
export const classIllustrations = Object.fromEntries(
  Object.entries(classAssets).map(([id, asset]) => [
    id,
    {
      classId: Number(id),
      ...asset,
      large: asset.portrait,
      format: "portrait" as const,
      source:
        "Vom Benutzer bereitgestelltes Klassenarchiv; design/class-images/import-report.json",
      variants: [],
      fallback: "icon",
    },
  ]),
);
export default function ClassArtwork({
  classId,
  name,
  size = 96,
  hero = false,
}: {
  classId?: number | null;
  name: string;
  size?: number;
  hero?: boolean;
}) {
  const data = classId ? classIllustrations[classId] : undefined;
  const [failed, setFailed] = useState("");
  const url = hero ? data?.large : data?.icon;
  return (
    <span
      className={`class-artwork ${hero ? "class-artwork-hero" : ""}`}
      style={{
        width: hero ? undefined : size,
        height: hero ? undefined : size,
      }}
    >
      {url && failed !== url ? (
        <img
          src={url}
          alt={`${name} · Klassen${hero ? "portrait" : "symbol"}`}
          onError={() => setFailed(url)}
        />
      ) : (
        <Users size={Math.min(size, 80)} />
      )}
    </span>
  );
}
