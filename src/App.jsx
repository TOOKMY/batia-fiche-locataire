import { useState, useEffect } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "batia_projets_v1";

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

const STATUT_COLORS = {
  "En cours":     { bg:"#e3f2fd", text:"#1565c0" },
  "Visite prévue":{ bg:"#fff8e1", text:"#e65100" },
  "Offre faite":  { bg:"#f3e5f5", text:"#6a1b9a" },
  "Abandonné":    { bg:"#fce4ec", text:"#b71c1c" },
  "Acquis":       { bg:"#e8f5e9", text:"#2e7d32" },
  "Vendu":        { bg:"#e8f5e9", text:"#1b5e20" },
};

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
function newProjet() {
  return {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ident: {}, check: {}, lots: [], etat: "", synth: { margeCible:"20" }
  };
}


// ─── GOOGLE DRIVE CONFIG ─────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = "337253556160-e4d5uvsfogdj1fj11e2e68lndaotacjs.apps.googleusercontent.com";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const BATIA_FOLDER = "BATIA-App";

// Load Google Identity Services script
function loadGoogleScript() {
  return new Promise(resolve => {
    if (window.google?.accounts) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

// Get or create BATIA-App folder in Drive
async function getOrCreateFolder(token) {
  const search = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${BATIA_FOLDER}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await search.json();
  if (data.files?.length > 0) return data.files[0].id;
  const create = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: BATIA_FOLDER, mimeType: "application/vnd.google-apps.folder" })
  });
  const folder = await create.json();
  return folder.id;
}

// List JSON files in BATIA-App folder
async function listDriveFiles(token, folderId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType='application/json'+and+trashed=false&fields=files(id,name,modifiedTime)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.files || [];
}

// Read a file from Drive
async function readDriveFile(token, fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return await res.json();
}

// Save/update a file in Drive
async function saveDriveFile(token, folderId, fileName, content, existingFileId) {
  const body = JSON.stringify(content);
  if (existingFileId) {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body
    });
    return existingFileId;
  } else {
    const meta = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: fileName, parents: [folderId], mimeType: "application/json" })
    });
    const file = await meta.json();
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body
    });
    return file.id;
  }
}

// Delete a file from Drive
async function deleteDriveFile(token, fileId) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
function loadProjets() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); }
  catch { return []; }
}
function saveProjets(projets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projets));
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

// ─── ÉCRAN LISTE PROJETS ──────────────────────────────────────────────────────
function EcranProjets({ projets, onOpen, onCreate, onDelete, onImport, isMobile, driveToken, driveUser, onDriveLogin, onDriveLogout, driveLoading, driveFolderId, onDriveSync }) {

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.ident !== undefined) onImport(data);
          else alert("Fichier invalide");
        } catch { alert("Fichier invalide"); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap'); *{box-sizing:border-box;}`}</style>

      {/* Header */}
      <div style={{ background:C.dark, padding:`0 ${isMobile?14:32}px` }}>
        <div style={{ maxWidth:980, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:56 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ background:C.gold, color:C.dark, fontWeight:800, fontSize:12, padding:"4px 12px", borderRadius:4, letterSpacing:2 }}>BATIA</span>
            <span style={{ color:"#fff", fontFamily:"'Playfair Display', serif", fontSize:16, fontWeight:700 }}>Mes dossiers</span>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {!driveToken ? (
              <button onClick={onDriveLogin} disabled={driveLoading} style={{ background:C.gold, border:"none", color:C.dark, cursor:"pointer", borderRadius:6, padding:"6px 12px", fontSize:12, fontWeight:700, fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
                {driveLoading ? "⏳" : "🔗"} {driveLoading ? "Connexion..." : "Connexion Google Drive"}
              </button>
            ) : (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, color:"#aaa" }}>{driveUser}</span>
                {driveFolderId && <button onClick={onDriveSync} style={{ background:"rgba(255,255,255,0.1)", border:"none", color:"#ccc", cursor:"pointer", borderRadius:6, padding:"5px 10px", fontSize:12, fontFamily:"inherit" }}>🔄 Sync</button>}
                <button onClick={onDriveLogout} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", color:"#888", cursor:"pointer", borderRadius:6, padding:"5px 8px", fontSize:11, fontFamily:"inherit" }}>Déconnexion</button>
              </div>
            )}
            {!driveToken && <button onClick={handleImport} style={{ background:"rgba(255,255,255,0.1)", border:"none", color:"#ccc", cursor:"pointer", borderRadius:6, padding:"6px 12px", fontSize:12, fontFamily:"inherit" }}>📂 Importer</button>}
          </div>
        </div>
      </div>

      {/* Bandeau Drive connecté */}
      {driveToken && (
        <div style={{ background:"#1b5e20", padding:"8px 32px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:12, color:"#a5d6a7" }}>✅ Google Drive connecté — dossier <strong style={{color:"#fff"}}>BATIA-App</strong> synchronisé</span>
          <button onClick={handleImport} style={{ background:"rgba(255,255,255,0.1)", border:"none", color:"#ccc", cursor:"pointer", borderRadius:6, padding:"4px 10px", fontSize:11, fontFamily:"inherit" }}>📂 Importer fichier local</button>
        </div>
      )}

      <div style={{ maxWidth:980, margin:"0 auto", padding:isMobile?"16px 14px":"28px 32px" }}>

        {/* Bouton nouveau dossier */}
        <button onClick={onCreate} style={{
          width:"100%", padding:"16px", background:C.dark, border:"none", borderRadius:12,
          cursor:"pointer", color:C.gold, fontSize:15, fontWeight:700, fontFamily:"inherit",
          marginBottom:20, display:"flex", alignItems:"center", justifyContent:"center", gap:10,
        }}>
          <span style={{ fontSize:20 }}>+</span> Nouveau dossier
        </button>

        {/* Liste projets */}
        {projets.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px", color:C.muted }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🏢</div>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>Aucun dossier</div>
            <div style={{ fontSize:14 }}>{driveToken ? "Aucun dossier trouvé dans Drive — crée ton premier dossier" : "Connecte Google Drive ou crée un dossier"}</div>
          </div>
        ) : (
          projets.slice().reverse().map(p => {
            const sc = STATUT_COLORS[p.ident?.statut]||{ bg:"#f5f3ee", text:C.muted };
            const updatedAt = new Date(p.updatedAt).toLocaleDateString("fr-FR");
            return (
              <div key={p.id} onClick={()=>onOpen(p.id)} style={{
                background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
                padding:"16px", marginBottom:12, cursor:"pointer", transition:"all 0.15s",
              }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.dark}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:C.dark, fontFamily:"'Playfair Display', serif", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {p.ident?.nom||"Sans titre"}
                    </div>
                    <div style={{ fontSize:13, color:C.muted }}>
                      {p.ident?.adresse||"Adresse non renseignée"}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
                    {p.ident?.statut&&(
                      <span style={{ fontSize:11, fontWeight:600, padding:"2px 10px", borderRadius:12, background:sc.bg, color:sc.text }}>
                        {p.ident.statut}
                      </span>
                    )}
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      {p.driveFileId && <span style={{ fontSize:10, color:"#4caf50" }}>☁️</span>}
                      <span style={{ fontSize:11, color:C.muted }}>{updatedAt}</span>
                    </div>
                    <button onClick={e=>{ e.stopPropagation(); if(window.confirm(`Supprimer "${p.ident?.nom||"ce dossier"}" ?`)) onDelete(p.id); }} style={{ background:"transparent", border:"none", color:"#ccc", cursor:"pointer", fontSize:16, padding:"2px 4px" }}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── MODULES 01-04 (identiques v3 mais avec isMobile prop) ───────────────────

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
        <Field label="Remarques"><textarea value={data.remarques||""} onChange={e=>f("remarques",e.target.value)} placeholder="Observations..." style={{...inp,height:80,resize:"vertical"}}/></Field>
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
            <button key={d} onClick={()=>f("decision",d)} style={{flex:1,minWidth:100,padding:"12px 8px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:"inherit",background:data.decision===d?(d==="GO"?"#1b5e20":d==="NO GO"?"#b71c1c":"#e65100"):"rgba(255,255,255,0.1)",border:data.decision===d?"none":`1px solid rgba(255,255,255,0.2)`,color:data.decision===d?"#fff":"#888"}}>
              {d==="GO"?"✅":d==="NO GO"?"❌":"⚠️"} {d}
            </button>
          ))}
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:12}}>
          <input type="checkbox" checked={data.pointBloquant||false} onChange={e=>f("pointBloquant",e.target.checked)} style={{accentColor:C.gold,width:18,height:18}}/>
          <span style={{color:data.pointBloquant?"#ff6b6b":"#aaa",fontWeight:600,fontSize:14}}>Point bloquant identifié</span>
        </label>
        {data.pointBloquant&&<textarea value={data.pointBloquantDetail||""} onChange={e=>f("pointBloquantDetail",e.target.value)} placeholder="Détail..." style={{...inp,height:70,resize:"vertical",background:"rgba(255,255,255,0.08)",borderColor:"#ff6b6b",color:"#fff"}}/>}
        <div style={{marginTop:12}}>
          <textarea value={data.decisionMotif||""} onChange={e=>f("decisionMotif",e.target.value)} placeholder="Motif de la décision..." style={{...inp,height:60,resize:"vertical",background:"rgba(255,255,255,0.08)",borderColor:"rgba(255,255,255,0.2)",color:"#fff"}}/>
        </div>
      </div>
    </div>
  );
}

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
        <div style={{marginTop:10,fontSize:12,color:C.muted,lineHeight:1.9}}>
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

function ModuleSynthese({ ident, lots, synth, onSynth, isMobile }) {
  const [copied, setCopied] = useState(false);
  const f = (k,v) => onSynth({...synth,[k]:v});

  const surface    = parseFloat(ident.surface||0);
  const caBase     = lots.reduce((acc,l)=>acc+(parseFloat(l.prixRevente)||0),0);
  const totalProv  = lots.reduce((acc,l)=>acc+provisionNum(l),0);
  const margeCible = parseFloat(synth.margeCible||20)/100;
  const duree      = synth.duree||"12M";
  const travaux    = parseFloat(synth.travaux||0);
  const trPm2      = surface>0&&travaux>0?travaux/surface:null;
  const manuel     = synth.acqManuel||false;
  const FF_RATIOS  = { "6M":0.063, "12M":0.09, "24M":0.155 };
  const prixAffiche = parseFloat(ident.prixAffiche||0);

  // Prix visé calculé automatiquement
  function prixViseAuto(ca, dur) {
    if (!ca) return null;
    const ffR  = FF_RATIOS[dur]||0.09;
    const cpt  = ca / (1 + margeCible);
    const acqV = (cpt / (1 + ffR) - travaux - totalProv) / 1.03;
    return acqV > 0 ? acqV : null;
  }

  // Décomposition depuis un prix d'achat
  function calcFromAcq(acqV) {
    if (!acqV) return null;
    const ffR  = FF_RATIOS[duree]||0.09;
    const fdn  = acqV*0.03;
    const cptB = acqV+fdn+travaux+totalProv;
    const ff   = cptB*ffR;
    const cpt  = cptB+ff;
    const ben  = caBase-cpt;
    return { fdn, cptBase:cptB, ff, cpt, montant:ben, pct:cpt>0?(ben/cpt)*100:0, apport:acqV*0.30, pret:acqV*0.70 };
  }

  const pvAuto  = prixViseAuto(caBase, duree);
  const acqVal  = manuel ? parseFloat(synth.acqManuelVal||0) : (pvAuto||0);
  const calc    = acqVal>0 ? calcFromAcq(acqVal) : null;

  const handleCopy = () => {
    const lines = [
      `📋 SYNTHÈSE BATIA — ${ident.nom||ident.adresse||"Dossier"}`,
      `🗓 ${new Date().toLocaleDateString("fr-FR")} · ${ident.adresse||""}`,
      `Prix affiché : ${fmt(prixAffiche)} · CA brut lots : ${fmt(caBase)}`,
      `Travaux : ${fmt(travaux)}${trPm2?` (${Math.round(trPm2)}€/m²)`:""}`,
      `Provision éviction : ~${fmt(totalProv)}`,
      `Durée : ${duree} · Marge cible : ${synth.margeCible||20}%`,
      "─────────────────────────────",
      `Prix d'acquisition ${manuel?"(manuel)":"(calculé)"} : ${fmt(acqVal)}`,
      calc?`FdN 3% : ${fmt(calc.fdn)} · Travaux : ${fmt(travaux)} · Provision : ${fmt(totalProv)}`:"",
      calc?`CPT hors FF : ${fmt(calc.cptBase)} · FF ${duree} : ${fmt(calc.ff)} · CPT total : ${fmt(calc.cpt)}`:"",
      calc?`CA brut : ${fmt(caBase)} · Marge nette : ${fmt(calc.montant)} (${calc.pct.toFixed(1)}%)`:"",
      calc?`Apport 30% : ${fmt(calc.apport)} · Prêt 70% : ${fmt(calc.pret)}`:"",
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join("\n")).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);});
  };

  return (
    <div>
      <SectionTitle num="04" title="Synthèse financière" subtitle="Prix d'acquisition cible calculé depuis le CA et la marge visée"/>

      {/* Paramètres */}
      <div style={cardStyle()}>
        <h3 style={sH3}>Paramètres</h3>
        <Grid cols={3} mob={1} isMobile={isMobile}>
          <Field label="Travaux estimés (€)">
            <input value={synth.travaux||""} onChange={e=>f("travaux",e.target.value)} placeholder="40 000" style={inp} type="number"/>
          </Field>
          <Field label="Marge cible">
            <select value={synth.margeCible||"20"} onChange={e=>f("margeCible",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="20">20%</option><option value="25">25%</option><option value="30">30%</option>
            </select>
          </Field>
          <Field label="Durée de portage">
            <select value={duree} onChange={e=>f("duree",e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="6M">6 mois</option>
              <option value="12M">12 mois</option>
              <option value="24M">24 mois</option>
            </select>
          </Field>
        </Grid>
        {trPm2&&<div style={{fontSize:12,color:C.muted,marginTop:6}}>
          Travaux : <strong style={{color:C.text}}>{Math.round(trPm2)}€/m²</strong> — {trPm2<300?"Rafraîchissement":trPm2<600?"Rénovation partielle":trPm2<900?"Rénovation lourde":"Tout à faire"}
        </div>}
        {caBase===0&&<div style={{marginTop:8,fontSize:12,color:C.muted}}>ℹ️ Renseigne les prix de revente dans l'onglet 03.</div>}
      </div>

      {/* Prix d'acquisition */}
      <div style={cardStyle()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <h3 style={{...sH3,margin:0,borderBottom:"none",paddingBottom:0}}>Prix d'acquisition</h3>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:C.muted}}>
            <input type="checkbox" checked={manuel} onChange={e=>f("acqManuel",e.target.checked)} style={{accentColor:C.dark,width:16,height:16}}/>
            Saisir manuellement
          </label>
        </div>

        {!manuel ? (
          // Figé — calculé automatiquement
          <div style={{padding:"14px 16px",background:"#F5F3EE",borderRadius:8,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.muted,letterSpacing:1,marginBottom:6,textTransform:"uppercase"}}>Calculé automatiquement</div>
            <div style={{fontSize:24,fontWeight:800,color:C.dark,fontFamily:"'Playfair Display', serif"}}>
              {pvAuto ? fmt(pvAuto) : caBase===0 ? "— (renseigne le CA)" : "—"}
            </div>
            {prixAffiche>0&&pvAuto&&(
              <div style={{marginTop:6,fontSize:12,color:C.muted}}>
                Écart vs. prix affiché : <strong style={{color:pvAuto<prixAffiche?C.success:C.danger}}>
                  {fmt(pvAuto-prixAffiche)} ({(((pvAuto-prixAffiche)/prixAffiche)*100).toFixed(1)}%)
                </strong>
              </div>
            )}
          </div>
        ) : (
          // Manuel — saisie libre
          <div>
            <input value={synth.acqManuelVal||""} onChange={e=>f("acqManuelVal",e.target.value)}
              placeholder="ex: 400 000" style={{...inp,fontSize:18,fontWeight:700}} type="number"/>
            {prixAffiche>0&&synth.acqManuelVal&&(
              <div style={{marginTop:6,fontSize:12,color:C.muted}}>
                Écart vs. prix affiché : <strong style={{color:parseFloat(synth.acqManuelVal)<prixAffiche?C.success:C.danger}}>
                  {fmt(parseFloat(synth.acqManuelVal)-prixAffiche)} ({(((parseFloat(synth.acqManuelVal)-prixAffiche)/prixAffiche)*100).toFixed(1)}%)
                </strong>
              </div>
            )}
            {pvAuto&&<div style={{marginTop:4,fontSize:12,color:C.muted}}>
              Prix calculé auto : <strong style={{color:C.text}}>{fmt(pvAuto)}</strong>
            </div>}
          </div>
        )}
      </div>

      {/* Décomposition CPT + synthèse */}
      {acqVal>0&&calc&&(
        <div style={cardStyle()}>
          <h3 style={sH3}>Décomposition CPT — {duree}</h3>
          {[
            { label:"Prix d'acquisition",          val:acqVal,        pct:calc.cptBase>0?acqVal/calc.cptBase*100:0 },
            { label:"Frais notaire (~3%)",          val:calc.fdn,      pct:calc.cptBase>0?calc.fdn/calc.cptBase*100:0 },
            { label:"Travaux",                      val:travaux,       pct:calc.cptBase>0?travaux/calc.cptBase*100:0 },
            { label:"Provision éviction estimée",   val:totalProv,     pct:calc.cptBase>0?totalProv/calc.cptBase*100:0 },
          ].map(row=>(
            <div key={row.label} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}>
              <span style={{color:C.muted}}>{row.label}</span>
              <span style={{fontWeight:600,color:C.text}}>{fmt(row.val)} <span style={{fontSize:11,color:C.muted}}>({row.pct.toFixed(1)}%)</span></span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0 5px",fontSize:13,fontWeight:700,color:C.dark,borderBottom:`1px solid ${C.border}`}}>
            <span>CPT hors frais financiers</span><span>{fmt(calc.cptBase)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0 5px",fontSize:13,color:C.muted,borderBottom:`2px solid ${C.dark}`}}>
            <span>Frais financiers {duree} ({(FF_RATIOS[duree]*100).toFixed(1)}%)</span>
            <span style={{fontWeight:600,color:C.text}}>{fmt(calc.ff)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0 0",fontSize:15,fontWeight:800,color:C.dark}}>
            <span>CPT TOTAL {duree}</span><span>{fmt(calc.cpt)}</span>
          </div>

          {/* Synthèse finale */}
          <div style={{marginTop:10,padding:"14px",background:"#1C1C2E",borderRadius:8}}>
            <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.1)",marginBottom:8}}>
              <span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>CA brut lots</span>
              <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>{fmt(caBase)}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.8)"}}>Marge nette</span>
              <div style={{textAlign:"right"}}>
                <span style={{fontSize:20,fontWeight:800,color:calc.pct>=20?C.success:calc.pct>=12?"#fb8c00":C.danger}}>
                  {fmt(calc.montant)}
                </span>
                <span style={{fontSize:14,fontWeight:700,color:calc.pct>=20?C.success:calc.pct>=12?"#fb8c00":C.danger,marginLeft:8}}>
                  ({calc.pct.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.1)",display:"flex",gap:16}}>
              <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Apport 30% : <strong style={{color:"rgba(255,255,255,0.7)"}}>{fmt(calc.apport)}</strong></span>
              <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Prêt 70% : <strong style={{color:"rgba(255,255,255,0.7)"}}>{fmt(calc.pret)}</strong></span>
            </div>
          </div>
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
  const [projets,      setProjets]      = useState(() => loadProjets());
  const [projetActif,  setProjetActif]  = useState(null);
  const [tab,          setTab]          = useState("ident");
  const [saved,        setSaved]        = useState(false);
  // Drive state
  const [driveToken,   setDriveToken]   = useState(() => sessionStorage.getItem("batia_drive_token")||null);
  const [driveUser,    setDriveUser]    = useState(() => sessionStorage.getItem("batia_drive_user")||null);
  const [driveFolderID,setDriveFolderID]= useState(() => sessionStorage.getItem("batia_drive_folder")||null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [syncMsg,      setSyncMsg]      = useState("");

  const projet = projets.find(p=>p.id===projetActif)||null;

  // Auto-save local toutes les 30s
  useEffect(() => {
    if (!projetActif) return;
    const t = setInterval(() => { saveProjets(projets); setSaved(true); setTimeout(()=>setSaved(false),1500); }, 30000);
    return () => clearInterval(t);
  }, [projetActif, projets]);

  // ── GOOGLE DRIVE AUTH ────────────────────────────────────────────────────
  const handleDriveLogin = async () => {
    setDriveLoading(true);
    try {
      await loadGoogleScript();
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email",
        callback: async (resp) => {
          if (resp.error) { setDriveLoading(false); alert("Erreur connexion: "+resp.error); return; }
          const token = resp.access_token;
          // Get user email
          const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers:{ Authorization:`Bearer ${token}` } });
          const userInfo = await userRes.json();
          // Get/create folder
          const folderId = await getOrCreateFolder(token);
          setDriveToken(token);
          setDriveUser(userInfo.email);
          setDriveFolderID(folderId);
          sessionStorage.setItem("batia_drive_token", token);
          sessionStorage.setItem("batia_drive_user", userInfo.email);
          sessionStorage.setItem("batia_drive_folder", folderId);
          setDriveLoading(false);
          // Sync immediately after login
          await syncFromDrive(token, folderId);
        }
      });
      client.requestAccessToken();
    } catch(e) { setDriveLoading(false); alert("Erreur: "+e.message); }
  };

  const handleDriveLogout = () => {
    setDriveToken(null); setDriveUser(null); setDriveFolderID(null);
    sessionStorage.removeItem("batia_drive_token");
    sessionStorage.removeItem("batia_drive_user");
    sessionStorage.removeItem("batia_drive_folder");
  };

  // ── SYNC DRIVE → LOCAL ───────────────────────────────────────────────────
  const syncFromDrive = async (token, folderId) => {
    setSyncMsg("Synchronisation...");
    try {
      const files = await listDriveFiles(token||driveToken, folderId||driveFolderID);
      const driveProjects = await Promise.all(files.map(async f => {
        const data = await readDriveFile(token||driveToken, f.id);
        return { ...newProjet(), ...data, driveFileId:f.id, updatedAt:f.modifiedTime||new Date().toISOString() };
      }));
      // Merge: Drive wins for existing driveFileId, keep local-only
      setProjets(prev => {
        const localOnly = prev.filter(p => !p.driveFileId);
        return [...localOnly, ...driveProjects];
      });
      setSyncMsg(`✅ ${driveProjects.length} dossier(s) synchronisé(s)`);
      setTimeout(()=>setSyncMsg(""),3000);
    } catch(e) { setSyncMsg("❌ Erreur sync: "+e.message); setTimeout(()=>setSyncMsg(""),4000); }
  };

  // ── SAVE TO DRIVE ────────────────────────────────────────────────────────
  const saveToDrive = async (p) => {
    if (!driveToken || !driveFolderID) return;
    try {
      const { ident, check, lots, etat, synth } = p;
      const fileName = `BATIA_${(ident?.nom||"dossier").replace(/\s+/g,"_")}.json`;
      const fileId = await saveDriveFile(driveToken, driveFolderID, fileName, {ident,check,lots,etat,synth}, p.driveFileId||null);
      // Update driveFileId in local state
      setProjets(prev => prev.map(lp => lp.id===p.id ? {...lp, driveFileId:fileId} : lp));
    } catch(e) { console.error("Drive save error:", e); }
  };

  // ── HELPERS ──────────────────────────────────────────────────────────────
  const updateProjet = (patch) => {
    setProjets(prev => prev.map(p => p.id===projetActif ? { ...p, ...patch, updatedAt:new Date().toISOString() } : p));
  };

  const saveNow = async () => {
    saveProjets(projets);
    if (driveToken && projet) await saveToDrive({...projet, updatedAt:new Date().toISOString()});
    setSaved(true);
    setTimeout(()=>setSaved(false),1500);
  };

  const handleCreate = () => {
    const p = newProjet();
    const updated = [...projets, p];
    setProjets(updated); saveProjets(updated);
    setProjetActif(p.id); setTab("ident");
  };
  const handleOpen = (id) => { setProjetActif(id); setTab("ident"); };
  const handleDelete = async (id) => {
    const p = projets.find(lp=>lp.id===id);
    if (p?.driveFileId && driveToken) await deleteDriveFile(driveToken, p.driveFileId).catch(()=>{});
    const updated = projets.filter(lp=>lp.id!==id);
    setProjets(updated); saveProjets(updated);
  };
  const handleImport = (data) => {
    const p = { ...newProjet(), ...data, id:Date.now().toString(), updatedAt:new Date().toISOString() };
    const updated = [...projets, p];
    setProjets(updated); saveProjets(updated);
    setProjetActif(p.id); setTab("ident");
  };
  const handleBack = () => { saveNow(); setProjetActif(null); };
  const handleExport = () => {
    if (!projet) return;
    const { ident, check, lots, etat, synth } = projet;
    const blob = new Blob([JSON.stringify({ident,check,lots,etat,synth},null,2)],{type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download=`BATIA_${(projet.ident?.nom||"dossier").replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── ÉCRAN LISTE ───────────────────────────────────────────────────────────
  if (!projetActif) {
    return (
      <div>
        {syncMsg&&<div style={{position:"fixed",top:0,left:0,right:0,background:"#1b5e20",color:"#fff",textAlign:"center",padding:"8px",fontSize:13,zIndex:999}}>{syncMsg}</div>}
        <EcranProjets
          projets={projets} onOpen={handleOpen} onCreate={handleCreate}
          onDelete={handleDelete} onImport={handleImport} isMobile={isMobile}
          driveToken={driveToken} driveUser={driveUser} driveLoading={driveLoading}
          driveFolderId={driveFolderID}
          onDriveLogin={handleDriveLogin} onDriveLogout={handleDriveLogout}
          onDriveSync={()=>syncFromDrive()}
        />
      </div>
    );
  }

  // ── ÉCRAN DOSSIER ─────────────────────────────────────────────────────────
  if (!projet) { setProjetActif(null); return null; }
  const { ident, check, lots, etat, synth } = projet;
  const setIdent = v => updateProjet({ident:v});
  const setCheck = v => updateProjet({check:v});
  const setLots  = v => updateProjet({lots:v});
  const setEtat  = v => updateProjet({etat:v});
  const setSynth = v => updateProjet({synth:v});
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
            <button onClick={handleBack} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#ccc",cursor:"pointer",borderRadius:6,padding:"5px 10px",fontSize:13,fontFamily:"inherit",flexShrink:0}}>← Dossiers</button>
            <span style={{color:"#fff",fontFamily:"'Playfair Display', serif",fontSize:isMobile?13:15,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {ident.nom||"Sans titre"}
            </span>
            {projet.driveFileId&&<span style={{fontSize:11,color:"#4caf50",flexShrink:0}}>☁️</span>}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
            {saved&&<span style={{fontSize:11,color:"#4caf50"}}>✓ Sauvegardé</span>}
            {check.decision&&!isMobile&&<span style={{fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:12,background:check.decision==="GO"?"#1b5e20":check.decision==="NO GO"?"#b71c1c":"#e65100",color:"#fff"}}>{check.decision}</span>}
            <button onClick={saveNow} style={{background:C.gold,border:"none",color:C.dark,cursor:"pointer",borderRadius:6,padding:"6px 10px",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>
              {isMobile?"💾":"💾 Sauvegarder"}
            </button>
            {!isMobile&&<button onClick={handleExport} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#ccc",cursor:"pointer",borderRadius:6,padding:"6px 10px",fontSize:12,fontFamily:"inherit"}}>📤 Exporter</button>}
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
              <span style={{fontSize:10,fontWeight:tab===t.id?700:400,color:tab===t.id?C.dark:C.muted}}>{t.full}</span>
              {tab===t.id&&<span style={{width:20,height:2,background:C.dark,borderRadius:1}}/>}
            </button>
          ))}
          <button onClick={()=>{saveNow();handleExport();}} style={{flex:1,padding:"10px 4px 12px",background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontFamily:"inherit"}}>
            <span style={{fontSize:20}}>📤</span>
            <span style={{fontSize:10,color:C.muted}}>Export</span>
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
