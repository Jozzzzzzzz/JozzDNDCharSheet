// App-wide dialogs (modal + toast) and plain-English Firebase errors.
// Moved here from the removed DM portal; the dm* names are kept because core.js wraps them as
// appToast / appAlert / appConfirm / appPrompt.

// ─── Friendly error/status messages ────────────────────────────────────────
// Turns raw Firestore/network errors into plain-English explanations so the
// Admin page never shows cryptic red error text. Shared via window.
function friendlyFirebaseError(e) {
  const code = (e && e.code) ? String(e.code) : '';
  const msg = (e && e.message) ? String(e.message) : String(e || '');
  const low = (code + ' ' + msg).toLowerCase();

  if (low.includes('index') && (low.includes('not ready') || low.includes('building'))) {
    return '⏳ Setting things up — the database is finishing a one-time setup for this view. Try again in a few minutes (this only happens once).';
  }
  if (low.includes('requires') && low.includes('index')) {
    return '⏳ This view needs a quick one-time database setup. It usually finishes within a few minutes — try again shortly.';
  }
  if (code === 'permission-denied' || low.includes('permission')) {
    return 'You don\'t have access to this. If it should work, make sure the latest security rules are deployed.';
  }
  if (code === 'unavailable' || low.includes('offline') || low.includes('network')) {
    return 'Can\'t reach the cloud right now — check your internet connection and try again.';
  }
  if (code === 'unauthenticated' || low.includes('unauthenticated')) {
    return 'You\'re signed out. Sign in again and retry.';
  }
  // Fallback — still readable, no raw stack
  return 'Something went wrong loading this. Try again in a moment.';
}
window.friendlyFirebaseError = friendlyFirebaseError;

// ─── In-app modal + toast (replaces native prompt/alert/confirm) ────────────
// Themed to match the player popup language. Promise-based so call sites read
// like `const v = await dmModal({...})`. Resolves null on cancel.
function dmEnsureModalRoot() {
  let root = document.getElementById('dmModalRoot');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'dmModalRoot';
  document.body.appendChild(root);
  return root;
}

function dmModal(opts) {
  // opts: { title, message, input (bool), placeholder, value, confirmText,
  //         cancelText, danger (bool), inputType }
  const o = opts || {};
  return new Promise(resolve => {
    const root = dmEnsureModalRoot();
    const backdrop = document.createElement('div');
    backdrop.className = 'dm-modal-backdrop';

    const wantsInput = !!o.input;
    backdrop.innerHTML = `
      <div class="dm-modal" role="dialog" aria-modal="true">
        ${o.title ? `<h3 class="dm-modal-title">${escapeHtml(o.title)}</h3>` : ''}
        ${o.message ? `<p class="dm-modal-message">${escapeHtml(o.message)}</p>` : ''}
        ${wantsInput ? `<input class="dm-modal-input" type="${escapeHtml(o.inputType || 'text')}" placeholder="${escapeHtml(o.placeholder || '')}" value="${escapeHtml(o.value || '')}">` : ''}
        <div class="dm-modal-actions">
          ${o.cancelText === null ? '' : `<button class="dm-action-btn dm-modal-cancel">${escapeHtml(o.cancelText || 'Cancel')}</button>`}
          <button class="dm-action-btn ${o.danger ? 'dm-danger-btn' : 'accent-contrast-bg'} dm-modal-confirm">${escapeHtml(o.confirmText || 'OK')}</button>
        </div>
      </div>
    `;
    root.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));

    const input = backdrop.querySelector('.dm-modal-input');
    if (input) { input.focus(); input.select(); }

    const close = (result) => {
      backdrop.classList.remove('show');
      setTimeout(() => backdrop.remove(), 200);
      resolve(result);
    };

    const cancelBtn = backdrop.querySelector('.dm-modal-cancel');
    if (cancelBtn) cancelBtn.onclick = () => close(null);
    backdrop.querySelector('.dm-modal-confirm').onclick = () =>
      close(wantsInput ? (input ? input.value : '') : true);
    backdrop.onclick = (e) => { if (e.target === backdrop) close(null); };
    backdrop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter' && wantsInput) { e.preventDefault(); close(input ? input.value : ''); }
    });
  });
}

function dmToast(message, type) {
  const root = dmEnsureModalRoot();
  const t = document.createElement('div');
  t.className = `dm-toast dm-toast-${type || 'info'}`;
  t.textContent = message;
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}

window.dmModal = dmModal;
window.dmToast = dmToast;
