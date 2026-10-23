import { LEGAL_VERSION, operator, privacy, terms } from "./legal-content";

export function LegalPage({ path }: { path: string }) {
  const title =
    path === "/impressum"
      ? "Impressum"
      : path === "/datenschutz"
        ? "Datenschutzerklärung"
        : "Nutzungsbedingungen";
  const sections =
    path === "/datenschutz"
      ? privacy
      : path === "/nutzungsbedingungen"
        ? terms
        : [];
  return (
    <main className="page-hero container legal-page">
      <nav aria-label="Rechtliche Informationen" className="legal-nav">
        <a href="/">Startseite</a>
        <a href="/impressum">Impressum</a>
        <a href="/datenschutz">Datenschutz</a>
        <a href="/nutzungsbedingungen">Nutzungsbedingungen</a>
      </nav>
      <h1>{title}</h1>
      <address style={{ fontStyle: "normal", lineHeight: 1.9 }}>
        <strong>{operator.project}</strong>
        <br />
        {operator.name}
        <br />
        {operator.address}
        <br />
        E-Mail: <a href={`mailto:${operator.email}`}>{operator.email}</a>
      </address>
      {sections.length > 0 && <p>Stand: {LEGAL_VERSION}</p>}
      {sections.map((section) => (
        <section
          key={section.title}
          style={{ marginTop: "2rem", maxWidth: "80ch" }}
        >
          <h2>{section.title}</h2>
          {section.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
