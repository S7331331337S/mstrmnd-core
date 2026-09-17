export default function HomePage() {
  return (
    <main style={{ padding: '80px 24px', maxWidth: 880, margin: '0 auto' }}>
      <p style={{ fontFamily: 'var(--f-mono)', fontSize: 11, letterSpacing: '0.2em', color: 'var(--mint)', textTransform: 'uppercase', margin: '0 0 24px' }}>
        // STATUS — ONLINE
      </p>
      <h1 style={{ fontFamily: 'var(--f-display)', fontWeight: 900, fontSize: 'clamp(48px, 10vw, 120px)', lineHeight: 0.95, letterSpacing: '-0.025em', margin: '0 0 32px' }}>
        MASTERBRAIN
      </h1>
      <p style={{ fontSize: 20, lineHeight: 1.5, color: 'var(--paper)', margin: '0 0 16px', maxWidth: '40ch' }}>
        The Council of Twelve as an operating system.
      </p>
      <p style={{ color: 'var(--muted)', margin: '0 0 48px' }}>
        15 archetypes. 6 closed-loop phases. Memory that compounds.
      </p>
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 32 }}>
        <p style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--muted)' }}>
          POST /api/signals/ingest → run the loop<br/>
          POST /api/canon/query → surface priors<br/>
          POST /api/canon/ingest → close the loop with an outcome
        </p>
      </div>
    </main>
  );
}
