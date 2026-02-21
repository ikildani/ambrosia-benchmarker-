/* eslint-disable @next/next/no-img-element */

interface AmbrosiaLogoProps {
  variant?: "color" | "reversed" | "auto";
  height?: number;
}

export default function AmbrosiaLogo({ variant = "auto", height = 40 }: AmbrosiaLogoProps) {
  if (variant === "auto") {
    return (
      <>
        <img
          src="/logo-color.svg"
          alt="Ambrosia Ventures"
          height={height}
          style={{ height, width: "auto" }}
          className="block dark:hidden"
        />
        <img
          src="/logo-white.svg"
          alt="Ambrosia Ventures"
          height={height}
          style={{ height, width: "auto" }}
          className="hidden dark:block"
        />
      </>
    );
  }

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
