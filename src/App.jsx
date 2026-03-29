// ============================================================
// STUDYMIND AI v3 — Backend Reale con Supabase
// ============================================================
// SETUP (fai questo prima di usare):
//
// 1. Installa dipendenze:
//    npm install @supabase/supabase-js
//
// 2. Crea file .env.local nella root del progetto:
//    VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
//    VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
//    (le trovi in Supabase > Settings > API)
//
// 3. Esegui il file supabase_schema.sql nel SQL Editor di Supabase
//
// 4. In Supabase > Authentication > Settings:
//    - Disabilita "Confirm email" (per i test)
//
// ============================================================

import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase Client ─────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Design Tokens ────────────────────────────────────────────
const C = {
  bg: "#07070A", card: "#0F0F13", card2: "#161619",
  border: "#1F1F26", borderHi: "#2E2E3A",
  accent: "#F5C842", accentSoft: "rgba(245,200,66,0.10)", accentMid: "rgba(245,200,66,0.22)",
  text: "#EDEAE0", textDim: "#9B9AA8", muted: "#4A4A58",
  green: "#3DD68C", red: "#F87171", blue: "#60A5FA", purple: "#A78BFA",
};
const FD = "'Syne', sans-serif";
const FB = "'DM Sans', sans-serif";
const PC  = { high: C.red, medium: C.accent, low: C.green };
const TI  = { school:"📚", personal:"🎯", study:"🧠", sport:"🏀", other:"📌" };
const TL  = { school:"Scuola", personal:"Personale", study:"Studio", sport:"Sport", other:"Altro" };
const MONTHS = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const DAYS   = ["D","L","M","M","G","V","S"];
const POM    = [{ l:"25/5", w:25, r:5 },{ l:"50/10", w:50, r:10 },{ l:"90/15", w:90, r:15 }];
const NOW    = () => new Date().toISOString().split("T")[0];

// ── Demo events per nuovi utenti ────────────────────────────
const buildDemoEvents = (userId) => {
  const add = d => { const x = new Date(); x.setDate(x.getDate()+d); return x.toISOString().split("T")[0]; };
  return [
    { user_id:userId, title:"Verifica Matematica",   date:add(2), type:"school",   priority:"high",   done:false, note:"Capitoli 4-6: integrali" },
    { user_id:userId, title:"Consegna progetto PHP",  date:add(3), type:"school",   priority:"high",   done:false, note:"Login + CRUD database" },
    { user_id:userId, title:"Allenamento basket",     date:add(1), type:"sport",    priority:"medium", done:false, note:"" },
    { user_id:userId, title:"Interrogazione Storia",  date:add(5), type:"school",   priority:"medium", done:false, note:"Prima guerra mondiale" },
    { user_id:userId, title:"Ripasso Reti",           date:add(1), type:"study",    priority:"high",   done:false, note:"Modello OSI + TCP/IP" },
  ];
};

// ── Hook: Auth ───────────────────────────────────────────────
function useAuth() {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Controlla sessione esistente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user);
      else setLoading(false);
    });
    // Ascolta cambiamenti auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user);
      else { setUser(null); setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (authUser) => {
    setUser(authUser);
    const { data } = await supabase.from("profiles").select("*").eq("id", authUser.id).single();
    setProfile(data);
    setLoading(false);
  };

  const signUp = async ({ name, email, password, classe }) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, classe } }
    });
    if (error) throw error;
  };

  const signIn = async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, profile, loading, signUp, signIn, signOut };
}

// ── Hook: Events ─────────────────────────────────────────────
function useEvents(userId) {
  const [events,  setEvents]  = useState([]);
  const [evLoad,  setEvLoad]  = useState(true);

  useEffect(() => {
    if (!userId) return;
    loadEvents();
    // Realtime subscription — aggiornamenti in tempo reale
    const sub = supabase
      .channel("events")
      .on("postgres_changes", { event:"*", schema:"public", table:"events", filter:`user_id=eq.${userId}` },
        () => loadEvents())
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [userId]);

  const loadEvents = async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true });
    if (data !== null) {
      if (data.length === 0) {
        // Primo accesso: inserisci demo events
        const demos = buildDemoEvents(userId);
        const { data: inserted } = await supabase.from("events").insert(demos).select();
        setEvents(inserted || []);
      } else {
        setEvents(data);
      }
    }
    setEvLoad(false);
  };

  const addEvent = async (ev) => {
    const { data } = await supabase.from("events").insert({ ...ev, user_id: userId }).select().single();
    if (data) setEvents(p => [...p, data]);
  };

  const toggleDone = async (id, current) => {
    await supabase.from("events").update({ done: !current }).eq("id", id);
    setEvents(p => p.map(e => e.id===id ? {...e, done:!current} : e));
  };

  const deleteEvent = async (id) => {
    await supabase.from("events").delete().eq("id", id);
    setEvents(p => p.filter(e => e.id!==id));
  };

  return { events, evLoad, addEvent, toggleDone, deleteEvent };
}

// ── Hook: Pomodoro ───────────────────────────────────────────
function usePomodoro(userId) {
  const [pomSes, setPomSes] = useState(0);
  const today = NOW();

  useEffect(() => {
    if (!userId) return;
    supabase.from("pomodoro_sessions").select("count").eq("user_id", userId).eq("date", today).maybeSingle()
	.then(({ data }) => { if (data) setPomSes(data.count); });
  }, [userId]);

  const incrementSession = async (preset) => {
    const newCount = pomSes + 1;
    setPomSes(newCount);
    await supabase.from("pomodoro_sessions").upsert({
      user_id: userId, date: today,
      count: newCount, minutes: newCount * POM[preset].w,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,date" });
  };

  return { pomSes, incrementSession };
}

// ── Hook: AI Messages ────────────────────────────────────────
function useMessages(userId, profile) {
  const [msgs, setMsgs] = useState([]);

  useEffect(() => {
    if (!userId) return;
    supabase.from("ai_messages").select("*").eq("user_id", userId)
      .order("created_at", { ascending: true }).limit(30)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMsgs(data.map(m => ({ role: m.role, text: m.content })));
        } else {
          setMsgs([{ role:"assistant", text:`Ciao ${profile?.name || ""}! 👋 Sono il tuo AI Coach. Dimmi come posso aiutarti con lo studio o i tuoi impegni.` }]);
        }
      });
  }, [userId]);

  const saveMessage = async (role, content) => {
    await supabase.from("ai_messages").insert({ user_id: userId, role, content });
  };

  const addMsg = (role, text) => {
    setMsgs(p => [...p, { role, text }]);
    saveMessage(role, text);
  };

  return { msgs, addMsg };
}

// ── MAIN APP ─────────────────────────────────────────────────
export default function StudyMindAI() {
  const { user, profile, loading, signUp, signIn, signOut } = useAuth();
  const { events, evLoad, addEvent, toggleDone, deleteEvent } = useEvents(user?.id);
  const { pomSes, incrementSession } = usePomodoro(user?.id);
  const { msgs, addMsg } = useMessages(user?.id, profile);

  // Auth state
  const [authTab,   setAuthTab]   = useState("login");
  const [loginForm, setLoginForm] = useState({ email:"", password:"" });
  const [regForm,   setRegForm]   = useState({ name:"", email:"", password:"", classe:"", birthYear:"", privacy:false });
  const [authErr,   setAuthErr]   = useState("");
  const [authLoad,  setAuthLoad]  = useState(false);

  // App state
  const [view,    setView]    = useState("dashboard");
  const [showAdd, setShowAdd] = useState(false);
  const [newEv,   setNewEv]   = useState({ title:"", date:"", type:"school", priority:"medium", note:"" });
  const [selEv,   setSelEv]   = useState(null);
  const [weekOff, setWeekOff] = useState(0);
  const [chatIn,  setChatIn]  = useState("");
  const [chatLoad,setChatLoad]= useState(false);

  // Pomodoro
  const [pomPre,  setPomPre]  = useState(0);
  const [pomPhase,setPomPhase]= useState("work");
  const [pomSecs, setPomSecs] = useState(25*60);
  const [pomRun,  setPomRun]  = useState(false);
  const timerRef = useRef(null);
  const chatEnd  = useRef(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  // Timer pomodoro
  useEffect(() => {
    if (pomRun) {
      timerRef.current = setInterval(() => {
        setPomSecs(s => {
          if (s <= 1) {
            clearInterval(timerRef.current);
            const p = POM[pomPre];
            if (pomPhase === "work") {
              setPomPhase("rest"); setPomSecs(p.r*60);
              incrementSession(pomPre);
            } else {
              setPomPhase("work"); setPomSecs(p.w*60);
            }
            setPomRun(false); return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [pomRun, pomPhase, pomPre]);

  const resetPom = (i=pomPre) => { clearInterval(timerRef.current); setPomRun(false); setPomPhase("work"); setPomSecs(POM[i].w*60); };
  const fmtT    = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const pomPct  = () => { const p=POM[pomPre]; const tot=(pomPhase==="work"?p.w:p.r)*60; return ((tot-pomSecs)/tot)*100; };

  // Calendario
  const weekDays = () => {
    const b=new Date(); b.setDate(b.getDate()-b.getDay()+weekOff*7);
    return Array.from({length:7},(_,i)=>{ const d=new Date(b); d.setDate(b.getDate()+i); return d.toISOString().split("T")[0]; });
  };
  const wd = weekDays();

  // Derived
  const today    = NOW();
  const upcoming = events.filter(e=>e.date>=today&&!e.done).sort((a,b)=>a.date.localeCompare(b.date));
  const done     = events.filter(e=>e.done);
  const urgent   = upcoming.filter(e=>e.priority==="high");
  const compRate = events.length ? Math.round(done.length/events.length*100) : 0;
  const fmtDate  = d => { const x=new Date(d+"T12:00:00"); return `${x.getDate()} ${MONTHS[x.getMonth()]}`; };
  const daysLeft = d => { const diff=Math.ceil((new Date(d)-new Date(today))/86400000); if(diff===0)return"Oggi"; if(diff===1)return"Domani"; if(diff<0)return"Scaduto"; return`${diff}g`; };

  // Auth handlers
  const handleLogin = async () => {
    setAuthErr(""); setAuthLoad(true);
    try { await signIn(loginForm); }
    catch (e) { setAuthErr("Email o password errati."); }
    setAuthLoad(false);
  };

  const handleRegister = async () => {
    setAuthErr(""); setAuthLoad(true);
    const { name, email, password, classe, birthYear, privacy } = regForm;
    if (!name||!email||!password||!birthYear) { setAuthErr("Compila tutti i campi obbligatori."); setAuthLoad(false); return; }
    if (password.length < 6) { setAuthErr("Password di almeno 6 caratteri."); setAuthLoad(false); return; }
    const year = parseInt(birthYear);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < 1900 || year > currentYear) { setAuthErr("Anno di nascita non valido."); setAuthLoad(false); return; }
    const age = currentYear - year;
    if (age < 16) { setAuthErr("Devi avere almeno 16 anni per registrarti a StudyMind AI."); setAuthLoad(false); return; }
    if (age > 100) { setAuthErr("Anno di nascita non valido."); setAuthLoad(false); return; }
    if (!privacy) { setAuthErr("Devi accettare la Privacy Policy per continuare."); setAuthLoad(false); return; }
    try { await signUp({ name, email, password, classe, birthYear }); }
    catch (e) { setAuthErr(e.message || "Errore durante la registrazione."); }
    setAuthLoad(false);
  };

  // AI Chat
  const sendMsg = async () => {
    if (!chatIn.trim()||chatLoad) return;
    const txt=chatIn.trim(); setChatIn("");
    addMsg("user", txt); setChatLoad(true);
    const ctx=upcoming.slice(0,8).map(e=>`- ${e.title} (${e.date}, ${TL[e.type]}, priorità ${e.priority}${e.note?", nota:"+e.note:""})`).join("\n");
    try {
      const systemPrompt = `Sei StudyMind AI, assistente personale per ${profile?.name}, studente al 5° anno di Informatica. Ama il basket.
Data oggi: ${today}. Classe: ${profile?.classe||"5° Informatica"}.
Impegni:\n${ctx||"Nessuno"}
Sessioni pomodoro oggi: ${pomSes}.
Rispondi in italiano, tono amichevole e diretto, max 4 frasi. Consigli pratici e specifici basati sui suoi impegni reali.`;
      const res=await fetch("/api/chat",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system: systemPrompt,
          messages:[...msgs.slice(-10).map(m=>({role:m.role,content:m.text})),{role:"user",content:txt}]
        })
      });
      const data=await res.json();
      const reply=data.content?.find(b=>b.type==="text")?.text||"Errore.";
      addMsg("assistant", reply);
    } catch { addMsg("assistant", "Errore di connessione. Riprova!"); }
    setChatLoad(false);
  };

  const handleAddEvent = async () => {
    if (!newEv.title||!newEv.date) return;
    await addEvent(newEv);
    setShowAdd(false); setNewEv({title:"",date:"",type:"school",priority:"medium",note:""});
  };

  // ── RENDER ───────────────────────────────────────────────────
  return (<>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      html,body{background:${C.bg}}
      ::-webkit-scrollbar{width:0}
      .app{width:100%;max-width:430px;height:100vh;margin:0 auto;background:${C.bg};color:${C.text};font-family:${FB};display:flex;flex-direction:column;position:relative;overflow:hidden}
      .splash{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
      .splash-logo{font-family:${FD};font-size:32px;font-weight:800;letter-spacing:-1px}
      .splash-logo em{color:${C.accent};font-style:normal}
      .splash-ring{width:40px;height:40px;border:3px solid ${C.border};border-top-color:${C.accent};border-radius:50%;animation:spin .8s linear infinite}
      @keyframes spin{to{transform:rotate(360deg)}}
      .auth-wrap{flex:1;overflow-y:auto}
      .auth-hero{background:${C.card};border-bottom:1px solid ${C.border};padding:52px 28px 28px;position:relative;overflow:hidden}
      .auth-glow{position:absolute;top:-60px;right:-60px;width:240px;height:240px;background:radial-gradient(circle,rgba(245,200,66,0.12),transparent 70%);pointer-events:none}
      .auth-logo{font-family:${FD};font-size:26px;font-weight:800;letter-spacing:-0.5px;margin-bottom:6px}
      .auth-logo em{color:${C.accent};font-style:normal}
      .auth-tagline{font-size:13px;color:${C.textDim};line-height:1.5;max-width:280px}
      .auth-tabs{display:flex;background:${C.card2};border-bottom:1px solid ${C.border}}
      .atab{flex:1;padding:15px;text-align:center;font-family:${FD};font-size:13px;font-weight:700;color:${C.muted};cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;background:none;border-top:none;border-left:none;border-right:none}
      .atab.on{color:${C.accent};border-bottom-color:${C.accent}}
      .auth-form{padding:28px}
      .af-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${C.muted};margin-bottom:8px}
      .af-input{width:100%;background:${C.card2};border:1px solid ${C.border};border-radius:12px;padding:13px 15px;color:${C.text};font-family:${FB};font-size:14px;outline:none;margin-bottom:16px;transition:border-color .2s}
      .af-input:focus{border-color:${C.accent}}
      .af-input::placeholder{color:${C.muted}}
      .af-err{background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);border-radius:10px;padding:10px 14px;font-size:12.5px;color:${C.red};margin-bottom:14px;display:flex;gap:8px;align-items:center}
      .af-btn{width:100%;background:${C.accent};color:${C.bg};border:none;border-radius:14px;padding:15px;font-family:${FD};font-size:15px;font-weight:700;cursor:pointer;transition:transform .15s,opacity .15s;margin-top:4px}
      .af-btn:hover{transform:scale(1.02)}
      .af-btn:disabled{opacity:.5;cursor:not-allowed}
      .af-note{font-size:11.5px;color:${C.muted};text-align:center;margin-top:14px;line-height:1.6}
      .app-inner{flex:1;display:flex;flex-direction:column;overflow:hidden}
      .top-bar{display:flex;align-items:center;justify-content:space-between;padding:52px 24px 16px;flex-shrink:0}
      .top-logo{font-family:${FD};font-size:18px;font-weight:800;letter-spacing:-0.5px}
      .top-logo em{color:${C.accent};font-style:normal}
      .avatar{width:34px;height:34px;border-radius:10px;background:${C.accentSoft};border:1px solid ${C.accentMid};display:flex;align-items:center;justify-content:center;font-family:${FD};font-size:14px;font-weight:700;color:${C.accent};cursor:pointer;transition:border-color .2s}
      .avatar:hover{border-color:${C.accent}}
      .sc{flex:1;overflow-y:auto;padding:0 24px 100px}
      .slbl{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.muted};margin:22px 0 11px}
      .status-hero{background:linear-gradient(135deg,${C.card} 0%,${C.card2} 100%);border:1px solid ${C.border};border-radius:22px;padding:20px;position:relative;overflow:hidden;margin-bottom:4px}
      .sh-glow{position:absolute;top:-30px;right:-30px;width:150px;height:150px;background:radial-gradient(circle,rgba(245,200,66,0.12),transparent 70%);pointer-events:none}
      .sh-greeting{font-family:${FD};font-size:22px;font-weight:700;line-height:1.2;margin-bottom:4px}
      .sh-greeting b{color:${C.accent}}
      .sh-sub{font-size:12px;color:${C.textDim};margin-bottom:16px}
      .sh-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .sh-stat{background:rgba(255,255,255,0.04);border:1px solid ${C.border};border-radius:12px;padding:10px;text-align:center}
      .sh-num{font-family:${FD};font-size:24px;font-weight:800;line-height:1}
      .sh-lbl{font-size:10px;color:${C.muted};margin-top:3px;font-weight:600}
      .alert-band{background:rgba(248,113,113,0.10);border:1px solid rgba(248,113,113,0.25);border-radius:14px;padding:13px 15px;display:flex;align-items:center;gap:10px;margin-bottom:8px}
      .alert-txt{font-size:13px;color:${C.red};font-weight:500;flex:1}
      .sgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .scard{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:15px}
      .scard.hi{background:${C.accent};border-color:transparent}
      .scard.hi .sn,.scard.hi .sl{color:${C.bg}}
      .sn{font-family:${FD};font-size:30px;font-weight:800;line-height:1}
      .sl{font-size:11px;color:${C.muted};margin-top:4px;font-weight:500}
      .evc{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:12px 14px 12px 17px;margin-bottom:7px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:border-color .18s,transform .14s;position:relative;overflow:hidden}
      .evc::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--pc);border-radius:14px 0 0 14px}
      .evc:hover{border-color:${C.accentMid};transform:translateX(3px)}
      .evc.dd{opacity:.35}
      .evic{font-size:17px;width:34px;height:34px;background:${C.card2};border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .evinf{flex:1;min-width:0}
      .evt{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .evm{font-size:11px;color:${C.muted};margin-top:2px}
      .evb{font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:var(--pc);color:${C.bg};flex-shrink:0}
      .chk{width:21px;height:21px;border-radius:50%;border:2px solid ${C.border};background:transparent;cursor:pointer;flex-shrink:0;transition:all .18s;display:flex;align-items:center;justify-content:center}
      .chk:hover{border-color:${C.accent}}
      .chk.on{background:${C.accent};border-color:${C.accent}}
      .wnav{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
      .wnav button{background:${C.card};border:1px solid ${C.border};border-radius:9px;color:${C.text};font-size:15px;width:34px;height:34px;cursor:pointer;transition:border-color .18s}
      .wnav button:hover{border-color:${C.accent}}
      .wtitle{font-family:${FD};font-size:13px;font-weight:700}
      .wrow{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:14px}
      .dcol{display:flex;flex-direction:column;align-items:center;gap:4px}
      .dname{font-size:9px;color:${C.muted};font-weight:700;text-transform:uppercase}
      .dnum{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;position:relative}
      .dnum.td{background:${C.accent};color:${C.bg}}
      .dnum.hev::after{content:'';position:absolute;bottom:2px;width:4px;height:4px;border-radius:50%;background:var(--dc,${C.accent})}
      .cev{background:${C.card};border:1px solid ${C.border};border-radius:10px;padding:8px 12px;font-size:12px;display:flex;gap:8px;align-items:center;margin-bottom:5px;cursor:pointer;transition:border-color .18s}
      .cev:hover{border-color:${C.accentMid}}
      .cdot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
      .empty{text-align:center;padding:30px 0;color:${C.muted};font-size:13px}
      .empty .big{font-size:34px;display:block;margin-bottom:8px}
      .pomc{display:flex;flex-direction:column;align-items:center;padding:4px 0 12px}
      .pomring{position:relative;width:180px;height:180px;margin:6px auto 18px}
      .pomring svg{transform:rotate(-90deg)}
      .pomctr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
      .pomtime{font-family:${FD};font-size:34px;font-weight:800;letter-spacing:-1px}
      .pomph{font-size:10px;color:${C.muted};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
      .pompre{display:flex;gap:7px;margin-bottom:16px}
      .pompr{padding:5px 13px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid ${C.border};background:${C.card};color:${C.muted};cursor:pointer;transition:all .18s}
      .pompr.act{background:${C.accentSoft};border-color:${C.accent};color:${C.accent}}
      .pomctl{display:flex;gap:9px}
      .pomb{padding:11px 26px;border-radius:13px;font-family:${FD};font-size:13px;font-weight:700;cursor:pointer;transition:all .18s;border:none}
      .poms{background:${C.accent};color:${C.bg}}
      .poms:hover{transform:scale(1.04)}
      .pomrst{background:${C.card};border:1px solid ${C.border};color:${C.muted}}
      .pomrst:hover{border-color:${C.accent};color:${C.accent}}
      .pomses{font-size:11px;color:${C.muted};margin-bottom:12px}
      .ptip{background:${C.card};border:1px solid ${C.border};border-radius:11px;padding:10px 13px;margin-bottom:7px;font-size:12px;color:${C.muted};display:flex;gap:8px}
      .bs{background:${C.card};border:1px solid ${C.border};border-radius:18px;padding:18px;text-align:center;margin-bottom:8px}
      .bsn{font-family:${FD};font-size:46px;font-weight:800;line-height:1;color:${C.accent}}
      .bsl{font-size:12px;color:${C.muted};margin-top:5px}
      .pbw{background:${C.border};border-radius:20px;height:7px;overflow:hidden;margin:7px 0 3px}
      .pbf{height:100%;border-radius:20px;background:var(--fc);transition:width .6s ease}
      .tr{display:flex;align-items:center;gap:9px;margin-bottom:9px}
      .tdot{width:9px;height:9px;border-radius:3px;flex-shrink:0}
      .chat-top{display:flex;align-items:center;gap:10px;padding:52px 24px 14px;border-bottom:1px solid ${C.border};flex-shrink:0}
      .chat-av{width:38px;height:38px;background:${C.accentSoft};border:1px solid ${C.accentMid};border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:18px}
      .chat-name{font-family:${FD};font-size:15px;font-weight:700}
      .chat-status{font-size:11px;color:${C.green};margin-top:1px}
      .cscr{flex:1;overflow-y:auto;padding:18px 24px 0;display:flex;flex-direction:column;gap:9px}
      .bbl{max-width:86%;padding:11px 15px;border-radius:18px;font-size:13.5px;line-height:1.55;animation:fup .22s ease}
      .bbl.u{background:${C.accent};color:${C.bg};font-weight:600;align-self:flex-end;border-bottom-right-radius:4px}
      .bbl.a{background:${C.card};border:1px solid ${C.border};color:${C.text};align-self:flex-start;border-bottom-left-radius:4px}
      @keyframes fup{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
      .dot{display:inline-block;width:5px;height:5px;background:${C.muted};border-radius:50%;margin:0 2px;animation:bnc 1.2s infinite}
      .dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
      @keyframes bnc{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
      .csug{display:flex;gap:5px;padding:10px 24px 8px;overflow-x:auto;flex-shrink:0}
      .sg{white-space:nowrap;padding:6px 12px;border-radius:20px;font-size:11.5px;background:${C.card};border:1px solid ${C.border};color:${C.muted};cursor:pointer;transition:all .18s;flex-shrink:0}
      .sg:hover{border-color:${C.accent};color:${C.accent}}
      .cbar{padding:10px 24px 22px;border-top:1px solid ${C.border};display:flex;gap:9px;background:${C.bg};flex-shrink:0}
      .cinp{flex:1;background:${C.card};border:1px solid ${C.border};border-radius:13px;padding:11px 14px;color:${C.text};font-family:${FB};font-size:13.5px;outline:none;transition:border-color .18s}
      .cinp:focus{border-color:${C.accent}}
      .cinp::placeholder{color:${C.muted}}
      .sbtn{width:43px;height:43px;background:${C.accent};border:none;border-radius:11px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:transform .14s,opacity .14s;flex-shrink:0;color:${C.bg}}
      .sbtn:hover{transform:scale(1.07)}
      .sbtn:disabled{opacity:.38}
      .prof-card{background:${C.card};border:1px solid ${C.border};border-radius:20px;padding:22px;margin-bottom:10px;display:flex;align-items:center;gap:16px}
      .prof-av{width:60px;height:60px;background:${C.accentSoft};border:2px solid ${C.accent};border-radius:18px;display:flex;align-items:center;justify-content:center;font-family:${FD};font-size:24px;font-weight:800;color:${C.accent};flex-shrink:0}
      .prof-name{font-family:${FD};font-size:20px;font-weight:700}
      .prof-sub{font-size:12px;color:${C.muted};margin-top:3px}
      .prof-row{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:14px 16px;margin-bottom:7px;display:flex;align-items:center;justify-content:space-between}
      .prof-key{font-size:13px;font-weight:600}
      .prof-val{font-size:13px;color:${C.muted};text-align:right;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .logout-btn{width:100%;background:rgba(248,113,113,0.10);border:1px solid rgba(248,113,113,0.25);color:${C.red};border-radius:14px;padding:14px;font-family:${FD};font-size:14px;font-weight:700;cursor:pointer;margin-top:14px;transition:all .18s}
      .logout-btn:hover{background:rgba(248,113,113,0.18)}
      .bnav{position:absolute;bottom:0;left:0;right:0;background:rgba(7,7,10,0.95);backdrop-filter:blur(16px);border-top:1px solid ${C.border};display:flex;justify-content:space-around;padding:10px 0 20px;z-index:100}
      .nb{display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;cursor:pointer;padding:5px 10px;border-radius:10px;transition:all .18s}
      .nb.on{background:${C.accentSoft}}
      .nb.on .nl{color:${C.accent}}
      .ni{font-size:20px}
      .nl{font-size:9px;font-weight:700;color:${C.muted};letter-spacing:0.8px;text-transform:uppercase;transition:color .18s}
      .fab{position:absolute;bottom:78px;right:22px;width:48px;height:48px;background:${C.accent};border:none;border-radius:15px;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(245,200,66,0.3);transition:transform .18s;z-index:50;color:${C.bg}}
      .fab:hover{transform:scale(1.1) rotate(8deg)}
      .ov{position:absolute;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);z-index:200;display:flex;align-items:flex-end;animation:fi .18s}
      @keyframes fi{from{opacity:0}to{opacity:1}}
      .modal{background:${C.card};border:1px solid ${C.borderHi};border-radius:24px 24px 0 0;padding:26px 22px 46px;width:100%;animation:su .26s ease;max-height:90vh;overflow-y:auto}
      @keyframes su{from{transform:translateY(100%)}to{transform:translateY(0)}}
      .mt{font-family:${FD};font-size:19px;font-weight:700;margin-bottom:18px}
      .fl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${C.muted};margin-bottom:7px}
      .fi{width:100%;background:${C.bg};border:1px solid ${C.border};border-radius:11px;padding:11px 13px;color:${C.text};font-family:${FB};font-size:13.5px;outline:none;margin-bottom:13px;transition:border-color .18s}
      .fi:focus{border-color:${C.accent}}
      .fi::placeholder{color:${C.muted}}
      textarea.fi{resize:none;min-height:65px}
      .crow{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:13px}
      .chip{padding:6px 13px;border-radius:20px;border:1px solid ${C.border};background:${C.bg};color:${C.muted};font-size:12px;font-weight:600;cursor:pointer;transition:all .18s}
      .chip.sel{background:${C.accentSoft};border-color:${C.accent};color:${C.accent}}
      .mc{width:100%;background:${C.accent};color:${C.bg};border:none;border-radius:13px;padding:13px;font-family:${FD};font-size:14px;font-weight:700;cursor:pointer;transition:transform .14s;margin-top:6px}
      .mc:hover{transform:scale(1.02)}
      .detic{font-size:40px;display:block;margin-bottom:10px}
      .dett{font-family:${FD};font-size:20px;font-weight:700;margin-bottom:5px}
      .detm{font-size:12.5px;color:${C.muted};margin-bottom:16px}
      .detn{background:${C.bg};border:1px solid ${C.border};border-radius:11px;padding:11px 13px;font-size:12.5px;color:${C.muted};margin-bottom:18px;min-height:46px;font-style:italic}
      .deta{display:flex;gap:9px}
      .dda{flex:1;background:${C.green};color:${C.bg};border:none;border-radius:11px;padding:12px;font-family:${FD};font-size:13px;font-weight:700;cursor:pointer}
      .ddl{flex:1;background:${C.card};border:1px solid ${C.red};color:${C.red};border-radius:11px;padding:12px;font-family:${FD};font-size:13px;font-weight:700;cursor:pointer}
      .realtime-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(61,214,140,0.1);border:1px solid rgba(61,214,140,0.25);border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700;color:${C.green}}
    `}</style>

    <div className="app">

      {/* SPLASH */}
      {loading && (
        <div className="splash">
          <div className="splash-logo">Study<em>Mind</em> AI</div>
          <div style={{fontSize:12,color:C.muted}}>Caricamento in corso…</div>
          <div className="splash-ring"/>
        </div>
      )}

      {/* AUTH */}
      {!loading && !user && (
        <div className="auth-wrap">
          <div className="auth-hero">
            <div className="auth-glow"/>
            <div className="auth-logo">Study<em>Mind</em> AI</div>
            <div className="auth-tagline">L'agenda intelligente per studenti. Impegni, AI coach e timer pomodoro — tutto in un posto.</div>
            <div style={{marginTop:12}}><span className="realtime-badge">🔴 Backend reale · Supabase</span></div>
          </div>
          <div className="auth-tabs">
            <button className={`atab ${authTab==="login"?"on":""}`} onClick={()=>{setAuthTab("login");setAuthErr("")}}>Accedi</button>
            <button className={`atab ${authTab==="register"?"on":""}`} onClick={()=>{setAuthTab("register");setAuthErr("")}}>Registrati</button>
          </div>
          <div className="auth-form">
            {authErr && <div className="af-err">⚠️ {authErr}</div>}
            {authTab==="login" ? (<>
              <div className="fl">Email</div>
              <input className="af-input" type="email" placeholder="la-tua@email.com"
                value={loginForm.email} onChange={e=>setLoginForm(p=>({...p,email:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
              <div className="fl">Password</div>
              <input className="af-input" type="password" placeholder="••••••••"
                value={loginForm.password} onChange={e=>setLoginForm(p=>({...p,password:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
              <button className="af-btn" onClick={handleLogin} disabled={authLoad}>
                {authLoad?"Accesso in corso…":"Accedi →"}
              </button>
              <div className="af-note">Non hai un account? Clicca su <strong>Registrati</strong>.</div>
            </>) : (<>
              <div className="fl">Nome *</div>
              <input className="af-input" placeholder="Il tuo nome" value={regForm.name} onChange={e=>setRegForm(p=>({...p,name:e.target.value}))}/>
              <div className="fl">Email *</div>
              <input className="af-input" type="email" placeholder="la-tua@email.com" value={regForm.email} onChange={e=>setRegForm(p=>({...p,email:e.target.value}))}/>
              <div className="fl">Password * (min. 6 caratteri)</div>
              <input className="af-input" type="password" placeholder="••••••••" value={regForm.password} onChange={e=>setRegForm(p=>({...p,password:e.target.value}))}/>
              <div className="fl">Anno di nascita * (devi avere almeno 16 anni)</div>
              <input className="af-input" type="number" placeholder="Es. 2005" min="1900" max={new Date().getFullYear()-16}
                onInput={e=>{ if(e.target.value.length>4) e.target.value=e.target.value.slice(0,4); }}
                value={regForm.birthYear} onChange={e=>setRegForm(p=>({...p,birthYear:e.target.value}))}/>
              <div className="fl">Classe (opzionale)</div>
              <input className="af-input" placeholder="Es. 5° Informatica" value={regForm.classe} onChange={e=>setRegForm(p=>({...p,classe:e.target.value}))}/>
              {/* Checkbox Privacy */}
              <div style={{display:"flex",gap:10,alignItems:"flex-start",background:"rgba(245,200,66,0.06)",border:"1px solid rgba(245,200,66,0.15)",borderRadius:12,padding:"12px 14px",marginBottom:16,cursor:"pointer"}}
                onClick={()=>setRegForm(p=>({...p,privacy:!p.privacy}))}>
                <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${regForm.privacy?"#F5C842":"#4A4A58"}`,background:regForm.privacy?"#F5C842":"transparent",flexShrink:0,marginTop:1,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
                  {regForm.privacy&&<span style={{color:"#07070A",fontSize:12,fontWeight:700}}>✓</span>}
                </div>
                <div style={{fontSize:12.5,color:"#9B9AA8",lineHeight:1.6}}>
                  Ho almeno <strong style={{color:"#F5C842"}}>16 anni</strong> e ho letto e accetto la{" "}
                  <span style={{color:"#F5C842",textDecoration:"underline",cursor:"pointer"}}
                    onClick={e=>{e.stopPropagation();setView("privacy");}}>
                    Privacy Policy
                  </span> di StudyMind AI. *
                </div>
              </div>
              <button className="af-btn" onClick={handleRegister} disabled={authLoad}>
                {authLoad?"Creazione account…":"Crea account gratuito →"}
              </button>
              <div className="af-note">StudyMind AI è riservato agli utenti con almeno 16 anni.<br/>Dati protetti secondo il GDPR 🇪🇺</div>
            </>)}
          </div>
        </div>
      )}

      {/* PRIVACY POLICY */}
      {!loading && !user && view==="privacy" && (
        <div style={{flex:1,overflowY:"auto",background:C.bg,color:C.text,fontFamily:FB}}>
          <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:"52px 24px 20px",position:"sticky",top:0,zIndex:10}}>
            <button onClick={()=>setView("auth")} style={{background:C.accentSoft,border:`1px solid ${C.accentMid}`,color:C.accent,borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:12,fontFamily:FB}}>← Torna indietro</button>
            <div style={{fontFamily:FD,fontSize:22,fontWeight:800,letterSpacing:-0.5}}>Privacy Policy</div>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>StudyMind AI · Ultimo aggiornamento: Marzo 2026</div>
          </div>
          <div style={{padding:"24px 24px 100px"}}>
            <div style={{background:"rgba(245,200,66,0.08)",border:"1px solid rgba(245,200,66,0.2)",borderRadius:16,padding:16,marginBottom:24,fontSize:13,lineHeight:1.7}}>
              StudyMind AI è riservato esclusivamente a studenti con <strong style={{color:C.accent}}>almeno 16 anni</strong>. Questa Privacy Policy spiega quali dati raccogliamo, come li usiamo e i tuoi diritti.
            </div>
            {[
              ["1. Chi siamo","StudyMind AI è un'applicazione web sviluppata da un progetto startup italiano. Per qualsiasi richiesta: privacy@studymind.app"],
              ["2. Età minima","Riservato agli utenti con almeno 16 anni, in conformità con l'art. 8 del GDPR. Se veniamo a conoscenza che un utente ha meno di 16 anni, cancelleremo immediatamente account e dati."],
              ["3. Dati che raccogliamo","• Nome e email\n• Anno di nascita (verifica età)\n• Classe scolastica (opzionale)\n• Impegni e scadenze inseriti\n• Messaggi inviati all'AI Coach\n• Sessioni Pomodoro\n\nNon raccogliamo dati di pagamento o dati sensibili."],
              ["4. Come usiamo i dati","I dati vengono usati solo per fornire il servizio. Non vendiamo dati a terzi. Non usiamo i dati per pubblicità."],
              ["5. AI Coach (Anthropic)","Le risposte AI sono generate tramite le API di Anthropic. I messaggi vengono inviati ai loro server per generare la risposta. Anthropic non usa questi dati per addestrare modelli."],
              ["6. Sicurezza","Dati su Supabase con server in Europa (UE). Crittografia HTTPS, password con hashing bcrypt, Row Level Security — ogni utente vede solo i propri dati."],
              ["7. I tuoi diritti (GDPR)","• Accesso ai tuoi dati\n• Rettifica di dati errati\n• Cancellazione dell'account e di tutti i dati\n• Portabilità dei dati\n\nScrive a: privacy@studymind.app"],
              ["8. Cancellazione dati","Se elimini l'account, tutti i tuoi dati vengono cancellati entro 30 giorni."],
              ["9. Cookie","Usiamo solo cookie tecnici necessari alla sessione. Nessun cookie pubblicitario."],
              ["10. Contatti","📧 privacy@studymind.app\n🌐 studymind.app\n\nPuoi presentare reclamo al Garante Privacy italiano: www.garanteprivacy.it"],
            ].map(([t,c])=>(
              <div key={t} style={{marginBottom:20}}>
                <div style={{fontFamily:FD,fontSize:15,fontWeight:700,color:C.accent,marginBottom:8}}>{t}</div>
                <div style={{fontSize:13,lineHeight:1.8,color:C.textDim,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,whiteSpace:"pre-line"}}>{c}</div>
              </div>
            ))}
            <div style={{background:"rgba(61,214,140,0.08)",border:"1px solid rgba(61,214,140,0.2)",borderRadius:14,padding:16,textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:6}}>✅</div>
              <div style={{fontSize:13,color:C.green,fontWeight:600}}>Conforme al GDPR · Dati in EU · No pubblicità</div>
            </div>
          </div>
        </div>
      )}

      {/* APP */}
      {!loading && user && (
        <div className="app-inner">

          {/* DASHBOARD */}
          {view==="dashboard" && <>
            <div className="top-bar">
              <div>
                <div className="top-logo">Study<em>Mind</em> AI</div>
                <div style={{marginTop:4}}><span className="realtime-badge">● Realtime</span></div>
              </div>
              <div className="avatar" onClick={()=>setView("profile")}>{profile?.name?.charAt(0)?.toUpperCase()||"?"}</div>
            </div>
            <div className="sc">
              <div className="status-hero">
                <div className="sh-glow"/>
                <div className="sh-greeting">Ciao, <b>{profile?.name?.split(" ")[0]}</b> 👋</div>
                <div className="sh-sub">{today} · {urgent.length>0?`${urgent.length} urgenti questa settimana`:"Tutto sotto controllo!"}</div>
                <div className="sh-stats">
                  <div className="sh-stat"><div className="sh-num" style={{color:C.red}}>{urgent.length}</div><div className="sh-lbl">🔥 Urgenti</div></div>
                  <div className="sh-stat"><div className="sh-num">{upcoming.length}</div><div className="sh-lbl">📅 Totale</div></div>
                  <div className="sh-stat"><div className="sh-num" style={{color:C.green}}>{pomSes}</div><div className="sh-lbl">🍅 Pomodoro</div></div>
                </div>
              </div>
              {urgent.length>0&&<div className="alert-band" style={{marginTop:12}}><span style={{fontSize:18}}>🔥</span><div className="alert-txt"><strong>{urgent[0].title}</strong> — {daysLeft(urgent[0].date)}</div></div>}
              <div className="slbl">Prossimi impegni</div>
              {evLoad && <div style={{textAlign:"center",padding:"20px 0",color:C.muted,fontSize:13}}>Caricamento…</div>}
              {!evLoad && upcoming.length===0 && <div className="empty"><span className="big">🎉</span>Sei libero! Premi + per aggiungere.</div>}
              {upcoming.map(ev=>(
                <div key={ev.id} className="evc" style={{"--pc":PC[ev.priority]}} onClick={()=>setSelEv(ev)}>
                  <button className="chk" onClick={e=>{e.stopPropagation();toggleDone(ev.id,ev.done)}}/>
                  <div className="evic">{TI[ev.type]}</div>
                  <div className="evinf"><div className="evt">{ev.title}</div><div className="evm">{daysLeft(ev.date)} · {fmtDate(ev.date)}</div></div>
                  <div className="evb">{daysLeft(ev.date)}</div>
                </div>
              ))}
              {done.length>0&&<>
                <div className="slbl">Completati ✅</div>
                {done.map(ev=>(
                  <div key={ev.id} className="evc dd" style={{"--pc":C.muted}} onClick={()=>setSelEv(ev)}>
                    <button className="chk on" onClick={e=>{e.stopPropagation();toggleDone(ev.id,ev.done)}}><span style={{color:C.bg,fontSize:10}}>✓</span></button>
                    <div className="evic">{TI[ev.type]}</div>
                    <div className="evinf"><div className="evt" style={{textDecoration:"line-through"}}>{ev.title}</div><div className="evm">{fmtDate(ev.date)}</div></div>
                  </div>
                ))}
              </>}
            </div>
            <button className="fab" onClick={()=>setShowAdd(true)}>＋</button>
          </>}

          {/* CALENDARIO */}
          {view==="calendar" && <>
            <div className="top-bar"><div className="top-logo">Study<em>Mind</em> AI</div><div className="avatar" onClick={()=>setView("profile")}>{profile?.name?.charAt(0)?.toUpperCase()||"?"}</div></div>
            <div className="sc" style={{paddingTop:4}}>
              <div className="wnav">
                <button onClick={()=>setWeekOff(o=>o-1)}>‹</button>
                <div className="wtitle">{fmtDate(wd[0])} – {fmtDate(wd[6])}</div>
                <button onClick={()=>setWeekOff(o=>o+1)}>›</button>
              </div>
              <div className="wrow">
                {wd.map(d=>{
                  const de=events.filter(e=>e.date===d&&!e.done);
                  const top=de.sort((a,b)=>["high","medium","low"].indexOf(a.priority)-["high","medium","low"].indexOf(b.priority))[0];
                  return <div key={d} className="dcol">
                    <div className="dname">{DAYS[new Date(d+"T12:00:00").getDay()]}</div>
                    <div className={`dnum ${d===today?"td":""} ${de.length>0&&d!==today?"hev":""}`} style={{"--dc":top?PC[top.priority]:C.accent}}>{new Date(d+"T12:00:00").getDate()}</div>
                  </div>;
                })}
              </div>
              {wd.map(d=>{
                const de=events.filter(e=>e.date===d);
                if(!de.length) return null;
                return <div key={d}>
                  <div className="slbl">{["Dom","Lun","Mar","Mer","Gio","Ven","Sab"][new Date(d+"T12:00:00").getDay()]} {fmtDate(d)}</div>
                  {de.map(ev=><div key={ev.id} className="cev" onClick={()=>setSelEv(ev)} style={{opacity:ev.done?.4:1}}>
                    <div className="cdot" style={{background:PC[ev.priority]}}/><span>{TI[ev.type]} {ev.title}</span>{ev.done&&<span style={{marginLeft:"auto",fontSize:10,color:C.green}}>✓</span>}
                  </div>)}
                </div>;
              })}
              {wd.every(d=>!events.find(e=>e.date===d))&&<div className="empty"><span className="big">📭</span>Nessun impegno questa settimana</div>}
            </div>
            <button className="fab" onClick={()=>setShowAdd(true)}>＋</button>
          </>}

          {/* POMODORO */}
          {view==="pomodoro" && <>
            <div className="top-bar"><div className="top-logo">Study<em>Mind</em> AI</div><div className="avatar" onClick={()=>setView("profile")}>{profile?.name?.charAt(0)?.toUpperCase()||"?"}</div></div>
            <div className="sc">
              <div className="pomc">
                <div className="pomses">Sessioni salvate oggi: <strong>{pomSes}</strong></div>
                <div className="pompre">{POM.map((p,i)=><button key={i} className={`pompr ${pomPre===i?"act":""}`} onClick={()=>{setPomPre(i);resetPom(i);}}>{p.l}</button>)}</div>
                <div className="pomring">
                  <svg width="180" height="180" viewBox="0 0 180 180">
                    <circle fill="none" stroke={C.border} strokeWidth="10" cx="90" cy="90" r="76"/>
                    <circle fill="none" stroke={pomPhase==="work"?C.accent:C.green} strokeWidth="10" strokeLinecap="round" cx="90" cy="90" r="76" strokeDasharray={`${2*Math.PI*76}`} strokeDashoffset={`${2*Math.PI*76*(1-pomPct()/100)}`} style={{transition:"stroke-dashoffset .5s linear"}}/>
                  </svg>
                  <div className="pomctr">
                    <div className="pomtime" style={{color:pomPhase==="work"?C.accent:C.green}}>{fmtT(pomSecs)}</div>
                    <div className="pomph">{pomPhase==="work"?"Studio 🧠":"Pausa 😮‍💨"}</div>
                  </div>
                </div>
                <div className="pomctl">
                  <button className="pomb poms" onClick={()=>setPomRun(r=>!r)}>{pomRun?"⏸ Pausa":"▶ Inizia"}</button>
                  <button className="pomb pomrst" onClick={()=>resetPom()}>↺ Reset</button>
                </div>
              </div>
              {[["🎯","Studia un argomento alla volta"],["📵","Telefono in silenziosa"],["🏀","Pausa lunga = muoviti"],["📝","Scrivi i concetti chiave"],["💧","Bevi acqua nelle pause"]].map(([ic,t],i)=><div key={i} className="ptip"><span>{ic}</span><span>{t}</span></div>)}
              {upcoming.slice(0,3).map(ev=><div key={ev.id} className="evc" style={{"--pc":PC[ev.priority]}}><div className="evic">{TI[ev.type]}</div><div className="evinf"><div className="evt">{ev.title}</div><div className="evm">{daysLeft(ev.date)}</div></div></div>)}
            </div>
          </>}

          {/* STATS */}
          {view==="stats" && <>
            <div className="top-bar"><div className="top-logo">Study<em>Mind</em> AI</div><div className="avatar" onClick={()=>setView("profile")}>{profile?.name?.charAt(0)?.toUpperCase()||"?"}</div></div>
            <div className="sc" style={{paddingTop:4}}>
              <div className="bs" style={{marginTop:4}}><div className="bsn">{compRate}%</div><div className="bsl">Tasso di completamento</div><div className="pbw" style={{marginTop:12}}><div className="pbf" style={{width:`${compRate}%`,"--fc":C.accent}}/></div></div>
              <div className="sgrid">
                <div className="scard hi"><div className="sn">{urgent.length}</div><div className="sl">🔥 Urgenti</div></div>
                <div className="scard"><div className="sn">{upcoming.length}</div><div className="sl">📅 In programma</div></div>
                <div className="scard"><div className="sn">{done.length}</div><div className="sl">✅ Completati</div></div>
                <div className="scard"><div className="sn">{pomSes}</div><div className="sl">🍅 Sessioni</div></div>
                <div className="scard" style={{gridColumn:"1/-1"}}><div className="sn">{pomSes*POM[pomPre].w} min</div><div className="sl">⏱️ Studio oggi</div></div>
              </div>
              <div className="slbl">Per tipo</div>
              {["school","study","sport","personal","other"].map(t=>{
                const cnt=events.filter(e=>e.type===t).length; if(!cnt) return null;
                const col={school:C.blue,study:C.purple,sport:C.green,personal:C.accent,other:C.muted}[t];
                return <div key={t} className="tr"><div className="tdot" style={{background:col}}/><span style={{flex:1,fontSize:13}}>{TI[t]} {TL[t]}</span><span style={{fontSize:13,fontWeight:600,color:C.muted,marginRight:8}}>{cnt}</span><div style={{width:80}}><div className="pbw" style={{marginTop:0}}><div className="pbf" style={{width:`${Math.round(cnt/events.length*100)}%`,"--fc":col}}/></div></div></div>;
              })}
            </div>
          </>}

          {/* AI COACH */}
          {view==="chat" && <>
            <div className="chat-top">
              <div className="chat-av">🤖</div>
              <div><div className="chat-name">AI Coach</div><div className="chat-status">● Online · sempre disponibile</div></div>
            </div>
            <div className="cscr">
              {msgs.map((m,i)=><div key={i} className={`bbl ${m.role==="user"?"u":"a"}`}>{m.text}</div>)}
              {chatLoad&&<div className="bbl a"><span className="dot"/><span className="dot"/><span className="dot"/></div>}
              <div ref={chatEnd}/>
            </div>
            <div className="csug">
	      {["Cosa studiare oggi?","Pianifica la settimana","Ho una verifica domani!","Come gestisco basket e scuola?"].map(s=>(
	      <button key={s} className="sg" onClick={()=>{ setChatIn(s); setTimeout(()=>sendMsg(), 100); }}>{s}</button>
	      ))}
            </div>
            <div className="cbar">
              <input className="cinp" placeholder="Chiedi al tuo AI Coach..." value={chatIn} onChange={e=>setChatIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()}/>
              <button className="sbtn" onClick={sendMsg} disabled={chatLoad||!chatIn.trim()}>➤</button>
            </div>
          </>}

          {/* PROFILO */}
          {view==="profile" && <>
            <div className="top-bar"><div className="top-logo">Study<em>Mind</em> AI</div></div>
            <div className="sc" style={{paddingTop:4}}>
              <div className="prof-card">
                <div className="prof-av">{profile?.name?.charAt(0)?.toUpperCase()||"?"}</div>
                <div><div className="prof-name">{profile?.name}</div><div className="prof-sub">{profile?.classe||"Studente"}</div></div>
              </div>
              <div className="slbl">Account</div>
              <div className="prof-row"><span className="prof-key">Email</span><span className="prof-val">{user.email}</span></div>
              <div className="prof-row"><span className="prof-key">Classe</span><span className="prof-val">{profile?.classe||"—"}</span></div>
              <div className="prof-row"><span className="prof-key">Impegni totali</span><span className="prof-val">{events.length}</span></div>
              <div className="prof-row"><span className="prof-key">Completati</span><span className="prof-val">{done.length} ({compRate}%)</span></div>
              <div className="prof-row"><span className="prof-key">🍅 Sessioni oggi</span><span className="prof-val">{pomSes}</span></div>
              <div className="prof-row"><span className="prof-key">Backend</span><span className="prof-val" style={{color:C.green}}>● Supabase · Realtime</span></div>
              <button className="logout-btn" onClick={signOut}>Esci dall'account →</button>
            </div>
          </>}

          {/* NAV */}
          <nav className="bnav">
            {[{id:"dashboard",icon:"📅",label:"Home"},{id:"calendar",icon:"🗓",label:"Agenda"},{id:"pomodoro",icon:"🍅",label:"Timer"},{id:"stats",icon:"📊",label:"Stats"},{id:"chat",icon:"🤖",label:"AI Coach"}].map(({id,icon,label})=>(
              <button key={id} className={`nb ${view===id?"on":""}`} onClick={()=>setView(id)}><span className="ni">{icon}</span><span className="nl">{label}</span></button>
            ))}
          </nav>

          {/* ADD MODAL */}
          {showAdd&&<div className="ov" onClick={()=>setShowAdd(false)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div className="mt">Nuovo impegno ✏️</div>
              <div className="fl">Titolo *</div>
              <input className="fi" placeholder="es. Verifica Matematica..." value={newEv.title} onChange={e=>setNewEv(p=>({...p,title:e.target.value}))}/>
              <div className="fl">Data *</div>
              <input type="date" className="fi" value={newEv.date} onChange={e=>setNewEv(p=>({...p,date:e.target.value}))}/>
              <div className="fl">Tipo</div>
              <div className="crow">{["school","study","sport","personal","other"].map(t=><button key={t} className={`chip ${newEv.type===t?"sel":""}`} onClick={()=>setNewEv(p=>({...p,type:t}))}>{TI[t]} {TL[t]}</button>)}</div>
              <div className="fl">Priorità</div>
              <div className="crow">{["high","medium","low"].map(pr=><button key={pr} className={`chip ${newEv.priority===pr?"sel":""}`} style={newEv.priority===pr?{borderColor:PC[pr],color:PC[pr],background:`${PC[pr]}18`}:{}} onClick={()=>setNewEv(p=>({...p,priority:pr}))}>{pr==="high"?"🔥 Alta":pr==="medium"?"⚡ Media":"✅ Bassa"}</button>)}</div>
              <div className="fl">Note</div>
              <textarea className="fi" placeholder="Argomenti, dettagli..." value={newEv.note} onChange={e=>setNewEv(p=>({...p,note:e.target.value}))}/>
              <button className="mc" onClick={handleAddEvent}>Aggiungi impegno</button>
            </div>
          </div>}

          {/* DETAIL MODAL */}
          {selEv&&<div className="ov" onClick={()=>setSelEv(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <span className="detic">{TI[selEv.type]}</span>
              <div className="dett">{selEv.title}</div>
              <div className="detm">{fmtDate(selEv.date)} · {daysLeft(selEv.date)} · <span style={{color:PC[selEv.priority]}}>{selEv.priority==="high"?"🔥 Alta":selEv.priority==="medium"?"⚡ Media":"✅ Bassa"} priorità</span></div>
              <div className="detn">{selEv.note||"Nessuna nota."}</div>
              <div className="deta">
                <button className="dda" onClick={()=>{toggleDone(selEv.id,selEv.done);setSelEv(null)}}>{selEv.done?"↩ Riapri":"✓ Completa"}</button>
                <button className="ddl" onClick={()=>{deleteEvent(selEv.id);setSelEv(null)}}>🗑 Elimina</button>
              </div>
            </div>
          </div>}

        </div>
      )}
    </div>
  </>);
}
