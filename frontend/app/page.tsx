"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Zap, BookOpen, Brain, ArrowRight,
  Microscope, Atom, Cpu, Leaf, Flame, Droplets,
  Layers, CheckCircle, Clock, Trash2, ChevronDown, Home, FlaskConical
} from "lucide-react";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { OmnixLogo } from "@/components/ui/Logo";
import { researchApi, ResearchSession } from "@/lib/api/client";

const EXAMPLE_QUERIES = [
  "cheaper catalyst alternative for green hydrogen production",
  "reduce lithium-ion battery overheating at high discharge rates",
  "improve perovskite solar panel efficiency and stability",
  "low-cost water purification for arsenic contamination",
  "biodegradable alternatives to microplastics in packaging",
  "non-invasive glucose monitoring for diabetics",
  "superconducting materials at room temperature",
  "carbon capture using engineered enzymes",
];

const FEATURES = [
  {
    icon: BookOpen,
    title: "arXiv Integration",
    desc: "Searches thousands of scientific papers across physics, chemistry, biology, and engineering domains.",
  },
  {
    icon: Brain,
    title: "RAG Pipeline",
    desc: "Retrieves the most relevant paper sections and sends only that context to the AI — no hallucinations.",
  },
  {
    icon: Zap,
    title: "Gemini Reasoning",
    desc: "Generates structured, citation-backed solutions with feasibility scores and implementation roadmaps.",
  },
  {
    icon: Cpu,
    title: "Semantic Search",
    desc: "pgvector-powered similarity search finds related concepts across disciplines for cross-domain inspiration.",
  },
];

const STEPS = [
  { num: "01", title: "Define Problem", desc: "Describe your scientific or engineering challenge in plain language." },
  { num: "02", title: "Search Papers", desc: "AI expands your query and searches arXiv for the most relevant research papers." },
  { num: "03", title: "Extract & Embed", desc: "PDFs are parsed, chunked, and embedded into a vector database for precise retrieval." },
  { num: "04", title: "Generate Solutions", desc: "Gemini reasons over retrieved evidence to generate structured, cited solutions." },
];

const DOMAIN_ICONS = [
  { icon: Atom, label: "Chemistry", color: "#ef4444" },
  { icon: Microscope, label: "Biology", color: "#f87171" },
  { icon: Cpu, label: "Engineering", color: "#fecaca" },
  { icon: Leaf, label: "Environment", color: "#ef4444" },
  { icon: Flame, label: "Energy", color: "#fca5a5" },
  { icon: Droplets, label: "Materials", color: "#fca5a5" },
];

export default function HomePage() {
  const router = useRouter();
  const { userId } = useAuth();
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem("hasSeenSplash");
    if (!hasSeenSplash) {
      setShowSplash(true);
      sessionStorage.setItem("hasSeenSplash", "true");
      const timer = setTimeout(() => setShowSplash(false), 2200);
      return () => clearTimeout(timer);
    }
  }, []);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const [arxivUrls, setArxivUrls] = useState("");
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutsideMode(event: MouseEvent) {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target as Node)) {
        setIsModeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutsideMode);
    return () => document.removeEventListener("mousedown", handleClickOutsideMode);
  }, []);

  // History Dropdown State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySessions, setHistorySessions] = useState<ResearchSession[]>([]);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % EXAMPLE_QUERIES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsHistoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleHistory = async () => {
    if (!isHistoryOpen) {
      setIsHistoryOpen(true);
      if (userId) {
        setHistoryLoading(true);
        try {
          const sessions = await researchApi.getHistory(userId);
          setHistorySessions(sessions);
        } catch (e) {
          console.error("Failed to fetch history:", e);
        } finally {
          setHistoryLoading(false);
        }
      }
    } else {
      setIsHistoryOpen(false);
    }
  };

  const handleDeleteHistorySession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent navigating to the session
    
    setDeletingSessionId(id);
    try {
      await researchApi.deleteSession(id);
      setHistorySessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert("Failed to delete session: " + err.message);
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleSubmit = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 10) {
      setError("Please describe your problem in at least 10 characters.");
      return;
    }

    let parsedArxivIds: string[] | undefined = undefined;
    if (isManualMode) {
      if (!arxivUrls.trim()) {
        setError("Please provide at least one arXiv URL or ID in manual mode.");
        return;
      }
      const matches = arxivUrls.match(/\d{4}\.\d{4,5}(?:v\d+)?/g);
      if (!matches || matches.length === 0) {
        setError("Could not find any valid arXiv IDs. Please use format like '2301.12345'.");
        return;
      }
      parsedArxivIds = Array.from(new Set(matches));
    }

    setError("");
    setLoading(true);
    try {
      const { session_id } = await researchApi.start(trimmed, userId ?? undefined, parsedArxivIds);
      router.push(`/research/${session_id}`);
    } catch (e: any) {
      setError(e.message || "Failed to start research. Check your backend is running.");
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(query);
    }
  };

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "#04050a",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, filter: "blur(10px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 1, type: "spring", bounce: 0.4 }}
            >
              <OmnixLogo size={180} loading={true} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              style={{ marginTop: "2.5rem", fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#e8eaf0" }}
            >
              OmnicrossX AI
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 1, duration: 1 }}
              style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#fca5a5", letterSpacing: "0.1em", textTransform: "uppercase" }}
            >
              Initializing Systems
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="page-wrapper">
        {/* Background orbs */}
        <div className="bg-orbs">
          <div className="bg-orb" style={{ width: "800px", height: "500px", top: "5%", left: "50%", transform: "translateX(-50%)", background: "radial-gradient(ellipse, rgba(239,68,68,0.13) 0%, transparent 65%)", filter: "blur(70px)" }} />
          <div className="bg-orb" style={{ width: "400px", height: "400px", top: "40%", left: "-8%", background: "radial-gradient(ellipse, rgba(252,165,165,0.07) 0%, transparent 70%)", filter: "blur(90px)" }} />
          <div className="bg-orb" style={{ width: "300px", height: "300px", top: "65%", right: "-4%", background: "radial-gradient(ellipse, rgba(248,113,113,0.06) 0%, transparent 70%)", filter: "blur(80px)" }} />
        </div>

        {/* ── Navbar */}
        <header style={{ position: "relative", zIndex: 50 }}>
          <nav className="navbar">
            <div className="nav-logo-wrapper" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <motion.a
                href="/"
                className="nav-logo"
                style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.7rem" }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <OmnixLogo size={36} />
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.15rem", letterSpacing: "-0.025em", color: "var(--foreground)" }}>
                  OmnicrossX <span className="gradient-text">AI</span>
                </span>
              </motion.a>
            </div>

            <div className="nav-actions" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div className="desktop-history-wrapper" style={{ position: "relative" }} ref={dropdownRef}>
                <button
                  onClick={toggleHistory}
                  style={{
                    background: isHistoryOpen ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                    border: isHistoryOpen ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px",
                    padding: "0.48rem 0.85rem",
                    color: isHistoryOpen ? "#fca5a5" : "rgba(255,255,255,0.6)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "0.45rem",
                    transition: "all 0.2s",
                    fontFamily: "inherit", fontSize: "0.875rem", fontWeight: 500,
                  }}
                >
                  <Clock size={15} />
                  <span>History</span>
                </button>

                <AnimatePresence>
                  {isHistoryOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="history-dropdown-desktop"
                      style={{
                        position: "absolute", top: "calc(100% + 0.6rem)", right: 0,
                        width: "340px",
                        background: "rgba(8,8,18,0.97)",
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(239,68,68,0.18)",
                        borderRadius: "16px",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(239,68,68,0.05)",
                        padding: "1rem",
                        zIndex: 100, maxHeight: "420px", overflowY: "auto",
                        display: "flex", flexDirection: "column", gap: "0.5rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingBottom: "0.6rem", borderBottom: "1px solid rgba(239,68,68,0.1)", marginBottom: "0.1rem" }}>
                        <Clock size={13} style={{ color: "#fca5a5" }} />
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#fca5a5", letterSpacing: "0.06em", textTransform: "uppercase" }}>Recent Sessions</span>
                      </div>

                      {!userId ? (
                        <div style={{ padding: "1.25rem 0", textAlign: "center", color: "rgba(255,255,255,0.38)", fontSize: "0.875rem" }}>Sign in to view your research history.</div>
                      ) : historyLoading ? (
                        <div style={{ padding: "1.25rem 0", textAlign: "center", color: "rgba(255,255,255,0.38)", fontSize: "0.875rem" }}>Loading sessions…</div>
                      ) : historySessions.length === 0 ? (
                        <div style={{ padding: "1.25rem 0", textAlign: "center", color: "rgba(255,255,255,0.38)", fontSize: "0.875rem" }}>No sessions yet — start your first research!</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          {historySessions.map((session) => (
                            <div
                              key={session.id}
                              onClick={() => router.push(`/research/${session.id}`)}
                              style={{
                                padding: "0.7rem 0.85rem",
                                background: "rgba(239,68,68,0.03)",
                                borderRadius: "10px", cursor: "pointer",
                                border: "1px solid rgba(239,68,68,0.08)",
                                transition: "all 0.2s",
                                display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.07)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.03)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.08)"; }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "0.825rem", color: "rgba(255,255,255,0.88)", marginBottom: "0.3rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>
                                  {session.query}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.72rem", color: "rgba(255,255,255,0.35)" }}>
                                  <span>{new Date(session.created_at).toLocaleDateString()}</span>
                                  <span style={{
                                    background: session.status === "complete" ? "rgba(34,197,94,0.12)" : session.status === "failed" ? "rgba(239,68,68,0.12)" : "rgba(234,179,8,0.12)",
                                    color: session.status === "complete" ? "#4ade80" : session.status === "failed" ? "#f87171" : "#facc15",
                                    padding: "0.1rem 0.45rem", borderRadius: "5px", fontWeight: 500,
                                    border: `1px solid ${session.status === "complete" ? "rgba(34,197,94,0.25)" : session.status === "failed" ? "rgba(239,68,68,0.25)" : "rgba(234,179,8,0.25)"}`,
                                  }}>
                                    {session.status}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={(e) => handleDeleteHistorySession(e, session.id)}
                                disabled={deletingSessionId === session.id}
                                style={{
                                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                                  color: "#ef4444", borderRadius: "8px", padding: "0.35rem",
                                  cursor: "pointer", transition: "all 0.2s",
                                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.2)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"; }}
                                title="Delete session"
                              >
                                {deletingSessionId === session.id ? (
                                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                                    <OmnixLogo size={14} loading={true} />
                                  </motion.div>
                                ) : (
                                  <Trash2 size={13} />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {!userId && (
                <>
                  <SignInButton mode="modal">
                    <button
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", fontFamily: "inherit", fontSize: "0.875rem", fontWeight: 500, padding: "0.5rem 0.25rem", transition: "color 0.2s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)"; }}
                    >
                      Sign In
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="nav-cta" style={{ border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem" }}>Get Started</button>
                  </SignUpButton>
                </>
              )}
              {userId && <UserButton />}
            </div>
          </nav>
        </header>



        {/* ── Hero */}
        <section className="hero-section">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="hero-badge"
          >
            <span className="hero-badge-dot" />
            Gemini · arXiv · pgvector
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="hero-title"
          >
            Turn Research Papers
            <br />
            <span className="gradient-text glow-text">Into Real Solutions</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="hero-subtitle"
          >
            Describe any scientific or engineering challenge. OmnicrossX autonomously searches thousands of arXiv papers, retrieves the most relevant evidence, and generates structured, citation-backed solutions.
          </motion.p>

          {/* Search Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.3 }}
            className="search-wrapper"
          >
            <div className={`search-box${error ? " has-error" : ""}`}>
              <textarea
                ref={inputRef}
                id="research-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder=""
                rows={3}
                className="search-textarea"
              />

              {isManualMode && (
                <div style={{ padding: "0 1.5rem 1rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.35)", marginBottom: "0.5rem", letterSpacing: "0.02em" }}>
                    Paste arXiv URLs or IDs (e.g. 2301.12345):
                  </p>
                  <textarea
                    value={arxivUrls}
                    onChange={(e) => setArxivUrls(e.target.value)}
                    placeholder="https://arxiv.org/abs/..."
                    rows={2}
                    style={{ width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "0.7rem 0.9rem", color: "white", fontSize: "0.85rem", resize: "none", outline: "none", fontFamily: "inherit" }}
                  />
                </div>
              )}

              {!query && (
                <div className="search-animated-placeholder">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={placeholderIdx}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.25 }}
                    >
                      {EXAMPLE_QUERIES[placeholderIdx]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              )}

              <div className="search-footer">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div ref={modeDropdownRef} style={{ position: "relative", zIndex: 10 }}>
                    <button
                      onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.35rem",
                        background: isManualMode ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                        color: isManualMode ? "#fca5a5" : "rgba(255,255,255,0.45)",
                        border: isManualMode ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(255,255,255,0.07)",
                        borderRadius: "8px", padding: "0.38rem 0.7rem",
                        fontSize: "0.78rem", fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
                      }}
                    >
                      {isManualMode ? "Manual" : "Auto"}
                      <ChevronDown size={13} style={{ opacity: 0.6, transform: isModeDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                    </button>

                    <AnimatePresence>
                      {isModeDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.12 }}
                          style={{
                            position: "absolute", bottom: "calc(100% + 0.4rem)", left: 0,
                            width: "160px", background: "rgba(10,12,22,0.98)",
                            backdropFilter: "blur(16px)",
                            border: "1px solid rgba(239,68,68,0.18)", borderRadius: "10px",
                            padding: "0.35rem", boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
                          }}
                        >
                          {[
                            { label: "Auto Search", value: false, desc: "AI finds papers" },
                            { label: "Manual Papers", value: true, desc: "Paste arXiv IDs" },
                          ].map((opt) => (
                            <button
                              key={opt.label}
                              onClick={() => { setIsManualMode(opt.value); setIsModeDropdownOpen(false); }}
                              style={{
                                display: "flex", flexDirection: "column", width: "100%",
                                textAlign: "left", padding: "0.5rem 0.7rem",
                                fontSize: "0.78rem", fontWeight: 500,
                                color: isManualMode === opt.value ? "#fca5a5" : "rgba(255,255,255,0.7)",
                                background: isManualMode === opt.value ? "rgba(239,68,68,0.1)" : "transparent",
                                borderRadius: "6px", cursor: "pointer", border: "none",
                                marginBottom: "0.1rem", transition: "all 0.15s",
                              }}
                            >
                              {opt.label}
                              <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.28)", marginTop: "0.1rem", fontWeight: 400 }}>{opt.desc}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className="search-hint">Enter to search · Shift+Enter for new line</span>
                </div>

                <button
                  id="research-submit-btn"
                  onClick={() => handleSubmit(query)}
                  disabled={loading}
                  className="search-btn"
                >
                  {loading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}>
                        <OmnixLogo size={20} loading={true} />
                      </motion.div>
                      Starting…
                    </div>
                  ) : (
                    <>
                      <Zap size={14} />
                      Research
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="error-text">
                {error}
              </motion.p>
            )}
          </motion.div>

          {/* Example pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="example-pills"
          >
            {EXAMPLE_QUERIES.slice(0, 4).map((q) => (
              <button
                key={q}
                className="example-pill"
                onClick={() => { setQuery(q); inputRef.current?.focus(); }}
              >
                {q}
              </button>
            ))}
          </motion.div>
        </section>

        {/* ── Trust Bar */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="trust-bar"
        >
          {([
            { icon: BookOpen,    label: "Papers Indexed", value: "1M+"    },
            { icon: Zap,         label: "Avg. Response",  value: "~90s"   },
            { icon: Brain,       label: "AI Reasoning",   value: "Gemini" },
            { icon: CheckCircle, label: "Every Answer",   value: "Cited"  },
          ] as const).map(({ icon: Icon, label, value }) => (
            <div key={label} className="trust-item">
              <Icon size={15} style={{ color: "#fca5a5" }} />
              <span className="trust-value">{value}</span>
              <span className="trust-label">{label}</span>
            </div>
          ))}
        </motion.section>

        {/* ── Domain Strip */}
        <section className="domain-section">
          {DOMAIN_ICONS.map(({ icon: Icon, label, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.06 }}
              className="domain-pill"
            >
              <Icon size={13} style={{ color }} />
              {label}
            </motion.div>
          ))}
        </section>

        {/* ── How It Works */}
        <section className="steps-section">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="section-header"
          >
            <div className="section-label">
              <span className="section-label-line" />
              How It Works
              <span className="section-label-line" />
            </div>
            <h2 className="section-title">
              From question to breakthrough{" "}
              <span className="gradient-text">in minutes</span>
            </h2>
            <p className="section-subtitle">
              A fully automated research pipeline — no academic login, no manual searching.
            </p>
          </motion.div>

          <div className="steps-grid">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.08 }}
                className="step-card"
              >
                <div className="step-number-bg">{step.num}</div>
                <div className="step-number-badge">
                  <span className="gradient-text" style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", fontWeight: 700 }}>
                    {step.num}
                  </span>
                </div>
                <h3 className="step-card-title">{step.title}</h3>
                <p className="step-card-desc">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Features */}
        <section className="features-section">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="section-header"
          >
            <div className="section-label">
              <span className="section-label-line" style={{ background: "linear-gradient(90deg, transparent, #ef4444)" }} />
              Capabilities
              <span className="section-label-line" style={{ background: "linear-gradient(90deg, #ef4444, transparent)" }} />
            </div>
            <h2 className="section-title">
              Built on <span className="gradient-text">cutting-edge AI</span>
            </h2>
            <p className="section-subtitle">
              Every layer of the pipeline is optimized for scientific accuracy and relevance.
            </p>
          </motion.div>

          <div className="features-grid">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, x: i % 2 === 0 ? -16 : 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.75 + i * 0.08 }}
                className="feature-card"
              >
                <div className="feature-icon-wrap">
                  <Icon size={20} color="#ef4444" />
                </div>
                <div>
                  <h3 className="feature-title">{title}</h3>
                  <p className="feature-desc">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Footer */}
        <footer className="page-footer">
          <p className="footer-text">
            OmnicrossX AI generates evidence-based hypotheses from academic literature — not a substitute for domain expertise. Always validate outputs with qualified researchers.
          </p>
        </footer>
      </div>

      {/* Mobile History Bottom Sheet */}
      <div className="mobile-history-sheet">
        {isMobile && (
          <AnimatePresence>
          {isHistoryOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={toggleHistory}
                style={{
                  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 150,
                  backdropFilter: "blur(4px)"
                }}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                style={{
                  position: "fixed", bottom: "64px", left: 0, right: 0,
                  background: "rgba(8,8,18,0.97)",
                  backdropFilter: "blur(20px)",
                  borderTop: "1px solid rgba(239,68,68,0.18)",
                  borderTopLeftRadius: "24px", borderTopRightRadius: "24px",
                  padding: "1.5rem", paddingBottom: "2rem", zIndex: 150,
                  maxHeight: "75vh", display: "flex", flexDirection: "column"
                }}
              >
                <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.2)", borderRadius: "2px", margin: "0 auto 1rem" }} />
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingBottom: "1rem", borderBottom: "1px solid rgba(239,68,68,0.1)", marginBottom: "0.5rem" }}>
                  <Clock size={16} style={{ color: "#fca5a5" }} />
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#fca5a5", letterSpacing: "0.06em", textTransform: "uppercase" }}>Recent Sessions</span>
                </div>
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {!userId ? (
                    <div style={{ padding: "2rem 0", textAlign: "center", color: "rgba(255,255,255,0.38)" }}>Sign in to view your research history.</div>
                  ) : historyLoading ? (
                    <div style={{ padding: "2rem 0", textAlign: "center", color: "rgba(255,255,255,0.38)" }}>Loading sessions…</div>
                  ) : historySessions.length === 0 ? (
                    <div style={{ padding: "2rem 0", textAlign: "center", color: "rgba(255,255,255,0.38)" }}>No sessions yet — start your first research!</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {historySessions.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => router.push(`/research/${session.id}`)}
                          style={{
                            padding: "1rem",
                            background: "rgba(239,68,68,0.03)",
                            borderRadius: "12px", cursor: "pointer",
                            border: "1px solid rgba(239,68,68,0.08)",
                            display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.88)", marginBottom: "0.4rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>
                              {session.query}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>
                              <span>{new Date(session.created_at).toLocaleDateString()}</span>
                              <span style={{
                                background: session.status === "complete" ? "rgba(34,197,94,0.12)" : session.status === "failed" ? "rgba(239,68,68,0.12)" : "rgba(234,179,8,0.12)",
                                color: session.status === "complete" ? "#4ade80" : session.status === "failed" ? "#f87171" : "#facc15",
                                padding: "0.15rem 0.5rem", borderRadius: "6px", fontWeight: 500,
                              }}>
                                {session.status}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleDeleteHistorySession(e, session.id)}
                            disabled={deletingSessionId === session.id}
                            style={{
                              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                              color: "#ef4444", borderRadius: "8px", padding: "0.5rem",
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}
                          >
                            {deletingSessionId === session.id ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                                <OmnixLogo size={16} loading={true} />
                              </motion.div>
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
          </AnimatePresence>
        )}
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <button className="mobile-nav-item active" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Home">
          <Home size={20} />
          Home
        </button>
        <button
          className="mobile-nav-item"
          onClick={() => inputRef.current?.focus()}
          aria-label="Research"
        >
          <FlaskConical size={20} />
          Research
        </button>
        <button
          className={`mobile-nav-item${isHistoryOpen ? " active" : ""}`}
          onClick={toggleHistory}
          aria-label="History"
        >
          <Clock size={20} />
          History
        </button>
      </nav>
    </>
  );
}
