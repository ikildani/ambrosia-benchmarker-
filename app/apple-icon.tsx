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
          <g stroke="#3fb5c4" strokeLinecap="round" fill="none">
            <path d="M20 12 C 44 22, 44 42, 20 52" strokeWidth={6} />
            <path d="M44 12 C 20 22, 20 42, 44 52" strokeWidth={6} />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
