import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/auth/login", "/auth/register", "/auth/verify-email"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pages publiques — toujours accessibles
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Vérifie la session via les cookies disponibles
  const hasSession =
    request.cookies.get("mansa_auth")?.value ||
    request.cookies.get("access_token")?.value;

  if (!hasSession) {
    // Redirige vers login UNE SEULE FOIS — évite la boucle infinie
    // en ne redirigeant que si on n'est pas déjà sur /auth/login
    const loginUrl = new URL("/auth/login", request.url);
    // Ne pas ajouter ?next= pour éviter les boucles
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Exclut : fichiers statiques, images, favicon, routes /api/
  // et AUSSI la page /auth/login elle-même (double protection anti-boucle)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|auth/).*)"],
};
