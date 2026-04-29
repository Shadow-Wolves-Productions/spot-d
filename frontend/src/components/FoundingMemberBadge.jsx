/**
 * Founding Member badge — pill with electric-yellow background, dark text,
 * leading diamond glyph.
 *
 * Renders when EITHER:
 *   - `isFoundingMember` prop is truthy (preferred — set on the User record
 *     so a user keeps the badge regardless of their billing tier)
 *   - or legacy: `tier === "founder"` (old direct-from-subscription path)
 */
export default function FoundingMemberBadge({ tier, isFoundingMember, className = "" }) {
  const show = !!isFoundingMember || tier === "founder";
  if (!show) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${className}`}
      style={{ backgroundColor: "#E8FC6C", color: "#0D0D0D" }}
      data-testid="founding-member-badge"
      title="Founding Member — locked in lifetime free PRO"
    >
      <span aria-hidden="true" style={{ fontSize: 10, lineHeight: 1 }}>◆</span>
      Founding Member
    </span>
  );
}
