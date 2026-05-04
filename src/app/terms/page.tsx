import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — TradeLog",
};

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 prose prose-invert">
      <Link href="/" className="text-sm text-fg-muted hover:text-fg">
        ← Home
      </Link>
      <h1>Terms of Service</h1>
      <p className="text-sm text-fg-muted">Last updated: 2026-04-27</p>

      <h2>What this is</h2>
      <p>
        TradeLog is a trading journal built for a small group of friends. By signing in you agree to
        the terms below. If you do not agree, do not sign in.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Use the app to log your own trades. Do not impersonate others.</li>
        <li>
          Do not attempt to access other users&apos; data, exploit security holes, or run automated
          tools that strain the service.
        </li>
        <li>Do not upload screenshots containing other people&apos;s personal data.</li>
      </ul>

      <h2>Not financial advice</h2>
      <p>
        Nothing in TradeLog is financial advice. The app is a record-keeping tool. P&amp;L numbers
        are computed from what you enter — verify against your broker before relying on them for
        anything that matters (taxes, performance reporting, decisions).
      </p>

      <h2>No warranty</h2>
      <p>
        The app is provided &quot;as is.&quot; We try to keep your data safe and the app available,
        but we make no guarantees. Always keep your own backups via the export feature in Settings.
      </p>

      <h2>Termination</h2>
      <p>
        You can delete your account from Settings at any time. The operator can revoke access if you
        abuse the service.
      </p>

      <h2>Contact</h2>
      <p>
        Email whoever invited you. See the <Link href="/privacy">Privacy Policy</Link> for what data
        we hold.
      </p>
    </main>
  );
}
