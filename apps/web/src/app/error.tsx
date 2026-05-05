"use client";

import { ErrorCard } from "@/components/common/ErrorCard";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorCard
      title="Erreur inattendue"
      message={error.message || "Une erreur s'est produite. Nos équipes ont été notifiées."}
      reset={reset}
    />
  );
}
