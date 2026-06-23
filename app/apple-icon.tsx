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
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 120,
            fontWeight: 700,
            fontFamily: 'Georgia, Times New Roman, serif',
            color: '#0f172a',
            letterSpacing: '-4px',
          }}
        >
          AV
        </span>
      </div>
    ),
    { ...size }
  );
}
