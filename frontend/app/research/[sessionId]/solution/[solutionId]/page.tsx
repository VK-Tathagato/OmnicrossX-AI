// Force hot reload
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, BookOpen, Lightbulb, CheckCircle2, AlertTriangle,
  Wrench, TrendingUp, DollarSign, Atom, ExternalLink, Copy,
  Download, MessageSquare, ChevronDown, ChevronUp,
  Send, Bot, User, X, Brain
} from "lucide-react";
import { solutionsApi, chatApi } from "@/lib/api/client";
import { OmnixLogo } from "@/components/ui/Logo";

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.round(value * 100);
  const r = 28, circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 72 72" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(.23,1,.32,1)" }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>{pct}%</span>
      </div>
      <span className="text-[11px] text-white/40">{label}</span>
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass rounded-2xl border border-white/5 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)" }}>
            <Icon size={16} className="text-[#ef4444]" />
          </div>
          <span className="font-semibold text-white text-sm" style={{ fontFamily: "Space Grotesk,sans-serif" }}>{title}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-white/30" /> : <ChevronDown size={16} className="text-white/30" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-1 text-sm text-white/60 leading-relaxed">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatPanel({ sessionId, solutionId }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    chatApi.getHistory(sessionId, solutionId).then((r: any) => setMessages(r.messages || [])).catch(() => {});
  }, [sessionId, solutionId]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { id: Date.now().toString(), role: "user", content: input, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const reply = await chatApi.send(sessionId, input, solutionId);
      setMessages(prev => [...prev, reply]);
    } catch (e: any) {
      setMessages(prev => [...prev, { id: "err", role: "assistant", content: "Error: " + e.message, created_at: "" }]);
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTIONS = [
    "How could this be implemented practically?",
    "What are the main technical challenges?",
    "Are there lower-cost alternatives?",
    "Compare to conventional approaches",
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#ef4444,#fca5a5)" }}>
            <Bot size={14} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white" style={{ fontFamily: "Space Grotesk,sans-serif" }}>Research Assistant</div>
            <div className="text-[11px] text-white/30">Context-aware · Cites sources</div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Bot size={28} className="text-white/10 mx-auto mb-3" />
            <p className="text-xs text-white/30 mb-4">Ask anything about this solution</p>
            <div className="space-y-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => setInput(s)} className="w-full text-left text-xs px-3 py-2 rounded-xl glass glass-hover border border-white/5 text-white/40 hover:text-white/70 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-1" style={{ background: "linear-gradient(135deg,#ef4444,#fca5a5)" }}>
                <Bot size={12} className="text-white" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${msg.role === "user" ? "chat-bubble-user text-white" : "chat-bubble-assistant text-white/80"}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.citations?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                  {msg.citations.map((c: any, i: number) => (
                    <div key={i} className="text-[10px] text-white/30 truncate">📄 {c.title}</div>
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-1 bg-white/10">
                <User size={12} className="text-white/60" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#ef4444,#fca5a5)" }}>
              <Bot size={12} className="text-white" />
            </div>
            <div className="chat-bubble-assistant rounded-2xl px-4 py-3 flex gap-1 items-center">
              {[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-white/5">
        <div className="flex gap-2">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask a follow-up question..." rows={2}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 resize-none focus:outline-none focus:border-[rgba(239,68,68,0.4)]" />
          <button onClick={send} disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 self-end disabled:opacity-30 transition-all hover:opacity-80"
            style={{ background: "linear-gradient(135deg,#ef4444,#fca5a5)" }}>
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SolutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const solutionId = params.solutionId as string;
  const [solution, setSolution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    solutionsApi.get(solutionId).then(setSolution).catch((e: any) => setError(e.message)).finally(() => setLoading(false));
  }, [solutionId]);

  const copyCitations = () => {
    if (!solution) return;
    const refs = solution.citations.map((c: any, i: number) => `[${i+1}] ${c.title}. arXiv:${c.arxiv_id}`).join("\n");
    navigator.clipboard.writeText(refs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center relative z-10 p-6">
      <div className="mx-auto text-center">
        <div className="flex justify-center mb-4 mt-2">
          <OmnixLogo size={64} loading={true} />
        </div>
        <p className="text-white/40 text-sm">Loading solution...</p>
      </div>
    </div>
  );

  if (error || !solution) return (
    <div className="min-h-screen bg-grid flex items-center justify-center">
      <div className="glass rounded-2xl p-8 text-center max-w-sm">
        <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-2">Failed to load</h2>
        <p className="text-sm text-white/40 mb-4">{error}</p>
        <button onClick={() => router.back()} className="text-sm text-[#ef4444]">← Go back</button>
      </div>
    </div>
  );

  const fc = solution.full_content || {};

  return (
    <main className="min-h-screen bg-grid">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[500px] h-[300px] rounded-full bg-[#ef4444] opacity-[0.04] blur-[100px]" />
      </div>

      <nav className="sticky top-0 z-30 glass border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <button onClick={() => router.push(`/research/${sessionId}`)} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm flex-shrink-0">
              <ArrowLeft size={16} /> Back
            </button>
            <motion.a 
              href="/" 
              className="hidden sm:flex items-center gap-2 text-decoration-none group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <OmnixLogo size={28} />
              <span className="transition-colors duration-300 group-hover:text-white text-white/80" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.02em" }}>
                OmnicrossX <span className="gradient-text">AI</span>
              </span>
            </motion.a>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {solution.is_speculative && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                <AlertTriangle size={12} /> Speculative
              </div>
            )}
            <button onClick={copyCitations} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl glass border border-white/10 text-white/50 hover:text-white transition-colors">
              <Copy size={12} /> {copied ? "Copied!" : "Citations"}
            </button>
            <a href={solutionsApi.exportUrl(solutionId)} download className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl glass border border-white/10 text-white/50 hover:text-white transition-colors">
              <Download size={12} /> Export
            </a>
            <button onClick={() => setChatOpen(!chatOpen)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs text-white font-medium transition-all"
              style={{ background: chatOpen ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)" }}>
              <MessageSquare size={13} /> {chatOpen ? "Close Chat" : "Ask AI"}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-6">
          <div className={`flex-1 min-w-0 space-y-4 transition-all duration-300 ${chatOpen ? "lg:max-w-[calc(100%-380px)]" : ""}`}>
            {/* Header */}
            <div className="glass rounded-2xl p-6 border border-white/5">
              <div className="flex flex-wrap gap-2 mb-3">
                {solution.domains?.map((d: string) => <span key={d} className="tag">{d}</span>)}
                {solution.tags?.slice(0, 4).map((t: string) => <span key={t} className="tag">{t}</span>)}
              </div>
              <h1 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: "Space Grotesk,sans-serif" }}>{solution.title}</h1>
              <p className="text-white/60 leading-relaxed text-sm mb-6">{solution.summary}</p>
              <div className="flex gap-6 flex-wrap">
                <ScoreRing value={solution.feasibility_score} label="Feasibility" color={solution.feasibility_score >= 0.7 ? "#f87171" : "#f59e0b"} />
                <ScoreRing value={solution.cost_score} label="Cost Score" color={solution.cost_score >= 0.7 ? "#f87171" : "#f59e0b"} />
                <ScoreRing value={solution.innovation_score} label="Innovation" color="#ef4444" />
                <ScoreRing value={solution.confidence_level} label="Confidence" color="#fecaca" />
              </div>
              {solution.is_speculative && (
                <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-400/80 leading-relaxed">
                    This solution contains speculative elements marked [HYPOTHESIS]. Always verify with domain experts before implementation.
                  </p>
                </div>
              )}
            </div>

            <Section title="The Idea" icon={Lightbulb}><p className="whitespace-pre-wrap">{fc.idea}</p></Section>
            <Section title="Why It Works" icon={Brain}><p className="whitespace-pre-wrap">{fc.why_it_works}</p></Section>

            <Section title="Advantages & Limitations" icon={TrendingUp}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle2 size={12} /> Advantages</div>
                  <ul className="space-y-2">{fc.advantages?.map((a: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5" />{a}</li>
                  ))}</ul>
                </div>
                <div>
                  <div className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Limitations</div>
                  <ul className="space-y-2">{fc.limitations?.map((l: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />{l}</li>
                  ))}</ul>
                </div>
              </div>
            </Section>

            <Section title="Feasibility Analysis" icon={CheckCircle2}><p className="whitespace-pre-wrap">{fc.feasibility_analysis}</p></Section>

            <Section title="Implementation Roadmap" icon={Wrench}>
              <ol className="space-y-3">{fc.implementation_ideas?.map((step: string, i: number) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", fontFamily: "JetBrains Mono,monospace" }}>{i+1}</span>
                  <span>{step}</span>
                </li>
              ))}</ol>
            </Section>

            <Section title="Cost & Economic Analysis" icon={DollarSign}><p className="whitespace-pre-wrap">{fc.cost_efficiency}</p></Section>

            {fc.possible_risks?.length > 0 && (
              <Section title="Possible Risks" icon={AlertTriangle} defaultOpen={false}>
                <ul className="space-y-2">{fc.possible_risks.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />{r}</li>
                ))}</ul>
              </Section>
            )}

            {fc.cross_domain_inspirations?.length > 0 && (
              <Section title="Cross-Domain Inspirations" icon={Atom} defaultOpen={false}>
                <ul className="space-y-2">{fc.cross_domain_inspirations.map((ins: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] flex-shrink-0 mt-1.5" />{ins}</li>
                ))}</ul>
              </Section>
            )}

            {solution.citations?.length > 0 && (
              <Section title="Source Papers & Citations" icon={BookOpen} defaultOpen={false}>
                <div className="space-y-3">{solution.citations.map((c: any, i: number) => (
                  <div key={c.paper_id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-mono text-white/30" style={{ fontFamily: "JetBrains Mono,monospace" }}>[{i+1}]</span>
                      <a href={`https://arxiv.org/abs/${c.arxiv_id}`} target="_blank" rel="noopener noreferrer" className="text-[#ef4444] hover:text-[#fca5a5] transition-colors">
                        <ExternalLink size={12} />
                      </a>
                    </div>
                    <p className="text-xs text-white/70 font-medium mb-1">{c.title}</p>
                    <p className="text-xs text-white/30 font-mono" style={{ fontFamily: "JetBrains Mono,monospace" }}>arXiv:{c.arxiv_id}</p>
                    {c.chunk_text && <p className="mt-2 text-xs text-white/40 italic leading-relaxed border-l-2 border-[rgba(239,68,68,0.3)] pl-3">"{c.chunk_text.slice(0,200)}..."</p>}
                  </div>
                ))}</div>
              </Section>
            )}
          </div>

          {/* Desktop Chat Panel */}
          <AnimatePresence>
            {chatOpen && (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 360, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.3 }}
                className="hidden lg:flex flex-col flex-shrink-0"
                style={{ height: "calc(100vh - 120px)", position: "sticky", top: "80px" }}>
                <div className="glass rounded-2xl border border-white/5 h-full flex flex-col overflow-hidden">
                  <ChatPanel sessionId={sessionId} solutionId={solutionId} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Chat Overlay */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(4,5,10,0.97)" }}>
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <span className="font-semibold text-sm text-white" style={{ fontFamily: "Space Grotesk,sans-serif" }}>Research Assistant</span>
              <button onClick={() => setChatOpen(false)} className="text-white/40 hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex-1 min-h-0"><ChatPanel sessionId={sessionId} solutionId={solutionId} /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
