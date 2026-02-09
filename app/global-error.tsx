'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(to bottom, #0a1628, #060e1a)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          {/* Plain img — providers unavailable at root error boundary */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-white.png"
            alt="Ambrosia Ventures"
            height={40}
            style={{ height: 40, width: 'auto', display: 'block' }}
          />

          <div style={{ marginTop: 40, textAlign: 'center', maxWidth: 400 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
              Something Went Wrong
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: 32 }}>
              A critical error occurred. Please try again.
            </p>

            <button
              onClick={reset}
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(to right, #14b8a6, #06b6d4)',
                color: '#fff',
                fontWeight: 600,
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
