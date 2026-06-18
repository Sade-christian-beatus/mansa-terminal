import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";

describe("DataSourceBadge", () => {
  it("affiche le badge Live avec la source quand isLive=true", () => {
    render(<DataSourceBadge isLive source="MANSA DB" />);
    expect(screen.getByText(/Live · MANSA DB/)).toBeInTheDocument();
  });

  it("affiche le badge démo quand isLive=false", () => {
    render(<DataSourceBadge isLive={false} source="MANSA DB" />);
    expect(screen.getByText("Données démo")).toBeInTheDocument();
    expect(screen.queryByText(/Live/)).not.toBeInTheDocument();
  });

  it("affiche une date relative récente quand lastUpdated est fourni", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    render(<DataSourceBadge isLive lastUpdated={tenMinAgo} />);
    expect(screen.getByText(/Il y a moins d'1h/)).toBeInTheDocument();
  });
});
