"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import {
  FileText, Layers, Brain, CheckCircle, AlertCircle,
  ArrowLeft, RefreshCw, Search, Cpu, Sparkles, Send
} from "lucide-react";
import { researchApi, solutionsApi, ResearchStatus, SolutionCard, Paper } from "@/lib/api/client";
import SolutionCardComponent from "@/components/solution/SolutionCard";
import { OmnixLogo } from "@/components/ui/Logo";

const STEPS = [
  { id: "expand",   label: "Expanding search queries",   icon: Sparkles,  color: "#ef4444" },
  { id: "search",   label: "Searching arXiv papers",     icon: Search,    color: "#f97316" },
  { id: "process",  label: "Extracting PDF content",     icon: FileText,  color: "#eab308" },
  { id: "embed",    label: "Generating embeddings",      icon: Cpu,       color: "#22d3ee" },
  { id: "retrieve", label: "Retrieving relevant sections", icon: Layers,  color: "#8b5cf6" },
  { id: "generate", label: "Synthesizing solutions",     icon: Brain,     color: "#10b981" },
];

export default function ResearchPage() {
  const params  = useParams();
  const router  = useRouter();
  const sessionId = params.sessionId as string;

  const [status,        setStatus]        = useState<ResearchStatus | null>(null);
  const [solutions,     setSolutions]     = useState<SolutionCard[]>([]);
  const [papers,        setPapers]        = useState<Paper[]>([]);
  const [error,         setError]         = useState("");
  const [pollingActive, setPollingActive] = useState(true);
  const [customPrompt,  setCustomPrompt]  = useState("");
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);
  const [initialLoad,   setInitialLoad]   = useState(true);

  const pollStatus = useCallback(async () => {
    try {
      const s = await researchApi.getStatus(sessionId);
      
      // If we were submitting and status switched to processing, we can clear the loading state
      if (s.status === "processing" || s.status === "pending") {
        setIsSubmitting(false);
      }

      if (s.status === "complete") {
        setPollingActive(false);
        const [sols, fetchedPapers] = await Promise.all([
          researchApi.getSolutions(sessionId),
          researchApi.getPapers(sessionId)
        ]);
        setSolutions(sols);
        setPapers(fetchedPapers);
        setStatus(s); // Wait until solutions are fetched before showing the complete screen
      } else if (s.status === "failed") {
        setPollingActive(false);
        const errorMsg = s.current_step === "No papers found" 
          ? "No relevant papers found for this query." 
          : "Pipeline failed: You may have run out of API tokens for the day. Please try again tomorrow.";
        setError(errorMsg);
        toast.error(errorMsg, { duration: 6000 });
        setStatus(s);
      } else {
        setStatus(s);
      }
    } catch (e: any) {
      setError(e.message);
      setPollingActive(false);
      setIsSubmitting(false);
    } finally {
      setInitialLoad(false);
    }
  }, [sessionId]);

  useEffect(() => { pollStatus(); }, [pollStatus]);

  useEffect(() => {
    if (!pollingActive) return;
    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [pollingActive, pollStatus]);

  const activeStepIndex = (() => {
    if (!status) return 0;
    const p = status.progress_pct;
    if (p < 15) return 0;
    if (p < 30) return 1;
    if (p < 55) return 2;
    if (p < 70) return 3;
    if (p < 85) return 4;
    return 5;
  })();

  const progressPct = status?.progress_pct ?? 0;

  const handleGenerateMore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await researchApi.generateMoreSession(sessionId, customPrompt.trim(), 2);
      setCustomPrompt("");
      setPollingActive(true); // resume polling to track new progress
    } catch (err: any) {
      setError(err.message || "Failed to generate more solutions");
      setIsSubmitting(false);
    }
  };

  const handleDeleteSolution = async (id: string) => {
    if (!confirm("Are you sure you want to delete this solution?")) return;
    setDeletingId(id);
    try {
      await solutionsApi.delete(id);
      setSolutions(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete solution");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page-wrapper" style={{ minHeight: "100vh" }}>
      <Toaster position="bottom-center" toastOptions={{ style: { background: '#1e1e2d', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />

      {/* ── Ambient Glow ── */}
      <div className="bg-orbs">
        <div className="bg-orb" style={{
          width: "700px", height: "400px",
          top: "0", left: "50%", transform: "translateX(-50%)",
          background: "radial-gradient(ellipse, rgba(239,68,68,0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
        }} />
        <div className="bg-orb" style={{
          width: "400px", height: "400px",
          bottom: "10%", right: "5%",
          background: "radial-gradient(ellipse, rgba(139,92,246,0.07) 0%, transparent 70%)",
          filter: "blur(80px)",
        }} />
      </div>

      {/* ── Nav ── */}
      <header style={{
        position: "relative", zIndex: 50,
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)",
        background: "rgba(4,5,10,0.7)",
      }}>
        <nav style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1rem 2rem", maxWidth: "1200px", margin: "0 auto",
        }}>
          <button
            onClick={() => router.push("/")}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              color: "rgba(255,255,255,0.45)", background: "none", border: "none",
              cursor: "pointer", fontSize: "0.875rem", transition: "color 0.2s",
              padding: "0.4rem 0.75rem", borderRadius: "8px",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = "rgba(255,255,255,0.9)";
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = "rgba(255,255,255,0.45)";
              e.currentTarget.style.background = "none";
            }}
          >
            <ArrowLeft size={15} /> Back
          </button>

          <motion.a 
            href="/" 
            className="group" 
            style={{ display: "flex", alignItems: "center", gap: "1rem", textDecoration: "none" }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <OmnixLogo size={32} />
            <span className="transition-colors duration-300 group-hover:text-white" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>
              OmnicrossX <span className="gradient-text">AI</span>
            </span>
          </motion.a>

          <div style={{ width: "80px" }} />
        </nav>
      </header>

      {/* ── Main Content ── */}
      <div style={{ position: "relative", zIndex: 10, maxWidth: "860px", margin: "0 auto", padding: "4rem 1.5rem 6rem" }}>

        {initialLoad ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <OmnixLogo size={64} loading={true} />
            <p className="text-white/40 text-sm mt-4">Loading session...</p>
          </div>
        ) : (
          <>
            {/* ── Error Banner ── */}
            <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              style={{
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "16px", padding: "1.25rem 1.5rem", marginBottom: "2rem",
                display: "flex", alignItems: "flex-start", gap: "1rem",
              }}
            >
              <AlertCircle color="#f87171" size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "#f87171", marginBottom: "0.25rem" }}>
                  Research Failed
                </h3>
                <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.5)" }}>{error}</p>
                <button
                  onClick={() => router.push("/")}
                  style={{
                    marginTop: "0.75rem", fontSize: "0.8rem", color: "#ef4444",
                    background: "none", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "0.4rem",
                  }}
                >
                  <RefreshCw size={13} /> Try Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════
            PROCESSING STATE
        ══════════════════════════════════════════════ */}
        {status?.status !== "complete" && !error && (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

            {/* ── Hero header ── */}
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              {/* Status pill */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: "99px", padding: "0.35rem 1rem", marginBottom: "1.5rem",
                  fontSize: "0.78rem", color: "#fca5a5",
                }}
              >
                <span style={{
                  width: "7px", height: "7px", borderRadius: "50%",
                  background: "#fca5a5",
                  animation: "pulse-dot 1.8s ease-in-out infinite",
                  display: "inline-block",
                }} />
                Research in progress
              </motion.div>

              <h1 style={{
                fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 5vw, 2.75rem)",
                fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.75rem",
                lineHeight: 1.1,
              }}>
                Analyzing Research Papers
              </h1>

              <p style={{ color: "rgba(255,255,255,0.38)", fontSize: "0.9rem" }}>
                {status?.current_step || "Initializing pipeline…"}
              </p>
            </div>

            {/* ── Progress bar ── */}
            <div style={{ marginBottom: "2.5rem", maxWidth: "520px", margin: "0 auto 2.5rem" }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: "0.72rem", color: "rgba(255,255,255,0.28)", marginBottom: "0.5rem",
              }}>
                <span>Progress</span>
                <span style={{ fontFamily: "var(--font-mono)", color: progressPct > 0 ? "#fca5a5" : "rgba(255,255,255,0.28)" }}>
                  {progressPct}%
                </span>
              </div>
              <div style={{
                height: "5px", borderRadius: "99px",
                background: "rgba(255,255,255,0.06)", overflow: "hidden",
                position: "relative",
              }}>
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
                  style={{
                    height: "100%", borderRadius: "99px",
                    background: "linear-gradient(90deg, #ef4444, #fca5a5)",
                    boxShadow: "0 0 12px rgba(239,68,68,0.5)",
                  }}
                />
                {/* Shimmer */}
                {progressPct < 100 && progressPct > 0 && (
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 2s infinite linear",
                  }} />
                )}
              </div>
            </div>

            {/* ── Step cards grid ── */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.875rem",
              marginBottom: "3rem",
            }}>
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isDone   = i < activeStepIndex;
                const isActive = i === activeStepIndex;
                const isPending = !isDone && !isActive;

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                    style={{
                      background: isActive
                        ? "rgba(239,68,68,0.07)"
                        : isDone
                        ? "rgba(16,185,129,0.05)"
                        : "rgba(13,15,26,0.6)",
                      border: isActive
                        ? "1px solid rgba(239,68,68,0.45)"
                        : isDone
                        ? "1px solid rgba(16,185,129,0.25)"
                        : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "14px",
                      padding: "1.1rem 1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                      backdropFilter: "blur(16px)",
                      transition: "border-color 0.3s, background 0.3s",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Glow for active */}
                    {isActive && (
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.08) 0%, transparent 70%)",
                        pointerEvents: "none",
                      }} />
                    )}

                    {/* Icon + Spinner */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{
                        width: "32px", height: "32px", borderRadius: "9px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: isDone
                          ? "rgba(16,185,129,0.12)"
                          : isActive
                          ? "rgba(239,68,68,0.15)"
                          : "rgba(255,255,255,0.04)",
                        border: isDone
                          ? "1px solid rgba(16,185,129,0.2)"
                          : isActive
                          ? "1px solid rgba(239,68,68,0.25)"
                          : "1px solid rgba(255,255,255,0.06)",
                        flexShrink: 0,
                      }}>
                        {isDone ? (
                          <CheckCircle size={15} color="#10b981" />
                        ) : isActive ? (
                          <span style={{
                            display: "block", width: "13px", height: "13px",
                            border: "2px solid rgba(239,68,68,0.3)",
                            borderTopColor: "#ef4444",
                            borderRadius: "50%",
                            animation: "spin 0.7s linear infinite",
                          }} />
                        ) : (
                          <Icon size={14} color="rgba(255,255,255,0.2)" />
                        )}
                      </div>

                      {/* Step number */}
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "0.65rem",
                        color: isDone ? "rgba(16,185,129,0.5)" : isActive ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.12)",
                      }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>

                    {/* Label */}
                    <span style={{
                      fontSize: "0.78rem", fontWeight: 500, lineHeight: 1.35,
                      color: isDone ? "rgba(16,185,129,0.85)" : isActive ? "#fca5a5" : "rgba(255,255,255,0.22)",
                    }}>
                      {step.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Stats ── */}
            {status && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                style={{
                  display: "flex", justifyContent: "center", gap: "1px",
                  background: "rgba(255,255,255,0.04)", borderRadius: "16px",
                  overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {[
                  { label: "Papers Found",   value: status.papers_found,          icon: "📄" },
                  { label: "Embeddings",     value: status.embeddings_generated,  icon: "🧠" },
                  { label: "Solutions",      value: status.solutions_count,       icon: "✨" },
                ].map((stat, i) => (
                  <div
                    key={stat.label}
                    style={{
                      flex: 1, textAlign: "center",
                      padding: "1.4rem 1rem",
                      background: "rgba(13,15,26,0.6)",
                      borderRight: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}
                  >
                    <div style={{ fontSize: "1.1rem", marginBottom: "0.4rem" }}>{stat.icon}</div>
                    <motion.div
                      key={stat.value}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      style={{
                        fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 700,
                        background: "linear-gradient(135deg, #ef4444, #fca5a5)",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        lineHeight: 1, marginBottom: "0.3rem",
                      }}
                    >
                      {stat.value}
                    </motion.div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em" }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

          </motion.div>
        )}

        {/* ══════════════════════════════════════════════
            COMPLETE STATE
        ══════════════════════════════════════════════ */}
        {status?.status === "complete" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                style={{
                  width: "64px", height: "64px", borderRadius: "20px",
                  margin: "0 auto 1.25rem",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.25)",
                  boxShadow: "0 0 32px rgba(16,185,129,0.15)",
                }}
              >
                <CheckCircle size={28} color="#10b981" />
              </motion.div>
              <h1 style={{
                fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,4vw,2.5rem)",
                fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.5rem",
              }}>
                Research Complete
              </h1>
              <p style={{ color: "rgba(255,255,255,0.38)", fontSize: "0.9rem" }}>
                Analyzed {status.papers_found} papers · Generated {solutions.length} solutions
              </p>
            </div>

            {/* Solution cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem", marginBottom: "2.5rem" }}>
              {solutions.map((sol, i) => (
                <motion.div
                  key={sol.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <SolutionCardComponent 
                    solution={sol} 
                    sessionId={sessionId} 
                    index={i} 
                    onDelete={handleDeleteSolution}
                    isDeleting={deletingId === sol.id}
                  />
                </motion.div>
              ))}
            </div>

            {/* Custom Generate Chat Box */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.3 }}
              style={{ marginBottom: "4rem" }}
            >
              <form onSubmit={handleGenerateMore} style={{
                position: "relative",
                background: "rgba(13,15,26,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
                padding: "0.5rem",
                display: "flex",
                alignItems: "center",
                boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                backdropFilter: "blur(20px)"
              }}>
                <input
                  type="text"
                  placeholder="Need something specific? (e.g. 'Generate 2 more focusing on cheap materials...')"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    padding: "0.75rem 1rem",
                    color: "white",
                    fontSize: "0.95rem",
                    fontFamily: "var(--font-sans)",
                  }}
                />
                <button
                  type="submit"
                  disabled={!customPrompt.trim() || isSubmitting}
                  style={{
                    background: (!customPrompt.trim() || isSubmitting) ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #ef4444, #fca5a5)",
                    border: "none",
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: (!customPrompt.trim() || isSubmitting) ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    color: (!customPrompt.trim() || isSubmitting) ? "rgba(255,255,255,0.3)" : "#fff",
                  }}
                >
                  {isSubmitting ? <OmnixLogo size={28} loading={true} /> : <Send size={18} style={{ marginLeft: "2px" }} />}
                </button>
              </form>
            </motion.div>

            {/* Papers List */}
            {papers.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <h3 style={{
                  fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 700,
                  marginBottom: "1rem", color: "rgba(255,255,255,0.9)",
                  display: "flex", alignItems: "center", gap: "0.5rem"
                }}>
                  <FileText size={18} color="#fca5a5" />
                  Analyzed Papers
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {papers.map((paper, i) => (
                    <a
                      key={paper.id || i}
                      href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex", alignItems: "flex-start", gap: "1rem",
                        padding: "1.25rem", background: "rgba(13,15,26,0.6)",
                        border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px",
                        textDecoration: "none", transition: "all 0.2s",
                        cursor: "pointer"
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(239,68,68,0.04)";
                        e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(13,15,26,0.6)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <h4 style={{ 
                          fontSize: "1rem", fontWeight: 600, color: "rgba(255,255,255,0.95)",
                          marginBottom: "0.4rem", lineHeight: 1.4
                        }}>
                          {paper.title}
                        </h4>
                        <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
                          {paper.authors.join(", ")} · arXiv:{paper.arxiv_id}
                        </div>
                      </div>
                      <div style={{
                        padding: "0.4rem 0.75rem", borderRadius: "6px",
                        background: "rgba(255,255,255,0.04)", fontSize: "0.75rem",
                        color: "rgba(255,255,255,0.6)", flexShrink: 0
                      }}>
                        View on arXiv
                      </div>
                    </a>
                  ))}
                </div>
              </motion.div>
            )}

          </motion.div>
        )}
        </>
        )}

      </div>
    </div>
  );
}
