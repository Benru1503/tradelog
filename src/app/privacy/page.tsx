import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — TradeLog",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 prose prose-invert">
      <Link href="/" className="text-sm text-fg-muted hover:text-fg">
        ← Home
      </Link>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-fg-muted">Last updated: 2026-08-13</p>

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
          <strong>Auth cookies.</strong> Supabase sets cookies on your browser so you stay signed
          in. Sign out from settings to clear them.
        </li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        TradeLog is not self-contained. These services receive some of your data in the course of
        running the app:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> (EU, Frankfurt) hosts the database and handles sign-in. All
          trades, notes, and account details are stored there.
        </li>
        <li>
          <strong>Market data providers</strong> (Finnhub, CoinGecko, Yahoo Finance) receive the
          ticker symbols you search for or hold, so we can fetch prices and charts. They do not
          receive your position sizes, P&amp;L, or notes. These requests are made from our server,
          never from your browser.
        </li>
        <li>
          <strong>Google Gemini</strong> — only if you use the <Link href="/coach">Coach</Link>, and
          only when you press the button to generate a report. It is never called automatically. See
          below for exactly what is sent.
        </li>
      </ul>

      <h2>The Coach and your journal</h2>
      <p>
        The Coach reviews your trading history using Google&apos;s Gemini model. When you run it, we
        send a computed summary of your account: asset names, profit and loss figures, trade dates,
        tag names, and <strong>excerpts of the free-text notes you wrote on your trades</strong>.
        Your email, name, and avatar are not included.
      </p>
      <p>
        The project currently uses Google&apos;s free API tier. On that tier, Google may use
        submitted content to improve their products, which can include human review. If you would
        rather your journal notes never leave this app, simply do not use the Coach — every other
        feature works without it.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your data, ever.</li>
        <li>We do not share it with anyone beyond the services listed above.</li>
        <li>We do not run third-party advertising trackers.</li>
        <li>We do not have access to your brokerage accounts — you enter trades manually.</li>
        <li>We do not use error-tracking or analytics services.</li>
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
          <strong>Questions.</strong> Email the operator (whoever invited you) to ask about your
          data.
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
