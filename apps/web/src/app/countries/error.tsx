"use client";

import { ErrorCard } from "@/components/common/ErrorCard";

export default function CountriesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorCard
      title="Impossible de charger les pays"
      message="La liste des 54 économies africaines est temporairement indisponible."
      reset={reset}
    />
  );
}
