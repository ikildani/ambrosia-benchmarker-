import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: '#0a0d1b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width={180}
          height={180}
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g stroke="#5fd4e3" strokeLinecap="round" fill="none">
            <path d="M20 12 C 44 22, 44 42, 20 52" strokeWidth={5} />
            <path d="M44 12 C 20 22, 20 42, 44 52" strokeWidth={5} />
            <line x1={25} y1={18} x2={39} y2={18} strokeWidth={3} opacity={0.55} />
            <line x1={25} y1={46} x2={39} y2={46} strokeWidth={3} opacity={0.55} />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
