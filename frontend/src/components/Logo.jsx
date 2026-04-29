/**
 * Spot'd brand logo component.
 * Uses the official dark-mode transparent lockup (yellow "o" camera-lens,
 * cream letters on transparent bg) at all sizes. The logo file includes the
 * tagline strip which renders at large sizes — at navbar sizes the strip is
 * naturally tiny and reads as visual texture rather than legible copy.
 *
 * `variant`: "dark" (default) — light letters, yellow lens (for dark bg)
 *            "light" — dark letters, orange lens (for light bg, rarely used)
 * `size`:   Tailwind height class or arbitrary `h-[NNpx]` — width is auto.
 */
export default function Logo({
  variant = "dark",
  className = "h-10 w-auto",
  "data-testid": testId,
  ...rest
}) {
  const src = variant === "light"
    ? "/brand/light-transparent.png?v=2"
    : "/brand/dark-transparent.png?v=2";
  return (
    <img
      src={src}
      alt="Spot'd — Cast · Crew · Companies · Indie Film · Visibility"
      className={className}
      data-testid={testId || "spotd-logo"}
      {...rest}
    />
  );
}
