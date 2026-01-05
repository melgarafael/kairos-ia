import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-session";
import { listAiMemories } from "@/lib/kairos/ai-memories";
import { listDailyLogs } from "@/lib/kairos/daily-logs";
import { getHumanDesignProfile } from "@/lib/kairos/human-design";
import { 
  MorningCard, 
  QuickActions, 
  StrategyReminder, 
  RecentActivity 
} from "@/components/dashboard";

/**
 * Dashboard Principal — "Acordar Digital"
 * 
 * Filosofia Jobs:
 * - Primeiros 10 segundos: faz alguém dizer "uau"
 * - Uma decisão clara substitui 10 configurações
 * - Estados vazios que ensinam
 * - Mobile-first
 * 
 * Human Design:
 * - Cada tipo acorda de forma diferente
 * - Estratégia + Autoridade como núcleo
 * - Dashboard personalizado por design
 */

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const userId = user?.id;

  if (!userId) {
    redirect("/login");
  }

  // Fetch all data in parallel
  const [profile, memories, logs] = await Promise.all([
    getHumanDesignProfile(userId),
    listAiMemories(userId, { limit: 3 }),
    listDailyLogs(userId, { limit: 3 })
  ]);

  // Redirect to onboarding if no Human Design profile
  if (!profile || !profile.tipo) {
    redirect("/onboarding");
  }

  // Get user name (fallback to email prefix)
  const userName = user?.user_metadata?.name 
    || user?.user_metadata?.full_name
    || user?.email?.split("@")[0];

  // Check if user has logged today
  const today = new Date().toISOString().split("T")[0];
  const hasLoggedToday = logs.some(log => 
    (log.data ?? log.created_at.split("T")[0]) === today
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* 
        Layout Mobile-First:
        - Stack vertical em mobile
        - Grid em desktop
        - Generoso em espaçamento
      */}
      <div className="flex-1 space-y-6 md:space-y-8 pb-safe">
        {/* Hero: Morning Card — O primeiro "uau" */}
        <MorningCard
          tipo={profile.tipo}
          userName={userName}
        />

        {/* 
          Grid secundário:
          - Mobile: stack vertical
          - Desktop: 2 columns (2/3 + 1/3)
        */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <QuickActions
              tipo={profile.tipo}
              hasRecentLog={hasLoggedToday}
            />

            {/* Recent Activity - Desktop only inline */}
            <div className="lg:hidden">
              <RecentActivity
                logs={logs}
                memories={memories}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Strategy Reminder */}
            <StrategyReminder
              tipo={profile.tipo}
              estrategia={profile.estrategia}
              autoridade={profile.autoridade}
            />

            {/* Recent Activity - Desktop only */}
            <div className="hidden lg:block">
              <RecentActivity
                logs={logs}
                memories={memories}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
