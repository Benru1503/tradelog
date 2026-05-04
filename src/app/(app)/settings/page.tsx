import Link from "next/link";
import { Download, LogOut } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { TagManager } from "@/components/tags/TagManager";

export default async function SettingsPage() {
  const user = await requireUser();
  const tags = await prisma.tag.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Settings" subtitle="Profile, data, and account." />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Profile</CardTitle>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="ghost" size="sm">
                <LogOut size={14} /> Sign out
              </Button>
            </form>
          </div>
        </CardHeader>
        <dl className="text-sm space-y-3">
          <div className="flex justify-between border-b border-border pb-2">
            <dt className="text-fg-muted">Display name</dt>
            <dd>{user.displayName ?? "—"}</dd>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <dt className="text-fg-muted">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-muted">Joined</dt>
            <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <TagManager tags={tags} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
        </CardHeader>
        <p className="text-sm text-fg-muted mb-3">
          Download everything: trades, tags, edit history, and account info.
        </p>
        <div className="flex gap-2">
          <a href="/api/export" download>
            <Button variant="secondary">
              <Download size={14} /> Export as JSON
            </Button>
          </a>
          <a href="/api/export/csv" download>
            <Button variant="secondary">
              <Download size={14} /> Export as CSV
            </Button>
          </a>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legal</CardTitle>
        </CardHeader>
        <ul className="text-sm space-y-1">
          <li><Link href="/privacy" className="hover:underline">Privacy Policy</Link></li>
          <li><Link href="/terms" className="hover:underline">Terms of Service</Link></li>
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
        </CardHeader>
        <DeleteAccountDialog />
      </Card>
    </div>
  );
}
