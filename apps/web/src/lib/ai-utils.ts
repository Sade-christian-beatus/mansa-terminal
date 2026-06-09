/**
 * Utilitaires pour la page MANSA AI.
 * Fichier .ts (non TSX) pour éviter toute ambiguïté de parsing JSX.
 */

export interface ErrorResult {
  message: string;
  code?: number;
}

export function getErrorMessage(err: unknown): ErrorResult {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("401"))
    return { message: "Session expirée. Veuillez vous reconnecter.", code: 401 };
  if (msg.includes("403"))
    return { message: "Abonnement requis pour accéder à MANSA AI.", code: 403 };
  if (msg.includes("429"))
    return { message: "Quota journalier atteint. Réessayez demain ou passez au plan supérieur.", code: 429 };
  if (msg.includes("422"))
    return { message: "Question invalide ou trop courte. Reformulez votre question.", code: 422 };
  if (msg.includes("500"))
    return { message: "Erreur serveur. L'équipe MANSA a été notifiée.", code: 500 };
  if (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("ECONNREFUSED")
  ) {
    return {
      message: "Impossible de joindre le serveur MANSA. Vérifiez votre connexion.",
      code: 0,
    };
  }
  return { message: "Une erreur inattendue est survenue. Réessayez dans quelques instants." };
}
