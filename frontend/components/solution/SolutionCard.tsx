import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Brain, Lightbulb, TrendingUp, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { SolutionCard } from "@/lib/api/client";
import { OmnixLogo } from "@/components/ui/Logo";

interface Props {
  solution: SolutionCard;
  sessionId: string;
  index: number;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

export default function SolutionCardComponent({ solution, sessionId, index, onDelete, isDeleting }: Props) {
  const confidencePct = Math.round(solution.confidence_level * 100);
  const confidenceColor =
    confidencePct >= 75 ? "#10b981" : confidencePct >= 50 ? "#fca5a5" : "#f97316";

  return (
    <div className="glass-card solution-card-root p-6 md:p-8 flex flex-col relative overflow-hidden group">
      {/* Decorative gradient blob */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-red-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-red-500/10 transition-colors duration-500" />

      {/* ── Mobile-only confidence banner ── */}
      <div className="solution-mobile-confidence-banner">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: confidenceColor,
                boxShadow: `0 0 8px ${confidenceColor}`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "0.68rem",
                color: "rgba(255,255,255,0.45)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                fontWeight: 600,
              }}
            >
              Confidence
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 800,
                fontSize: "1.55rem",
                lineHeight: 1,
                color: confidenceColor,
                letterSpacing: "-0.02em",
              }}
            >
              {confidencePct}%
            </span>
            {onDelete && (
              <button
                onClick={() => onDelete(solution.id)}
                disabled={isDeleting}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete solution"
              >
                {isDeleting ? <OmnixLogo size={24} loading={true} /> : <Trash2 size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
              Solution {index + 1}
            </span>
            {solution.is_speculative && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                <Sparkles size={12} />
                Hypothesis
              </span>
            )}
          </div>
          <h2
            className="text-xl md:text-2xl font-bold text-white mb-2"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            {solution.title}
          </h2>
        </div>

        {/* Desktop-only: Confidence Score & Delete */}
        <div className="solution-desktop-confidence flex flex-col items-end flex-shrink-0 gap-2">
          {onDelete && (
            <button
              onClick={() => onDelete(solution.id)}
              disabled={isDeleting}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete solution"
            >
              {isDeleting ? <OmnixLogo size={24} loading={true} /> : <Trash2 size={14} />}
            </button>
          )}
          <div className="text-right mt-1">
            <div
              className="text-3xl font-black gradient-text"
              style={{ fontFamily: "Space Grotesk, sans-serif", lineHeight: 1 }}
            >
              {confidencePct}%
            </div>
            <div className="text-[10px] text-white/40 font-medium tracking-wide uppercase mt-1">
              Confidence
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <p className="text-white/60 text-sm md:text-base leading-relaxed mb-6 max-w-3xl relative z-10">
        {solution.summary}
      </p>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3 mb-6 relative z-10">
        <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
          <TrendingUp size={16} className="text-emerald-400 mb-1" />
          <span className="text-lg font-bold text-white">{solution.feasibility_score}/10</span>
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Feasibility</span>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
          <Brain size={16} className="text-blue-400 mb-1" />
          <span className="text-lg font-bold text-white">{solution.innovation_score}/10</span>
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Innovation</span>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
          <Lightbulb size={16} className="text-amber-400 mb-1" />
          <span className="text-lg font-bold text-white">{solution.cost_score}/10</span>
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Cost Efficiency</span>
        </div>
      </div>

      {/* Tags & Action */}
      <div className="mt-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-white/5 relative z-10">
        <div className="flex flex-wrap gap-2">
          {solution.domains.slice(0, 3).map((domain, i) => (
            <span
              key={i}
              className="text-[11px] font-medium text-white/50 bg-white/5 border border-white/10 px-2 py-1 rounded-md"
            >
              {domain}
            </span>
          ))}
        </div>

        <Link
          href={`/research/${sessionId}/solution/${solution.id}`}
          className="nav-cta flex items-center gap-2 flex-shrink-0 group w-full sm:w-auto justify-center"
        >
          View Full Analysis
          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
