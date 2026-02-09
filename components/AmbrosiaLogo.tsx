import Image from "next/image";

interface AmbrosiaLogoProps {
  variant: "color" | "reversed";
  height?: number;
}

// Actual image ratio: 1040×216 = 4.815:1
const ASPECT_RATIO = 1040 / 216;

export default function AmbrosiaLogo({ variant, height = 40 }: AmbrosiaLogoProps) {
  const src = variant === "color" ? "/logo-color.png" : "/logo-white.png";
  const width = Math.round(height * ASPECT_RATIO);

  return (
    <div style={{ position: "relative", width, height, flexShrink: 0 }}>
      <Image
        src={src}
        alt="Ambrosia Ventures"
        fill
        sizes={`${width}px`}
        priority
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}
