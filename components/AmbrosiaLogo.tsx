/* eslint-disable @next/next/no-img-element */

interface AmbrosiaLogoProps {
  variant: "color" | "reversed";
  height?: number;
}

export default function AmbrosiaLogo({ variant, height = 40 }: AmbrosiaLogoProps) {
  const src = variant === "color" ? "/logo-color.svg" : "/logo-white.svg";

  return (
    <img
      src={src}
      alt="Ambrosia Ventures"
      height={height}
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
