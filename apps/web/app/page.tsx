import './globals.css';

interface HealthBody {
  status: string;
  service: string;
  version: string;
  checks: Record<string, string>;
}

const API_HEALTH_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3100';

async function getHealth(): Promise<{ body?: HealthBody; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${API_HEALTH_URL}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!response.ok) return { error: `API responded with ${response.status}` };
    return { body: (await response.json()) as HealthBody };
  } catch {
    return { error: 'API unreachable — is the API running? (npm run dev)' };
  }
}

const LABEL: Record<string, string> = {
  database: 'PostgreSQL',
  redis: 'Redis',
  ollama: 'Ollama',
};

export default async function Home() {
  const { body, error } = await getHealth();
  const health = body?.checks ?? {};

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <header>
        <h1 style={{ marginBottom: '0.25rem' }}>Jobs Applications</h1>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Local-first AI job discovery, matching and application assistant.
        </p>
      </header>

      <section
        style={{
          marginTop: '1.5rem',
          padding: '1.25rem',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>System health</h2>
        {error ? (
          <p style={{ color: 'var(--bad)' }}>{error}</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {Object.entries(health).map(([key, value]) => (
              <li key={key} style={{ padding: '0.35rem 0', display: 'flex', justifyContent: 'space-between' }}>
                <span>{LABEL[key] ?? key}</span>
                <span style={{ color: value === 'ok' ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>
                  {value}
                </span>
              </li>
            ))}
          </ul>
        )}
        {body && !error && (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 0 }}>
            API v{body.version} · status {body.status}
          </p>
        )}
      </section>

      <section style={{ marginTop: '2rem', color: 'var(--muted)' }}>
        <p>Web dashboard UI is not built yet — the API exposes listing routes for the planned MUI dashboard.</p>
        <p>
          Docs: <code>README.md</code> · Developer guide: <code>DEVELOPMENT.md</code>
        </p>
      </section>
    </main>
  );
}