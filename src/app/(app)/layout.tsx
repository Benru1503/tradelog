import { Sidebar } from "@/components/layout/Sidebar";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar
        user={{
          displayName: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
