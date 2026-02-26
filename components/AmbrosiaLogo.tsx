import Image from "next/image";

interface AmbrosiaLogoProps {
  variant?: "color" | "reversed" | "auto";
  height?: number;
}

// Source image is 1920x400, so width = height * 4.8
export default function AmbrosiaLogo({ variant = "auto", height = 40 }: AmbrosiaLogoProps) {
  const width = Math.round(height * 4.8);

  if (variant === "auto") {
    return (
      <>
        <Image
          src="/logo-color.png"
          alt="Ambrosia Ventures"
          width={width}
          height={height}
          className="block dark:hidden"
          priority
        />
        <Image
          src="/logo-white.png"
          alt="Ambrosia Ventures"
          width={width}
          height={height}
          className="hidden dark:block"
          priority
        />
      </>
    );
  }

  const src = variant === "color" ? "/logo-color.png" : "/logo-white.png";

  return (
    <Image
      src={src}
      alt="Ambrosia Ventures"
      width={width}
      height={height}
      priority
    />
  );
}
