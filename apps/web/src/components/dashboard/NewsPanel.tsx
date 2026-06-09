"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Newspaper, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Article {
  title: string;
  description: string | null;
  source: { name: string };
  publishedAt: string;
  url: string;
}

interface NewsResponse {
  articles: Article[];
  source: "live" | "mock";
}

function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
  } catch {
    return "";
  }
}

export function NewsPanel() {
  const { data, isLoading, refetch, isFetching } = useQuery<NewsResponse>({
    queryKey: ["news-panel"],
    queryFn: () => fetch("/api/news").then((r) => r.json()),
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
  });

  const articles = data?.articles ?? [];

  return (
    <div className="mansa-card rounded-lg flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0"
           style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-2">
          <Newspaper size={12} style={{ color: "var(--mansa-green)" }} />
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Actualités macro</span>
          {data?.source === "live" && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                  style={{ color: "var(--mansa-green)", border: "1px solid color-mix(in srgb, var(--mansa-green) 30%, transparent)" }}>
              LIVE
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="transition-colors p-0.5"
          style={{ color: "var(--text-muted)" }}
          aria-label="Actualiser"
        >
          <RotateCcw size={11} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Article list */}
      <div className="flex-1 overflow-y-auto divide-y min-h-0"
           style={{ borderColor: "var(--bg-border)" }}>
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 animate-pulse">
                <div className="h-2.5 skeleton rounded w-full mb-1.5" />
                <div className="h-2.5 skeleton rounded w-4/5 mb-2" />
                <div className="h-2 skeleton rounded w-24" />
              </div>
            ))
          : articles.map((article, i) => (
              <a
                key={i}
                href={article.url !== "#" ? article.url : undefined}
                target={article.url !== "#" ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="flex flex-col p-3 transition-colors group cursor-pointer"
                style={{ color: "inherit" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <div className="flex items-start gap-1.5 mb-1">
                  <p className="flex-1 text-[11px] leading-relaxed font-medium line-clamp-2 transition-colors"
                     style={{ color: "var(--text-secondary)" }}>
                    {article.title}
                  </p>
                  {article.url !== "#" && (
                    <ExternalLink
                      size={9}
                      className="shrink-0 mt-0.5 transition-colors"
                      style={{ color: "var(--text-muted)" }}
                    />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-mono truncate"
                        style={{ color: "color-mix(in srgb, var(--mansa-green) 60%, transparent)" }}>
                    {article.source.name}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>·</span>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                    {timeAgo(article.publishedAt)}
                  </span>
                </div>
              </a>
            ))}
      </div>
    </div>
  );
}
