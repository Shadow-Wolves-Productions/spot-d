import { Link } from "react-router-dom";

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20 prose-spotd">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Legal</p>
      <h1 className="font-display text-4xl font-500 text-foreground mt-2" style={{ letterSpacing: "-1px" }}>Terms of Service</h1>
      <p className="text-sm text-muted-foreground mt-2">Last updated: January 2026</p>

      <div className="mt-10 space-y-8 text-sm text-muted-foreground leading-[1.8]">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Who we are</h2>
          <p>Spot'd is a directory and discovery platform for independent film cast and crew, operated from New South Wales, Australia.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. Eligibility</h2>
          <p>You must be at least 18 years old to register an account. Profiles for minors must be managed by a parent, legal guardian, or authorised agent who consents on the minor's behalf and accepts these Terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. Accounts & passwordless sign-in</h2>
          <p>We use a one-time email code (OTP) to sign you in. You're responsible for keeping access to your email secure. Don't share codes.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. Subscriptions & payments</h2>
          <p>Paid plans (PRO, Elite) are billed via Stripe. Charges are in AUD unless otherwise stated. You can cancel any time; subscriptions remain active until the end of the paid period.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Content & conduct</h2>
          <p>You retain ownership of content you post. You grant Spot'd a non-exclusive licence to display it on the platform. You agree not to post unlawful, defamatory, or abusive content, and not to misrepresent your credits, identity, or association.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Minor / child performer safeguarding</h2>
          <p>All listings for performers under 18 must show a responsible adult contact (parent, legal guardian, or licensed agent). Direct contact with minors via the platform is prohibited; all communication must go through the listed adult.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. Third parties</h2>
          <p>We use Stripe (payments) and Postmark (transactional email). Use of those services is subject to their own terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">8. Termination</h2>
          <p>We may suspend or terminate accounts that breach these Terms. You may delete your profile from your dashboard at any time.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">9. Disclaimers & liability</h2>
          <p>The service is provided "as is". To the maximum extent permitted by law, Spot'd is not liable for indirect, incidental, or consequential damages.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">10. Governing law</h2>
          <p>These Terms are governed by the laws of New South Wales, Australia. Disputes will be resolved in the courts of NSW.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">11. Contact</h2>
          <p>Questions? Email <a className="underline hover:text-foreground" href="mailto:hello@getspotd.app">hello@getspotd.app</a>.</p>
        </section>

        <p className="text-xs"><Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link></p>
      </div>
    </div>
  );
}
