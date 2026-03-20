"use client";
import { useState, useCallback } from "react";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";
type Student = { id: string; prenom: string; nom: string; classe: string };

const ELEVES: Student[] = [
  { id: "30a5c6cd", prenom: "Yona", nom: "Babatunde", classe: "3GTA" },
  { id: "13baf24c", prenom: "Selina", nom: "Baldassarre", classe: "3GTA" },
  { id: "1c4bce3e", prenom: "Moussa", nom: "Belmamoun", classe: "3GTA" },
  { id: "392f74cb", prenom: "Abdel-Karim", nom: "Bouzanih", classe: "3GTA" },
  { id: "47a311c2", prenom: "Elodie", nom: "Cela", classe: "3GTA" },
  { id: "5bc43db7", prenom: "Victoria", nom: "Correnti", classe: "3GTA" },
  { id: "d388b3e0", prenom: "Maria Eduarda", nom: "Dos Santos Coelho", classe: "3GTA" },
  { id: "5dc59dd8", prenom: "Aimrane", nom: "El Bouzaggaoui", classe: "3GTA" },
  { id: "676f46f6", prenom: "Sam", nom: "El Debssi", classe: "3GTA" },
  { id: "a24e1502", prenom: "Mehdi", nom: "El Ghiati", classe: "3GTA" },
  { id: "08c10ed8", prenom: "Mayssa", nom: "El Yattouti", classe: "3GTA" },
  { id: "7a6c9433", prenom: "Eliza", nom: "Feijten", classe: "3GTA" },
  { id: "e4085dda", prenom: "Tamara", nom: "Ferreira de Sousa Colaco", classe: "3GTA" },
  { id: "1d01303e", prenom: "Sofya", nom: "Fonseca Souza", classe: "3GTA" },
  { id: "82df8b79", prenom: "Samy", nom: "Hammiche", classe: "3GTA" },
  { id: "98cf8610", prenom: "Ija", nom: "Iraamane", classe: "3GTA" },
  { id: "98b009b1", prenom: "Azra", nom: "Kara", classe: "3GTA" },
  { id: "6591300b", prenom: "Brandon", nom: "Manuel", classe: "3GTA" },
  { id: "f424f526", prenom: "Zineb", nom: "Mekkaoui", classe: "3GTA" },
  { id: "3782501f", prenom: "Pailine", nom: "Poismans", classe: "3GTA" },
  { id: "a5d21dfa", prenom: "Marwan", nom: "Rukhda", classe: "3GTA" },
  { id: "85a592aa", prenom: "Oliwia", nom: "Siergiejczyk", classe: "3GTA" },
  { id: "478db09a", prenom: "Mathis", nom: "Stoffen", classe: "3GTA" },
  { id: "f1953918", prenom: "Jessy", nom: "Van Peufflik", classe: "3GTA" },
  { id: "c6f6ab5b", prenom: "Selina", nom: "Wandy", classe: "3GTA" },
  { id: "76d53de1", prenom: "Selina", nom: "Wanzi", classe: "3GTA" },
  { id: "d9678b75", prenom: "Walid", nom: "Zaidi", classe: "3GTA" },
  { id: "4097498f", prenom: "Mohammed", nom: "Al Shakhli", classe: "3GTIM" },
  { id: "18567603", prenom: "Mouctar", nom: "Bah Mamadou", classe: "3GTIM" },
  { id: "f0a9cc84", prenom: "Bachir", nom: "Dardari", classe: "3GTIM" },
  { id: "fa863645", prenom: "Matiya", nom: "Djipro", classe: "3GTIM" },
  { id: "b17082fa", prenom: "Nejma", nom: "El Amrani", classe: "3GTIM" },
  { id: "35abb060", prenom: "Fay", nom: "Galarioti", classe: "3GTIM" },
  { id: "51ac773f", prenom: "Nour", nom: "Hida", classe: "3GTIM" },
  { id: "e665a29f", prenom: "Sophia", nom: "Marius", classe: "3GTIM" },
  { id: "6ad4a21c", prenom: "Franck", nom: "SIPOWO TCHINDA", classe: "3GTIM" },
  { id: "beabde29", prenom: "Bell", nom: "Wedjietie", classe: "3GTIM" },
  { id: "e4e99a51", prenom: "Florinda", nom: "Arifi", classe: "3GTM" },
  { id: "229abab7", prenom: "Mamadou Mouctar", nom: "Bah", classe: "3GTM" },
  { id: "0b6a68d6", prenom: "Lina", nom: "Bahamou", classe: "3GTM" },
  { id: "972698c0", prenom: "Achraf", nom: "Bouchal", classe: "3GTM" },
  { id: "c0082f24", prenom: "Richard Junior", nom: "Delvaux", classe: "3GTM" },
  { id: "c33a70ca", prenom: "Eliott", nom: "Djamous", classe: "3GTM" },
  { id: "74ea5adb", prenom: "Kelly", nom: "Fournier", classe: "3GTM" },
  { id: "d9cb2f38", prenom: "Malu", nom: "Franjulien", classe: "3GTM" },
  { id: "00a5cb93", prenom: "Sara", nom: "Ghulam", classe: "3GTM" },
  { id: "7d959c63", prenom: "Nathan", nom: "Gouzu", classe: "3GTM" },
  { id: "52fdc163", prenom: "Blessing", nom: "Kapia Mbanzulu", classe: "3GTM" },
  { id: "9e28c979", prenom: "Baran", nom: "Kartal", classe: "3GTM" },
  { id: "9e0451de", prenom: "Johan", nom: "Kibambe Musafiri", classe: "3GTM" },
  { id: "2ecdba34", prenom: "Laya", nom: "Moussaoui", classe: "3GTM" },
  { id: "76aa1904", prenom: "Steclay", nom: "Patam", classe: "3GTM" },
  { id: "b780745c", prenom: "Malak", nom: "Regragui", classe: "3GTM" },
  { id: "dfa15ba7", prenom: "Martiniuk Ilona", nom: "Villar Bonilla", classe: "3GTM" },
  { id: "4a2b9483", prenom: "Meriyem", nom: "Afkir", classe: "3GTS" },
  { id: "39b8e04b", prenom: "Jesus Dania", nom: "Ahdadi", classe: "3GTS" },
  { id: "3f272374", prenom: "Meriem", nom: "Akaaouach", classe: "3GTS" },
  { id: "cd17936b", prenom: "Ines", nom: "Ben Amar", classe: "3GTS" },
  { id: "980201bb", prenom: "Mohammed", nom: "Ben Hammouda", classe: "3GTS" },
  { id: "88d397ec", prenom: "Ali", nom: "Benmira", classe: "3GTS" },
  { id: "245f752e", prenom: "Zaynab", nom: "Chekkor", classe: "3GTS" },
  { id: "b6fa68f3", prenom: "Abdeljalil", nom: "Daali", classe: "3GTS" },
  { id: "fe2451fc", prenom: "Marwan", nom: "Daif", classe: "3GTS" },
  { id: "7062fc2e", prenom: "Luiz", nom: "FERNANDES SALES", classe: "3GTS" },
  { id: "e4464322", prenom: "Ilyas", nom: "Hadouchi", classe: "3GTS" },
  { id: "88394c8b", prenom: "Samuel-Andreas", nom: "INTUE-BONDOKI", classe: "3GTS" },
  { id: "c17d66c4", prenom: "Ines", nom: "Loucif", classe: "3GTS" },
  { id: "f4d97ccd", prenom: "Salsabile", nom: "Moshawrab", classe: "3GTS" },
  { id: "bda6d222", prenom: "William", nom: "Moussafounia", classe: "3GTS" },
  { id: "c9a73bc3", prenom: "Armeline", nom: "NOULEKA KAMGANG", classe: "3GTS" },
  { id: "31cb6a93", prenom: "Adama", nom: "OUATTARA", classe: "3GTS" },
  { id: "03dd1d16", prenom: "Semih", nom: "Ozkan", classe: "3GTS" },
  { id: "1f02457f", prenom: "Tele Jean-Pierre", nom: "Samba", classe: "3GTS" },
  { id: "e48324ae", prenom: "Adel", nom: "Sedira", classe: "3GTS" },
  { id: "99d98ff2", prenom: "Hakim", nom: "Tizgui", classe: "3GTS" },
  { id: "a30c217e", prenom: "Beniamin", nom: "Tofei", classe: "3GTS" },
  { id: "0959abbc", prenom: "Soraya", nom: "Aifar", classe: "3GTT" },
  { id: "58f81033", prenom: "Abdulshafay", nom: "AKHTAR", classe: "3GTT" },
  { id: "111fae38", prenom: "Ayoub", nom: "Amri", classe: "3GTT" },
  { id: "c7236d30", prenom: "Mariama", nom: "Bah", classe: "3GTT" },
  { id: "7c4eeb38", prenom: "Lina", nom: "Barhoumi", classe: "3GTT" },
  { id: "df706ce0", prenom: "Malak", nom: "Bouras Jalti", classe: "3GTT" },
  { id: "31e4d095", prenom: "Louay", nom: "El Hanoudi", classe: "3GTT" },
  { id: "5eaad89d", prenom: "Nada", nom: "El Mehdi", classe: "3GTT" },
  { id: "eb3bcb53", prenom: "Naim", nom: "Hamoudan", classe: "3GTT" },
  { id: "c8df2fcb", prenom: "Ilian", nom: "Hilli", classe: "3GTT" },
  { id: "d3a30976", prenom: "Abdoulzahir", nom: "Issa Arzika", classe: "3GTT" },
  { id: "21c00f45", prenom: "Fady", nom: "Jamai", classe: "3GTT" },
  { id: "5dffcb05", prenom: "Rita", nom: "Jelloul", classe: "3GTT" },
  { id: "0c4182f6", prenom: "Leyla", nom: "Jiyar", classe: "3GTT" },
  { id: "d8296274", prenom: "Malak", nom: "Lfarh", classe: "3GTT" },
  { id: "31bc83d8", prenom: "Fahd", nom: "Merdaci", classe: "3GTT" },
  { id: "808fb36d", prenom: "Maram", nom: "Mimoune", classe: "3GTT" },
  { id: "393e0850", prenom: "Aya", nom: "Nait Hamoud", classe: "3GTT" },
  { id: "55053de6", prenom: "Binta", nom: "Oumar", classe: "3GTT" },
  { id: "259d4422", prenom: "Youssef", nom: "Rharib", classe: "3GTT" },
  { id: "be65555e", prenom: "Robert", nom: "VLAS", classe: "3GTT" },
  { id: "c6ce74f9", prenom: "Yasmine", nom: "Zahraoui", classe: "3GTT" },
  { id: "caf055ba", prenom: "Adam", nom: "Abdelhamid", classe: "3GTU" },
  { id: "dbe5c202", prenom: "Taieb Malak", nom: "Ait Hammouche", classe: "3GTU" },
  { id: "18cd0b99", prenom: "Bayane", nom: "Akabi", classe: "3GTU" },
  { id: "42302f4b", prenom: "Ibrahima", nom: "Bah", classe: "3GTU" },
  { id: "10b73862", prenom: "Citoyen Johanna", nom: "Bazimaziki", classe: "3GTU" },
  { id: "ce0eca07", prenom: "Zakaria", nom: "Cherkaoui", classe: "3GTU" },
  { id: "c2f1879a", prenom: "Zephyr", nom: "De Bie", classe: "3GTU" },
  { id: "d77fca72", prenom: "Rania", nom: "El Grimette", classe: "3GTU" },
  { id: "bf1950e3", prenom: "Najoua", nom: "El Hadouchi", classe: "3GTU" },
  { id: "373f7acf", prenom: "Ilyas", nom: "Fenzar", classe: "3GTU" },
  { id: "5775ab97", prenom: "issa Amadou", nom: "Hima", classe: "3GTU" },
  { id: "50f55391", prenom: "Celian", nom: "Hubert", classe: "3GTU" },
  { id: "cf977d73", prenom: "Maryam", nom: "Kallah", classe: "3GTU" },
  { id: "bbd7e677", prenom: "Tidora", nom: "Kaya", classe: "3GTU" },
  { id: "8bb351c6", prenom: "Livia", nom: "Krawczuk", classe: "3GTU" },
  { id: "02ecd45b", prenom: "Zuzanna", nom: "Lizewska", classe: "3GTU" },
  { id: "6090b8a5", prenom: "Gabriela", nom: "Mantura", classe: "3GTU" },
  { id: "109f4464", prenom: "Sami", nom: "Mehjoub", classe: "3GTU" },
  { id: "faf614ca", prenom: "Mulamba Sacha", nom: "Nzuzi", classe: "3GTU" },
  { id: "bf790433", prenom: "Riham", nom: "Oudes", classe: "3GTU" },
  { id: "6a86f5ab", prenom: "Sherine", nom: "Rharib", classe: "3GTU" },
  { id: "12714463", prenom: "Sefora", nom: "Vasile", classe: "3GTU" },
  { id: "a88bff7a", prenom: "Pages Samuel", nom: "Yanes", classe: "3GTU" },
];

const CLASSES = ["3GTA", "3GTIM", "3GTM", "3GTS", "3GTT", "3GTU"];
const COLORS = ["#FF3B30","#0A84FF","#34C759","#FF9500","#AF52DE","#00C7BE","#FF2D55","#5AC8FA"];

export default function OutilsPage() {
  const [classe, setClasse] = useState("3GTA");
  const [mode, setMode] = useState<"tirage"|"groupes">("tirage");
  const [eleve, setEleve] = useState<Student|null>(null);
  const [anim, setAnim] = useState(false);
  const [histo, setHisto] = useState<Student[]>([]);
  const [modeG, setModeG] = useState<"nb"|"taille">("nb");
  const [valG, setValG] = useState(4);
  const [groupes, setGroupes] = useState<Student[][]>([]);

  const list = ELEVES.filter(e => e.classe === classe);

  const tirer = useCallback(() => {
    if (!list.length) return;
    setAnim(true); setEleve(null);
    let n = 0;
    const iv = setInterval(() => {
      setEleve(list[Math.floor(Math.random()*list.length)]);
      if (++n > 14) {
        clearInterval(iv); setAnim(false);
        const f = list[Math.floor(Math.random()*list.length)];
        setEleve(f);
        setHisto(p => [f,...p].slice(0,6));
      }
    }, 70);
  }, [list]);

  const creer = useCallback(() => {
    const s = [...list].sort(() => Math.random()-0.5);
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
  }, [list, modeG, valG]);

  const preview = modeG === "nb"
    ? `~${Math.ceil(list.length/valG)} eleves/groupe`
    : `${Math.ceil(list.length/valG)} groupe(s)`;

  return (
    <div style={{maxWidth:820,margin:"0 auto"}}>
      <div style={{borderRadius:18,padding:"16px 22px",background:GRADIENT,color:"#fff",marginBottom:20}}>
        <div style={{fontSize:22,fontWeight:900}}>🎲 Outils de classe</div>
        <div style={{fontSize:13,opacity:.85,marginTop:2}}>Tirage au sort · Creation de groupes aleatoires</div>
      </div>

      <div style={{marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:8}}>CLASSE</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {CLASSES.map(c => (
            <button key={c} onClick={()=>{setClasse(c);setEleve(null);setGroupes([]);setHisto([]);}} style={{
              padding:"8px 16px",borderRadius:99,
              border:classe===c?"2px solid #0A84FF":"1.5px solid #e2e8f0",
              background:classe===c?"#eff6ff":"#fff",
              color:classe===c?"#0A63BF":"#334155",
              fontWeight:classe===c?800:600,fontSize:14,cursor:"pointer",
            }}>{c} <span style={{opacity:.5,fontSize:11}}>({ELEVES.filter(e=>e.classe===c).length})</span></button>
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
          }}>{m==="tirage"?"🎯 Tirage au sort":"👥 Creer des groupes"}</button>
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
                <div style={{fontSize:16}}>Appuie sur le bouton pour tirer un eleve au sort</div>
                <div style={{fontSize:13,marginTop:6}}>{list.length} eleves dans {classe}</div>
              </div>
            ) : (
              <div>
                <div style={{fontSize:13,color:"#64748b",fontWeight:600,marginBottom:10}}>
                  {anim?"🎲 Tirage en cours...":"✨ Eleve tire au sort !"}
                </div>
                <div style={{fontSize:38,fontWeight:900,color:"#0f172a",lineHeight:1.2,filter:anim?"blur(3px)":"none",transition:"filter .08s"}}>
                  {eleve?.prenom}<br/>{eleve?.nom}
                </div>
                {!anim && <div style={{display:"inline-block",marginTop:14,padding:"5px 16px",borderRadius:99,background:"#eff6ff",color:"#0A63BF",fontSize:13,fontWeight:700}}>{classe}</div>}
              </div>
            )}
          </div>

          <button onClick={tirer} disabled={anim} style={{
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
                {modeG==="nb"?"Nombre de groupes":"Eleves par groupe"} :
              </span>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <button onClick={()=>{setValG(v=>Math.max(2,v-1));setGroupes([]);}} style={{width:38,height:38,borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:20,cursor:"pointer",fontWeight:700,color:"#334155"}}>-</button>
                <span style={{fontSize:28,fontWeight:900,color:"#0f172a",minWidth:44,textAlign:"center"}}>{valG}</span>
                <button onClick={()=>{setValG(v=>Math.min(list.length,v+1));setGroupes([]);}} style={{width:38,height:38,borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:20,cursor:"pointer",fontWeight:700,color:"#334155"}}>+</button>
              </div>
              <span style={{fontSize:13,color:"#64748b",background:"#f1f5f9",padding:"4px 10px",borderRadius:8}}>{preview}</span>
            </div>
          </div>

          <button onClick={creer} style={{
            padding:"14px",borderRadius:14,border:"none",background:GRADIENT,
            color:"#fff",fontWeight:900,fontSize:16,cursor:"pointer",
            boxShadow:"0 4px 16px rgba(10,132,255,.3)",
          }}>{groupes.length>0?"🔀 Recreer les groupes":"🔀 Creer les groupes aleatoirement"}</button>

          {groupes.length>0 && (
            <>
              <div style={{fontSize:13,color:"#64748b",textAlign:"center"}}>{groupes.length} groupe{groupes.length>1?"s":""} · {list.length} eleves</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
                {groupes.map((g,gi)=>(
                  <div key={gi} style={{borderRadius:16,background:"#fff",border:`2px solid ${COLORS[gi%COLORS.length]}25`,padding:16,boxShadow:"0 2px 8px rgba(15,23,42,.05)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,paddingBottom:10,borderBottom:`2px solid ${COLORS[gi%COLORS.length]}20`}}>
                      <div style={{width:34,height:34,borderRadius:"50%",background:COLORS[gi%COLORS.length],display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:15,flexShrink:0}}>{gi+1}</div>
                      <span style={{fontWeight:800,color:"#0f172a",fontSize:15}}>Groupe {gi+1}</span>
                      <span style={{fontSize:12,color:"#94a3b8",marginLeft:"auto"}}>{g.length} eleve{g.length>1?"s":""}</span>
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
    </div>
  );
}
