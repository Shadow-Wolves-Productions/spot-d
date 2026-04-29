/**
 * Founding Member badge — pill with electric-yellow background, dark text,
 * and a leading diamond glyph. Renders only when `tier === "founder"`.
 *
 * Pass-through props for spacing/alignment (`className`).
 */
export default function FoundingMemberBadge({ tier, className = "" }) {
  if (tier !== "founder") return null;
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
