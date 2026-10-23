import { useState } from "react";
export default function DiscordContactButton({
  name,
  verifiedDiscordId,
}: {
  name: string;
  verifiedDiscordId?: string;
}) {
  const [message, setMessage] = useState("");
  if (!name) return null;
  return (
    <span className="cc-discord-contact">
      <button
        type="button"
        title="Discord-Benutzernamen kopieren"
        onClick={() =>
          void navigator.clipboard.writeText(name).then(
            () => setMessage("Kopiert"),
            () => setMessage("Kopieren nicht möglich"),
          )
        }
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M19.7 5.1a18 18 0 0 0-4.4-1.4l-.5 1a16 16 0 0 0-5.6 0l-.5-1a18 18 0 0 0-4.4 1.4C1.5 9.3.8 13.4 1.2 17.4a18 18 0 0 0 5.4 2.7l1.1-1.8-1.7-.8.4-.3a13 13 0 0 0 11.2 0l.4.3-1.7.8 1.1 1.8a18 18 0 0 0 5.4-2.7c.5-4.6-.8-8.7-3.1-12.3ZM8.3 14.9c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
        </svg>
        {name}
      </button>
      {verifiedDiscordId && /^\d{17,20}$/.test(verifiedDiscordId) && (
        <a
          href={`https://discord.com/users/${verifiedDiscordId}`}
          target="_blank"
          rel="noreferrer"
        >
          Discord öffnen
        </a>
      )}
      <small role="status">{message}</small>
    </span>
  );
}
