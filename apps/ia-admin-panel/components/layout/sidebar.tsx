"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";
import {
  LogOut,
  MessageSquare,
  Shield,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Cpu,
  BrainCircuit,
  Activity,
  Receipt
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type SidebarProps = {
  user: User;
};

export function Sidebar({ user }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const showIaConsoleV2 = process.env.NEXT_PUBLIC_FEATURE_IA_CONSOLE_V2 === "true";
  const showIaConsoleV3 = process.env.NEXT_PUBLIC_FEATURE_IA_CONSOLE_V3 === "true";
  const showIaConsoleVendas = process.env.NEXT_PUBLIC_FEATURE_IA_CONSOLE_VENDAS === "true";

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 240 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="hidden lg:flex flex-col justify-between border-r border-white/5 bg-sidebar/95 backdrop-blur-xl text-sidebar-foreground relative"
    >
      <div className="flex-1 flex flex-col p-4 space-y-6 overflow-hidden">
        {/* Logo/Brand - Minimalista */}
        <div className="flex items-center justify-between min-h-[44px]">
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                key="brand"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="flex-1"
              >
                <h2 className="text-xl font-semibold text-white tracking-tight">
                  TomikOS
                </h2>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg",
              "hover:bg-white/10 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            )}
            aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            {collapsed ? (
              <ChevronRight size={16} className="text-white/70" />
            ) : (
              <ChevronLeft size={16} className="text-white/70" />
            )}
          </button>
        </div>

        {/* Navigation - Deferência ao conteúdo */}
        <nav className="flex-1 space-y-1">
          <SidebarLink
            href="/admin"
            label="Painel"
            icon={<Sparkles size={20} />}
            active={pathname === "/admin"}
            collapsed={collapsed}
          />
          <SidebarLink
            href="/admin/chat"
            label="IA Console"
            icon={<MessageSquare size={20} />}
            active={pathname === "/admin/chat"}
            collapsed={collapsed}
          />
          {showIaConsoleV2 && (
            <SidebarLink
              href="/ia-console/v2"
              label="IA Console V2"
              icon={<Cpu size={20} />}
              active={pathname === "/ia-console/v2"}
              collapsed={collapsed}
            />
          )}
          {showIaConsoleV3 && (
            <SidebarLink
              href="/ia-console/v3"
              label="IA Console V3"
              icon={<BrainCircuit size={20} />}
              active={pathname === "/ia-console/v3"}
              collapsed={collapsed}
            />
          )}
          {showIaConsoleVendas && (
            <SidebarLink
              href="/ia-console/vendas"
              label="IA Vendas"
              icon={<Receipt size={20} />}
              active={pathname === "/ia-console/vendas"}
              collapsed={collapsed}
            />
          )}
          <SidebarLink
            href="/admin/security"
            label="Segurança"
            icon={<Shield size={20} />}
            active={pathname === "/admin/security"}
            collapsed={collapsed}
          />
          <SidebarLink
            href="/audit"
            label="Auditoria MCP"
            icon={<Activity size={20} />}
            active={pathname === "/audit"}
            collapsed={collapsed}
          />
        </nav>
      </div>

      {/* User Footer - Minimalista */}
      <div className="p-4 border-t border-white/5 space-y-3">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              key="user-info"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              className="text-sm space-y-1"
            >
              <p className="font-medium text-white truncate">
                {user.user_metadata?.name ?? user.email?.split("@")[0]}
              </p>
              <p className="text-xs text-sidebar-foreground/60">
                {user.user_metadata?.role ?? "staff"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className={cn(
              "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium",
              "hover:bg-white/10 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Sair" : undefined}
          >
            <LogOut size={18} className="text-white/70 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </form>
      </div>
    </motion.aside>
  );
}

function SidebarLink({
  href,
  label,
  icon,
  active,
  collapsed
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        active
          ? "bg-white/10 text-white"
          : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-white",
        collapsed && "justify-center"
      )}
      title={collapsed ? label : undefined}
    >
      <span className="flex-shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

