export type Language = "de" | "en" | "fr";
export type TranslatorPreferences = {
  source: Language;
  target: Language;
  automatic: boolean;
  minimized: boolean;
};
export const languageNames: Record<Language, string> = {
  de: "Deutsch",
  en: "Englisch",
  fr: "Französisch",
};
export function translatorDefaults(outgoing = false): TranslatorPreferences {
  return {
    source: outgoing ? "de" : "fr",
    target: outgoing ? "fr" : "de",
    automatic: false,
    minimized: false,
  };
}
export function normalizeTranslator(
  raw: Partial<TranslatorPreferences> | undefined,
  outgoing = false,
): TranslatorPreferences {
  const defaults = translatorDefaults(outgoing);
  const source =
    raw?.source && raw.source in languageNames ? raw.source : defaults.source;
  const target =
    raw?.target && raw.target in languageNames && raw.target !== source
      ? raw.target
      : source === "de"
        ? "fr"
        : "de";
  return {
    source,
    target,
    automatic: raw?.automatic === true,
    minimized: raw?.minimized === true,
  };
}
