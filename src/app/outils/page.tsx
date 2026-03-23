"use client";
import { useState, useCallback, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";
const COLORS = ["#FF3B30","#0A84FF","#34C759","#FF9500","#AF52DE","#00C7BE","#FF2D55","#5AC8FA"];

type Student = { id: string; prenom: string; nom: string; classe: string; classeId: string };
type ClassGroup = { id: string; name: string };

export default function OutilsPage() {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classeId, setClasseId] = useState<string>("");
  const [eleves, setEleves] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"tirage"|"groupes">("tirage");
  const [eleve, setEleve] = useState<Student|null>(null);
  const [anim, setAnim] = useState(false);
  const [histo, setHisto] = useState<Student[]>([]);
  const [modeG, setModeG] = useState<"nb"|"taille">("nb");
  const [valG, setValG] = useState(4);
  const [groupes, setGroupes] = useState<Student[][]>([]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Charger les classes au démarrage
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { window.location.href = "/login"; return; }
      supabase.from("class_groups")
        .select("id, name")
        .order("name")
        .then(({ data: cls }) => {
          if (cls && cls.length > 0) {
            setClasses(cls);
            setClasseId(cls[0].id);
          }
          setLoading(false);
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charger les élèves quand la classe change
  useEffect(() => {
    if (!classeId) return;
    setEleve(null); setGroupes([]); setHisto([]);
    // 2 requêtes séparées pour éviter le conflit RLS sur le join PostgREST
    supabase
      .from("student_enrollments")
      .select("student_id")
      .eq("class_group_id", classeId)
      .then(async ({ data: enrolls }) => {
        if (!enrolls || enrolls.length === 0) { setEleves([]); return; }
        const ids = enrolls.map((e: { student_id: string }) => e.student_id);
        const { data: studs } = await supabase
          .from("students")
          .select("id, first_name, last_name")
          .in("id", ids);
        if (!studs) { setEleves([]); return; }
        const mapped: Student[] = studs
          .map((s: { id: string; first_name: string; last_name: string }) => ({
            id: s.id,
            prenom: s.first_name ?? "",
            nom: s.last_name ?? "",
            classe: classes.find(c => c.id === classeId)?.name ?? "",
            classeId,
          }))
          .filter(s => s.prenom || s.nom)
          .sort((a, b) => a.nom.localeCompare(b.nom));
        setEleves(mapped);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId]);

  const currentClasse = classes.find(c => c.id === classeId);

  const tirer = useCallback(() => {
    if (!eleves.length) return;
    setAnim(true); setEleve(null);
    let n = 0;
    const iv = setInterval(() => {
      setEleve(eleves[Math.floor(Math.random()*eleves.length)]);
      if (++n > 14) {
        clearInterval(iv); setAnim(false);
        const f = eleves[Math.floor(Math.random()*eleves.length)];
        setEleve(f);
        setHisto(p => [f,...p].slice(0,6));
      }
    }, 70);
  }, [eleves]);

  const creer = useCallback(() => {
    const s = [...eleves].sort(() => Math.random()-0.5);
    const r: Student[][] = [];
    if (modeG === "nb") {
      const nb = Math.min(valG, s.length);
      for (let i=0;i<nb;i++) r.push([]);
      s.forEach((e,i) => r[i%nb].push(e));
    } else {
      const t = Math.max(1, valG);
      for (let i=0;i<s.length;i+=t) r.push(s.slice(i,i+t));
    }
    setGroupes(r);
  }, [eleves, modeG, valG]);

  const preview = modeG === "nb"
    ? `~${Math.ceil(eleves.length/valG)} eleves/groupe`
    : `${Math.ceil(eleves.length/valG)} groupe(s)`;

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:300,color:"#94a3b8",fontSize:14}}>
      Chargement...
    </div>
  );

  return (
    <div style={{maxWidth:820,margin:"0 auto"}}>
      <div style={{borderRadius:18,padding:"16px 22px",background:GRADIENT,color:"#fff",marginBottom:20}}>
        <div style={{fontSize:22,fontWeight:900}}>🎲 Outils de classe</div>
        <div style={{fontSize:13,opacity:.85,marginTop:2}}>Tirage au sort · Création de groupes aléatoires</div>
      </div>

      {classes.length === 0 ? (
        <div style={{borderRadius:14,background:"#fff",border:"1.5px solid #e2e8f0",padding:32,textAlign:"center",color:"#94a3b8"}}>
          <div style={{fontSize:32,marginBottom:12}}>📂</div>
          <div>Aucune classe trouvée. Importez d&apos;abord vos classes et élèves.</div>
        </div>
      ) : (
        <>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:8}}>CLASSE</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {classes.map(c => (
                <button key={c.id} onClick={()=>{setClasseId(c.id);setMode("tirage");}} style={{
                  padding:"8px 16px",borderRadius:99,
                  border:classeId===c.id?"2px solid #0A84FF":"1.5px solid #e2e8f0",
                  background:classeId===c.id?"#eff6ff":"#fff",
                  color:classeId===c.id?"#0A63BF":"#334155",
                  fontWeight:classeId===c.id?800:600,fontSize:14,cursor:"pointer",
                }}>{c.name}</button>
              ))}
            </div>
          </div>

          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {(["tirage","groupes"] as const).map(m => (
              <button key={m} onClick={()=>setMode(m)} style={{
                flex:1,padding:"12px",borderRadius:14,
                border:mode===m?"2px solid #0A84FF":"1.5px solid #e2e8f0",
                background:mode===m?"#eff6ff":"#fff",
                color:mode===m?"#0A63BF":"#64748b",
                fontWeight:mode===m?800:600,fontSize:15,cursor:"pointer",
              }}>{m==="tirage"?"🎯 Tirage au sort":"👥 Créer des groupes"}</button>
            ))}
          </div>

          {mode==="tirage" && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{
                borderRadius:20,background:"#fff",border:"1.5px solid #e2e8f0",
                padding:"48px 20px",textAlign:"center",boxShadow:"0 4px 20px rgba(15,23,42,.06)",
                minHeight:200,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              }}>
                {!eleve&&!anim ? (
                  <div style={{color:"#94a3b8"}}>
                    <div style={{fontSize:52,marginBottom:14}}>🎰</div>
                    <div style={{fontSize:16}}>Appuie sur le bouton pour tirer un élève au sort</div>
                    <div style={{fontSize:13,marginTop:6}}>{eleves.length} élèves dans {currentClasse?.name}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{fontSize:13,color:"#64748b",fontWeight:600,marginBottom:10}}>
                      {anim?"🎲 Tirage en cours...":"✨ Élève tiré au sort !"}
                    </div>
                    <div style={{fontSize:38,fontWeight:900,color:"#0f172a",lineHeight:1.2,filter:anim?"blur(3px)":"none",transition:"filter .08s"}}>
                      {eleve?.prenom}<br/>{eleve?.nom}
                    </div>
                    {!anim && <div style={{display:"inline-block",marginTop:14,padding:"5px 16px",borderRadius:99,background:"#eff6ff",color:"#0A63BF",fontSize:13,fontWeight:700}}>{currentClasse?.name}</div>}
                  </div>
                )}
              </div>

              <button onClick={tirer} disabled={anim||eleves.length===0} style={{
                padding:"16px",borderRadius:14,border:"none",
                background:anim?"#94a3b8":GRADIENT,color:"#fff",
                fontWeight:900,fontSize:18,cursor:anim?"wait":"pointer",
                boxShadow:anim?"none":"0 4px 16px rgba(10,132,255,.3)",
              }}>{anim?"🎲 Tirage en cours...":"🎯 Tirer au sort"}</button>

              {histo.length>0 && (
                <div style={{borderRadius:14,background:"#fff",border:"1.5px solid #e2e8f0",padding:"14px 16px"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:10}}>HISTORIQUE</div>
                  {histo.map((e,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:i<histo.length-1?"1px solid #f1f5f9":"none",opacity:Math.max(.3,1-i*.15)}}>
                      <span style={{fontWeight:i===0?800:500,color:i===0?"#0f172a":"#475569",fontSize:14}}>{i===0?"🎯 ":`${i+1}. `}{e.prenom} {e.nom}</span>
                      <span style={{fontSize:12,color:"#94a3b8"}}>{e.classe}</span>
                    </div>
                  ))}
                  <button onClick={()=>setHisto([])} style={{marginTop:10,padding:"5px 12px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#94a3b8",fontSize:12,cursor:"pointer"}}>Effacer</button>
                </div>
              )}
            </div>
          )}

          {mode==="groupes" && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{borderRadius:16,background:"#fff",border:"1.5px solid #e2e8f0",padding:20}}>
                <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:12}}>CONFIGURATION</div>
                <div style={{display:"flex",gap:8,marginBottom:18}}>
                  {(["nb","taille"] as const).map(m=>(
                    <button key={m} onClick={()=>{setModeG(m);setGroupes([]);}} style={{
                      flex:1,padding:"9px",borderRadius:10,
                      border:modeG===m?"2px solid #0A84FF":"1.5px solid #e2e8f0",
                      background:modeG===m?"#eff6ff":"#fff",
                      color:modeG===m?"#0A63BF":"#64748b",
                      fontWeight:modeG===m?700:500,fontSize:13,cursor:"pointer",
                    }}>{m==="nb"?"Par nombre de groupes":"Par taille de groupe"}</button>
                  ))}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                  <span style={{fontSize:14,color:"#475569",fontWeight:600}}>
                    {modeG==="nb"?"Nombre de groupes":"Élèves par groupe"} :
                  </span>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <button onClick={()=>{setValG(v=>Math.max(2,v-1));setGroupes([]);}} style={{width:38,height:38,borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:20,cursor:"pointer",fontWeight:700,color:"#334155"}}>-</button>
                    <span style={{fontSize:28,fontWeight:900,color:"#0f172a",minWidth:44,textAlign:"center"}}>{valG}</span>
                    <button onClick={()=>{setValG(v=>Math.min(eleves.length,v+1));setGroupes([]);}} style={{width:38,height:38,borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:20,cursor:"pointer",fontWeight:700,color:"#334155"}}>+</button>
                  </div>
                  <span style={{fontSize:13,color:"#64748b",background:"#f1f5f9",padding:"4px 10px",borderRadius:8}}>{preview}</span>
                </div>
              </div>

              <button onClick={creer} style={{
                padding:"14px",borderRadius:14,border:"none",background:GRADIENT,
                color:"#fff",fontWeight:900,fontSize:16,cursor:"pointer",
                boxShadow:"0 4px 16px rgba(10,132,255,.3)",
              }}>{groupes.length>0?"🔀 Recréer les groupes":"🔀 Créer les groupes aléatoirement"}</button>

              {groupes.length>0 && (
                <>
                  <div style={{fontSize:13,color:"#64748b",textAlign:"center"}}>{groupes.length} groupe{groupes.length>1?"s":""} · {eleves.length} élèves</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
                    {groupes.map((g,gi)=>(
                      <div key={gi} style={{borderRadius:16,background:"#fff",border:`2px solid ${COLORS[gi%COLORS.length]}25`,padding:16,boxShadow:"0 2px 8px rgba(15,23,42,.05)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,paddingBottom:10,borderBottom:`2px solid ${COLORS[gi%COLORS.length]}20`}}>
                          <div style={{width:34,height:34,borderRadius:"50%",background:COLORS[gi%COLORS.length],display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:15,flexShrink:0}}>{gi+1}</div>
                          <span style={{fontWeight:800,color:"#0f172a",fontSize:15}}>Groupe {gi+1}</span>
                          <span style={{fontSize:12,color:"#94a3b8",marginLeft:"auto"}}>{g.length} élève{g.length>1?"s":""}</span>
                        </div>
                        {g.map((e,ei)=>(
                          <div key={ei} style={{padding:"5px 0",fontSize:13,color:"#334155",borderBottom:ei<g.length-1?"1px solid #f8fafc":"none"}}>
                            {e.prenom} <span style={{fontWeight:700}}>{e.nom}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
