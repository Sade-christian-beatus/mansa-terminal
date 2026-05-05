"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorCardProps {
  title?: string;
  message?: string;
  reset?: () => void;
}

export function ErrorCard({
  title = "Une erreur est survenue",
  message = "Impossible de charger cette section. Vérifiez votre connexion et réessayez.",
  reset,
}: ErrorCardProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center
                      justify-center mb-4">
        <AlertTriangle size={28} className="text-red-400" />
      </div>
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <p className="text-gray-500 text-sm max-w-sm mb-6">{message}</p>
      {reset && (
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 rounded-lg
                     bg-[#1E2A42] hover:bg-[#253350] text-gray-300
                     hover:text-white text-sm transition-colors"
        >
          <RefreshCw size={14} />
          Réessayer
        </button>
      )}
    </div>
  );
}
