"use client";

import { useState, useId } from "react";
import Image from "next/image";

/**
 * Image avec repli dégradé thémable.
 *
 * Affiche une image `next/image` (typiquement une photo générée par IA déposée
 * dans `public/images/`). Tant que le fichier est absent ou échoue à charger,
 * un fond dégradé + motif léger est rendu à la place — l'interface reste
 * présentable avant la livraison des visuels définitifs.
 */
interface ImageWithFallbackProps {
  src: string;
  alt: string;
  /** Couleurs du dégradé de repli (CSS). Défaut : vert→bleu MANSA. */
  from?: string;
  to?: string;
  className?: string;
  /** Mode `fill` (le parent doit être `position: relative`). Défaut true. */
  fill?: boolean;
  width?: number;
  height?: number;
  /** Priorité de chargement (hero au-dessus de la ligne de flottaison). */
  priority?: boolean;
  /** Contenu décoratif optionnel rendu au centre du repli (icône…). */
  children?: React.ReactNode;
  sizes?: string;
  imgClassName?: string;
}

export function ImageWithFallback({
  src,
  alt,
  from = "var(--mansa-green)",
  to = "var(--mansa-blue, #3B82F6)",
  className = "",
  fill = true,
  width,
  height,
  priority = false,
  children,
  sizes,
  imgClassName = "object-cover",
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);
  const patternId = `mansa-dots-${useId().replace(/:/g, "")}`;

  const fallback = (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      aria-hidden={children ? undefined : true}
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${from} 75%, #0b1220), color-mix(in srgb, ${to} 70%, #0b1220))`,
      }}
    >
      {/* Motif décoratif léger */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.12]" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={patternId} width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="#ffffff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      {children}
    </div>
  );

  if (failed || !src) {
    return <div className={`relative ${className}`}>{fallback}</div>;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Repli sous l'image — visible le temps du chargement / si transparente */}
      {fallback}
      <Image
        src={src}
        alt={alt}
        {...(fill ? { fill: true } : { width: width ?? 800, height: height ?? 600 })}
        priority={priority}
        sizes={sizes ?? (fill ? "100vw" : undefined)}
        className={`relative ${imgClassName}`}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
