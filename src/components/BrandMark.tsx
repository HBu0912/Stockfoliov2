"use client";

export function BrandMark({
  size = "md",
  withName = true,
}: {
  size?: "sm" | "md" | "lg";
  withName?: boolean;
}) {
  const icon = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-8 w-8" : "h-6 w-6";
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";
  return (
    <span className="inline-flex items-center gap-2 text-(--accent)">
      <svg viewBox="0 0 32 32" className={icon} fill="none" aria-hidden>
        <path
          d="M3 21L9 15L13 18L20 9L24 14L29 8"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M3 27H29" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="29" cy="8" r="2.2" fill="currentColor" />
      </svg>
      {withName ? <span className={`${text} font-semibold tracking-tight`}>Stockfolio</span> : null}
    </span>
  );
}
