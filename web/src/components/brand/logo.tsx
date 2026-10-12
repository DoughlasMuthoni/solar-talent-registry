import Image from "next/image";
import { cn } from "@/lib/utils";

const VARIANTS = {
  /** Full logo with tagline and waves. Use at ≥320px wide (landing, sign-in, emails). */
  full: { light: "/brand/waterlift-logo.svg", dark: "/brand/waterlift-logo-dark.svg", width: 1166, height: 486 },
  /** "WATERLIFT SOLAR" only — sidebar, header, anything small. */
  wordmark: { light: "/brand/waterlift-wordmark.svg", dark: "/brand/waterlift-wordmark-dark.svg", width: 1156, height: 343 },
  /** Drop + A. Same artwork on both themes. */
  mark: { light: "/brand/waterlift-mark.svg", dark: "/brand/waterlift-mark.svg", width: 212, height: 212 },
} as const;

type LogoProps = { variant?: keyof typeof VARIANTS; className?: string; priority?: boolean };

/**
 * Theme-aware Waterlift Solar logo. Both images render and CSS shows the right one,
 * so there is no flash or hydration mismatch while next-themes resolves.
 */
export function Logo({ variant = "wordmark", className, priority }: LogoProps) {
  const v = VARIANTS[variant];
  const shared = { width: v.width, height: v.height, priority, unoptimized: true } as const;
  if (v.light === v.dark) {
    return <Image {...shared} src={v.light} alt="Waterlift Solar" className={cn("h-auto", className)} />;
  }
  return (
    <span className={cn("block", className)}>
      <Image {...shared} src={v.light} alt="Waterlift Solar" className="h-auto w-full dark:hidden" />
      {/* Only the light variant is preloaded; preloading both wastes a request and warns in the console. */}
      <Image {...shared} priority={false} src={v.dark} alt="Waterlift Solar" className="hidden h-auto w-full dark:block" />
    </span>
  );
}
