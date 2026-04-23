import { useState, useEffect } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const RISK_COLORS = {
  libre:   { bg:"#e8f5e9", text:"#2e7d32", label:"LIBRE",   dot:"#43a047" },
  faible:  { bg:"#e3f2fd", text:"#1565c0", label:"FAIBLE",  dot:"#1e88e5" },
  modere:  { bg:"#fff8e1", text:"#e65100", label:"MODÉRÉ",  dot:"#fb8c00" },
  bloque:  { bg:"#fce4ec", text:"#b71c1c", label:"BLOQUÉ",  dot:"#e53935" },
  inconnu: { bg:"#f3e5f5", text:"#6a1b9a", label:"INCONNU", dot:"#8e24aa" },
};
const BAIL_LABELS = {
  loi89:"Loi 89", loi48:"Loi 48",
  derogatoire:"Bail dérogatoire / précaire",
  commercial_369:"Bail commercial 3/6/9", autre:"Autre / Inconnu",
};
const RISQUES_ADRESSE = [
  { key:"inondation", label:"Zone inondable (PPRI)" },
  { key:"argile",     label:"Retrait-gonflement argile fort" },
  { key:"sismique",   label:"Zone sismique" },
  { key:"radon",      label:"Exposition radon" },
  { key:"mvsol",      label:"Mouvement de terrain" },
  { key:"industrie",  label:"Site industriel / ICPE proche" },
];
const CHECKLIST_ITEMS = {
  enveloppe: [
    { key:"acces_fonctionnel",   label:"Accès existant fonctionnel" },
    { key:"acces_separables",    label:"Accès séparables possibles" },
    { key:"facade_saine",        label:"Façade saine" },
    { key:"couverture_ok",       label:"Couverture correcte" },
    { key:"charpente_ok",        label:"Charpente correcte" },
    { key:"ouvertures_possible", label:"Création d'ouvertures possible" },
  ],
  reseaux: [
    { key:"tout_egout",   label:"Tout-à-l'égout présent" },
    { key:"ep_separatif", label:"EP séparatif" },
    { key:"compteur_eau", label:"Compteur d'eau repéré" },
    { key:"tableau_elec", label:"Tableau électrique repéré" },
    { key:"colonnes_ok",  label:"Colonnes / chutes repérées" },
    { key:"wc_visibles",  label:"Gros diamètres WC visibles" },
  ],
  structure: [
    { key:"murs_porteurs",  label:"Murs porteurs identifiables" },
    { key:"plancher_sain",  label:"Plancher sain" },
    { key:"escalier_ok",    label:"Escalier présent" },
    { key:"hauteur_ok",     label:"Hauteur exploitable" },
    { key:"lumiere_ok",     label:"Lumière naturelle suffisante" },
    { key:"circulation_ok", label:"Circulations cohérentes" },
  ],
};
const ETATS_BIEN = [
  { key:"rafraichissement", label:"Rafraîchissement (murs & sols)",         cout:250,  coutMax:250  },
  { key:"renovation_moy",   label:"Rénovation moyenne (+ plomberie/élec)", cout:500,  coutMax:500  },
  { key:"grosse_renov",     label:"Grosse rénovation (total)",              cout:750,  coutMax:750  },
  { key:"tout_faire",       label:"Tout à faire (GO + SO)",                 cout:1000, coutMax:1200 },
];
const STATUTS_DOSSIER = ["En cours","Visite prévue","Offre faite","Abandonné","Acquis","Vendu"];
const TYPES_BIEN      = ["Immeuble","Appartement","Maison","Plateau brut","Local commercial","Terrain"];
const SOURCES         = ["Agent immobilier","LeBonCoin","PAP","SeLoger","Notaire","Direct vendeur","Bouche à oreille","Autre"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function computeRisk(lot) {
  if (lot.statut==="libre") return "libre";
  if (lot.statutInconnu) return "inconnu";
  if (lot.bailType==="commercial_369") return "bloque";
  if (lot.protege) return "bloque";
  if (lot.bailType==="loi48") return "bloque";
  if (lot.bailType==="derogatoire") return "faible";
  if (lot.bailType==="loi89") {
    const m=parseInt(lot.moisRestants)||0;
    if (m<=6) return "faible";
    if (m<=18) return "modere";
    return "bloque";
  }
  return "inconnu";
}
function computeDelai(lot) {
  if (lot.statut==="libre") return "Immédiat";
  if (lot.statutInconnu) return "Inconnu — clarifier avant signing";
  if (lot.protege) return "Indéterminé";
  if (lot.bailType==="commercial_369") return "Selon échéance triennale";
  if (lot.bailType==="loi48") return "Très long / inamovible";
  if (lot.bailType==="derogatoire") return "3 mois (LRAR)";
  if (lot.bailType==="loi89") {
    const m=parseInt(lot.moisRestants)||0;
    if (m<=6) return "3–6 mois (amiable)";
    if (m<=18) return `${m} mois à échéance`;
    return `${m} mois — vente occupé`;
  }
  return "À évaluer";
}
function computeProvisionLabel(lot) {
  if (lot.statut==="libre") return "0€";
  if (lot.statutInconnu) return "À clarifier";
  if (lot.protege) return "6k – 12k€+";
  if (lot.bailType==="commercial_369") return "30k – 80k€";
  if (lot.bailType==="loi48") return "5k – 15k€";
  if (lot.bailType==="derogatoire") return "0€";
  if (lot.bailType==="loi89") {
    const m=parseInt(lot.moisRestants)||0;
    if (m<=6) return "1,5k – 3k€";
    if (m<=18) return "3k – 6k€";
    return "6k€+ ou occupé";
  }
  return "À évaluer";
}
function provisionNum(lot) {
  const r=computeRisk(lot);
  if (r==="libre") return 0;
  if (r==="faible") return 2500;
  if (r==="modere") return 5000;
  if (r==="bloque"&&lot.bailType==="commercial_369") return 50000;
  if (r==="bloque") return 10000;
  return 0;
}
function fmt(n) {
  if (n===null||n===undefined||isNaN(n)) return "—";
  return Math.round(n).toLocaleString("fr-FR")+"€";
}

// ─── RESPONSIVE HOOK ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#F5F3EE", card:"#FFFFFF", dark:"#1C1C2E", gold:"#D4A843",
  border:"#E2DDD5", text:"#2C2C2C", muted:"#888880", danger:"#C0392B", success:"#27AE60",
};
const inp = {
  width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`,
  borderRadius:8, fontSize:15, background:"#FAFAF8", outline:"none",
  boxSizing:"border-box", color:C.text, fontFamily:"inherit",
};
const lbl = {
  display:"block", fontSize:10, color:C.muted, letterSpacing:1.2,
  marginBottom:5, textTransform:"uppercase", fontWeight:600,
};
const sH3 = {
  margin:"0 0 14px", fontSize:15, fontWeight:700, color:C.dark,
  paddingBottom:8, borderBottom:`1px solid ${C.border}`,
  fontFamily:"'Playfair Display', serif",
};
function cardStyle(extra={}) {
  return { background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px", marginBottom:14, ...extra };
}
function Field({ label, children }) {
  return <div style={{marginBottom:12}}><label style={lbl}>{label}</label>{children}</div>;
}
function Grid({ cols=2, mob=1, isMobile, children }) {
  const c = isMobile ? mob : cols;
  return <div style={{ display:"grid", gridTemplateColumns:`repeat(${c},1fr)`, gap:12 }}>{children}</div>;
}
function SectionTitle({ num, title, subtitle }) {
  return (
    <div style={{ marginBottom:18, marginTop:4 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ background:C.dark, color:C.gold, fontWeight:800, fontSize:11, padding:"3px 10px", borderRadius:4, letterSpacing:2 }}>{num}</span>
        <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:C.dark, fontFamily:"'Playfair Display', serif" }}>{title}</h2>
      </div>
      {subtitle && <p style={{ margin:"4px 0 0 44px", fontSize:12, color:C.muted }}>{subtitle}</p>}
    </div>
  );
}
function RiskBadge({ risk }) {
  const rc = RISK_COLORS[risk]||RISK_COLORS.inconnu;
  return (
    <span style={{ background:rc.bg, color:rc.text, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, letterSpacing:1, display:"inline-flex", alignItems:"center", gap:5 }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:rc.dot, display:"inline-block" }}/>{rc.label}
    </span>
  );
}

// ─── MODULE 01 ───────────────────────────────────────────────────────────────
function ModuleIdentification({ data, onChange, isMobile }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
    <div>
      <SectionTitle num="01" title="Identification du bien" subtitle="Informations générales et contexte vendeur"/>
      <div style={cardStyle()}>
        <h3 style={sH3}>Bien</h3>
        <Grid cols={3} mob={1} isMobile={isMobile}>
          <Field label="Nom / référence dossier"><input value={data.nom||""} onChange={e=>f("nom",e.target.value)} placeholder="ex: Immeuble Trévoux 456m²" style={inp}/></Field>
          <Field label="Type de bien">
            <select value={data.type||""} onChange={e=>f("type",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="">— Choisir —</option>{TYPES_BIEN.map(t=><option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Statut dossier">
            <select value={data.statut||""} onChange={e=>f("statut",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="">— Choisir —</option>{STATUTS_DOSSIER.map(s=><option key={s}>{s}</option>)}
            </select>
          </Field>
        </Grid>
        <Grid cols={2} mob={1} isMobile={isMobile}>
          <Field label="Adresse complète"><input value={data.adresse||""} onChange={e=>f("adresse",e.target.value)} placeholder="40 Grande Rue, 01600 Trévoux" style={inp}/></Field>
          <Field label="Lien annonce"><input value={data.lienAnnonce||""} onChange={e=>f("lienAnnonce",e.target.value)} placeholder="URL leboncoin..." style={inp}/></Field>
        </Grid>
        <Grid cols={4} mob={2} isMobile={isMobile}>
          <Field label="Surface (m²)"><input value={data.surface||""} onChange={e=>f("surface",e.target.value)} placeholder="456" style={inp} type="number"/></Field>
          <Field label="Terrain (m²)"><input value={data.surfaceTerrain||""} onChange={e=>f("surfaceTerrain",e.target.value)} placeholder="—" style={inp} type="number"/></Field>
          <Field label="Prix affiché (€)"><input value={data.prixAffiche||""} onChange={e=>f("prixAffiche",e.target.value)} placeholder="550 000" style={inp} type="number"/></Field>
          <Field label="Source">
            <select value={data.source||""} onChange={e=>f("source",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="">— Choisir —</option>{SOURCES.map(s=><option key={s}>{s}</option>)}
            </select>
          </Field>
        </Grid>
        <Grid cols={2} mob={1} isMobile={isMobile}>
          <Field label="Agence / contact"><input value={data.agence||""} onChange={e=>f("agence",e.target.value)} placeholder="ex: Mycasa — Enzo Molina" style={inp}/></Field>
          <Field label="Éléments dossier (Drive)"><input value={data.dossier||""} onChange={e=>f("dossier",e.target.value)} placeholder="https://drive.google.com/..." style={inp}/></Field>
        </Grid>
      </div>

      <div style={cardStyle()}>
        <h3 style={sH3}>Contexte vendeur</h3>
        <Grid cols={2} mob={1} isMobile={isMobile}>
          <Field label="Qui vend ?"><input value={data.vendeur||""} onChange={e=>f("vendeur",e.target.value)} placeholder="ex: 1 personne âgée via ses enfants" style={inp}/></Field>
          <Field label="Pourquoi vendre ?"><input value={data.motifVente||""} onChange={e=>f("motifVente",e.target.value)} placeholder="ex: succession, DPE G..." style={inp}/></Field>
        </Grid>
        <Grid cols={3} mob={1} isMobile={isMobile}>
          <Field label="En vente depuis"><input value={data.depuisCombien||""} onChange={e=>f("depuisCombien",e.target.value)} placeholder="ex: 2 mois" style={inp}/></Field>
          <Field label="Offre(s) reçue(s)">
            <select value={data.offresRecues||""} onChange={e=>f("offresRecues",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="">— Non renseigné —</option><option value="non">Non</option><option value="oui">Oui</option>
            </select>
          </Field>
          <Field label="Si oui, montant ?"><input value={data.montantOffre||""} onChange={e=>f("montantOffre",e.target.value)} placeholder="ex: 480 000€" style={inp}/></Field>
        </Grid>
        <Field label="Remarques">
          <textarea value={data.remarques||""} onChange={e=>f("remarques",e.target.value)} placeholder="Observations..." style={{...inp,height:80,resize:"vertical"}}/>
        </Field>
      </div>

      <div style={cardStyle()}>
        <h3 style={sH3}>Réglementaire & Risques adresse</h3>
        <Grid cols={3} mob={1} isMobile={isMobile}>
          <Field label="Zone PLU"><input value={data.pluZone||""} onChange={e=>f("pluZone",e.target.value)} placeholder="ex: Zone U" style={inp}/></Field>
          <Field label="Référence parcelle"><input value={data.pluParcelle||""} onChange={e=>f("pluParcelle",e.target.value)} placeholder="ex: 000/AD/0593" style={inp}/></Field>
          <Field label="Destination compatible ?">
            <select value={data.pluDestination||""} onChange={e=>f("pluDestination",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="">— Non vérifié —</option><option value="oui">✅ Oui</option><option value="non">❌ Non</option><option value="confirmer">⚠️ À confirmer</option>
            </select>
          </Field>
        </Grid>
        <Grid cols={2} mob={1} isMobile={isMobile}>
          <Field label="Stationnement">
            <select value={data.pluStationnement||""} onChange={e=>f("pluStationnement",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="">— Non vérifié —</option><option value="non_bloquant">✅ Non bloquant</option><option value="bloquant">❌ Bloquant</option><option value="confirmer">⚠️ À confirmer</option>
            </select>
          </Field>
          <Field label="Points à vérifier"><input value={data.pluPoints||""} onChange={e=>f("pluPoints",e.target.value)} placeholder="ex: COS, hauteur..." style={inp}/></Field>
        </Grid>
        <div style={{marginTop:8}}>
          <div style={{fontSize:11,color:C.muted,letterSpacing:1.2,fontWeight:600,marginBottom:10,textTransform:"uppercase"}}>
            Risques — <a href="https://georisques.gouv.fr" target="_blank" rel="noreferrer" style={{color:C.gold,textDecoration:"none"}}>géorisques.gouv.fr</a>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr",gap:8}}>
            {RISQUES_ADRESSE.map(r=>(
              <label key={r.key} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,padding:"8px 10px",borderRadius:8,background:data.risques?.[r.key]?"#fce4ec":"#F5F3EE",border:`1px solid ${data.risques?.[r.key]?"#e53935":C.border}`}}>
                <input type="checkbox" checked={data.risques?.[r.key]||false} onChange={e=>f("risques",{...data.risques,[r.key]:e.target.checked})} style={{accentColor:C.danger,width:16,height:16}}/>
                <span style={{color:data.risques?.[r.key]?C.danger:C.text,fontSize:12,fontWeight:data.risques?.[r.key]?600:400}}>{data.risques?.[r.key]?"⚠️ ":""}{r.label}</span>
              </label>
            ))}
          </div>
          {Object.values(data.risques||{}).some(Boolean)&&(
            <div style={{marginTop:10,padding:"8px 14px",background:"#fce4ec",borderRadius:8,fontSize:12,color:C.danger,fontWeight:600}}>
              ⚠️ {Object.values(data.risques||{}).filter(Boolean).length} risque(s) identifié(s)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MODULE 02 ───────────────────────────────────────────────────────────────
function ModuleChecklist({ data, onChange, isMobile }) {
  const f = (k,v) => onChange({...data,[k]:v});
  const setCheck = (section,key,val) => f(section,{...data[section],[key]:val});
  const setNote  = (k,v) => f("notes",{...data.notes,[k]:v});
  const CheckRow = ({item,section}) => (
    <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"10px 12px",borderRadius:8,marginBottom:6,background:data[section]?.[item.key]?"#f0faf4":"#FAFAF8",border:`1px solid ${data[section]?.[item.key]?"#a5d6a7":C.border}`}}>
      <input type="checkbox" checked={data[section]?.[item.key]===true} onChange={e=>setCheck(section,item.key,e.target.checked)} style={{accentColor:C.dark,width:18,height:18,flexShrink:0}}/>
      <span style={{fontSize:14,textDecoration:data[section]?.[item.key]?"line-through":"none",color:data[section]?.[item.key]?C.muted:C.text}}>{item.label}</span>
    </label>
  );
  return (
    <div>
      <SectionTitle num="02" title="Checklist visite" subtitle="À compléter pendant et après la visite"/>
      <div style={cardStyle()}>
        <h3 style={sH3}>① Extérieur / Accès / Enveloppe</h3>
        {CHECKLIST_ITEMS.enveloppe.map(item=><CheckRow key={item.key} item={item} section="enveloppe"/>)}
        <Field label="Notes extérieur"><textarea value={data.notes?.enveloppe||""} onChange={e=>setNote("enveloppe",e.target.value)} placeholder="Observations..." style={{...inp,height:70,resize:"vertical",marginTop:4}}/></Field>
      </div>
      <div style={cardStyle()}>
        <h3 style={sH3}>② Réseaux / VRD</h3>
        {CHECKLIST_ITEMS.reseaux.map(item=><CheckRow key={item.key} item={item} section="reseaux"/>)}
        <Field label="Notes réseaux"><textarea value={data.notes?.reseaux||""} onChange={e=>setNote("reseaux",e.target.value)} placeholder="Observations..." style={{...inp,height:70,resize:"vertical",marginTop:4}}/></Field>
      </div>
      <div style={cardStyle()}>
        <h3 style={sH3}>③ Intérieur / Structure</h3>
        {CHECKLIST_ITEMS.structure.map(item=><CheckRow key={item.key} item={item} section="structure"/>)}
        <Field label="Surface exploitable (m²)"><input value={data.surfaceExploit||""} onChange={e=>f("surfaceExploit",e.target.value)} placeholder="ex: 456" style={inp} type="number"/></Field>
        <Field label="Notes structure"><textarea value={data.notes?.structure||""} onChange={e=>setNote("structure",e.target.value)} placeholder="Observations..." style={{...inp,height:60,resize:"vertical"}}/></Field>
      </div>
      <div style={cardStyle({background:C.dark})}>
        <h3 style={{...sH3,color:"#fff",borderColor:"rgba(255,255,255,0.15)"}}>④ Décision à chaud</h3>
        <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          {["GO","GO sous réserve","NO GO"].map(d=>(
            <button key={d} onClick={()=>f("decision",d)} style={{
              flex:1, minWidth:100, padding:"12px 8px", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:14, fontFamily:"inherit",
              background:data.decision===d?(d==="GO"?"#1b5e20":d==="NO GO"?"#b71c1c":"#e65100"):"rgba(255,255,255,0.1)",
              border:data.decision===d?"none":`1px solid rgba(255,255,255,0.2)`,
              color:data.decision===d?"#fff":"#888",
            }}>{d==="GO"?"✅":d==="NO GO"?"❌":"⚠️"} {d}</button>
          ))}
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:12}}>
          <input type="checkbox" checked={data.pointBloquant||false} onChange={e=>f("pointBloquant",e.target.checked)} style={{accentColor:C.gold,width:18,height:18}}/>
          <span style={{color:data.pointBloquant?"#ff6b6b":"#aaa",fontWeight:600,fontSize:14}}>Point bloquant identifié</span>
        </label>
        {data.pointBloquant&&<textarea value={data.pointBloquantDetail||""} onChange={e=>f("pointBloquantDetail",e.target.value)} placeholder="Détail du point bloquant..." style={{...inp,height:70,resize:"vertical",background:"rgba(255,255,255,0.08)",borderColor:"#ff6b6b",color:"#fff"}}/>}
        <div style={{marginTop:12}}>
          <textarea value={data.decisionMotif||""} onChange={e=>f("decisionMotif",e.target.value)} placeholder="Motif de la décision..." style={{...inp,height:60,resize:"vertical",background:"rgba(255,255,255,0.08)",borderColor:"rgba(255,255,255,0.2)",color:"#fff"}}/>
        </div>
      </div>
    </div>
  );
}

// ─── MODULE 03 ───────────────────────────────────────────────────────────────
function EtatSelector({ value, onChange, surface, label="État général" }) {
  const etat = ETATS_BIEN.find(e=>e.key===value);
  const s = parseFloat(surface)||0;
  return (
    <Field label={label}>
      <select value={value||""} onChange={e=>onChange(e.target.value)} style={{...inp,cursor:"pointer"}}>
        <option value="">— Non évalué —</option>
        {ETATS_BIEN.map(e=><option key={e.key} value={e.key}>{e.label} (~{e.key==="tout_faire"?"1 000–1 200":e.cout}€/m²)</option>)}
      </select>
      {etat&&s>0&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>Estimation : <strong style={{color:C.text}}>{fmt(etat.cout*s)}{etat.key==="tout_faire"?` – ${fmt(1200*s)}`:""}</strong></div>}
    </Field>
  );
}

function LotCard({ lot, index, onUpdate, onDelete, isMobile }) {
  const [open, setOpen] = useState(true);
  const risk = computeRisk(lot);
  const rc   = RISK_COLORS[risk];
  const f    = (k,v) => onUpdate(index,k,v);
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:14,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:C.dark,cursor:"pointer"}} onClick={()=>setOpen(!open)}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{background:C.gold,color:C.dark,fontWeight:800,fontSize:11,padding:"2px 10px",borderRadius:4,letterSpacing:1}}>LOT {lot.numero||index+1}</span>
          <span style={{color:"#fff",fontSize:13,fontWeight:600}}>{lot.nom||"—"}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <RiskBadge risk={risk}/>
          <span style={{color:"#888",fontSize:16}}>{open?"▲":"▼"}</span>
          <button onClick={e=>{e.stopPropagation();onDelete(index);}} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",cursor:"pointer",borderRadius:4,padding:"4px 8px",fontSize:13}}>✕</button>
        </div>
      </div>
      {open&&(
        <div style={{padding:"14px 16px"}}>
          <Grid cols={3} mob={2} isMobile={isMobile}>
            <Field label="Statut">
              <select value={lot.statut||""} onChange={e=>f("statut",e.target.value)} style={{...inp,cursor:"pointer"}}>
                <option value="">— Choisir —</option><option value="libre">🟢 Libre</option><option value="occupe">🔴 Occupé</option>
              </select>
            </Field>
            <Field label="N° lot"><input value={lot.numero||""} onChange={e=>f("numero",e.target.value)} placeholder="4" style={inp}/></Field>
            <Field label="Désignation"><input value={lot.nom||""} onChange={e=>f("nom",e.target.value)} placeholder="ex: Appt T2" style={inp}/></Field>
          </Grid>
          <Grid cols={3} mob={2} isMobile={isMobile}>
            <Field label="Surface hab. (m²)"><input value={lot.surface||""} onChange={e=>f("surface",e.target.value)} placeholder="62" style={inp} type="number"/></Field>
            <Field label="Ext. (m²)"><input value={lot.surfaceExt||""} onChange={e=>f("surfaceExt",e.target.value)} placeholder="8" style={inp} type="number"/></Field>
            <Field label="Type ext.">
              <select value={lot.typeExt||""} onChange={e=>f("typeExt",e.target.value)} style={{...inp,cursor:"pointer"}}>
                <option value="">— Aucun —</option><option value="balcon">Balcon</option><option value="loggia">Loggia</option><option value="terrasse">Terrasse</option><option value="jardin">Jardin</option><option value="cour">Cour</option>
              </select>
            </Field>
          </Grid>
          <EtatSelector value={lot.etatLot} onChange={v=>f("etatLot",v)} surface={lot.surface} label="État général du lot"/>

          {lot.statut==="occupe"&&(
            <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:12,fontSize:14}}>
                <input type="checkbox" checked={lot.statutInconnu||false} onChange={e=>f("statutInconnu",e.target.checked)} style={{width:18,height:18}}/>
                <span style={{color:lot.statutInconnu?C.danger:C.text,fontWeight:600}}>⚠️ Bail non reçu / statut inconnu</span>
              </label>
              {!lot.statutInconnu&&(
                <>
                  <Grid cols={2} mob={1} isMobile={isMobile}>
                    <Field label="Type de bail">
                      <select value={lot.bailType||""} onChange={e=>f("bailType",e.target.value)} style={{...inp,cursor:"pointer"}}>
                        <option value="">— Choisir —</option>{Object.entries(BAIL_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                      </select>
                    </Field>
                    <Field label="Échéance bail"><input value={lot.echeance||""} onChange={e=>f("echeance",e.target.value)} placeholder="02/2027" style={inp}/></Field>
                  </Grid>
                  <Grid cols={3} mob={2} isMobile={isMobile}>
                    <Field label="Mois restants"><input value={lot.moisRestants||""} onChange={e=>f("moisRestants",e.target.value)} placeholder="22" style={inp} type="number"/></Field>
                    <Field label="Loyer CC/mois (€)"><input value={lot.loyer||""} onChange={e=>f("loyer",e.target.value)} placeholder="575" style={inp} type="number"/></Field>
                    <Field label="Loyer marché (€)"><input value={lot.loyerMarche||""} onChange={e=>f("loyerMarche",e.target.value)} placeholder="700" style={inp} type="number"/></Field>
                  </Grid>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:14,marginBottom:10}}>
                    <input type="checkbox" checked={lot.protege||false} onChange={e=>f("protege",e.target.checked)} style={{width:18,height:18}}/>
                    🔒 Locataire protégé (+65 ans)
                  </label>
                  <Field label="Profil locataire"><textarea value={lot.profil||""} onChange={e=>f("profil",e.target.value)} placeholder="ex: famille vendeurs..." style={{...inp,height:50,resize:"vertical"}}/></Field>
                </>
              )}
              {lot.statutInconnu&&<Field label="Action requise"><textarea value={lot.actionInconnu||""} onChange={e=>f("actionInconnu",e.target.value)} placeholder="ex: Contacter Foncia avant signing" style={{...inp,height:50,resize:"vertical"}}/></Field>}
            </div>
          )}

          {lot.statut&&(
            <div style={{marginTop:12,padding:"12px",background:rc.bg,borderRadius:8}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <div><div style={{fontSize:9,color:C.muted,letterSpacing:1,marginBottom:2}}>RISQUE</div><div style={{fontSize:13,fontWeight:700,color:rc.text}}>{rc.label}</div></div>
                <div><div style={{fontSize:9,color:C.muted,letterSpacing:1,marginBottom:2}}>DÉLAI</div><div style={{fontSize:11,fontWeight:600,color:C.text}}>{computeDelai(lot)}</div></div>
                <div><div style={{fontSize:9,color:C.muted,letterSpacing:1,marginBottom:2}}>PROVISION</div><div style={{fontSize:11,fontWeight:600,color:C.text}}>{computeProvisionLabel(lot)}</div></div>
              </div>
              {lot.statut==="occupe"&&lot.loyer&&(
                <div style={{marginTop:8,fontSize:12,color:C.muted,borderTop:`1px solid ${rc.dot}33`,paddingTop:8}}>
                  Valeur investisseur · <span style={{color:C.text}}>7,5% : <strong>{fmt((parseFloat(lot.loyer)*12)/0.075)}</strong></span> · <span style={{color:C.danger}}>8% : <strong>{fmt((parseFloat(lot.loyer)*12)/0.08)}</strong></span>
                </div>
              )}
            </div>
          )}

          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
            <Grid cols={2} mob={2} isMobile={isMobile}>
              <Field label="Prix revente estimé (€)"><input value={lot.prixRevente||""} onChange={e=>f("prixRevente",e.target.value)} placeholder="90 000" style={inp} type="number"/></Field>
              <Field label="€/m² implicite">
                <div style={{...inp,background:"#f0f0ee",color:C.muted,cursor:"default"}}>
                  {lot.prixRevente&&lot.surface?`${Math.round(parseFloat(lot.prixRevente)/parseFloat(lot.surface)).toLocaleString("fr-FR")} €/m²`:"—"}
                </div>
              </Field>
            </Grid>
          </div>
        </div>
      )}
    </div>
  );
}

function ModuleLots({ lots, onChange, etatGlobal, onEtatGlobal, surfaceGlobale, typeBien, isMobile }) {
  const addLot = () => onChange([...lots,{nom:"",numero:"",surface:"",statut:"",surfaceExt:"",typeExt:"",etatLot:"",statutInconnu:false,bailType:"",echeance:"",moisRestants:"",loyer:"",loyerMarche:"",age:"",protege:false,profil:"",actionInconnu:"",prixRevente:""}]);
  const deleteLot = i => onChange(lots.filter((_,idx)=>idx!==i));
  const updateLot = (i,k,v) => onChange(lots.map((l,idx)=>idx===i?{...l,[k]:v}:l));
  const labelBien = typeBien||"bien";
  const riskCounts = lots.reduce((acc,l)=>{const r=computeRisk(l);acc[r]=(acc[r]||0)+1;return acc;},{});
  const totalProv  = lots.reduce((acc,l)=>acc+provisionNum(l),0);
  const totalCA    = lots.reduce((acc,l)=>acc+(parseFloat(l.prixRevente)||0),0);
  const hasBlocker = (riskCounts.bloque||0)>0||(riskCounts.inconnu||0)>0;
  return (
    <div>
      <SectionTitle num="03" title="Lots & Occupation" subtitle="Analyse locative lot par lot"/>
      <div style={cardStyle()}>
        <h3 style={sH3}>État général — {labelBien.toLowerCase()}</h3>
        <EtatSelector value={etatGlobal} onChange={onEtatGlobal} surface={surfaceGlobale} label={`État global (${labelBien.toLowerCase()})`}/>
        <div style={{marginTop:10,fontSize:12,color:C.muted,lineHeight:1.8}}>
          {ETATS_BIEN.map(e=><div key={e.key} style={{color:etatGlobal===e.key?C.dark:C.muted,fontWeight:etatGlobal===e.key?700:400}}>{etatGlobal===e.key?"→ ":"· "}{e.label} : {e.key==="tout_faire"?"1 000–1 200":e.cout}€/m²</div>)}
        </div>
      </div>
      {lots.length>0&&lots.some(l=>l.statut)&&(
        <div style={{...cardStyle({padding:"12px 16px"}),background:hasBlocker?"#fff8f0":"#f0faf4",border:`1px solid ${hasBlocker?"#ffb74d":"#a5d6a7"}`,marginBottom:14}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {Object.entries(riskCounts).map(([r,n])=>(
                <span key={r} style={{fontSize:12,color:RISK_COLORS[r]?.text,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:RISK_COLORS[r]?.dot,display:"inline-block"}}/>{n} lot{n>1?"s":""} {RISK_COLORS[r]?.label?.toLowerCase()}
                </span>
              ))}
            </div>
            <div style={{fontSize:12,fontWeight:700}}>
              {totalCA>0&&<span style={{color:C.success}}>CA : {fmt(totalCA)} · </span>}
              <span style={{color:C.muted}}>Prov. : ~{fmt(totalProv)}</span>
              {hasBlocker&&<span style={{color:C.danger}}> · ⚠️ Bloquants</span>}
            </div>
          </div>
        </div>
      )}
      {lots.map((lot,i)=><LotCard key={i} lot={lot} index={i} onUpdate={updateLot} onDelete={deleteLot} isMobile={isMobile}/>)}
      <button onClick={addLot} style={{width:"100%",padding:"14px",background:"transparent",border:`2px dashed ${C.border}`,borderRadius:10,cursor:"pointer",fontSize:14,color:C.muted,fontFamily:"inherit",letterSpacing:1}}>
        + AJOUTER UN LOT
      </button>
    </div>
  );
}

// ─── MODULE 04 ───────────────────────────────────────────────────────────────
function ModuleSynthese({ ident, lots, synth, onSynth, isMobile }) {
  const [copied, setCopied] = useState(false);
  const f = (k,v) => onSynth({...synth,[k]:v});
  const surface   = parseFloat(ident.surface||0);
  const caBase    = lots.reduce((acc,l)=>acc+(parseFloat(l.prixRevente)||0),0);
  const caOpt     = caBase*1.05;
  const caPess    = caBase*0.95;
  const acq       = parseFloat(synth.acq||0);
  const fdn       = acq*0.03;
  const travaux   = parseFloat(synth.travaux||0);
  const trPm2     = surface>0&&travaux>0?travaux/surface:null;
  const totalProv = lots.reduce((acc,l)=>acc+provisionNum(l),0);
  const cpt       = acq+fdn+travaux+totalProv;
  const ff        = cpt*0.08;
  const margeCible= parseFloat(synth.margeCible||20)/100;
  function margeCalc(ca) {
    if (!acq||!ca) return null;
    const ben = ca-cpt-ff;
    return { montant:ben, pct:cpt>0?(ben/cpt)*100:0 };
  }
  function prixVise(ca) {
    if (!ca) return null;
    const cptVise = ca/(1.08+margeCible);
    return (cptVise-travaux-totalProv)/1.03;
  }
  const scenarios = [
    { label:"Pessimiste −5%", ca:caPess, color:C.danger  },
    { label:"Neutre",         ca:caBase, color:C.text     },
    { label:"Optimiste +5%",  ca:caOpt,  color:C.success  },
  ];
  const handleCopy = () => {
    const m = margeCalc(caBase);
    const lines = [
      `📋 SYNTHÈSE BATIA — ${ident.nom||ident.adresse||"Dossier"}`,
      `🗓 ${new Date().toLocaleDateString("fr-FR")} · ${ident.adresse||""}`,
      "─────────────────────────────",
      `CA brut lots : ${fmt(caBase)}`,
      `Acquisition : ${fmt(acq)} · FdN 3% : ${fmt(fdn)}`,
      `Travaux : ${fmt(travaux)}${trPm2?` (${Math.round(trPm2)}€/m²)`:""}`,
      `Provision éviction : ~${fmt(totalProv)}`,
      `Frais financiers ~8% CPT : ${fmt(ff)}`,
      `CPT total : ${fmt(cpt)}`,
      "─────────────────────────────",
      ...scenarios.map(s=>{
        const mv=margeCalc(s.ca);
        const pv=prixVise(s.ca);
        return `${s.label} · CA ${fmt(s.ca)} · Marge ${mv?mv.pct.toFixed(1)+"%":"NC"} · Acq. visé (${synth.margeCible||20}%) : ${pv&&pv>0?fmt(pv):"NC"}`;
      }),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);});
  };
  return (
    <div>
      <SectionTitle num="04" title="Synthèse financière" subtitle="Coût de revient, marge et prix d'acquisition cible"/>
      <div style={cardStyle()}>
        <h3 style={sH3}>Paramètres</h3>
        <Grid cols={3} mob={1} isMobile={isMobile}>
          <Field label="Coût d'acquisition (€)"><input value={synth.acq||""} onChange={e=>f("acq",e.target.value)} placeholder="400 000" style={inp} type="number"/></Field>
          <Field label="Travaux estimés (€)"><input value={synth.travaux||""} onChange={e=>f("travaux",e.target.value)} placeholder="40 000" style={inp} type="number"/></Field>
          <Field label="Marge cible">
            <select value={synth.margeCible||"20"} onChange={e=>f("margeCible",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="20">20%</option><option value="25">25%</option><option value="30">30%</option>
            </select>
          </Field>
        </Grid>
        {trPm2&&<div style={{fontSize:12,color:C.muted,marginTop:4}}>Travaux : <strong style={{color:C.text}}>{Math.round(trPm2)}€/m²</strong> — {trPm2<300?"Rafraîchissement":trPm2<600?"Rénovation partielle":trPm2<900?"Rénovation lourde":"Tout à faire"}</div>}
        {caBase===0&&<div style={{marginTop:8,fontSize:12,color:C.muted}}>ℹ️ Renseigne les prix de revente dans l'onglet 03.</div>}
      </div>
      {acq>0&&(
        <div style={cardStyle()}>
          <h3 style={sH3}>Décomposition CPT</h3>
          {[
            {label:"Acquisition",val:acq,pct:cpt>0?acq/cpt*100:0},
            {label:"Frais notaire 3%",val:fdn,pct:cpt>0?fdn/cpt*100:0},
            {label:"Travaux",val:travaux,pct:cpt>0?travaux/cpt*100:0},
            {label:"Provision éviction",val:totalProv,pct:cpt>0?totalProv/cpt*100:0},
            {label:"Frais financiers ~8% (12M)",val:ff,pct:cpt>0?ff/cpt*100:0},
          ].map(row=>(
            <div key={row.label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontSize:14}}>
              <span style={{color:C.muted}}>{row.label}</span>
              <span style={{fontWeight:600}}>{fmt(row.val)} <span style={{fontSize:11,color:C.muted}}>({row.pct.toFixed(1)}%)</span></span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",fontSize:15,fontWeight:800,color:C.dark}}>
            <span>CPT TOTAL</span><span>{fmt(cpt)}</span>
          </div>
        </div>
      )}
      {caBase>0&&(
        <div style={cardStyle({background:C.dark})}>
          <h3 style={{...sH3,color:"#fff",borderColor:"rgba(255,255,255,0.15)"}}>Matrice scénarios</h3>
          {scenarios.map(s=>{
            const m  = margeCalc(s.ca);
            const pv = prixVise(s.ca);
            const isGo   = m&&m.pct>=20;
            const isWarn = m&&m.pct>=12&&m.pct<20;
            return (
              <div key={s.label} style={{marginBottom:12,padding:"12px",background:"rgba(255,255,255,0.06)",borderRadius:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{color:s.color,fontWeight:700,fontSize:14}}>{s.label}</span>
                  <span style={{color:"#fff",fontWeight:600}}>{fmt(s.ca)}</span>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                  {m&&<span style={{background:isGo?"#1b5e20":isWarn?"#e65100":"#b71c1c",color:"#fff",padding:"2px 10px",borderRadius:12,fontSize:12,fontWeight:700}}>{m.pct.toFixed(1)}% · {fmt(m.montant)}</span>}
                  {pv&&pv>0&&<span style={{color:C.gold,fontSize:12}}>Acq. visé : <strong>{fmt(pv)}</strong></span>}
                </div>
              </div>
            );
          })}
          {acq>0&&caBase>0&&(()=>{
            const m = margeCalc(caBase);
            const g = m&&m.pct>=20?"GO":m&&m.pct>=12?"ATTENTION":"NO GO";
            return (
              <div style={{marginTop:8,textAlign:"center"}}>
                <span style={{display:"inline-block",padding:"10px 28px",borderRadius:8,fontWeight:800,fontSize:18,letterSpacing:2,background:g==="GO"?"#1b5e20":g==="NO GO"?"#b71c1c":"#e65100",color:"#fff"}}>
                  {g==="GO"?"✅":g==="NO GO"?"❌":"⚠️"} {g}
                </span>
              </div>
            );
          })()}
        </div>
      )}
      <button onClick={handleCopy} style={{width:"100%",padding:"14px",background:copied?"#e8f5e9":C.dark,border:"none",borderRadius:10,cursor:"pointer",fontSize:14,fontWeight:700,color:copied?C.success:C.gold,fontFamily:"inherit",letterSpacing:1,marginTop:4,transition:"all 0.3s"}}>
        {copied?"✅ COPIÉ — COLLE DANS NOTION":"📋 COPIER LA SYNTHÈSE NOTION"}
      </button>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"ident",     label:"01", icon:"🏠", full:"Identification" },
  { id:"checklist", label:"02", icon:"✅", full:"Checklist" },
  { id:"lots",      label:"03", icon:"🔑", full:"Lots" },
  { id:"synthese",  label:"04", icon:"📊", full:"Synthèse" },
];

export default function App() {
  const isMobile = useIsMobile();
  const [tab,   setTab]   = useState("ident");
  const [ident, setIdent] = useState({});
  const [check, setCheck] = useState({});
  const [lots,  setLots]  = useState([]);
  const [etat,  setEtat]  = useState("");
  const [synth, setSynth] = useState({ margeCible:"20" });

  const handleSave = () => {
    const data = { ident, check, lots, etat, synth };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `BATIA_${(ident.nom||"dossier").replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleLoad = () => {
    const input = document.createElement("input");
    input.type  = "file";
    input.accept= ".json";
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.ident) setIdent(data.ident);
          if (data.check) setCheck(data.check);
          if (data.lots)  setLots(data.lots);
          if (data.etat)  setEtat(data.etat);
          if (data.synth) setSynth(data.synth);
          setTab("ident");
        } catch { alert("Fichier invalide"); }
      };
      reader.readAsText(file);
    };
    input.click();
  };
  const handleNew = () => {
    if (window.confirm("Nouveau dossier ? Les données non sauvegardées seront perdues.")) {
      setIdent({}); setCheck({}); setLots([]); setEtat(""); setSynth({margeCible:"20"}); setTab("ident");
    }
  };

  const caBase = lots.reduce((acc,l)=>acc+(parseFloat(l.prixRevente)||0),0);

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans', sans-serif",color:C.text,paddingBottom:isMobile?80:0}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;}
        input:focus,select:focus,textarea:focus{border-color:${C.dark}!important;background:#fff!important;box-shadow:0 0 0 2px rgba(28,28,46,0.08);}
        input[type=checkbox],input[type=radio]{accent-color:${C.dark};}
        ::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-track{background:${C.bg};}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
      `}</style>

      {/* HEADER */}
      <div style={{background:C.dark,padding:`0 ${isMobile?14:32}px`}}>
        <div style={{maxWidth:980,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:54}}>
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
            <span style={{background:C.gold,color:C.dark,fontWeight:800,fontSize:11,padding:"3px 10px",borderRadius:4,letterSpacing:2,flexShrink:0}}>BATIA</span>
            <span style={{color:"#fff",fontFamily:"'Playfair Display', serif",fontSize:isMobile?13:15,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {ident.nom||"Nouveau dossier"}
            </span>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
            {check.decision&&!isMobile&&<span style={{fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:12,background:check.decision==="GO"?"#1b5e20":check.decision==="NO GO"?"#b71c1c":"#e65100",color:"#fff"}}>{check.decision}</span>}
            <button onClick={handleLoad} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#ccc",cursor:"pointer",borderRadius:6,padding:"6px 10px",fontSize:12,fontFamily:"inherit"}}>
              {isMobile?"📂":"📂 Charger"}
            </button>
            <button onClick={handleSave} style={{background:C.gold,border:"none",color:C.dark,cursor:"pointer",borderRadius:6,padding:"6px 10px",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>
              {isMobile?"💾":"💾 Sauvegarder"}
            </button>
            {!isMobile&&<button onClick={handleNew} style={{background:"rgba(255,255,255,0.08)",border:`1px solid rgba(255,255,255,0.15)`,color:"#aaa",cursor:"pointer",borderRadius:6,padding:"6px 10px",fontSize:12,fontFamily:"inherit"}}>+ Nouveau</button>}
          </div>
        </div>
      </div>

      {/* NAV DESKTOP */}
      {!isMobile&&(
        <div style={{background:"#fff",borderBottom:`1px solid ${C.border}`,padding:"0 32px",position:"sticky",top:0,zIndex:100}}>
          <div style={{maxWidth:980,margin:"0 auto",display:"flex"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"14px 20px",background:"transparent",border:"none",cursor:"pointer",fontSize:13,fontWeight:tab===t.id?700:500,fontFamily:"inherit",color:tab===t.id?C.dark:C.muted,borderBottom:tab===t.id?`2px solid ${C.dark}`:"2px solid transparent",transition:"all 0.15s",whiteSpace:"nowrap"}}>{t.label} · {t.full}</button>
            ))}
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div style={{maxWidth:980,margin:"0 auto",padding:isMobile?"16px 14px 20px":"28px 32px 80px"}}>
        {tab==="ident"     && <ModuleIdentification data={ident} onChange={setIdent} isMobile={isMobile}/>}
        {tab==="checklist" && <ModuleChecklist data={check} onChange={setCheck} isMobile={isMobile}/>}
        {tab==="lots"      && <ModuleLots lots={lots} onChange={setLots} etatGlobal={etat} onEtatGlobal={setEtat} surfaceGlobale={ident.surface} typeBien={ident.type} isMobile={isMobile}/>}
        {tab==="synthese"  && <ModuleSynthese ident={ident} lots={lots} synth={synth} onSynth={setSynth} isMobile={isMobile}/>}
      </div>

      {/* NAV MOBILE BAS */}
      {isMobile&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100,boxShadow:"0 -2px 12px rgba(0,0,0,0.08)"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 4px 12px",background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontFamily:"inherit"}}>
              <span style={{fontSize:20}}>{t.icon}</span>
              <span style={{fontSize:10,fontWeight:tab===t.id?700:400,color:tab===t.id?C.dark:C.muted,letterSpacing:0.5}}>{t.full}</span>
              {tab===t.id&&<span style={{width:20,height:2,background:C.dark,borderRadius:1}}/>}
            </button>
          ))}
          <button onClick={handleNew} style={{flex:1,padding:"10px 4px 12px",background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontFamily:"inherit"}}>
            <span style={{fontSize:20}}>➕</span>
            <span style={{fontSize:10,color:C.muted}}>Nouveau</span>
          </button>
        </div>
      )}

      {/* BARRE SYNTHESE MOBILE */}
      {isMobile&&caBase>0&&(
        <div style={{position:"fixed",top:54,left:0,right:0,background:"#1b5e20",padding:"6px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:99}}>
          <span style={{color:"#fff",fontSize:12,fontWeight:600}}>CA brut : {fmt(caBase)}</span>
          {check.decision&&<span style={{fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:12,background:check.decision==="GO"?"rgba(255,255,255,0.2)":check.decision==="NO GO"?"#b71c1c":"#e65100",color:"#fff"}}>{check.decision}</span>}
        </div>
      )}
    </div>
  );
}
