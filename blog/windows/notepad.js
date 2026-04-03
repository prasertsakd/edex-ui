/* ===================================================
   eDEX-UI Web Blog — Notepad Window
   =================================================== */

'use strict';

let _notepadCounter = 0;

function openNotepad(initialText) {
    _notepadCounter++;
    const winId = `np_${_notepadCounter}`;
    const title = _notepadCounter > 1 ? `NOTEPAD [${_notepadCounter}]` : 'NOTEPAD.TXT';

    const bodyHtml = `
        <div class="notepad_toolbar">
            <button onclick="_notepadCopy('${winId}')">[ COPY ]</button>
            <button onclick="_notepadClear('${winId}')">[ CLEAR ]</button>
            <button onclick="_notepadSave('${winId}')">[ SAVE ]</button>
            <span style="margin-left:auto; font-size:0.9vh; opacity:0.4; font-family:var(--font_main_light);"
                  id="np_status_${winId}">READY</span>
        </div>
        <textarea
            id="np_area_${winId}"
            class="notepad_area"
            spellcheck="false"
            placeholder="// START TYPING..."
        >${initialText || ''}</textarea>
    `;

    new BlogWindow({
        title,
        bodyHtml,
        width:    '520px',
        height:   '420px',
        minWidth: '320px',
    });

    // Focus textarea after open animation
    setTimeout(() => {
        const ta = document.getElementById(`np_area_${winId}`);
        if (ta) ta.focus();
    }, 200);
}

function _notepadSetStatus(winId, msg, ms) {
    const el = document.getElementById(`np_status_${winId}`);
    if (!el) return;
    el.textContent = msg;
    if (ms) setTimeout(() => { if (el) el.textContent = 'READY'; }, ms);
}

function _notepadCopy(winId) {
    const ta = document.getElementById(`np_area_${winId}`);
    if (!ta) return;
    navigator.clipboard.writeText(ta.value)
        .then(() => _notepadSetStatus(winId, 'COPIED!', 1500))
        .catch(() => {
            // Fallback
            ta.select();
            document.execCommand('copy');
            _notepadSetStatus(winId, 'COPIED!', 1500);
        });
}

function _notepadClear(winId) {
    const ta = document.getElementById(`np_area_${winId}`);
    if (ta) { ta.value = ''; ta.focus(); }
    _notepadSetStatus(winId, 'CLEARED', 1000);
}

function _notepadSave(winId) {
    const ta = document.getElementById(`np_area_${winId}`);
    if (!ta) return;
    const blob = new Blob([ta.value], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `note_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    _notepadSetStatus(winId, 'SAVED!', 1500);
}

// Allow dragging text/files onto notepad to read them
function _notepadInitDrop(winId) {
    const ta = document.getElementById(`np_area_${winId}`);
    if (!ta) return;
    ta.addEventListener('dragover', e => e.preventDefault());
    ta.addEventListener('drop', e => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            ta.value = ev.target.result;
            _notepadSetStatus(winId, `LOADED: ${file.name}`, 2000);
        };
        reader.readAsText(file);
    });
}

// Expose globally
window.openNotepad = openNotepad;
