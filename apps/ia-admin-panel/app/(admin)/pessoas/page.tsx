import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-session";
import { listFriends, listRelationships } from "@/lib/kairos/friends";
import { PessoasContent } from "@/components/pessoas/pessoas-content";

export const metadata = {
  title: "Pessoas • Kairos IA"
};

export default async function PessoasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [friends, relationships] = await Promise.all([
    listFriends(user.id),
    listRelationships(user.id),
  ]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          Conexões
        </p>
        <h1 className="text-2xl font-semibold text-white/90">
          Pessoas & Relacionamentos
        </h1>
        <p className="text-sm text-white/50 max-w-lg">
          Adicione pessoas importantes na sua vida e descubra a dinâmica energética 
          entre vocês através do Human Design.
        </p>
      </header>

      {/* Main Content */}
      <PessoasContent 
        initialFriends={friends} 
        initialRelationships={relationships}
      />
    </div>
  );
}

