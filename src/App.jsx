import { useState } from "react";

const RISK_COLORS = {
  libre:   { bg: "#e8f5e9", text: "#2e7d32", label: "LIBRE",   dot: "#43a047" },
  faible:  { bg: "#e3f2fd", text: "#1565c0", label: "FAIBLE",  dot: "#1e88e5" },
  modere:  { bg: "#fff8e1", text: "#e65100", label: "MODÉRÉ",  dot: "#fb8c00" },
  bloque:  { bg: "#fce4ec", text: "#b71c1c", label: "BLOQUÉ",  dot: "#e53935" },
  inconnu: { bg: "#f3e5f5", text: "#6a1b9a", label: "INCONNU", dot: "#8e24aa" },
};

const BAIL_LABELS = {
  loi89: "Loi 89", loi48: "Loi 48",
  derogatoire: "Bail dérogatoire / précaire",
  commercial_369: "Bail commercial 3/6/9", autre: "Autre / Inconnu",
};

const RISQUES_ADRESSE = [
  { key: "inondation", label: "Zone inondable (PPRI)" },
  { key: "argile",     label: "Retrait-gonflement argile fort" },
  { key: "sismique",   label: "Zone sismique" },
  { key: "radon",      label: "Exposition radon" },
  { key: "mvsol",      label: "Mouvement de terrain" },
  { key: "industrie",  label: "Site industriel / ICPE proche" },
];

const CHECKLIST_ITEMS = {
  enveloppe: [
    { key: "acces_fonctionnel",   label: "Accès existant fonctionnel" },
    { key: "acces_separables",    label: "Accès séparables possibles" },
    { key: "facade_saine",        label: "Façade saine (lecture globale)" },
    { key: "couverture_ok",       label: "Couverture correcte" },
    { key: "charpente_ok",        label: "Charpente correcte" },
    { key: "ouvertures_possible", label: "Création d'ouvertures possible" },
  ],
  reseaux: [
    { key: "tout_egout",   label: "Tout-à-l'égout présent" },
    { key: "ep_separatif", label: "EP séparatif" },
    { key: "compteur_eau", label: "Compteur d'eau repéré" },
    { key: "tableau_elec", label: "Tableau électrique repéré" },
    { key: "colonnes_ok",  label: "Colonnes / chutes repérées" },
    { key: "wc_visibles",  label: "Gros diamètres WC visibles" },
  ],
  structure: [
    { key: "murs_porteurs",  label: "Murs porteurs identifiables" },
    { key: "plancher_sain",  label: "Plancher sain" },
    { key: "escalier_ok",    label: "Escalier existant / présent" },
    { key: "hauteur_ok",     label: "Hauteur exploitable" },
    { key: "lumiere_ok",     label: "Lumière naturelle suffisante" },
    { key: "circulation_ok", label: "Circulations cohérentes" },
  ],
};

const ETATS_BIEN = [
  { key: "rafraichissement", label: "Petit rafraîchissement (murs & sols)",        cout: 250,  coutMax: 250  },
  { key: "renovation_moy",   label: "Rénovation moyenne (+ plomberie & élec)",    cout: 500,  coutMax: 500  },
  { key: "grosse_renov",     label: "Grosse rénovation (total)",                  cout: 750,  coutMax: 750  },
  { key: "tout_faire",       label: "Gros œuvre + Second œuvre (tout à faire)",   cout: 1000, coutMax: 1200 },
];

const STATUTS_DOSSIER = ["En cours","Visite prévue","Offre faite","Abandonné","Acquis","Vendu"];
const TYPES_BIEN      = ["Immeuble","Appartement","Maison","Plateau brut","Local commercial","Terrain"];
const SOURCES         = ["Agent immobilier","LeBonCoin","PAP","SeLoger","Notaire","Direct vendeur","Bouche à oreille","Autre"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function computeRisk(lot) {
  if (lot.statut === "libre") return "libre";
  if (lot.statutInconnu) return "inconnu";
  if (lot.bailType === "commercial_369") return "bloque";
  if (lot.protege) return "bloque";
  if (lot.bailType === "loi48") return "bloque";
  if (lot.bailType === "derogatoire") return "faible";
  if (lot.bailType === "loi89") {
    const m = parseInt(lot.moisRestants) || 0;
    if (m <= 6) return "faible";
    if (m <= 18) return "modere";
    return "bloque";
  }
  return "inconnu";
}

function computeDelai(lot) {
  if (lot.statut === "libre") return "Immédiat";
  if (lot.statutInconnu) return "Inconnu — clarifier avant signing";
  if (lot.protege) return "Indéterminé";
  if (lot.bailType === "commercial_369") return "Selon échéance triennale";
  if (lot.bailType === "loi48") return "Très long / inamovible";
  if (lot.bailType === "derogatoire") return "3 mois (LRAR)";
  if (lot.bailType === "loi89") {
    const m = parseInt(lot.moisRestants) || 0;
    if (m <= 6) return "3–6 mois (amiable possible)";
    if (m <= 18) return `${m} mois jusqu'à échéance`;
    return `${m} mois — vente occupé conseillé`;
  }
  return "À évaluer";
}

function computeProvisionLabel(lot) {
  if (lot.statut === "libre") return "0€";
  if (lot.statutInconnu) return "À clarifier";
  if (lot.protege) return "6 000€ – 12 000€+";
  if (lot.bailType === "commercial_369") return "30 000€ – 80 000€";
  if (lot.bailType === "loi48") return "5 000€ – 15 000€";
  if (lot.bailType === "derogatoire") return "0€";
  if (lot.bailType === "loi89") {
    const m = parseInt(lot.moisRestants) || 0;
    if (m <= 6) return "1 500€ – 3 000€";
    if (m <= 18) return "3 000€ – 6 000€";
    return "6 000€+ ou vente occupé";
  }
  return "À évaluer";
}

function provisionNum(lot) {
  const r = computeRisk(lot);
  if (r === "libre") return 0;
  if (r === "faible") return 2500;
  if (r === "modere") return 5000;
  if (r === "bloque" && lot.bailType === "commercial_369") return 50000;
  if (r === "bloque") return 10000;
  return 0;
}

function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Math.round(n).toLocaleString("fr-FR") + "€";
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#F5F3EE", card:"#FFFFFF", dark:"#1C1C2E", gold:"#D4A843",
  border:"#E2DDD5", text:"#2C2C2C", muted:"#888880", danger:"#C0392B", success:"#27AE60",
};
const inp = {
  width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`,
  borderRadius:6, fontSize:13, background:"#FAFAF8", outline:"none",
  boxSizing:"border-box", color:C.text, fontFamily:"inherit",
};
const lbl = {
  display:"block", fontSize:10, color:C.muted, letterSpacing:1.2,
  marginBottom:5, textTransform:"uppercase", fontWeight:600,
};
const sH3 = {
  margin:"0 0 14px", fontSize:14, fontWeight:700, color:C.dark,
  paddingBottom:8, borderBottom:`1px solid ${C.border}`,
  fontFamily:"'Playfair Display', serif", letterSpacing:0.5,
};
const cardStyle = (extra={}) => ({
  background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
  padding:"20px 24px", marginBottom:16, ...extra,
});

function Field({ label, children }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}
function Grid({ cols=3, gap=14, children }) {
  return <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap }}>{children}</div>;
}
function SectionTitle({ num, title, subtitle }) {
  return (
    <div style={{ marginBottom:20, marginTop:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ background:C.dark, color:C.gold, fontWeight:800, fontSize:11, padding:"3px 10px", borderRadius:4, letterSpacing:2 }}>{num}</span>
        <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:C.dark, fontFamily:"'Playfair Display', serif" }}>{title}</h2>
      </div>
      {subtitle && <p style={{ margin:"4px 0 0 44px", fontSize:12, color:C.muted }}>{subtitle}</p>}
    </div>
  );
}
function RiskBadge({ risk }) {
  const rc = RISK_COLORS[risk] || RISK_COLORS.inconnu;
  return (
    <span style={{ background:rc.bg, color:rc.text, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, letterSpacing:1, display:"inline-flex", alignItems:"center", gap:5 }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:rc.dot, display:"inline-block" }} />{rc.label}
    </span>
  );
}

// ─── MODULE 01 ────────────────────────────────────────────────────────────────
function ModuleIdentification({ data, onChange }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
    <div>
      <SectionTitle num="01" title="Identification du bien" subtitle="Informations générales et contexte vendeur" />
      <div style={cardStyle()}>
        <h3 style={sH3}>Bien</h3>
        <Grid cols={3}>
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
        <div style={{marginTop:14}}><Grid cols={2}>
          <Field label="Adresse complète"><input value={data.adresse||""} onChange={e=>f("adresse",e.target.value)} placeholder="40 Grande Rue, 01600 Trévoux" style={inp}/></Field>
          <Field label="Lien annonce"><input value={data.lienAnnonce||""} onChange={e=>f("lienAnnonce",e.target.value)} placeholder="URL leboncoin / seloger..." style={inp}/></Field>
        </Grid></div>
        <div style={{marginTop:14}}><Grid cols={4}>
          <Field label="Surface totale (m²)"><input value={data.surface||""} onChange={e=>f("surface",e.target.value)} placeholder="456" style={inp} type="number"/></Field>
          <Field label="Surface terrain (m²)"><input value={data.surfaceTerrain||""} onChange={e=>f("surfaceTerrain",e.target.value)} placeholder="—" style={inp} type="number"/></Field>
          <Field label="Prix affiché (€)"><input value={data.prixAffiche||""} onChange={e=>f("prixAffiche",e.target.value)} placeholder="550 000" style={inp} type="number"/></Field>
          <Field label="Source">
            <select value={data.source||""} onChange={e=>f("source",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="">— Choisir —</option>{SOURCES.map(s=><option key={s}>{s}</option>)}
            </select>
          </Field>
        </Grid></div>
        <div style={{marginTop:14}}><Grid cols={2}>
          <Field label="Agence / contact"><input value={data.agence||""} onChange={e=>f("agence",e.target.value)} placeholder="ex: Mycasa — Enzo Molina" style={inp}/></Field>
          <Field label="Éléments dossier — photos, plans, baux (lien Drive)"><input value={data.dossier||""} onChange={e=>f("dossier",e.target.value)} placeholder="https://drive.google.com/..." style={inp}/></Field>
        </Grid></div>
      </div>

      <div style={cardStyle()}>
        <h3 style={sH3}>Contexte vendeur</h3>
        <Grid cols={2}>
          <Field label="Qui vend ?"><input value={data.vendeur||""} onChange={e=>f("vendeur",e.target.value)} placeholder="ex: 1 personne âgée via ses enfants" style={inp}/></Field>
          <Field label="Pourquoi vendre ?"><input value={data.motifVente||""} onChange={e=>f("motifVente",e.target.value)} placeholder="ex: succession, DPE G..." style={inp}/></Field>
        </Grid>
        <div style={{marginTop:14}}><Grid cols={3}>
          <Field label="En vente depuis"><input value={data.depuisCombien||""} onChange={e=>f("depuisCombien",e.target.value)} placeholder="ex: 2 mois" style={inp}/></Field>
          <Field label="Offre(s) reçue(s)">
            <select value={data.offresRecues||""} onChange={e=>f("offresRecues",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="">— Non renseigné —</option><option value="non">Non</option><option value="oui">Oui</option>
            </select>
          </Field>
          <Field label="Si oui, à combien ?"><input value={data.montantOffre||""} onChange={e=>f("montantOffre",e.target.value)} placeholder="ex: 480 000€" style={inp}/></Field>
        </Grid></div>
        <div style={{marginTop:14}}>
          <Field label="Remarques / notes libres">
            <textarea value={data.remarques||""} onChange={e=>f("remarques",e.target.value)} placeholder="Observations..." style={{...inp,height:70,resize:"vertical"}}/>
          </Field>
        </div>
      </div>

      <div style={cardStyle()}>
        <h3 style={sH3}>Réglementaire & Risques adresse</h3>
        <Grid cols={3}>
          <Field label="Zone PLU"><input value={data.pluZone||""} onChange={e=>f("pluZone",e.target.value)} placeholder="ex: Zone U" style={inp}/></Field>
          <Field label="Référence parcelle"><input value={data.pluParcelle||""} onChange={e=>f("pluParcelle",e.target.value)} placeholder="ex: 000/AD/0593" style={inp}/></Field>
          <Field label="Destination compatible ?">
            <select value={data.pluDestination||""} onChange={e=>f("pluDestination",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="">— Non vérifié —</option><option value="oui">✅ Oui</option><option value="non">❌ Non</option><option value="confirmer">⚠️ À confirmer</option>
            </select>
          </Field>
        </Grid>
        <div style={{marginTop:14}}><Grid cols={2}>
          <Field label="Stationnement">
            <select value={data.pluStationnement||""} onChange={e=>f("pluStationnement",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="">— Non vérifié —</option><option value="non_bloquant">✅ Non bloquant</option><option value="bloquant">❌ Bloquant</option><option value="confirmer">⚠️ À confirmer</option>
            </select>
          </Field>
          <Field label="Points réglementaires à vérifier"><input value={data.pluPoints||""} onChange={e=>f("pluPoints",e.target.value)} placeholder="ex: COS, hauteur, reculs..." style={inp}/></Field>
        </Grid></div>

        <div style={{marginTop:18,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,color:C.muted,letterSpacing:1.2,fontWeight:600,marginBottom:10,textTransform:"uppercase"}}>
            Risques adresse —{" "}
            <a href="https://georisques.gouv.fr" target="_blank" rel="noreferrer" style={{color:C.gold,textDecoration:"none"}}>vérifier sur géorisques.gouv.fr</a>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {RISQUES_ADRESSE.map(r=>(
              <label key={r.key} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,padding:"8px 12px",borderRadius:8,background:data.risques?.[r.key]?"#fce4ec":"#F5F3EE",border:`1px solid ${data.risques?.[r.key]?"#e53935":C.border}`}}>
                <input type="checkbox" checked={data.risques?.[r.key]||false} onChange={e=>f("risques",{...data.risques,[r.key]:e.target.checked})} style={{accentColor:C.danger}}/>
                <span style={{color:data.risques?.[r.key]?C.danger:C.text,fontWeight:data.risques?.[r.key]?600:400}}>{data.risques?.[r.key]?"⚠️ ":""}{r.label}</span>
              </label>
            ))}
          </div>
          {Object.values(data.risques||{}).some(Boolean)&&(
            <div style={{marginTop:10,padding:"8px 14px",background:"#fce4ec",borderRadius:8,fontSize:12,color:C.danger,fontWeight:600}}>
              ⚠️ {Object.values(data.risques||{}).filter(Boolean).length} risque(s) identifié(s) — à intégrer dans la due diligence et la valorisation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MODULE 02 ────────────────────────────────────────────────────────────────
function ModuleChecklist({ data, onChange }) {
  const f = (k,v) => onChange({...data,[k]:v});
  const setCheck = (section,key,val) => f(section,{...data[section],[key]:val});
  const setNote  = (k,v) => f("notes",{...data.notes,[k]:v});

  const CheckRow = ({item,section}) => (
    <div style={{marginBottom:10}}>
      <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
        <input type="checkbox" checked={data[section]?.[item.key]===true} onChange={e=>setCheck(section,item.key,e.target.checked)} style={{accentColor:C.dark,width:15,height:15}}/>
        <span style={{textDecoration:data[section]?.[item.key]?"line-through":"none",color:data[section]?.[item.key]?C.muted:C.text}}>{item.label}</span>
      </label>
    </div>
  );

  return (
    <div>
      <SectionTitle num="02" title="Checklist visite" subtitle="À compléter en amont, pendant et après la visite"/>
      <div style={cardStyle()}>
        <h3 style={sH3}>① Extérieur / Accès / Enveloppe</h3>
        <Grid cols={2}>
          <div>{CHECKLIST_ITEMS.enveloppe.map(item=><CheckRow key={item.key} item={item} section="enveloppe"/>)}</div>
          <div>
            <Field label="Entrées / ouvertures"><input value={data.nbEntrees||""} onChange={e=>f("nbEntrees",e.target.value)} placeholder="ex: 1 + 2 ouvertures locaux" style={inp}/></Field>
            <div style={{marginTop:10}}><Field label="Menuiseries (état / nb)"><input value={data.menuiseries||""} onChange={e=>f("menuiseries",e.target.value)} placeholder="ex: 24 — état moyen" style={inp}/></Field></div>
            <div style={{marginTop:10}}><Field label="Notes extérieur"><textarea value={data.notes?.enveloppe||""} onChange={e=>setNote("enveloppe",e.target.value)} placeholder="Observations..." style={{...inp,height:60,resize:"vertical"}}/></Field></div>
          </div>
        </Grid>
      </div>
      <div style={cardStyle()}>
        <h3 style={sH3}>② Réseaux / VRD</h3>
        <Grid cols={2}>
          <div>{CHECKLIST_ITEMS.reseaux.map(item=><CheckRow key={item.key} item={item} section="reseaux"/>)}</div>
          <div><Field label="Notes réseaux"><textarea value={data.notes?.reseaux||""} onChange={e=>setNote("reseaux",e.target.value)} placeholder="Observations..." style={{...inp,height:80,resize:"vertical"}}/></Field></div>
        </Grid>
      </div>
      <div style={cardStyle()}>
        <h3 style={sH3}>③ Intérieur / Volumes / Structure</h3>
        <Grid cols={2}>
          <div>{CHECKLIST_ITEMS.structure.map(item=><CheckRow key={item.key} item={item} section="structure"/>)}</div>
          <div>
            <Field label="Superficie exploitable (m²)"><input value={data.surfaceExploit||""} onChange={e=>f("surfaceExploit",e.target.value)} placeholder="ex: 456" style={inp} type="number"/></Field>
            <div style={{marginTop:10}}><Field label="Notes structure"><textarea value={data.notes?.structure||""} onChange={e=>setNote("structure",e.target.value)} placeholder="Observations..." style={{...inp,height:60,resize:"vertical"}}/></Field></div>
          </div>
        </Grid>
      </div>
      <div style={cardStyle({background:C.dark})}>
        <h3 style={{...sH3,color:"#fff",borderColor:"rgba(255,255,255,0.15)"}}>④ Point bloquant & Décision à chaud</h3>
        <Grid cols={2}>
          <div>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:12}}>
              <input type="checkbox" checked={data.pointBloquant||false} onChange={e=>f("pointBloquant",e.target.checked)} style={{accentColor:C.gold,width:16,height:16}}/>
              <span style={{color:data.pointBloquant?"#ff6b6b":"#aaa",fontWeight:600,fontSize:14}}>Point bloquant identifié</span>
            </label>
            {data.pointBloquant&&<textarea value={data.pointBloquantDetail||""} onChange={e=>f("pointBloquantDetail",e.target.value)} placeholder="Détail..." style={{...inp,height:70,resize:"vertical",background:"rgba(255,255,255,0.08)",borderColor:"#ff6b6b",color:"#fff"}}/>}
          </div>
          <div>
            <label style={{...lbl,color:"#aaa"}}>Décision à chaud</label>
            {["GO","GO sous réserve","NO GO"].map(d=>(
              <label key={d} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer"}}>
                <input type="radio" name="decision" value={d} checked={data.decision===d} onChange={()=>f("decision",d)} style={{accentColor:C.gold}}/>
                <span style={{color:data.decision===d?(d==="GO"?"#4caf50":d==="NO GO"?"#f44336":C.gold):"#888",fontWeight:data.decision===d?700:400,fontSize:14}}>
                  {d==="GO"?"✅":d==="NO GO"?"❌":"⚠️"} {d}
                </span>
              </label>
            ))}
            <textarea value={data.decisionMotif||""} onChange={e=>f("decisionMotif",e.target.value)} placeholder="Motif..." style={{...inp,height:55,marginTop:8,resize:"vertical",background:"rgba(255,255,255,0.08)",borderColor:"rgba(255,255,255,0.2)",color:"#fff"}}/>
          </div>
        </Grid>
      </div>
    </div>
  );
}

// ─── MODULE 03 ────────────────────────────────────────────────────────────────
function EtatSelector({ value, onChange, surface, label="État général" }) {
  const etat = ETATS_BIEN.find(e=>e.key===value);
  const s = parseFloat(surface)||0;
  return (
    <div>
      <label style={lbl}>{label}</label>
      <select value={value||""} onChange={e=>onChange(e.target.value)} style={{...inp,cursor:"pointer"}}>
        <option value="">— Non évalué —</option>
        {ETATS_BIEN.map(e=><option key={e.key} value={e.key}>{e.label} (~{e.key==="tout_faire"?"1 000–1 200":e.cout}€/m²)</option>)}
      </select>
      {etat&&s>0&&(
        <div style={{fontSize:11,color:C.muted,marginTop:4}}>
          Estimation second œuvre : <strong style={{color:C.text}}>{fmt(etat.cout*s)}{etat.key==="tout_faire"?` – ${fmt(1200*s)}`:""}</strong>
        </div>
      )}
    </div>
  );
}

function LotCard({ lot, index, onUpdate, onDelete }) {
  const risk = computeRisk(lot);
  const rc   = RISK_COLORS[risk];
  const f    = (k,v) => onUpdate(index,k,v);
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:16,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",background:C.dark}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{background:C.gold,color:C.dark,fontWeight:800,fontSize:11,padding:"2px 10px",borderRadius:4,letterSpacing:1}}>LOT {lot.numero||index+1}</span>
          <input value={lot.nom||""} onChange={e=>f("nom",e.target.value)} placeholder="Désignation du lot" style={{background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,0.2)",color:"#fff",fontSize:13,outline:"none",width:200,fontFamily:"inherit"}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <RiskBadge risk={risk}/>
          <button onClick={()=>onDelete(index)} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",cursor:"pointer",borderRadius:4,padding:"3px 8px",fontSize:12}}>✕</button>
        </div>
      </div>
      <div style={{padding:"16px 18px"}}>
        <Grid cols={3}>
          <Field label="Statut occupation">
            <select value={lot.statut||""} onChange={e=>f("statut",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="">— Choisir —</option><option value="libre">🟢 Libre</option><option value="occupe">🔴 Occupé</option>
            </select>
          </Field>
          <Field label="N° lot"><input value={lot.numero||""} onChange={e=>f("numero",e.target.value)} placeholder="4" style={inp}/></Field>
          <Field label="Surface habitable (m²)"><input value={lot.surface||""} onChange={e=>f("surface",e.target.value)} placeholder="62" style={inp} type="number"/></Field>
        </Grid>
        <div style={{marginTop:12}}><Grid cols={3}>
          <Field label="Surface ext. / balcon (m²)"><input value={lot.surfaceExt||""} onChange={e=>f("surfaceExt",e.target.value)} placeholder="8" style={inp} type="number"/></Field>
          <Field label="Type extérieur">
            <select value={lot.typeExt||""} onChange={e=>f("typeExt",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="">— Aucun —</option><option value="balcon">Balcon</option><option value="loggia">Loggia</option><option value="terrasse">Terrasse</option><option value="jardin">Jardin privatif</option><option value="cour">Cour</option>
            </select>
          </Field>
          <EtatSelector value={lot.etatLot} onChange={v=>f("etatLot",v)} surface={lot.surface} label="État général du lot"/>
        </Grid></div>

        {lot.statut==="occupe"&&(
          <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:12,fontSize:13}}>
              <input type="checkbox" checked={lot.statutInconnu||false} onChange={e=>f("statutInconnu",e.target.checked)}/>
              ⚠️ Statut locatif inconnu / bail non reçu — <strong style={{color:C.danger}}>clarifier avant signing</strong>
            </label>
            {!lot.statutInconnu&&(
              <>
                <Grid cols={3}>
                  <Field label="Type de bail">
                    <select value={lot.bailType||""} onChange={e=>f("bailType",e.target.value)} style={{...inp,cursor:"pointer"}}>
                      <option value="">— Choisir —</option>{Object.entries(BAIL_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Échéance bail"><input value={lot.echeance||""} onChange={e=>f("echeance",e.target.value)} placeholder="02/2027" style={inp}/></Field>
                  <Field label="Mois restants"><input value={lot.moisRestants||""} onChange={e=>f("moisRestants",e.target.value)} placeholder="22" style={inp} type="number"/></Field>
                </Grid>
                <div style={{marginTop:12}}><Grid cols={3}>
                  <Field label="Loyer CC/mois (€)"><input value={lot.loyer||""} onChange={e=>f("loyer",e.target.value)} placeholder="575" style={inp} type="number"/></Field>
                  <Field label="Loyer marché (€)"><input value={lot.loyerMarche||""} onChange={e=>f("loyerMarche",e.target.value)} placeholder="700" style={inp} type="number"/></Field>
                  <Field label="Âge locataire"><input value={lot.age||""} onChange={e=>f("age",e.target.value)} placeholder="38" style={inp} type="number"/></Field>
                </Grid></div>
                <div style={{marginTop:10}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,marginBottom:10}}>
                    <input type="checkbox" checked={lot.protege||false} onChange={e=>f("protege",e.target.checked)}/>
                    🔒 Locataire protégé (+65 ans / ressources limitées)
                  </label>
                  <Field label="Profil / contexte locataire">
                    <textarea value={lot.profil||""} onChange={e=>f("profil",e.target.value)} placeholder="ex: famille vendeurs, occupation ancienne..." style={{...inp,height:50,resize:"vertical"}}/>
                  </Field>
                </div>
              </>
            )}
            {lot.statutInconnu&&<Field label="Action requise"><textarea value={lot.actionInconnu||""} onChange={e=>f("actionInconnu",e.target.value)} placeholder="ex: Contacter Foncia / notaire avant signing" style={{...inp,height:50,resize:"vertical"}}/></Field>}
          </div>
        )}

        {lot.statut&&(
          <div style={{marginTop:12,padding:"10px 14px",background:rc.bg,borderRadius:8,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <div><div style={{fontSize:9,color:C.muted,letterSpacing:1,marginBottom:2}}>RISQUE SORTIE</div><div style={{fontSize:13,fontWeight:700,color:rc.text}}>{rc.label}</div></div>
            <div><div style={{fontSize:9,color:C.muted,letterSpacing:1,marginBottom:2}}>DÉLAI ESTIMÉ</div><div style={{fontSize:12,fontWeight:600,color:C.text}}>{computeDelai(lot)}</div></div>
            <div><div style={{fontSize:9,color:C.muted,letterSpacing:1,marginBottom:2}}>PROVISION ÉVICTION</div><div style={{fontSize:12,fontWeight:600,color:C.text}}>{computeProvisionLabel(lot)}</div></div>
          </div>
        )}
        {lot.statut==="occupe"&&lot.loyer&&lot.surface&&(
          <div style={{marginTop:8,fontSize:12,color:C.muted}}>
            💡 Valeur investisseur · <span style={{color:C.text}}>7,5% : <strong>{fmt((parseFloat(lot.loyer)*12)/0.075)}</strong></span>
            {" · "}<span style={{color:C.danger}}>8% : <strong>{fmt((parseFloat(lot.loyer)*12)/0.08)}</strong></span>
          </div>
        )}
        <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}><Grid cols={2}>
          <Field label="Prix de revente estimé (€)"><input value={lot.prixRevente||""} onChange={e=>f("prixRevente",e.target.value)} placeholder="90 000" style={inp} type="number"/></Field>
          <Field label="Prix/m² implicite">
            <div style={{...inp,background:"#f0f0ee",color:C.muted,cursor:"default"}}>
              {lot.prixRevente&&lot.surface?`${Math.round(parseFloat(lot.prixRevente)/parseFloat(lot.surface)).toLocaleString("fr-FR")} €/m²`:"—"}
            </div>
          </Field>
        </Grid></div>
      </div>
    </div>
  );
}

function ModuleLots({ lots, onChange, etatGlobal, onEtatGlobal, surfaceGlobale, typeBien }) {
  const labelBien = typeBien || "bien";
  const addLot = () => onChange([...lots,{nom:"",numero:"",surface:"",statut:"",surfaceExt:"",typeExt:"",etatLot:"",statutInconnu:false,bailType:"",echeance:"",moisRestants:"",loyer:"",loyerMarche:"",age:"",protege:false,profil:"",actionInconnu:"",prixRevente:""}]);
  const deleteLot = i => onChange(lots.filter((_,idx)=>idx!==i));
  const updateLot = (i,k,v) => onChange(lots.map((l,idx)=>idx===i?{...l,[k]:v}:l));
  const riskCounts = lots.reduce((acc,l)=>{const r=computeRisk(l);acc[r]=(acc[r]||0)+1;return acc;},{});
  const totalProv  = lots.reduce((acc,l)=>acc+provisionNum(l),0);
  const totalCA    = lots.reduce((acc,l)=>acc+(parseFloat(l.prixRevente)||0),0);
  const hasBlocker = (riskCounts.bloque||0)>0||(riskCounts.inconnu||0)>0;
  return (
    <div>
      <SectionTitle num="03" title="Lots & Occupation" subtitle="Analyse locative lot par lot — scoring de risque automatique"/>
      <div style={cardStyle()}>
        <h3 style={sH3}>État général — {labelBien.toLowerCase()}</h3>
        <Grid cols={2}>
          <EtatSelector value={etatGlobal} onChange={onEtatGlobal} surface={surfaceGlobale} label={`État général (${labelBien.toLowerCase()})`}/>
          <div style={{padding:"10px 14px",background:"#F5F3EE",borderRadius:8,fontSize:12,lineHeight:1.9}}>
            <strong style={{color:C.text,display:"block",marginBottom:4}}>Grille de référence second œuvre :</strong>
            {ETATS_BIEN.map(e=>(
              <div key={e.key} style={{color:etatGlobal===e.key?C.dark:C.muted,fontWeight:etatGlobal===e.key?700:400}}>
                {etatGlobal===e.key?"→ ":"· "}{e.label} : {e.key==="tout_faire"?"1 000–1 200":e.cout}€/m²
              </div>
            ))}
          </div>
        </Grid>
      </div>
      {lots.length>0&&lots.some(l=>l.statut)&&(
        <div style={{...cardStyle({padding:"14px 18px"}),background:hasBlocker?"#fff8f0":"#f0faf4",border:`1px solid ${hasBlocker?"#ffb74d":"#a5d6a7"}`,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
              {Object.entries(riskCounts).map(([r,n])=>(
                <span key={r} style={{fontSize:12,color:RISK_COLORS[r]?.text,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:RISK_COLORS[r]?.dot,display:"inline-block"}}/>
                  {n} lot{n>1?"s":""} {RISK_COLORS[r]?.label?.toLowerCase()}
                </span>
              ))}
            </div>
            <div style={{display:"flex",gap:20,fontSize:12,fontWeight:700}}>
              <span style={{color:C.muted}}>Provision : ~{fmt(totalProv)}</span>
              {totalCA>0&&<span style={{color:C.success}}>CA brut : {fmt(totalCA)}</span>}
              {hasBlocker&&<span style={{color:C.danger}}>⚠️ Points bloquants</span>}
            </div>
          </div>
        </div>
      )}
      {lots.map((lot,i)=><LotCard key={i} lot={lot} index={i} onUpdate={updateLot} onDelete={deleteLot}/>)}
      <button onClick={addLot} style={{width:"100%",padding:"13px",background:"transparent",border:`2px dashed ${C.border}`,borderRadius:10,cursor:"pointer",fontSize:13,color:C.muted,fontFamily:"inherit",letterSpacing:1,transition:"all 0.2s"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.dark;e.currentTarget.style.color=C.dark;}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}
      >+ AJOUTER UN LOT</button>
    </div>
  );
}

// ─── MODULE 04 : SYNTHÈSE ─────────────────────────────────────────────────────
function ModuleSynthese({ ident, lots, synth, onSynth }) {
  const [copied, setCopied] = useState(false);
  const f = (k,v) => onSynth({...synth,[k]:v});

  const surface  = parseFloat(ident.surface||0);
  const caBase   = lots.reduce((acc,l)=>acc+(parseFloat(l.prixRevente)||0),0);
  const caOpt    = caBase*1.05;
  const caPess   = caBase*0.95;
  const acq      = parseFloat(synth.acq||0);
  const fdn      = acq*0.03;
  const travaux  = parseFloat(synth.travaux||0);
  const trPm2    = surface>0&&travaux>0?travaux/surface:null;
  const totalProv= lots.reduce((acc,l)=>acc+provisionNum(l),0);
  const cpt      = acq+fdn+travaux+totalProv;
  const ff       = cpt*0.08;
  const margeCible = parseFloat(synth.margeCible||20)/100;

  function margeCalc(ca) {
    if(!acq||!ca) return null;
    const ben = ca-cpt-ff;
    return { montant:ben, pct:cpt>0?(ben/cpt)*100:0 };
  }
  function prixVise(ca) {
    if(!ca||!travaux&&travaux!==0) return null;
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
      `Coût acquisition : ${fmt(acq)}`,
      `Frais notaire 3% : ${fmt(fdn)}`,
      `Travaux : ${fmt(travaux)}${trPm2?` (${Math.round(trPm2)}€/m²)`:""}`,
      `Provision éviction : ~${fmt(totalProv)}`,
      `Frais financiers ~8% CPT 12M : ${fmt(ff)}`,
      `CPT total : ${fmt(cpt)}`,
      "─────────────────────────────",
      ...scenarios.map(s=>{
        const mv = margeCalc(s.ca);
        const pv = prixVise(s.ca);
        return `${s.label} · CA ${fmt(s.ca)} · Marge ${mv?mv.pct.toFixed(1)+"%":"NC"} · Prix acq. visé (cible ${synth.margeCible||20}%) : ${pv?fmt(pv):"NC"}`;
      }),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);});
  };

  return (
    <div>
      <SectionTitle num="04" title="Synthèse financière" subtitle="Modèle simplifié — coût de revient, marge et prix d'acquisition cible"/>
      <div style={cardStyle()}>
        <h3 style={sH3}>Paramètres</h3>
        <Grid cols={3}>
          <Field label="Coût d'acquisition (€)"><input value={synth.acq||""} onChange={e=>f("acq",e.target.value)} placeholder="400 000" style={inp} type="number"/></Field>
          <Field label="Travaux — estimation globale (€)"><input value={synth.travaux||""} onChange={e=>f("travaux",e.target.value)} placeholder="40 000" style={inp} type="number"/></Field>
          <Field label="Marge cible">
            <select value={synth.margeCible||"20"} onChange={e=>f("margeCible",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="20">20%</option><option value="25">25%</option><option value="30">30%</option>
            </select>
          </Field>
        </Grid>
        {trPm2&&(
          <div style={{marginTop:8,fontSize:12,color:C.muted}}>
            Travaux représentent <strong style={{color:C.text}}>{Math.round(trPm2)}€/m²</strong> sur {surface}m²
            {" — "}{trPm2<300?"Rafraîchissement léger":trPm2<600?"Rénovation partielle":trPm2<900?"Rénovation lourde":"Tout à faire"}
          </div>
        )}
        {caBase===0&&<div style={{marginTop:8,fontSize:12,color:C.muted}}>ℹ️ Renseigne les prix de revente dans l'onglet 03 pour alimenter le CA.</div>}
      </div>

      {acq>0&&(
        <div style={cardStyle()}>
          <h3 style={sH3}>Décomposition du coût de revient (CPT)</h3>
          {[
            {label:"Coût d'acquisition",           val:acq,        pct:cpt>0?acq/cpt*100:0},
            {label:"Frais de notaire (3%)",         val:fdn,        pct:cpt>0?fdn/cpt*100:0},
            {label:"Travaux",                       val:travaux,    pct:cpt>0?travaux/cpt*100:0},
            {label:"Provision éviction (estimée)",  val:totalProv,  pct:cpt>0?totalProv/cpt*100:0},
            {label:"Frais financiers (~8% CPT 12M)",val:ff,         pct:cpt>0?ff/cpt*100:0},
          ].map(row=>(
            <div key={row.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}>
              <span style={{color:C.muted}}>{row.label}</span>
              <span style={{fontWeight:600,color:C.text}}>{fmt(row.val)} <span style={{fontSize:11,color:C.muted}}>({row.pct.toFixed(1)}%)</span></span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",fontSize:15,fontWeight:800,color:C.dark}}>
            <span>CPT TOTAL</span><span>{fmt(cpt)}</span>
          </div>
        </div>
      )}

      {caBase>0&&(
        <div style={cardStyle({background:C.dark})}>
          <h3 style={{...sH3,color:"#fff",borderColor:"rgba(255,255,255,0.15)"}}>Matrice scénarios CA</h3>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["Scénario","CA brut","Marge €","Marge %",`Prix acq. visé (cible ${synth.margeCible||20}%)`].map(h=>(
                <th key={h} style={{padding:"8px 12px",textAlign:"left",color:"#888",fontSize:10,letterSpacing:1,fontWeight:600,borderBottom:"1px solid rgba(255,255,255,0.1)"}}>{h.toUpperCase()}</th>
              ))}</tr></thead>
              <tbody>{scenarios.map(s=>{
                const m  = margeCalc(s.ca);
                const pv = prixVise(s.ca);
                const isGo   = m&&m.pct>=20;
                const isWarn = m&&m.pct>=12&&m.pct<20;
                return (
                  <tr key={s.label} style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                    <td style={{padding:"10px 12px",color:s.color,fontWeight:700}}>{s.label}</td>
                    <td style={{padding:"10px 12px",color:"#fff",fontWeight:600}}>{fmt(s.ca)}</td>
                    <td style={{padding:"10px 12px",color:m?(m.montant>=0?"#4caf50":C.danger):"#888"}}>{m?fmt(m.montant):"—"}</td>
                    <td style={{padding:"10px 12px"}}>
                      {m?<span style={{background:isGo?"#1b5e20":isWarn?"#e65100":"#b71c1c",color:"#fff",padding:"2px 10px",borderRadius:12,fontSize:12,fontWeight:700}}>{m.pct.toFixed(1)}%</span>:"—"}
                    </td>
                    <td style={{padding:"10px 12px",color:C.gold,fontWeight:700}}>{pv&&pv>0?fmt(pv):"—"}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          {acq>0&&caBase>0&&(()=>{
            const m = margeCalc(caBase);
            const g = m&&m.pct>=20?"GO":m&&m.pct>=12?"ATTENTION":"NO GO";
            return (
              <div style={{marginTop:14,textAlign:"center"}}>
                <span style={{display:"inline-block",padding:"8px 28px",borderRadius:8,fontWeight:800,fontSize:16,letterSpacing:2,background:g==="GO"?"#1b5e20":g==="NO GO"?"#b71c1c":"#e65100",color:"#fff"}}>
                  {g==="GO"?"✅":g==="NO GO"?"❌":"⚠️"} {g}
                  <span style={{fontSize:11,fontWeight:400,marginLeft:10,opacity:0.8}}>
                    {g==="GO"?"Marge ≥ 20% (neutre)":g==="ATTENTION"?"12–20% — à optimiser":"< 12% — insuffisante"}
                  </span>
                </span>
              </div>
            );
          })()}
        </div>
      )}

      <button onClick={handleCopy} style={{width:"100%",padding:"13px",background:copied?"#e8f5e9":C.dark,border:"none",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:700,color:copied?C.success:C.gold,fontFamily:"inherit",letterSpacing:1,marginTop:4,transition:"all 0.3s",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        {copied?"✅ COPIÉ — COLLE DANS NOTION":"📋 COPIER LA SYNTHÈSE NOTION"}
      </button>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
const TABS = [
  {id:"ident",    label:"01 · Identification"},
  {id:"checklist",label:"02 · Checklist visite"},
  {id:"lots",     label:"03 · Lots & Occupation"},
  {id:"synthese", label:"04 · Synthèse"},
];

export default function App() {
  const [tab,     setTab]     = useState("ident");
  const [ident,   setIdent]   = useState({});
  const [check,   setCheck]   = useState({});
  const [lots,    setLots]    = useState([]);
  const [etat,    setEtat]    = useState("");
  const [synth,   setSynth]   = useState({margeCible:"20"});

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans', sans-serif",color:C.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;}
        input:focus,select:focus,textarea:focus{border-color:${C.dark}!important;background:#fff!important;box-shadow:0 0 0 2px rgba(28,28,46,0.08);}
        input[type=checkbox],input[type=radio]{accent-color:${C.dark};}
        ::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-track{background:${C.bg};}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
      `}</style>

      <div style={{background:C.dark,padding:"0 32px"}}>
        <div style={{maxWidth:980,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <span style={{background:C.gold,color:C.dark,fontWeight:800,fontSize:12,padding:"3px 12px",borderRadius:4,letterSpacing:2}}>BATIA</span>
            <span style={{color:"#fff",fontFamily:"'Playfair Display', serif",fontSize:15,fontWeight:700}}>{ident.nom||"Nouveau dossier"}</span>
            {ident.prixAffiche&&<span style={{color:"#888",fontSize:12}}>· {parseFloat(ident.prixAffiche).toLocaleString("fr-FR")}€ affiché</span>}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {check.decision&&<span style={{fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:12,background:check.decision==="GO"?"#1b5e20":check.decision==="NO GO"?"#b71c1c":"#e65100",color:"#fff"}}>{check.decision}</span>}
            {[{ok:!!(ident.nom&&ident.adresse)},{ok:!!check.decision},{ok:lots.length>0&&lots.some(l=>l.statut)},{ok:!!(synth.acq&&synth.travaux)}].map(({ok},i)=>(
              <span key={i} style={{width:8,height:8,borderRadius:"50%",background:ok?"#4caf50":"rgba(255,255,255,0.2)"}}/>
            ))}
          </div>
        </div>
      </div>

      <div style={{background:"#fff",borderBottom:`1px solid ${C.border}`,padding:"0 32px",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:980,margin:"0 auto",display:"flex"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"14px 20px",background:"transparent",border:"none",cursor:"pointer",fontSize:13,fontWeight:tab===t.id?700:500,fontFamily:"inherit",color:tab===t.id?C.dark:C.muted,borderBottom:tab===t.id?`2px solid ${C.dark}`:"2px solid transparent",transition:"all 0.15s",whiteSpace:"nowrap"}}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:980,margin:"0 auto",padding:"28px 32px 80px"}}>
        {tab==="ident"     && <ModuleIdentification data={ident} onChange={setIdent}/>}
        {tab==="checklist" && <ModuleChecklist data={check} onChange={setCheck}/>}
        {tab==="lots"      && <ModuleLots lots={lots} onChange={setLots} etatGlobal={etat} onEtatGlobal={setEtat} surfaceGlobale={ident.surface} typeBien={ident.type}/>}
        {tab==="synthese"  && <ModuleSynthese ident={ident} lots={lots} synth={synth} onSynth={setSynth}/>}
      </div>
    </div>
  );
}
