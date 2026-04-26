import { requireUser } from "@/lib/auth";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-fg-muted mt-1">
          Profile and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
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
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <p className="text-sm text-fg-muted">
          Display name editing, default asset type, and currency preferences land in Phase 2.
        </p>
      </Card>
    </div>
  );
}
