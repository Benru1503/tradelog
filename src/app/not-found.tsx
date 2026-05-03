import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-xs uppercase tracking-wider text-fg-muted">404</p>
        <h1 className="text-2xl font-semibold">Page not found.</h1>
        <p className="text-sm text-fg-muted">
          The link is wrong, or the trade was deleted.
        </p>
        <div className="pt-2">
          <Link href="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
