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
          <path
            fillRule="evenodd"
            fill="#3fb5c4"
            d="M32 10 L50 54 L42 54 L37 42 L27 42 L22 54 L14 54 Z M28 38 L36 38 L32 22 Z"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
