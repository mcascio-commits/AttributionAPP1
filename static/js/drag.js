// ═══════════════════════════════════════════════════════════════
//  DRAG & DROP — v3
//  1. Profs : glisser une pastille vers n'importe quelle case
//  2. Cours : glisser une ligne pour réordonner
// ═══════════════════════════════════════════════════════════════

let dragAttrId  = null;
let dragCoursId = null;

document.addEventListener('DOMContentLoaded', () => {
  initDragProfs();
  initDragCours();
});

// ─────────────────────────────────────────────────────────────
//  DRAG PROFS
// ─────────────────────────────────────────────────────────────
function initDragProfs() {
  // Pills → draggable
  document.querySelectorAll('.pill[data-attr-id]').forEach(pill => {
    pill.draggable = true;
    pill.style.cursor = 'grab';

    pill.addEventListener('dragstart', e => {
      dragAttrId = parseInt(pill.dataset.attrId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragAttrId));
      e.stopPropagation(); // don't trigger cours drag
      setTimeout(() => pill.style.opacity = '.4', 0);
    });

    pill.addEventListener('dragend', () => {
      pill.style.opacity = '1';
      dragAttrId = null;
      document.querySelectorAll('.drop-hi').forEach(el => {
        el.classList.remove('drop-hi');
        el.style.outline = '';
      });
    });
  });

  // Drop zones — only grp-slot divs and td[data-attr-id]
  const dropZones = [
    ...document.querySelectorAll('.grp-slot'),
    ...document.querySelectorAll('td[data-attr-id]'),
  ];

  dropZones.forEach(zone => {
    zone.addEventListener('dragover', e => {
      if (!dragAttrId) return; // not a prof drag
      e.preventDefault();
      e.stopPropagation();
      zone.style.outline = '2px solid var(--blue)';
      zone.style.outlineOffset = '-2px';
      zone.classList.add('drop-hi');
    });

    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) {
        zone.style.outline = '';
        zone.classList.remove('drop-hi');
      }
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      zone.style.outline = '';
      zone.classList.remove('drop-hi');
      if (!dragAttrId) return;

      // Case 1: swap with existing pill
      const targetPill = zone.querySelector('.pill[data-attr-id]');
      const targetId = targetPill ? parseInt(targetPill.dataset.attrId) : null;

      if (targetId && targetId !== dragAttrId) {
        api('/api/attribution/swap', 'POST', {id1: dragAttrId, id2: targetId})
          .then(r => {
            if (r.ok) { toast('Échangé'); setTimeout(() => location.reload(), 300); }
            else toast('Erreur','err');
          });
        dragAttrId = null;
        return;
      }

      // Case 2: move to empty slot
      if (!targetId) {
        const btn = zone.querySelector('.add-pill');
        if (!btn) { dragAttrId = null; return; }
        const onclick = btn.getAttribute('onclick') || '';
        const m = onclick.match(/addProfModal\((\d+),(\d+),(null|\d+)/);
        if (!m) { dragAttrId = null; return; }
        api('/api/attribution/move', 'POST', {
          attr_id:    dragAttrId,
          cours_id:   parseInt(m[1]),
          groupe_num: parseInt(m[2]),
          classe_id:  m[3] === 'null' ? null : parseInt(m[3]),
        }).then(r => {
          if (r.ok) { toast('Déplacé'); setTimeout(() => location.reload(), 300); }
          else toast('Erreur','err');
        });
      }
      dragAttrId = null;
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  DRAG COURS (réordonner)
// ─────────────────────────────────────────────────────────────
function initDragCours() {
  document.querySelectorAll('.tbl tbody tr').forEach(tr => {
    const editBtn = tr.querySelector('[onclick*="editCours"]');
    if (!editBtn) return;
    const m = (editBtn.getAttribute('onclick') || '').match(/editCours\((\d+)/);
    if (!m) return;
    const coursId = parseInt(m[1]);
    tr.dataset.coursId = coursId;
    tr.draggable = true;

    // Add drag handle
    const firstTd = tr.querySelector('td');
    if (firstTd && !firstTd.querySelector('.drag-handle')) {
      const h = document.createElement('span');
      h.className = 'drag-handle';
      h.textContent = '⠿';
      h.style.cssText = 'color:var(--gray-light);margin-right:5px;cursor:grab;font-size:13px;user-select:none;display:inline-block';
      firstTd.insertBefore(h, firstTd.firstChild);
    }

    tr.addEventListener('dragstart', e => {
      if (dragAttrId) return; // prof drag takes priority
      dragCoursId = coursId;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'cours-' + coursId);
      setTimeout(() => tr.style.opacity = '.4', 0);
    });

    tr.addEventListener('dragend', () => {
      tr.style.opacity = '1';
      dragCoursId = null;
      document.querySelectorAll('.cours-drop').forEach(el => {
        el.classList.remove('cours-drop');
        el.style.borderTop = '';
      });
    });

    tr.addEventListener('dragover', e => {
      if (!dragCoursId || dragCoursId === coursId) return;
      if (dragAttrId) return; // prof drag takes priority
      e.preventDefault();
      e.stopPropagation();
      tr.style.borderTop = '2px solid var(--blue)';
      tr.classList.add('cours-drop');
    });

    tr.addEventListener('dragleave', e => {
      if (!tr.contains(e.relatedTarget)) {
        tr.style.borderTop = '';
        tr.classList.remove('cours-drop');
      }
    });

    tr.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      tr.style.borderTop = '';
      tr.classList.remove('cours-drop');
      if (!dragCoursId || dragCoursId === coursId || dragAttrId) return;

      // Collect all sibling rows in order
      const tbody = tr.closest('tbody');
      if (!tbody) return;
      const allRows = [...tbody.querySelectorAll('tr[data-cours-id]')];
      const ids = allRows.map(r => parseInt(r.dataset.coursId)).filter(Boolean);

      const fromIdx = ids.indexOf(dragCoursId);
      const toIdx   = ids.indexOf(coursId);
      if (fromIdx === -1 || toIdx === -1) return;

      ids.splice(fromIdx, 1);
      ids.splice(toIdx, 0, dragCoursId);

      api('/api/cours/reorder', 'POST', ids.map((id, i) => ({id, ordre: i})))
        .then(r => {
          if (r.ok) { toast('Ordre mis à jour'); setTimeout(() => location.reload(), 300); }
          else toast('Erreur','err');
        });
      dragCoursId = null;
    });
  });
}
