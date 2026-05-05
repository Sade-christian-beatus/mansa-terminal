"use client";

import { ErrorCard } from "@/components/common/ErrorCard";

export default function AIError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorCard
      title="Erreur AI Analyst"
      message="Le service d'analyse IA est temporairement indisponible. Réessayez dans quelques instants."
      reset={reset}
    />
  );
}
