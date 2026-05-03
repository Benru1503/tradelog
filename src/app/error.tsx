"use client";

import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Something broke.</h1>
        <p className="text-sm text-fg-muted">
          The error has been logged. Try again, or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-fg-muted">ref: {error.digest}</p>
        )}
        <div className="flex justify-center gap-2 pt-2">
          <Button onClick={reset}>Try again</Button>
          <a href="/dashboard">
            <Button variant="secondary">Go home</Button>
          </a>
        </div>
      </div>
    </main>
  );
}
