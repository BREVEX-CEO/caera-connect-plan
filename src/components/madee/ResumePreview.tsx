import type { ResumeContent } from "@/lib/madee-resume-types";

/**
 * Neutral single-column preview — deliberately restrained so ATS parsers
 * read it cleanly and print output stays deterministic across browsers.
 * Uses local greyscale styles so it renders identically in Dark / Light / REAL themes.
 */
export function ResumePreview({ resume, compact }: { resume: ResumeContent; compact?: boolean }) {
  const p = resume.personal;
  const contact = [p.email, p.phone, p.location, p.website].filter(Boolean);
  return (
    <article
      className={`resume-preview mx-auto ${compact ? "text-[13px]" : "text-[14px]"} leading-relaxed`}
      style={{
        background: "#ffffff",
        color: "#111111",
        padding: "42px 48px",
        maxWidth: "820px",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        boxShadow: "0 1px 3px rgba(0,0,0,.12)",
        borderRadius: 6,
      }}
    >
      <header style={{ textAlign: "center", marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
          {p.fullName || "Your name"}
        </h1>
        {p.headline && (
          <p style={{ margin: "4px 0 8px", fontStyle: "italic", color: "#374151" }}>
            {p.headline}
          </p>
        )}
        {contact.length > 0 && (
          <p style={{ margin: 0, color: "#374151", fontSize: 12 }}>{contact.join(" • ")}</p>
        )}
      </header>

      {resume.summary?.trim() && (
        <Section title="Summary">
          <p style={{ margin: 0 }}>{resume.summary}</p>
        </Section>
      )}

      {resume.work.length > 0 && (
        <Section title="Experience">
          {resume.work.map((w) => {
            const range = [w.start, w.current ? "Present" : w.end].filter(Boolean).join(" – ");
            return (
              <div key={w.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{[w.role, w.company].filter(Boolean).join(" — ") || "Role"}</strong>
                  {range && <span style={{ color: "#374151", fontSize: 12 }}>{range}</span>}
                </div>
                {w.location && (
                  <div style={{ color: "#374151", fontSize: 12 }}>{w.location}</div>
                )}
                {w.bullets.filter(Boolean).length > 0 && (
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                    {w.bullets.filter(Boolean).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </Section>
      )}

      {resume.education.length > 0 && (
        <Section title="Education">
          {resume.education.map((e) => {
            const range = [e.start, e.end].filter(Boolean).join(" – ");
            return (
              <div key={e.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{e.school || "School"}</strong>
                  {range && <span style={{ color: "#374151", fontSize: 12 }}>{range}</span>}
                </div>
                <div>{[e.degree, e.field].filter(Boolean).join(", ")}</div>
                {e.notes && <div style={{ color: "#374151" }}>{e.notes}</div>}
              </div>
            );
          })}
        </Section>
      )}

      {resume.skills.length > 0 && (
        <Section title="Skills">
          <p style={{ margin: 0 }}>{resume.skills.filter(Boolean).join(" • ")}</p>
        </Section>
      )}

      {resume.projects.length > 0 && (
        <Section title="Projects">
          {resume.projects.map((pr) => (
            <div key={pr.id} style={{ marginBottom: 10 }}>
              <strong>{[pr.name, pr.role].filter(Boolean).join(" — ") || "Project"}</strong>
              {pr.link && (
                <div style={{ color: "#374151", fontSize: 12 }}>{pr.link}</div>
              )}
              {pr.bullets.filter(Boolean).length > 0 && (
                <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                  {pr.bullets.filter(Boolean).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Section>
      )}

      {resume.certifications.length > 0 && (
        <Section title="Certifications">
          <ul style={{ margin: "0 0 0 18px", padding: 0 }}>
            {resume.certifications.map((c) => (
              <li key={c.id}>{[c.name, c.issuer, c.date].filter(Boolean).join(" — ")}</li>
            ))}
          </ul>
        </Section>
      )}

      {resume.achievements.length > 0 && (
        <Section title="Achievements">
          <ul style={{ margin: "0 0 0 18px", padding: 0 }}>
            {resume.achievements.filter(Boolean).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Section>
      )}

      {resume.languages.length > 0 && (
        <Section title="Languages">
          <p style={{ margin: 0 }}>
            {resume.languages
              .filter((l) => l.name)
              .map((l) => `${l.name} (${l.proficiency})`)
              .join(" • ")}
          </p>
        </Section>
      )}

      {resume.links.length > 0 && (
        <Section title="Links">
          <ul style={{ margin: "0 0 0 18px", padding: 0 }}>
            {resume.links.map((l) => (
              <li key={l.id}>{[l.label, l.url].filter(Boolean).join(": ")}</li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 16 }}>
      <h2
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1,
          margin: "0 0 6px",
          borderBottom: "1px solid #d1d5db",
          paddingBottom: 3,
          color: "#111827",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
