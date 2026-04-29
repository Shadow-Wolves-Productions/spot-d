import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Legal</p>
      <h1 className="font-display text-4xl font-500 text-foreground mt-2" style={{ letterSpacing: "-1px" }}>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mt-2">Last updated: January 2026</p>

      <div className="mt-10 space-y-8 text-sm text-muted-foreground leading-[1.8]">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Australian Privacy Principles</h2>
          <p>Spot'd handles personal information in accordance with the Australian <em>Privacy Act 1988 (Cth)</em> and the Australian Privacy Principles.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">What we collect</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Account info: email address, name, role, location, optional phone.</li>
            <li>Profile content: bio, headshots, showreel link, IMDb, credits, availability.</li>
            <li>Engagement data: profile views, contact reveals, casting applications.</li>
            <li>Payment metadata (handled by Stripe — we never store card numbers).</li>
            <li>Sign-in / verification codes (kept short-term; purged after use).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">How we use it</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>To run the directory, send role-alert notifications, and process payments.</li>
            <li>To compute SpotScore and surface relevant matches.</li>
            <li>To prevent abuse and enforce these Terms.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Third parties we share with</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Stripe</strong> — payment processing.</li>
            <li><strong>Postmark</strong> — transactional email delivery.</li>
          </ul>
          <p>We never sell your personal information.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Minor performers</h2>
          <p>Profiles for performers under 18 must be managed by a parent, guardian, or licensed agent. We never collect or display a minor's personal contact details — only the responsible adult's. All communication initiated through Spot'd for a minor must go through the listed adult.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Your rights</h2>
          <p>You can edit or delete your profile any time from the dashboard. To request a full data export or full deletion, email us.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Security</h2>
          <p>We use industry-standard encryption in transit (HTTPS), token-based sessions, and access controls. No system is perfectly secure, but we take it seriously.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2>
          <p>Privacy questions: <a className="underline hover:text-foreground" href="mailto:hello@getspotd.app">hello@getspotd.app</a>.</p>
        </section>

        <p className="text-xs"><Link to="/terms" className="underline hover:text-foreground">Terms of Service</Link></p>
      </div>
    </div>
  );
}
