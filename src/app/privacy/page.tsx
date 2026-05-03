import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — TradeLog",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 prose prose-invert">
      <Link href="/" className="text-sm text-fg-muted hover:text-fg">← Home</Link>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-fg-muted">Last updated: 2026-04-27</p>

      <p>
        TradeLog is a private trading journal used by a small group of friends. This page describes
        what we collect, why, and what you can do about it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account info from Google.</strong> When you sign in with Google we receive your
          email, name, and avatar URL. We store these so we can show you who you are.
        </li>
        <li>
          <strong>Trades you log.</strong> Asset, prices, quantity, dates, fees, notes, and any
          screenshots you attach. These are private to your account by default.
        </li>
        <li>
          <strong>Edit history.</strong> When you change a trade, we keep a record of the old and
          new values so the journal stays honest.
        </li>
        <li>
          <strong>Auth cookies.</strong> Supabase sets cookies on your browser so you stay signed in.
          Sign out from settings to clear them.
        </li>
        <li>
          <strong>Error and performance data.</strong> If the app crashes for you, Sentry receives a
          stack trace and your user ID. We use this only to fix bugs.
        </li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell or share your data with anyone.</li>
        <li>We do not run third-party advertising trackers.</li>
        <li>We do not have access to your brokerage accounts — you enter trades manually.</li>
      </ul>

      <h2>Your rights</h2>
      <ul>
        <li>
          <strong>Export.</strong> Download all of your data as JSON or CSV from{" "}
          <Link href="/settings">Settings</Link>.
        </li>
        <li>
          <strong>Delete.</strong> Permanently delete your account and all associated trades, tags,
          and revisions from Settings. This cannot be undone.
        </li>
        <li>
          <strong>Questions.</strong> Email the operator (whoever invited you) to ask about your data.
        </li>
      </ul>

      <h2>Changes</h2>
      <p>
        If anything material changes — new data we collect, a new third-party service — we will
        update this page and post a note in the app.
      </p>
    </main>
  );
}
