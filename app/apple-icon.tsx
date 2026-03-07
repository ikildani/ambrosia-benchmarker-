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
          background: 'linear-gradient(135deg, #141732, #0c0e1f)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            background: 'linear-gradient(135deg, #34c2c2, #0EA5A5, #0c8e8e)',
            backgroundClip: 'text',
            color: '#34c2c2',
          }}
        >
          DT
        </span>
      </div>
    ),
    { ...size }
  );
}
