"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Heart, Plus, Search } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { type HdFriend, type HdRelationship } from "@/lib/kairos/types";
import { FriendsList } from "./friends-list";
import { RelationshipsList } from "./relationships-list";
import { AddFriendModal } from "./add-friend-modal";
import { FriendDetailModal } from "./friend-detail-modal";
import { RelationshipDetailModal } from "./relationship-detail-modal";

type Tab = "pessoas" | "relacionamentos";

interface PessoasContentProps {
  initialFriends: HdFriend[];
  initialRelationships: HdRelationship[];
}

export function PessoasContent({ initialFriends, initialRelationships }: PessoasContentProps) {
  const [activeTab, setActiveTab] = useState<Tab>("pessoas");
  const [friends, setFriends] = useState<HdFriend[]>(initialFriends);
  const [relationships, setRelationships] = useState<HdRelationship[]>(initialRelationships);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<HdFriend | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<HdRelationship | null>(null);

  // Filter friends based on search
  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.relationship_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRelationships = relationships.filter(rel =>
    rel.friend?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Callbacks
  const handleFriendAdded = useCallback((friend: HdFriend) => {
    setFriends(prev => [...prev, friend]);
    setShowAddModal(false);
  }, []);

  const handleFriendUpdated = useCallback((friend: HdFriend) => {
    setFriends(prev => prev.map(f => f.id === friend.id ? friend : f));
    setSelectedFriend(friend);
  }, []);

  const handleFriendDeleted = useCallback((friendId: string) => {
    setFriends(prev => prev.filter(f => f.id !== friendId));
    setRelationships(prev => prev.filter(r => r.friend_id !== friendId));
    setSelectedFriend(null);
  }, []);

  const handleRelationshipGenerated = useCallback((relationship: HdRelationship) => {
    setRelationships(prev => {
      const existing = prev.findIndex(r => r.friend_id === relationship.friend_id);
      if (existing >= 0) {
        return prev.map((r, i) => i === existing ? relationship : r);
      }
      return [...prev, relationship];
    });
  }, []);

  const tabs = [
    { id: "pessoas" as Tab, label: "Pessoas", icon: Users, count: friends.length },
    { id: "relacionamentos" as Tab, label: "Relacionamentos", icon: Heart, count: relationships.length },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white/70 hover:bg-white/5"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs",
                  isActive ? "bg-white/10 text-white/80" : "bg-white/5 text-white/40"
                )}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "pl-9 pr-4 py-2 rounded-lg text-sm",
                "bg-white/5 border border-white/10 text-white placeholder:text-white/30",
                "focus:outline-none focus:ring-2 focus:ring-white/20"
              )}
            />
          </div>

          {/* Add Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddModal(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
              "bg-gradient-to-r from-emerald-600 to-emerald-500",
              "text-white shadow-lg shadow-emerald-500/20",
              "hover:shadow-emerald-500/30 transition-shadow"
            )}
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar pessoa</span>
          </motion.button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === "pessoas" ? (
          <motion.div
            key="pessoas"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <FriendsList
              friends={filteredFriends}
              onSelectFriend={setSelectedFriend}
            />
          </motion.div>
        ) : (
          <motion.div
            key="relacionamentos"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <RelationshipsList
              relationships={filteredRelationships}
              onSelectRelationship={setSelectedRelationship}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AddFriendModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onFriendAdded={handleFriendAdded}
      />

      <FriendDetailModal
        friend={selectedFriend}
        onClose={() => setSelectedFriend(null)}
        onFriendUpdated={handleFriendUpdated}
        onFriendDeleted={handleFriendDeleted}
        onRelationshipGenerated={handleRelationshipGenerated}
      />

      <RelationshipDetailModal
        relationship={selectedRelationship}
        onClose={() => setSelectedRelationship(null)}
      />
    </div>
  );
}

