import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-session";
import { createDailyLog, updateDailyLog, deleteDailyLog, listDailyLogs } from "@/lib/kairos/daily-logs";
import { getHumanDesignProfile } from "@/lib/kairos/human-design";
import { DiaryHero, DiaryContent } from "@/components/diary";

export const metadata = {
  title: "Diário • Kairos IA",
};

export default async function DiarioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Fetch logs and HD profile in parallel
  const [logs, hdProfile] = await Promise.all([
    listDailyLogs(user.id, { limit: 30 }),
    getHumanDesignProfile(user.id).catch(() => null),
  ]);

  // Calculate streak
  const streak = calculateStreak(logs);

  // Server action for creating a new log
  async function addLog(formData: FormData) {
    "use server";
    const currentUser = await getCurrentUser();
    if (!currentUser) redirect("/login");

    await createDailyLog(currentUser.id, {
      data: formData.get("data")?.toString() || undefined,
      hora: formData.get("hora")?.toString() || null,
      humor_energia: formData.get("humor_energia")?.toString() || null,
      principais_desafios: formData.get("principais_desafios")?.toString() || null,
      foco_do_dia: formData.get("foco_do_dia")?.toString() || null,
    });

    revalidatePath("/diario");
    revalidatePath("/app");
  }

  // Server action for updating an existing log
  async function editLog(formData: FormData) {
    "use server";
    const currentUser = await getCurrentUser();
    if (!currentUser) redirect("/login");

    const logId = formData.get("id")?.toString();
    if (!logId) throw new Error("ID do registro não fornecido");

    await updateDailyLog(currentUser.id, logId, {
      data: formData.get("data")?.toString() || undefined,
      hora: formData.get("hora")?.toString() || null,
      humor_energia: formData.get("humor_energia")?.toString() || null,
      principais_desafios: formData.get("principais_desafios")?.toString() || null,
      foco_do_dia: formData.get("foco_do_dia")?.toString() || null,
    });

    revalidatePath("/diario");
    revalidatePath("/app");
  }

  // Server action for deleting a log
  async function removeLog(id: string) {
    "use server";
    const currentUser = await getCurrentUser();
    if (!currentUser) redirect("/login");

    await deleteDailyLog(currentUser.id, id);

    revalidatePath("/diario");
    revalidatePath("/app");
  }

  // Transform logs for the timeline component
  const entries = logs.map((log) => ({
    id: log.id,
    data: log.data,
    hora: log.hora,
    created_at: log.created_at,
    humor_energia: log.humor_energia,
    principais_desafios: log.principais_desafios,
    foco_do_dia: log.foco_do_dia,
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero Section */}
      <DiaryHero
        userName={user.user_metadata?.full_name || user.email?.split("@")[0]}
        tipo={hdProfile?.tipo}
        streakDays={streak}
        totalEntries={logs.length}
      />

      {/* Main Content */}
      <DiaryContent 
        entries={entries} 
        onSubmit={addLog} 
        onUpdate={editLog}
        onDelete={removeLog}
      />
    </div>
  );
}

/**
 * Calculate consecutive days streak
 */
function calculateStreak(logs: { data: string | null; created_at: string }[]): number {
  if (logs.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let currentDate = new Date(today);

  // Sort logs by date descending
  const sortedLogs = [...logs].sort((a, b) => {
    const dateA = new Date(a.data ?? a.created_at);
    const dateB = new Date(b.data ?? b.created_at);
    return dateB.getTime() - dateA.getTime();
  });

  // Get unique dates
  const uniqueDates = new Set<string>();
  for (const log of sortedLogs) {
    const logDate = new Date(log.data ?? log.created_at);
    logDate.setHours(0, 0, 0, 0);
    uniqueDates.add(logDate.toISOString());
  }

  // Check for consecutive days
  for (let i = 0; i < 365; i++) {
    const dateStr = currentDate.toISOString();
    if (uniqueDates.has(dateStr)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (i === 0) {
      // If today has no log, check if yesterday has
      currentDate.setDate(currentDate.getDate() - 1);
      const yesterdayStr = currentDate.toISOString();
      if (uniqueDates.has(yesterdayStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return streak;
}
