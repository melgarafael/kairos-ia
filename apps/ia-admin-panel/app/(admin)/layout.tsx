import { requireStaffSession } from "@/lib/auth/guards";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaffSession();

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar user={session.user} />
      {/* Main Content - Deferência ao conteúdo com espaçamento generoso */}
      <main className="flex-1 px-6 lg:px-10 py-8 lg:py-12 max-w-[1920px] mx-auto">
        {children}
      </main>
    </div>
  );
}

