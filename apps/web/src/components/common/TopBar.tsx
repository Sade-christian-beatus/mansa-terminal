"use client";

import { useState } from "react";
import { Search, Bell, User, LogOut } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";

export function TopBar() {
  const { email, fullName, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = fullName || email?.split("@")[0] || "Utilisateur";

  return (
    <header className="h-14 bg-[#0F1629] border-b border-[#1E2A42] px-6
                       flex items-center justify-between flex-shrink-0">
      {/* Search */}
      <div className="flex items-center gap-2 bg-[#141B2E] border border-[#1E2A42]
                      rounded-lg px-3 py-2 w-72">
        <Search size={14} className="text-gray-500" />
        <input
          type="text"
          placeholder="Rechercher un pays, un indicateur..."
          className="bg-transparent text-sm text-gray-300 placeholder-gray-600
                     focus:outline-none w-full"
        />
        <kbd className="text-xs text-gray-600 bg-[#1E2A42] px-1.5 py-0.5
                        rounded font-mono">⌘K</kbd>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Data freshness indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Data: IMF · 2024</span>
        </div>

        {/* Notifications */}
        <button className="relative text-gray-400 hover:text-gray-200 transition-colors">
          <Bell size={18} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#00D4AA]
                           rounded-full text-[10px] text-white flex items-center
                           justify-center font-bold">
            3
          </span>
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00D4AA]
                            to-[#3B82F6] flex items-center justify-center">
              <User size={14} className="text-white" />
            </div>
            <div className="text-xs text-left">
              <div className="text-gray-300 font-medium">{displayName}</div>
              <div className="text-gray-600 truncate max-w-[120px]">{email || "—"}</div>
            </div>
          </button>

          {menuOpen && (
            <>
              {/* Overlay pour fermer le menu */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-10 z-20 w-48 bg-[#0F1629]
                              border border-[#1E2A42] rounded-xl shadow-xl py-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm
                             text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <LogOut size={14} />
                  Se déconnecter
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
