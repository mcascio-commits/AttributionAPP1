// ── API ───────────────────────────────────────────────────────────────────────
async function api(url, method='GET', body=null) {
  const opts = {method, headers:{'Content-Type':'application/json'}};
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type='ok') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(html) {
  document.getElementById('modal').innerHTML = html;
  document.getElementById('modal').classList.add('show');
  document.getElementById('modal-overlay').classList.add('show');
}
function closeModal() {
  document.getElementById('modal').classList.remove('show');
  document.getElementById('modal-overlay').classList.remove('show');
}

// ── Année ─────────────────────────────────────────────────────────────────────
function changerAnnee(val) {
  fetch('/api/annee', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({label:val})})
    .then(() => { const u = new URL(window.location); u.searchParams.set('annee',val); window.location=u; });
}

// ── Autocomplete ──────────────────────────────────────────────────────────────
let _acTimer = null, _acCallback = null;

function setupAC(input, onSelect) {
  input.setAttribute('autocomplete','off');
  _acCallback = onSelect;
  input.addEventListener('input', () => {
    clearTimeout(_acTimer);
    _acTimer = setTimeout(() => doAC(input), 150);
  });
  input.addEventListener('blur', () => setTimeout(hideAC, 200));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideAC();
    if (e.key === 'Enter') { e.preventDefault(); const first = document.querySelector('.ac-item'); if(first) first.click(); }
  });
}

function doAC(input) {
  const q = input.value.trim();
  if (!q) { hideAC(); return; }
  fetch(`/api/personnel/search?q=${encodeURIComponent(q)}`)
    .then(r => r.json()).then(results => {
      let drop = document.getElementById('ac-drop');
      if (!drop) { drop = document.createElement('div'); drop.id='ac-drop'; document.body.appendChild(drop); }
      const rect = input.getBoundingClientRect();
      drop.style.top  = (rect.bottom + window.scrollY + 2) + 'px';
      drop.style.left = (rect.left + window.scrollX) + 'px';
      drop.style.minWidth = rect.width + 'px';
      if (!results.length) { drop.innerHTML='<div class="ac-item" style="color:var(--text3)">Aucun résultat</div>'; drop.style.display='block'; return; }
      drop.innerHTML = results.map(p => `
        <div class="ac-item" data-acro="${p.acronyme}">
          <strong>${p.acronyme}</strong>
          <span style="color:var(--text3)">${p.prenom||''} ${p.nom||''}</span>
        </div>`).join('');
      drop.querySelectorAll('.ac-item').forEach(item => {
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          input.value = item.dataset.acro;
          if (_acCallback) _acCallback(item.dataset.acro);
          hideAC();
        });
      });
      drop.style.display = 'block';
    });
}

function hideAC() {
  const d = document.getElementById('ac-drop');
  if (d) d.style.display = 'none';
}

// ── Add prof modal ─────────────────────────────────────────────────────────────
function addProfModal(coursId, groupeNum, classeId, annee, heuresCours, onSuccess) {
  openModal(`
    <div class="modal-title">Ajouter un professeur — Groupe ${groupeNum}</div>
    <div class="form-group">
      <label class="form-label">Professeur (acronyme ou nom)</label>
      <input id="ap-in" placeholder="ex: CASMO, Martin…" style="width:100%">
      <div id="ap-name" style="font-size:10px;color:var(--blue-dark);height:14px;margin-top:2px"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Heures attribuées
        <span style="color:var(--text3);font-size:10px">(vide = ${heuresCours}h complètes)</span>
      </label>
      <input id="ap-h" type="number" step="0.5" placeholder="${heuresCours}" style="width:110px">
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" id="ap-btn">Ajouter</button>
    </div>`);
  const inp = document.getElementById('ap-in');
  setupAC(inp, acro => {
    inp.value = acro;
    // Show name
    fetch(`/api/personnel/search?q=${acro}`).then(r=>r.json()).then(res => {
      const found = res.find(p => p.acronyme === acro);
      if (found) document.getElementById('ap-name').textContent = `${found.prenom||''} ${found.nom||''}`;
    });
  });
  setTimeout(() => inp.focus(), 80);
  document.getElementById('ap-btn').onclick = () => {
    const acro = inp.value.trim().toUpperCase();
    const h = document.getElementById('ap-h').value;
    if (!acro) return toast('Acronyme requis','err');
    api('/api/attribution','POST',{
      cours_id: coursId, classe_id: classeId||null,
      acronyme: acro, groupe_num: groupeNum,
      heures_attr: h ? parseFloat(h) : null, annee
    }).then(r => {
      if (!r.ok) return toast(r.error||'Erreur','err');
      closeModal(); toast('Ajouté');
      if (onSuccess) onSuccess(); else setTimeout(()=>window.location.href=window.location.href,300);
    });
  };
}

// ── Add titulaire ─────────────────────────────────────────────────────────────
function addTitulaireModal(classeId, classeNom, annee) {
  openModal(`
    <div class="modal-title">Titulaire — ${classeNom}</div>
    <div class="form-group">
      <label class="form-label">Professeur</label>
      <input id="titu-in" placeholder="Acronyme ou nom…" style="width:100%">
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" id="titu-btn">Ajouter</button>
    </div>`);
  const inp = document.getElementById('titu-in');
  setupAC(inp, acro => inp.value = acro);
  setTimeout(() => inp.focus(), 80);
  document.getElementById('titu-btn').onclick = () => {
    const acro = inp.value.trim().toUpperCase();
    if (!acro) return toast('Acronyme requis','err');
    api('/api/titulaire','POST',{classe_id:classeId, acronyme:acro, annee})
      .then(r => { if(!r.ok) return toast('Erreur','err'); closeModal(); toast('Titulaire ajouté'); setTimeout(()=>window.location.href=window.location.href,300); });
  };
}

function deleteTitulaire(id) {
  api(`/api/titulaire/${id}`,'DELETE').then(()=>{toast('Supprimé');setTimeout(()=>window.location.href=window.location.href,300)});
}

// ── Attribution ───────────────────────────────────────────────────────────────
function deleteAttr(id) {
  api(`/api/attribution/${id}`,'DELETE').then(()=>{toast('Supprimé');setTimeout(()=>window.location.href=window.location.href,300)});
}

function editAttr(id, acro, heuresAttr, heuresCours, currentColor) {
  const colors = [
    {label:'Normal',    cls:''},
    {label:'Rouge',     cls:'pill-red'},
    {label:'Orange',    cls:'pill-amber'},
    {label:'Vert',      cls:'pill-green'},
    {label:'Bleu',      cls:'pill-blue'},
    {label:'Violet',    cls:'pill-purple'},
  ];
  const colorBtns = colors.map(c =>
    `<button onclick="document.querySelectorAll('.color-btn').forEach(b=>b.style.outline='');this.style.outline='2px solid var(--blue)';document.getElementById('ea-color').value='${c.cls}'"
      class="btn btn-sm color-btn ${c.cls}" style="min-width:60px;${c.cls===currentColor?'outline:2px solid var(--blue)':''}">${c.label}</button>`
  ).join('');
  openModal(`
    <div class="modal-title">Modifier — ${acro}</div>
    <div class="form-group">
      <label class="form-label">Professeur</label>
      <input id="ea-acro" value="${acro}" style="width:100%">
    </div>
    <div class="form-group">
      <label class="form-label">Heures attribuées
        <span style="color:var(--text3);font-size:10px">(${heuresCours}h au total pour ce cours)</span>
      </label>
      <input id="ea-h" type="number" step="0.5" value="${heuresAttr||''}" placeholder="${heuresCours}" style="width:110px">
    </div>
    <div class="form-group">
      <label class="form-label">Couleur de la pastille</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${colorBtns}</div>
      <input type="hidden" id="ea-color" value="${currentColor||''}">
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Annuler</button>
      <button class="btn btn-danger btn-sm" onclick="deleteAttr(${id})">Supprimer</button>
      <button class="btn btn-primary" onclick="doEditAttr(${id})">Enregistrer</button>
    </div>`);
  const inp = document.getElementById('ea-acro');
  setupAC(inp, a => inp.value=a);
  setTimeout(()=>inp.focus(),80);
}

function doEditAttr(id) {
  const acro  = document.getElementById('ea-acro').value.trim().toUpperCase();
  const h     = document.getElementById('ea-h').value;
  const color = document.getElementById('ea-color')?.value || '';
  api(`/api/attribution/${id}`,'PUT',{acronyme:acro, heures_attr: h ? parseFloat(h) : null, couleur: color})
    .then(r => { if(!r.ok) return toast('Erreur','err'); closeModal(); toast('Mis à jour'); setTimeout(()=>window.location.href=window.location.href,300); });
}

// ── Cours management ──────────────────────────────────────────────────────────
function editCours(id, nom, heures, type) {
  openModal(`
    <div class="modal-title">Modifier le cours</div>
    <div class="form-group"><label class="form-label">Nom</label>
      <input id="ec-nom" value="${nom}" style="width:100%"></div>
    <div class="form-group"><label class="form-label">Heures</label>
      <input id="ec-h" type="number" step="0.5" value="${heures}" style="width:80px"></div>
    <div class="form-group"><label class="form-label">Type</label>
      <select id="ec-type">${['FC','OPT','TT','EDPH','COORD','AC'].map(t=>`<option ${t===type?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Annuler</button>
      <button class="btn btn-danger btn-sm" onclick="if(confirm('Supprimer ce cours ?'))api('/api/cours/${id}','DELETE').then(()=>{closeModal();toast('Supprimé');setTimeout(()=>window.location.href=window.location.href,300)})">Supprimer</button>
      <button class="btn btn-primary" onclick="doEditCours(${id})">Enregistrer</button>
    </div>`);
  setTimeout(()=>document.getElementById('ec-nom').focus(),80);
}

function doEditCours(id) {
  api(`/api/cours/${id}`,'PUT',{
    nom: document.getElementById('ec-nom').value.trim(),
    heures: parseFloat(document.getElementById('ec-h').value)||0,
    type: document.getElementById('ec-type').value,
  }).then(r=>{ if(!r.ok) return toast('Erreur','err'); closeModal(); toast('Mis à jour'); setTimeout(()=>window.location.href=window.location.href,300); });
}

function addCours(filiereId) {
  openModal(`
    <div class="modal-title">Ajouter un cours</div>
    <div class="form-group"><label class="form-label">Nom</label><input id="ac-nom" placeholder="ex: Philosophie" style="width:100%"></div>
    <div class="form-group"><label class="form-label">Heures</label><input id="ac-h" type="number" step="0.5" value="2" style="width:80px"></div>
    <div class="form-group"><label class="form-label">Type</label>
      <select id="ac-type">${['FC','OPT','TT','EDPH','COORD','AC'].map(t=>`<option>${t}</option>`).join('')}</select></div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="doAddCours(${filiereId})">Ajouter</button>
    </div>`);
  setTimeout(()=>document.getElementById('ac-nom').focus(),80);
}

function doAddCours(filiereId) {
  const nom = document.getElementById('ac-nom').value.trim();
  if(!nom) return toast('Nom requis','err');
  api('/api/cours','POST',{
    filiere_id:filiereId, nom,
    heures: parseFloat(document.getElementById('ac-h').value)||0,
    type: document.getElementById('ac-type').value,
  }).then(r=>{ if(!r.ok) return toast('Erreur','err'); closeModal(); toast('Cours ajouté'); setTimeout(()=>window.location.href=window.location.href,300); });
}

// ── Classes management ────────────────────────────────────────────────────────
function manageClasses(filiereId, filiereNom) {
  fetch(`/api/classes/${filiereId}`).then(r=>r.json()).then(classes => {
    renderClassesModal(filiereId, filiereNom, classes);
  });
}

function renderClassesModal(filiereId, filiereNom, classes) {
  const rows = classes.length ? classes.map(c=>`
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <input value="${c.nom}" style="width:100px;font-weight:500"
             onblur="if(this.value.trim().toUpperCase()!=='${c.nom}')
               api('/api/classe/${c.id}','PUT',{nom:this.value}).then(()=>toast('Renommée'))">
      <span style="flex:1"></span>
      <button class="btn btn-sm btn-danger" onclick="deleteClasse(${c.id},'${c.nom}',${filiereId},'${filiereNom}')">Supprimer</button>
    </div>`).join('')
    : '<div style="color:var(--text3);font-size:12px;padding:8px 0">Aucune classe — filière transversale.</div>';
  openModal(`
    <div class="modal-title">Classes — ${filiereNom}</div>
    <div style="margin-bottom:12px">${rows}</div>
    <div style="display:flex;gap:8px;align-items:center;padding-top:10px;border-top:1px solid var(--border)">
      <input id="nc-nom" placeholder="Nom (ex: 3J)" style="width:130px"
             onkeydown="if(event.key==='Enter')doAddClasse(${filiereId},'${filiereNom}')">
      <button class="btn btn-success" onclick="doAddClasse(${filiereId},'${filiereNom}')">+ Ajouter</button>
    </div>
    <div class="modal-footer"><button class="btn" onclick="closeModal();window.location.href=window.location.href">Fermer</button></div>`);
}

function doAddClasse(filiereId, filiereNom) {
  const nom = (document.getElementById('nc-nom').value||'').trim().toUpperCase();
  if(!nom) return toast('Nom requis','err');
  api('/api/classe','POST',{filiere_id:filiereId,nom}).then(r=>{
    if(!r.ok) return toast('Erreur','err');
    toast(`Classe ${nom} ajoutée`);
    document.getElementById('nc-nom').value='';
    fetch(`/api/classes/${filiereId}`).then(r=>r.json()).then(cls=>renderClassesModal(filiereId,filiereNom,cls));
  });
}

function deleteClasse(id, nom, filiereId, filiereNom) {
  if(!confirm(`Supprimer la classe "${nom}" ?\nLes attributions seront conservées.`)) return;
  api(`/api/classe/${id}`,'DELETE').then(r=>{
    if(!r.ok) return toast('Erreur','err');
    toast(`${nom} supprimée`);
    fetch(`/api/classes/${filiereId}`).then(r=>r.json()).then(cls=>renderClassesModal(filiereId,filiereNom,cls));
  });
}

// ── Set nb groupes ─────────────────────────────────────────────────────────────
function setGroupes(coursId, coursNom, currentNb) {
  openModal(`
    <div class="modal-title">Groupes — ${coursNom}</div>
    <div class="form-group">
      <label class="form-label">Nombre de groupes prévus</label>
      <div style="display:flex;align-items:center;gap:14px;margin:8px 0">
        <button class="btn" onclick="document.getElementById('sg-nb').value=Math.max(1,parseInt(document.getElementById('sg-nb').value||1)-1)">−</button>
        <input id="sg-nb" type="number" min="1" max="30" value="${currentNb}" style="width:65px;text-align:center;font-size:20px;font-weight:600">
        <button class="btn" onclick="document.getElementById('sg-nb').value=parseInt(document.getElementById('sg-nb').value||1)+1">+</button>
      </div>
      <div class="form-hint">Chaque groupe génère une case. Les cases vides apparaissent en pointillé rouge.</div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="doSetGroupes(${coursId})">Confirmer</button>
    </div>`);
  setTimeout(()=>document.getElementById('sg-nb').focus(),80);
}

function doSetGroupes(coursId) {
  const nb = Math.max(1, parseInt(document.getElementById('sg-nb').value)||1);
  api(`/api/cours/${coursId}`,'PUT',{nb_groupes:nb}).then(r=>{
    if(!r.ok) return toast('Erreur','err');
    toast(`${nb} groupe(s) configuré(s)`); closeModal(); setTimeout(()=>window.location.href=window.location.href,300);
  });
}

// ── Nb élèves ──────────────────────────────────────────────────────────────────
function saveEleves(coursId, val, annee) {
  const nb = parseInt(val);
  if(isNaN(nb)||nb<0) return;
  api('/api/eleves','POST',{cours_id:coursId,nb_eleves:nb,annee}).then(r=>{
    if(r.ok) toast('Élèves mis à jour');
  });
}

// ── NTPP catégories ───────────────────────────────────────────────────────────
function addNtppCat(signe=1, parentId=null) {
  openModal(`
    <div class="modal-title">${signe===1?'+ Nouvelle catégorie':parentId?'+ École partenaire':'− Nouvelle catégorie négative'}</div>
    <div class="form-group"><label class="form-label">Nom</label>
      <input id="nc-n" placeholder="${parentId?'ex: LYSEM':'ex: Complémentaire spécial'}" style="width:100%"></div>
    ${!parentId?`<div class="form-group"><label class="form-label">Signe</label>
      <select id="nc-s"><option value="1" ${signe===1?'selected':''}>+ (ajoute des heures)</option>
      <option value="-1" ${signe===-1?'selected':''}>− (soustrait des heures)</option></select></div>`:''}
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="doAddNtppCat(${signe},${parentId||'null'})">Créer</button>
    </div>`);
  setTimeout(()=>document.getElementById('nc-n').focus(),80);
}

function doAddNtppCat(signe, parentId) {
  const nom = document.getElementById('nc-n').value.trim();
  const s = document.getElementById('nc-s') ? parseInt(document.getElementById('nc-s').value) : signe;
  if(!nom) return toast('Nom requis','err');
  api('/api/ntpp/categorie','POST',{nom,signe:s,parent_id:parentId})
    .then(r=>{ if(!r.ok) return toast('Erreur','err'); closeModal(); toast('Catégorie ajoutée'); setTimeout(()=>window.location.href=window.location.href,300); });
}

function editNtppCat(id, nom, signe) {
  openModal(`
    <div class="modal-title">Modifier la catégorie</div>
    <div class="form-group"><label class="form-label">Nom</label><input id="en-n" value="${nom}" style="width:100%"></div>
    <div class="form-group"><label class="form-label">Signe</label>
      <select id="en-s"><option value="1" ${signe===1?'selected':''}>+ (ajoute)</option>
      <option value="-1" ${signe===-1?'selected':''}>− (soustrait)</option></select></div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="doEditNtppCat(${id})">Enregistrer</button>
    </div>`);
  setTimeout(()=>document.getElementById('en-n').focus(),80);
}

function doEditNtppCat(id) {
  api(`/api/ntpp/categorie/${id}`,'PUT',{
    nom: document.getElementById('en-n').value.trim(),
    signe: parseInt(document.getElementById('en-s').value),
  }).then(r=>{ if(!r.ok) return toast('Erreur','err'); closeModal(); toast('Mis à jour'); setTimeout(()=>window.location.href=window.location.href,300); });
}

function deleteNtppCat(id, nom) {
  if(!confirm(`Supprimer la catégorie "${nom}" et ses valeurs ?`)) return;
  api(`/api/ntpp/categorie/${id}`,'DELETE').then(()=>{toast('Supprimée');setTimeout(()=>window.location.href=window.location.href,300)});
}

function saveNtppVal(catId, val, annee) {
  api('/api/ntpp/valeur','POST',{categorie_id:catId,valeur:parseFloat(val)||0,annee});
}

// ── Coord catégories ──────────────────────────────────────────────────────────
function manageCoordCats() {
  fetch('/api/coord/categories').then(r=>r.json()).then(cats=>{
    renderCoordCatsModal(cats);
  });
}

function renderCoordCatsModal(cats) {
  const rows = cats.map(c=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="width:12px;height:12px;border-radius:50%;background:${c.couleur};flex-shrink:0"></span>
      <span style="flex:1;font-size:12px;font-weight:500">${c.nom}</span>
      <button class="btn btn-sm" onclick="renameCoordCat(${c.id},'${c.nom}')">Renommer</button>
      <button class="btn btn-sm btn-danger" onclick="deleteCoordCat(${c.id},'${c.nom}')">✕</button>
    </div>`).join('') || '<div style="color:var(--text3)">Aucune catégorie</div>';
  openModal(`
    <div class="modal-title">Catégories de coordination</div>
    <div style="margin-bottom:12px">${rows}</div>
    <div style="padding-top:10px;border-top:1px solid var(--border)">
      <div style="font-size:12px;font-weight:500;margin-bottom:8px">Nouvelle catégorie</div>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="ncc-n" placeholder="Nom…" style="flex:1">
        <input type="color" id="ncc-c" value="#888780" style="width:34px;height:28px;padding:2px;border:1px solid var(--border2);border-radius:4px">
        <button class="btn btn-success" onclick="doAddCoordCat()">+ Ajouter</button>
      </div>
    </div>
    <div class="modal-footer"><button class="btn" onclick="closeModal();window.location.href=window.location.href">Fermer</button></div>`);
}

function doAddCoordCat() {
  const nom = document.getElementById('ncc-n').value.trim();
  const couleur = document.getElementById('ncc-c').value;
  if(!nom) return toast('Nom requis','err');
  api('/api/coord/categorie','POST',{nom,couleur}).then(r=>{
    if(!r.ok) return toast('Erreur','err');
    toast('Ajoutée');
    fetch('/api/coord/categories').then(r=>r.json()).then(renderCoordCatsModal);
  });
}

function renameCoordCat(id, currentNom) {
  const nom = prompt('Nouveau nom :',currentNom);
  if(!nom||nom===currentNom) return;
  api(`/api/coord/categorie/${id}`,'PUT',{nom}).then(r=>{
    if(!r.ok) return toast('Erreur','err');
    toast('Renommée');
    fetch('/api/coord/categories').then(r=>r.json()).then(renderCoordCatsModal);
  });
}

function deleteCoordCat(id, nom) {
  if(!confirm(`Supprimer "${nom}" ?`)) return;
  api(`/api/coord/categorie/${id}`,'DELETE').then(r=>{
    if(!r.ok) return toast('Erreur','err');
    toast('Supprimée');
    fetch('/api/coord/categories').then(r=>r.json()).then(renderCoordCatsModal);
  });
}

// ── Années ────────────────────────────────────────────────────────────────────
function manageAnnees(annees, anneeActive) {
  function nextYr(lbl){ const p=lbl.split('-'); return p.length===2?`${+p[0]+1}-${+p[1]+1}`:''; }
  const rows = annees.map(a=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="flex:1;font-weight:${a.actif?'600':'400'};color:${a.actif?'var(--blue-dark)':'var(--text)'}">
        ${a.label}${a.actif?' <span style="font-size:10px;background:var(--blue-pale);color:var(--blue-dark);padding:1px 7px;border-radius:10px;margin-left:4px">active</span>':''}
      </span>
      ${!a.actif?`<button class="btn btn-sm" onclick="api('/api/annee','POST',{label:'${a.label}'}).then(()=>{toast('Activée');closeModal();window.location.href=window.location.href})">Activer</button>`:''}
      ${!a.actif?`<button class="btn btn-sm btn-danger" onclick="if(confirm('Supprimer ${a.label} et toutes ses données ?'))api('/api/annee/${a.label}','DELETE').then(()=>{toast('Supprimée');closeModal();window.location.href=window.location.href})">Supprimer</button>`:''}
    </div>`).join('');
  openModal(`
    <div class="modal-title">Années scolaires</div>
    <div style="margin-bottom:12px">${rows}</div>
    <div style="padding-top:12px;border-top:1px solid var(--border)">
      <div style="font-size:12px;font-weight:500;margin-bottom:10px">Nouvelle année</div>
      <div class="form-group"><label class="form-label">Année</label>
        <input id="na-lbl" placeholder="ex: 2026-2027" value="${nextYr(anneeActive)}" style="width:160px"></div>
      <div class="form-group"><label class="form-label">Copier depuis</label>
        <select id="na-src"><option value="">— partir de zéro —</option>
        ${annees.map(a=>`<option value="${a.label}" ${a.actif?'selected':''}>${a.label}</option>`).join('')}
        </select></div>
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
        <input type="checkbox" id="na-dup" checked> Copier toutes les attributions
      </label>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Fermer</button>
      <button class="btn btn-primary" onclick="doNouvelleAnnee()">Créer l'année</button>
    </div>`);
}

function doNouvelleAnnee() {
  const label = document.getElementById('na-lbl').value.trim();
  if(!/^\d{4}-\d{4}$/.test(label)) return toast('Format invalide (ex: 2026-2027)','err');
  const source = document.getElementById('na-src').value;
  const dup = document.getElementById('na-dup').checked;
  api('/api/annee/nouvelle','POST',{label,source,dupliquer:dup})
    .then(r=>{ if(!r.ok) return toast('Erreur','err'); toast(`Année ${label} créée`); closeModal(); setTimeout(()=>window.location.href=window.location.href,800); });
}

// ── Backup / Restore ──────────────────────────────────────────────────────────
function backupDB() { toast('Téléchargement…'); window.location.href='/api/backup'; }

function restoreDB() {
  openModal(`
    <div class="modal-title">Restaurer une sauvegarde</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">
      Sélectionnez un fichier <strong>.db</strong> sauvegardé.<br>
      <span style="color:var(--red)">Attention : remplace toutes les données actuelles.</span>
    </div>
    <input type="file" id="restore-f" accept=".db">
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Annuler</button>
      <button class="btn btn-danger" onclick="doRestore()">Restaurer</button>
    </div>`);
}

function doRestore() {
  const file = document.getElementById('restore-f').files[0];
  if(!file) return toast('Sélectionnez un fichier .db','err');
  if(!confirm('Confirmer ? Les données actuelles seront remplacées.')) return;
  const form = new FormData(); form.append('file',file);
  fetch('/api/restore',{method:'POST',body:form}).then(r=>r.json()).then(d=>{
    if(d.ok){toast('Restauré');closeModal();setTimeout(()=>window.location.href=window.location.href,1500);}
    else toast(d.error||'Erreur','err');
  });
}

// ── Import personnel ───────────────────────────────────────────────────────────
function importPersonnel() { document.getElementById('import-f').click(); }

function doImportPersonnel(input) {
  const form = new FormData(); form.append('file', input.files[0]);
  fetch('/api/personnel/import',{method:'POST',body:form}).then(r=>r.json()).then(d=>{
    if(d.ok) toast(`${d.added} ajouté(s), ${d.updated} mis à jour`);
    else toast(d.error||'Erreur','err');
    setTimeout(()=>window.location.href=window.location.href,1000);
  });
}



// ── Tooltip prof au survol ─────────────────────────────────────────────────────
let _tooltipTimer = null;
let _tooltipEl    = null;

function getOrCreateTooltip() {
  if (!_tooltipEl) {
    _tooltipEl = document.createElement('div');
    _tooltipEl.id = 'prof-tooltip';
    _tooltipEl.style.cssText = 'position:fixed;z-index:999;background:var(--text);color:#fff;padding:8px 12px;border-radius:var(--radius);font-size:11px;pointer-events:none;display:none;max-width:260px;line-height:1.6;box-shadow:0 4px 12px rgba(0,0,0,.2)';
    document.body.appendChild(_tooltipEl);
  }
  return _tooltipEl;
}

function initTooltips() {
  document.querySelectorAll('.pill[data-attr-id]').forEach(pill => {
    if (pill._tooltip) return;
    pill._tooltip = true;

    pill.addEventListener('mouseenter', e => {
      const txt = pill.textContent.replace('x','').replace('×','').trim();
      const acro = txt.split(/\s+/)[0];
      if (!acro || acro.length < 2) return;

      _tooltipTimer = setTimeout(() => {
        const annee = new URLSearchParams(window.location.search).get('annee') || '2025-2026';
        fetch('/api/personnel/search?q=' + encodeURIComponent(acro))
          .then(r => r.json()).then(results => {
            const prof = results.find(p => p.acronyme === acro);
            if (!prof) return;
            fetch('/api/synthese/' + prof.id + '?annee=' + annee)
              .then(r => r.json()).then(d => {
                const total = d.attributions.reduce((s,a) => s + (a.h||0), 0);
                const titu  = d.titulariats.map(t => t.filiere + '/' + t.classe).join(', ');
                const tip   = getOrCreateTooltip();
                tip.innerHTML =
                  '<div style="font-weight:600;font-size:12px;margin-bottom:4px">' + acro + '</div>' +
                  (prof.prenom ? '<div style="color:#ccc;font-size:10px">' + prof.prenom + ' ' + prof.nom + '</div>' : '') +
                  '<div style="margin-top:5px;border-top:1px solid rgba(255,255,255,.2);padding-top:5px">' +
                  '<span style="color:#a8d8a8">Total : ' + total + 'h</span></div>' +
                  (titu ? '<div style="color:#fac775;font-size:10px;margin-top:3px">Titulaire : ' + titu + '</div>' : '');
                const rect = pill.getBoundingClientRect();
                tip.style.left    = Math.min(rect.left, window.innerWidth - 270) + 'px';
                tip.style.top     = (rect.bottom + 6) + 'px';
                tip.style.display = 'block';
              });
          });
      }, 500);
    });

    pill.addEventListener('mouseleave', () => {
      clearTimeout(_tooltipTimer);
      const tip = getOrCreateTooltip();
      tip.style.display = 'none';
    });
  });
}

document.addEventListener('DOMContentLoaded', initTooltips);

// ── Nominations ────────────────────────────────────────────────────────────────
function manageNominations(pid, acro) {
  fetch('/api/nominations/' + pid).then(r=>r.json()).then(noms => {
    renderNominationsModal(pid, acro, noms);
  });
}

function renderNominationsModal(pid, acro, noms) {
  const types = ['FC','OPT','TT','EDPH','COORD','AC'];
  const rows = noms.length ? noms.map(n => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="flex:1;font-size:12px"><strong>${n.heures}h</strong> ${n.matiere}
        <span class="tag tag-${n.type_cours.toLowerCase()}" style="margin-left:4px">${n.type_cours}</span>
      </span>
      <button class="btn btn-sm btn-danger" onclick="delNomination(${n.id},${pid},'${acro}')">✕</button>
    </div>`).join('')
    : '<div style="color:var(--text3);font-size:12px;padding:8px 0">Aucune nomination encodée.</div>';

  // Calc total
  const total = noms.reduce((s,n) => s + (n.heures||0), 0);
  const totalLine = noms.length ? `<div style="font-size:11px;color:var(--text3);margin-bottom:10px">Total nommé : <strong>${total}h</strong></div>` : '';

  openModal(`
    <div class="modal-title">Nominations — ${acro}</div>
    <div style="margin-bottom:10px">${totalLine}${rows}</div>
    <div style="padding-top:10px;border-top:1px solid var(--border)">
      <div style="font-size:12px;font-weight:500;margin-bottom:8px">Ajouter une nomination</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input id="nom-mat" placeholder="Matière (ex: Mathématique)" style="width:180px">
        <input id="nom-h" type="number" step="0.5" placeholder="h" style="width:60px">
        <select id="nom-type">${types.map(t=>`<option>${t}</option>`).join('')}</select>
        <button class="btn btn-success" onclick="doAddNomination(${pid},'${acro}')">+ Ajouter</button>
      </div>
    </div>
    <div class="modal-footer"><button class="btn" onclick="closeModal()">Fermer</button></div>`);
  setTimeout(()=>document.getElementById('nom-mat')?.focus(),80);
}

function doAddNomination(pid, acro) {
  const matiere = document.getElementById('nom-mat').value.trim();
  const heures  = parseFloat(document.getElementById('nom-h').value) || 0;
  const type    = document.getElementById('nom-type').value;
  if (!matiere) return toast('Matière requise','err');
  api('/api/nomination','POST',{personnel_id:pid, matiere, heures, type_cours:type})
    .then(r => {
      if (!r.ok) return toast('Erreur','err');
      toast('Nomination ajoutée');
      fetch('/api/nominations/' + pid).then(r=>r.json()).then(noms=>renderNominationsModal(pid,acro,noms));
    });
}

function delNomination(nid, pid, acro) {
  api('/api/nomination/' + nid, 'DELETE').then(() => {
    toast('Supprimée');
    fetch('/api/nominations/' + pid).then(r=>r.json()).then(noms=>renderNominationsModal(pid,acro,noms));
  });
}

// ── Commentaire classe ─────────────────────────────────────────────────────────
function editCommentaireClasse(id, nom, current) {
  openModal(`
    <div class="modal-title">Commentaire — ${nom}</div>
    <div class="form-group">
      <label class="form-label">Commentaire (ex: Immersion, Projet théâtre…)</label>
      <input id="cc-txt" value="${current}" placeholder="Texte libre…" style="width:100%">
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Annuler</button>
      <button class="btn btn-danger btn-sm" onclick="doEditCommentaireClasse(${id},'')">Effacer</button>
      <button class="btn btn-primary" onclick="doEditCommentaireClasse(${id},document.getElementById('cc-txt').value)">Enregistrer</button>
    </div>`);
  setTimeout(()=>document.getElementById('cc-txt').focus(),80);
}

function doEditCommentaireClasse(id, val) {
  api(`/api/classe/${id}`,'PUT',{commentaire: val.trim()})
    .then(r => {
      if(!r.ok) return toast('Erreur','err');
      closeModal(); toast('Commentaire mis à jour');
      setTimeout(()=>window.location.href=window.location.href, 300);
    });
}
