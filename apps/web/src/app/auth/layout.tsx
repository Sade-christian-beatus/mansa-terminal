/**
 * MANSA Terminal — Auth Layout
 * Fond sombre avec dégradé et motif africain subtil.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Gradient radial au centre */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,212,170,0.08) 0%, transparent 60%), " +
            "radial-gradient(ellipse 50% 40% at 80% 100%, rgba(59,130,246,0.06) 0%, transparent 50%)",
        }}
      />

      {/* Grille subtile */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--bg-border) 1px, transparent 1px), " +
            "linear-gradient(90deg, var(--bg-border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Orbes décoratifs */}
      <div
        className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(0,212,170,0.04) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-[-150px] right-[-150px] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,184,0,0.03) 0%, transparent 70%)",
        }}
      />

      {/* Contenu centré */}
      <div className="relative z-10 w-full flex flex-col items-center">
        {children}
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center w-full z-10">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          © {new Date().getFullYear()} MANSA Terminal · Africa&apos;s AI-Powered Macro-Fiscal Intelligence Platform
        </p>
      </div>
    </div>
  );
}
