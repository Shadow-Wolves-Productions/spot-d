/**
 * Spot'd brand logo component.
 *
 * Uses the official Master Logo Badge — a self-contained rounded-square mark
 * with its own black background, cream wordmark, neon-yellow apostrophe and
 * yellow camera-lens "o". Because the badge carries its own background, a
 * single asset works on every theme (dark, light, on coloured banners) and
 * always reads cleanly. The historical `variant` prop is accepted for
 * backwards compatibility but no longer affects the rendered asset.
 *
 * `size`:   Tailwind height class or arbitrary `h-[NNpx]` — width is auto.
 */
export default function Logo({
  // eslint-disable-next-line no-unused-vars
  variant = "dark",
  className = "h-10 w-auto",
  "data-testid": testId,
  ...rest
}) {
  return (
    <img
      src="/brand/master-badge.png?v=3"
      alt="Spot'd — Cast · Crew · Companies · Indie Film · Visibility"
      className={className}
      data-testid={testId || "spotd-logo"}
      {...rest}
    />
  );
}
