"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, Bookmark, Search, BookOpen, ArrowRight, User, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OmnixLogo } from "@/components/ui/Logo";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [sessions, setSessions] = useState<any[]>([]);
  const [saved, setSaved] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("history");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      supabase.from("research_sessions").select("*").eq("user_id", data.user.id).order("created_at", { ascending: false }).limit(20).then(r => setSessions(r.data || []));
      supabase.from("saved_items").select("*, solutions(title, summary, feasibility_score, session_id)").eq("user_id", data.user.id).eq("item_type", "solution").order("created_at", { ascending: false }).limit(20).then(r => setSaved(r.data || []));
    });
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); router.push("/"); };
  const statusColor: Record<string, string> = { complete: "#10b981", processing: "#6378ff", pending: "#f59e0b", failed: "#f43f5e" };
  const TABS = [{ id: "history", label: "Research History", icon: Clock }, { id: "saved", label: "Saved Solutions", icon: Bookmark }];

  return (
    <div className="page-wrapper" style={{ minHeight: "100vh" }}>
      <div className="bg-orbs"><div className="bg-orb" style={{ width: "400px", height: "300px", top: "10%", right: "10%", background: "radial-gradient(ellipse, rgba(167,139,250,0.07) 0%, transparent 70%)", filter: "blur(80px)" }} /></div>
      <header style={{ position: "relative", zIndex: 50, borderBottom: "1px solid rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", background: "rgba(4,5,10,0.7)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem" }}>
          <button onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "none", border: "none", cursor: "pointer", textDecoration: "none" }}>
            <OmnixLogo size={32} />
            <span className="gradient-text" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem" }}>OmnicrossX AI</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: "0.4rem" }}><User size={14} />{(user as any)?.email}</span>
            <button onClick={signOut} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}><LogOut size={14} /> Sign Out</button>
          </div>
        </div>
      </header>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2.5rem 1.5rem 5rem", position: "relative", zIndex: 10 }}>
        <div className="mb-8 flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white mb-1" style={{fontFamily:"Space Grotesk,sans-serif"}}>Dashboard</h1><p className="text-white/40 text-sm">Your research history and saved solutions</p></div>
          <button onClick={() => router.push("/")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white font-medium" style={{background:"linear-gradient(135deg,#6378ff,#a78bfa)"}}><Search size={16} /> New Research</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[{label:"Total Searches",value:sessions.length,color:"#6378ff"},{label:"Completed",value:sessions.filter(s=>s.status==="complete").length,color:"#10b981"},{label:"Saved Solutions",value:saved.length,color:"#a78bfa"},{label:"Papers Analyzed",value:sessions.reduce((acc,s)=>acc+(s.papers_found||0),0),color:"#22d3ee"}].map(stat=>(
            <div key={stat.label} className="glass rounded-2xl p-4 border border-white/5">
              <p className="text-xs text-white/40 mb-2">{stat.label}</p>
              <div className="text-2xl font-bold" style={{color:stat.color,fontFamily:"Space Grotesk,sans-serif"}}>{stat.value}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-xl glass border border-white/5 mb-6 w-fit">
          {TABS.map(tab=>{const Icon=tab.icon;const active=activeTab===tab.id;return(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${active?"text-white":"text-white/40 hover:text-white/70"}`} style={active?{background:"rgba(99,120,255,0.2)"}:{}}>
              <Icon size={14} />{tab.label}
            </button>
          );})}
        </div>
        {activeTab==="history" && (
          <div className="space-y-3">
            {sessions.length===0?(<div className="glass rounded-2xl p-12 text-center border border-white/5"><p className="text-white/30 text-sm">No research sessions yet.</p><button onClick={()=>router.push("/")} className="mt-4 text-sm text-[#6378ff]">Start your first research →</button></div>)
            :sessions.map((sess,i)=>(
              <motion.button key={sess.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
                onClick={()=>router.push(`/research/${sess.id}`)} className="w-full text-left glass glass-hover rounded-2xl p-5 border border-white/5 hover:border-[rgba(99,120,255,0.25)] transition-all group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full" style={{background:statusColor[sess.status]||"#fff"}} />
                      <span className="text-xs text-white/30 capitalize">{sess.status}</span>
                      {sess.papers_found>0&&<span className="text-xs text-white/20">· {sess.papers_found} papers</span>}
                      <span className="text-xs text-white/20 ml-auto">{new Date(sess.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-white/80 font-medium leading-relaxed group-hover:text-white transition-colors">{sess.query}</p>
                  </div>
                  <ArrowRight size={16} className="text-white/20 group-hover:text-[#6378ff] transition-colors flex-shrink-0 mt-1" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
        {activeTab==="saved" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {saved.length===0?(<div className="col-span-2 glass rounded-2xl p-12 text-center border border-white/5"><Bookmark size={32} className="text-white/10 mx-auto mb-3" /><p className="text-white/30 text-sm">No saved solutions yet.</p></div>)
            :saved.map((item,i)=>{const sol=item.solutions;if(!sol)return null;return(
              <motion.button key={item.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
                onClick={()=>router.push(`/research/${sol.session_id}/solution/${item.item_id}`)} className="text-left glass glass-hover rounded-2xl p-5 border border-white/5 hover:border-[rgba(99,120,255,0.25)] transition-all group">
                <h3 className="text-sm font-semibold text-white mb-2 group-hover:gradient-text transition-all" style={{fontFamily:"Space Grotesk,sans-serif"}}>{sol.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed mb-3 line-clamp-2">{sol.summary}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/30">{Math.round(sol.feasibility_score*100)}% feasible</span>
                  <ArrowRight size={14} className="text-white/20 group-hover:text-[#6378ff] transition-colors" />
                </div>
              </motion.button>
            );})}
          </div>
        )}
      </div>
    </div>
  );
}