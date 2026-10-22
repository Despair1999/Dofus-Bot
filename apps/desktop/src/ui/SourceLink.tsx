import { ExternalLink } from "lucide-react";
import { openExternal } from "../native";
export default function SourceLink({
  url,
  label = "DofusPourLesNoobs",
}: {
  url?: string;
  label?: string;
}) {
  if (!url || !/^https:\/\//.test(url)) return null;
  return (
    <a
      className="external-source-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault();
        void openExternal(url);
      }}
    >
      Quelle: {label} <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}
