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
    <div className="bg-[#0D1426] border border-[#1E2A42] rounded-lg flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1E2A42] shrink-0">
        <div className="flex items-center gap-2">
          <Newspaper size={12} className="text-[#00D4AA]" />
          <span className="text-white text-xs font-semibold">Actualités macro</span>
          {data?.source === "live" && (
            <span className="text-[#00D4AA] text-[9px] font-mono border border-[#00D4AA]/30 px-1.5 py-0.5 rounded">
              LIVE
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="text-gray-600 hover:text-gray-300 transition-colors p-0.5"
          aria-label="Actualiser"
        >
          <RotateCcw size={11} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Article list */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#1E2A42]/50 min-h-0">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 animate-pulse">
                <div className="h-2.5 bg-[#1E2A42] rounded w-full mb-1.5" />
                <div className="h-2.5 bg-[#1E2A42] rounded w-4/5 mb-2" />
                <div className="h-2 bg-[#1E2A42] rounded w-24" />
              </div>
            ))
          : articles.map((article, i) => (
              <a
                key={i}
                href={article.url !== "#" ? article.url : undefined}
                target={article.url !== "#" ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="flex flex-col p-3 hover:bg-[#1E2A42]/30 transition-colors group cursor-pointer"
              >
                <div className="flex items-start gap-1.5 mb-1">
                  <p className="flex-1 text-gray-200 text-[11px] leading-relaxed font-medium group-hover:text-white transition-colors line-clamp-2">
                    {article.title}
                  </p>
                  {article.url !== "#" && (
                    <ExternalLink
                      size={9}
                      className="shrink-0 mt-0.5 text-gray-700 group-hover:text-gray-400 transition-colors"
                    />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[#00D4AA]/60 text-[10px] font-mono truncate">
                    {article.source.name}
                  </span>
                  <span className="text-gray-700 text-[10px]">·</span>
                  <span className="text-gray-600 text-[10px] shrink-0">
                    {timeAgo(article.publishedAt)}
                  </span>
                </div>
              </a>
            ))}
      </div>
    </div>
  );
}
