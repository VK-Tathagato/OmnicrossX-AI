"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Zap, BookOpen, Brain, ArrowRight,
  Microscope, Atom, Cpu, Leaf, Flame, Droplets,
  Layers, CheckCircle, Clock, Trash2, ChevronDown
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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      {/* Fixed ambient background orbs */}
      <div className="bg-orbs">
        <div
          className="bg-orb"
          style={{
            width: "700px",
            height: "400px",
            top: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            background: "radial-gradient(ellipse, rgba(239,68,68,0.12) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="bg-orb"
          style={{
            width: "450px",
            height: "450px",
            top: "30%",
            left: "-10%",
            background: "radial-gradient(ellipse, rgba(252,165,165,0.07) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="bg-orb"
          style={{
            width: "350px",
            height: "350px",
            top: "60%",
            right: "-5%",
            background: "radial-gradient(ellipse, rgba(248,113,113,0.05) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
      </div>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header style={{ position: "relative", zIndex: 50 }}>
        <nav className="navbar">
          <motion.a 
            href="/" 
            className="nav-logo group" 
            style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <OmnixLogo size={38} />
            <span className="nav-logo-text transition-colors duration-300 group-hover:text-white" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.02em" }}>
              OmnicrossX <span className="gradient-text">AI</span>
            </span>
          </motion.a>
          <div className="nav-actions" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ position: "relative" }} ref={dropdownRef}>
              <button 
                onClick={toggleHistory}
                style={{
                  background: isHistoryOpen ? "rgba(239,68,68,0.15)" : "rgba(0,0,0,0.4)",
                  border: isHistoryOpen ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(239,68,68,0.1)",
                  borderRadius: "8px",
                  padding: "0.5rem 0.75rem",
                  color: isHistoryOpen ? "#fca5a5" : "rgba(255,255,255,0.8)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  transition: "all 0.2s",
                  fontFamily: "inherit",
                  fontSize: "0.9rem",
                  boxShadow: isHistoryOpen ? "0 0 15px rgba(239,68,68,0.3)" : "none",
                }}
              >
                <Clock size={16} />
                <span>Previous Researches</span>
              </button>

              <AnimatePresence>
                {isHistoryOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: "absolute",
                      top: "calc(100% + 0.5rem)",
                      right: 0,
                      width: "320px",
                      background: "rgba(5,0,0,0.95)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: "12px",
                      boxShadow: "0 8px 30px rgba(239,68,68,0.08)",
                      padding: "1rem",
                      zIndex: 100,
                      maxHeight: "400px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem"
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: "0.95rem", color: "#fca5a5", borderBottom: "1px solid rgba(239,68,68,0.2)", paddingBottom: "0.5rem" }}>
                      Recent Research
                    </h3>
                    
                    {!userId ? (
                      <div style={{ padding: "1rem 0", textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>
                        Log in first please.
                      </div>
                    ) : historyLoading ? (
                      <div style={{ padding: "1rem 0", textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>
                        Loading history...
                      </div>
                    ) : historySessions.length === 0 ? (
                      <div style={{ padding: "1rem 0", textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>
                        No past generations found.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {historySessions.map((session) => (
                          <div 
                            key={session.id}
                            onClick={() => router.push(`/research/${session.id}`)}
                            style={{
                              padding: "0.75rem",
                              background: "rgba(239,68,68,0.03)",
                              borderRadius: "8px",
                              cursor: "pointer",
                              border: "1px solid rgba(239,68,68,0.1)",
                              transition: "all 0.2s",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: "0.5rem"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                              e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "rgba(239,68,68,0.03)";
                              e.currentTarget.style.borderColor = "rgba(239,68,68,0.1)";
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.9)", marginBottom: "0.35rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {session.query}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
                                <span>{new Date(session.created_at).toLocaleDateString()}</span>
                                <span style={{ 
                                  background: session.status === "complete" ? "rgba(34,197,94,0.15)" : session.status === "failed" ? "rgba(239,68,68,0.15)" : "rgba(234,179,8,0.15)", 
                                  color: session.status === "complete" ? "#4ade80" : session.status === "failed" ? "#f87171" : "#facc15",
                                  padding: "0.1rem 0.4rem", 
                                  borderRadius: "4px",
                                  border: `1px solid ${session.status === "complete" ? "rgba(34,197,94,0.3)" : session.status === "failed" ? "rgba(239,68,68,0.3)" : "rgba(234,179,8,0.3)"}`
                                }}>
                                  {session.status}
                                </span>
                              </div>
                            </div>
                            
                            {/* Delete Button */}
                            <button
                              onClick={(e) => handleDeleteHistorySession(e, session.id)}
                              disabled={deletingSessionId === session.id}
                              style={{
                                background: "rgba(239,68,68,0.1)",
                                border: "1px solid rgba(239,68,68,0.2)",
                                color: "#ef4444",
                                borderRadius: "6px",
                                padding: "0.35rem",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(239,68,68,0.25)";
                                e.currentTarget.style.color = "#fca5a5";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                                e.currentTarget.style.color = "#ef4444";
                              }}
                              title="Delete history"
                            >
                              {deletingSessionId === session.id ? (
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                                  <OmnixLogo size={24} loading={true} />
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
                  <button className="nav-link bg-transparent border-none cursor-pointer" style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255, 255, 255, 0.7)", fontFamily: "inherit", fontSize: "0.95rem" }}>Sign In</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="nav-cta border-none cursor-pointer" style={{ border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.95rem" }}>Get Started</button>
                </SignUpButton>
              </>
            )}
            {userId && (
              <UserButton />
            )}
          </div>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="hero-section">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hero-badge"
        >
          <span className="hero-badge-dot" />
          AI-Assisted Scientific Reasoning — Powered by Gemini &amp; arXiv
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="hero-title"
        >
          Solve Scientific Problems
          <br />
          <span className="gradient-text glow-text">with Research Evidence</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="hero-subtitle"
        >
          Describe your engineering or scientific challenge. OmnicrossX searches
          thousands of arXiv papers, extracts the most relevant research, and
          generates structured, citation-backed solutions.
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
              <div style={{ padding: "0 1.5rem 4.5rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", marginBottom: "0.5rem" }}>
                  Paste arXiv URLs or IDs (e.g. 2301.12345):
                </p>
                <textarea
                  value={arxivUrls}
                  onChange={(e) => setArxivUrls(e.target.value)}
                  placeholder="https://arxiv.org/abs/..."
                  rows={2}
                  style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "0.75rem", color: "white", fontSize: "0.85rem", resize: "none", outline: "none" }}
                />
              </div>
            )}

            {/* Animated placeholder */}
            {!query && (
              <div className="search-animated-placeholder">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={placeholderIdx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.28 }}
                  >
                    {EXAMPLE_QUERIES[placeholderIdx]}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}

            {/* Footer row */}
            <div className="search-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div 
                  ref={modeDropdownRef}
                  style={{ position: "relative", zIndex: 10 }}
                >
                  <button
                    onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      background: isManualMode ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
                      color: isManualMode ? "#fca5a5" : "rgba(255,255,255,0.7)",
                      border: isManualMode ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      padding: "0.4rem 0.75rem",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {isManualMode ? "Manual" : "Auto"}
                    <ChevronDown size={14} style={{ opacity: 0.5, transform: isModeDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                  </button>
                  
                  <AnimatePresence>
                    {isModeDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        style={{
                          position: "absolute",
                          bottom: "calc(100% + 0.5rem)",
                          left: 0,
                          width: "140px",
                          background: "rgba(13, 15, 26, 0.95)",
                          backdropFilter: "blur(12px)",
                          border: "1px solid rgba(239, 68, 68, 0.2)",
                          borderRadius: "8px",
                          padding: "0.4rem",
                          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                        }}
                      >
                        <button
                          onClick={() => { setIsManualMode(false); setIsModeDropdownOpen(false); }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.8rem",
                            color: !isManualMode ? "#fca5a5" : "rgba(255,255,255,0.7)",
                            background: !isManualMode ? "rgba(239,68,68,0.1)" : "transparent",
                            borderRadius: "4px",
                            cursor: "pointer",
                            border: "none",
                            marginBottom: "0.2rem"
                          }}
                        >
                          Auto Search
                        </button>
                        <button
                          onClick={() => { setIsManualMode(true); setIsModeDropdownOpen(false); }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.8rem",
                            color: isManualMode ? "#fca5a5" : "rgba(255,255,255,0.7)",
                            background: isManualMode ? "rgba(239,68,68,0.1)" : "transparent",
                            borderRadius: "4px",
                            cursor: "pointer",
                            border: "none"
                          }}
                        >
                          Manual Papers
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <span className="search-hint">
                  Press Enter to research · Shift+Enter for new line
                </span>
              </div>
              <button
                id="research-submit-btn"
                onClick={() => handleSubmit(query)}
                disabled={loading}
                className="search-btn"
              >
                {loading ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                      <OmnixLogo size={24} loading={true} />
                    </motion.div>
                    Starting…
                  </div>
                ) : (
                  <>
                    <Zap size={15} />
                    Research
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="error-text"
            >
              {error}
            </motion.p>
          )}
        </motion.div>

        {/* Example query pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="example-pills"
        >
          {EXAMPLE_QUERIES.slice(0, 4).map((q) => (
            <button
              key={q}
              className="example-pill"
              onClick={() => {
                setQuery(q);
                inputRef.current?.focus();
              }}
            >
              {q}
            </button>
          ))}
        </motion.div>
      </section>

      {/* ── Domain pills ─────────────────────────────────────────────────── */}
      <section className="domain-section">
        {DOMAIN_ICONS.map(({ icon: Icon, label, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 + i * 0.06 }}
            className="domain-pill"
          >
            <Icon size={14} style={{ color }} />
            {label}
          </motion.div>
        ))}
      </section>

      {/* ── How it Works ─────────────────────────────────────────────────── */}
      <section className="steps-section">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          style={{ textAlign: "center", marginBottom: "3rem" }}
        >
          <div className="section-label">
            <span style={{
              width: 20, height: 1,
              background: "linear-gradient(90deg, transparent, #fca5a5)",
              display: "inline-block"
            }} />
            How It Works
            <span style={{
              width: 20, height: 1,
              background: "linear-gradient(90deg, #fca5a5, transparent)",
              display: "inline-block"
            }} />
          </div>
          <h2 className="section-title">
            From problem to solution{" "}
            <span className="gradient-text">in minutes</span>
          </h2>
          <p className="section-subtitle">
            A fully automated research pipeline — no manual searching required.
          </p>
        </motion.div>

        {/* Step cards grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1.25rem",
          }}
        >
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
                <span className="gradient-text" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700 }}>
                  {step.num}
                </span>
              </div>
              <h3 className="step-card-title">{step.title}</h3>
              <p className="step-card-desc">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="features-section">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          style={{ textAlign: "center", marginBottom: "3rem" }}
        >
          <div className="section-label">
            <span style={{
              width: 20, height: 1,
              background: "linear-gradient(90deg, transparent, #ef4444)",
              display: "inline-block"
            }} />
            Capabilities
            <span style={{
              width: 20, height: 1,
              background: "linear-gradient(90deg, #ef4444, transparent)",
              display: "inline-block"
            }} />
          </div>
          <h2 className="section-title">
            Built on{" "}
            <span className="gradient-text">cutting-edge AI</span>
          </h2>
          <p className="section-subtitle">
            Every layer of the pipeline is optimised for accuracy and relevance.
          </p>
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.25rem",
          }}
        >
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

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="page-footer">
        <p className="footer-text">
          OmnicrossX AI is an AI-assisted scientific reasoning platform — not a
          replacement for domain experts. All outputs are speculative hypotheses
          based on academic literature. Always verify with qualified researchers.
        </p>
      </footer>
    </div>
    </>
  );
}
