/**
 * Duet Karaoke Maker - Admin Dashboard Controller
 * 
 * Secure management of all user song credits, real-time statistics,
 * instant search, and one-click credit top-up.
 * All credentials are authenticated server-side with salted cryptography.
 */

const ADMIN_CONFIG = {
  supabaseUrl: 'https://odvgmniswfpahwkqwtcw.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdmdtbmlzd2ZwYWh3a3F3dGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MzE4MTksImV4cCI6MjEwNzEwNzgxOX0.dl3gytRtsokArFxN_VH2nMABfAF35757ghOnm-dYESs',
  whatsappNumber: '919663396058'
};

let supabaseAdmin = null;
let allUsers = [];
let currentFilter = 'all'; // 'all' | 'zero' | 'active'
let currentSearch = '';

// Initialize Supabase client
function initSupabase() {
  if (typeof supabase !== 'undefined' && ADMIN_CONFIG.supabaseUrl && ADMIN_CONFIG.anonKey) {
    try {
      supabaseAdmin = supabase.createClient(ADMIN_CONFIG.supabaseUrl, ADMIN_CONFIG.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'duet_karaoke_admin_session'
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-client-info': 'duet-karaoke-maker-admin',
            'x-connection-pool': 'supavisor-transaction-6543'
          }
        }
      });
    } catch (e) {
      console.warn('[Admin] Note on Supabase client:', e);
    }
  }
}

// Check session with server
async function checkAdminSession() {
  try {
    const res = await fetch('/api/admin/session', {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated) {
        unlockAdminPanel(data.email || 'Admin');
        return true;
      }
    }
  } catch (_) {}
  lockAdminPanel();
  return false;
}

function getAuthHeaders() {
  const token = sessionStorage.getItem('karaoke_admin_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Admin-Token'] = token;
  }
  return headers;
}

function unlockAdminPanel(modeLabel = 'Verified Admin') {
  sessionStorage.setItem('karaoke_admin_unlocked', 'true');
  const overlay = document.getElementById('admin-gate-overlay');
  const main = document.getElementById('admin-main');
  const actions = document.getElementById('admin-header-actions');
  const tag = document.getElementById('admin-auth-tag');

  if (overlay) overlay.style.display = 'none';
  if (main) main.style.display = 'block';
  if (actions) actions.style.display = 'flex';
  if (tag) tag.textContent = escapeHtml(modeLabel);
  loadUsers();
}

async function lockAdminPanel() {
  sessionStorage.removeItem('karaoke_admin_unlocked');
  sessionStorage.removeItem('karaoke_admin_token');
  try {
    await fetch('/api/admin/logout', { method: 'POST' });
  } catch (_) {}
  if (supabaseAdmin) {
    try { await supabaseAdmin.auth.signOut(); } catch (_) {}
  }
  const overlay = document.getElementById('admin-gate-overlay');
  const main = document.getElementById('admin-main');
  const actions = document.getElementById('admin-header-actions');
  const pwdInput = document.getElementById('admin-password-input');

  if (overlay) overlay.style.display = 'flex';
  if (main) main.style.display = 'none';
  if (actions) actions.style.display = 'none';
  if (pwdInput) pwdInput.value = '';
}

// Fetch all users from Supabase or server API
async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading users securely from database...</td></tr>';
  }

  try {
    let users = null;
    let error = null;

    // 1. Try secure Postgres RPC function first
    if (supabaseAdmin) {
      try {
        const rpcRes = await supabaseAdmin.rpc('admin_get_all_users');
        if (!rpcRes.error && Array.isArray(rpcRes.data)) {
          users = rpcRes.data;
        } else {
          // 2. Direct table select fallback
          const tableRes = await supabaseAdmin
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (!tableRes.error && Array.isArray(tableRes.data)) {
            users = tableRes.data;
          } else if (tableRes.error) {
            error = tableRes.error;
          }
        }
      } catch (sbErr) {
        error = sbErr;
      }
    }

    if (error && !users) {
      console.warn('[Admin] Query notice:', error);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="table-empty">
              <div style="margin-bottom: 8px;">Note: Database profiles table is empty or awaiting setup.</div>
              <div style="font-size: 0.8rem; color: #8b9bb4;">
                Run <code>supabase_security_setup.sql</code> in your Supabase SQL editor to activate table & RLS policies.
              </div>
            </td>
          </tr>`;
      }
      allUsers = [];
      updateMetrics([]);
      return;
    }

    allUsers = users || [];
    updateMetrics(allUsers);
    renderUsersTable();
  } catch (err) {
    console.error('[Admin] Fetch error:', err);
    if (tbody) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.className = 'table-empty';
      td.textContent = `Error loading users: ${err.message}`;
      tr.appendChild(td);
      tbody.innerHTML = '';
      tbody.appendChild(tr);
    }
  }
}

// Compute & display dashboard metrics
function updateMetrics(users) {
  const total = users.length;
  const zeroCredits = users.filter(u => (u.credits || 0) <= 0).length;
  const activeUsers = users.filter(u => (u.credits || 0) > 0).length;
  const totalCredits = users.reduce((acc, u) => acc + (u.credits || 0), 0);

  setText('stat-total-users', total);
  setText('stat-zero-credits', zeroCredits);
  setText('stat-active-users', activeUsers);
  setText('stat-total-credits', totalCredits);

  setText('count-filter-all', total);
  setText('count-filter-zero', zeroCredits);
  setText('count-filter-active', activeUsers);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// Render user rows with filter and search (XSS sanitized)
function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  
  let filtered = allUsers.filter(u => {
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const id = (u.id || '').toLowerCase();
      if (!email.includes(q) && !id.includes(q)) return false;
    }

    const creds = u.credits || 0;
    if (currentFilter === 'zero') return creds <= 0;
    if (currentFilter === 'active') return creds > 0;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">
          ${allUsers.length === 0 ? 'No registered users found yet.' : 'No users match your search/filter.'}
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((u, idx) => {
    const credits = u.credits ?? 0;
    let badgeClass = 'good';
    if (credits <= 0) badgeClass = 'zero';
    else if (credits === 1) badgeClass = 'low';

    const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Recent';
    const email = escapeHtml(u.email || 'No email');
    const safeUserId = escapeHtml(u.id || '');
    const rowId = `user-row-${idx}`;

    return `
      <tr data-user-id="${safeUserId}" data-email="${email}">
        <td>
          <div class="user-email-cell">
            <span class="user-email-text-full">${email}</span>
            <button type="button" class="btn-copy-mini btn-action-copy" data-copy="${email}" title="Copy Email">Copy</button>
            ${credits <= 0 ? `<a href="https://wa.me/${ADMIN_CONFIG.whatsappNumber}?text=Hi+${encodeURIComponent(u.email || '')}+your+credits+are+ready" target="_blank" rel="noopener noreferrer" class="btn-copy-mini" title="Send WhatsApp Message">WhatsApp</a>` : ''}
          </div>
        </td>
        <td>
          <div class="remaining-credits-cell">
            <span class="credit-badge ${badgeClass}" id="badge-rem-${rowId}">
              ${credits} ${credits === 1 ? 'Song' : 'Songs'}
            </span>
            <span class="sub-label">Remaining</span>
          </div>
        </td>
        <td>
          <div class="adding-credits-cell">
            <div class="adding-controls-row">
              <div class="adding-input-wrap">
                <span class="adding-plus">+</span>
                <input type="number" 
                       id="add-input-${rowId}" 
                       class="row-add-input" 
                       value="10" 
                       min="1" 
                       max="1000" 
                       data-row-id="${rowId}"
                       data-credits="${credits}"
                       title="Credits to add">
                <span class="adding-unit">Songs</span>
              </div>
              <div class="row-preset-chips" data-row-id="${rowId}" data-credits="${credits}">
                <button type="button" class="btn-preset-chip" data-preset="5">+5</button>
                <button type="button" class="btn-preset-chip active" data-preset="10">+10</button>
                <button type="button" class="btn-preset-chip" data-preset="25">+25</button>
                <button type="button" class="btn-preset-chip" data-preset="50">+50</button>
              </div>
            </div>
            <div class="row-calc-preview" id="row-calc-${rowId}">
              <span class="calc-arrow">→</span> Total after approval: <strong class="text-success">${credits + 10} Songs</strong>
            </div>
          </div>
        </td>
        <td>
          <div class="approve-action-cell">
            <button type="button" 
                    class="btn-approve-row btn-action-approve" 
                    id="btn-approve-${rowId}" 
                    data-user-id="${safeUserId}" 
                    data-email="${email}" 
                    data-row-id="${rowId}" 
                    data-credits="${credits}">
              Approve (<span id="btn-amt-${rowId}">+10</span>)
            </button>
          </div>
        </td>
        <td style="color: var(--text-muted); font-size: 0.85rem; white-space: nowrap;">
          ${escapeHtml(dateStr)}
        </td>
        <td>
          <button type="button" class="btn-reset-zero btn-action-reset" data-user-id="${safeUserId}" data-email="${email}" title="Reset credits to 0">Reset (0)</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Modify credits securely
async function setCredits(userId, email, newCredits) {
  const num = Math.max(0, parseInt(newCredits, 10));

  try {
    let success = false;

    // 1. Try secure Postgres RPC function first
    if (supabaseAdmin) {
      try {
        const rpcRes = await supabaseAdmin.rpc('admin_update_credits', {
          target_email: email,
          new_credits: num
        });
        if (!rpcRes.error && rpcRes.data?.success) {
          success = true;
        }
      } catch (_) {}
    }

    // 2. Direct table update fallback
    if (!success && supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ credits: num })
        .match(userId ? { id: userId } : { email: email });

      if (!error) success = true;
    }

    if (success) {
      showToast(`Set ${num} credits for ${email}`, 'success');
      const target = allUsers.find(u => (userId && u.id === userId) || u.email === email);
      if (target) {
        target.credits = num;
      }
      updateMetrics(allUsers);
      renderUsersTable();
    } else {
      showToast(`Could not update credits. Please verify Supabase permissions.`, 'error');
    }
  } catch (err) {
    console.error('[Admin] Update credits error:', err);
    showToast(`Error: ${err.message}`, 'error');
  }
}

// Approval State
let pendingApproval = null;

function openApprovalModal({ userId, email, remaining, added, newTotal, isReset = false }) {
  pendingApproval = { userId, email, newTotal };

  const modal = document.getElementById('credit-approval-modal');
  const title = document.getElementById('approve-modal-title');
  const icon = document.getElementById('approve-icon');
  const emailEl = document.getElementById('approve-modal-email');
  const remEl = document.getElementById('approve-remaining-val');
  const addEl = document.getElementById('approve-added-val');
  const addLabel = document.getElementById('approve-added-label');
  const mathSymbol = document.getElementById('approve-math-symbol');
  const totEl = document.getElementById('approve-total-val');
  const confirmBtn = document.getElementById('btn-confirm-approval');

  if (emailEl) emailEl.textContent = email;
  if (remEl) remEl.textContent = remaining;
  if (totEl) totEl.textContent = newTotal;

  if (isReset) {
    if (title) title.textContent = 'Confirm Reset to 0 Credits';
    if (addLabel) addLabel.textContent = 'Resetting';
    if (addEl) addEl.textContent = 'To 0';
    if (mathSymbol) mathSymbol.textContent = '→';
    if (confirmBtn) {
      confirmBtn.textContent = 'Confirm Reset to 0';
      confirmBtn.className = 'btn-approve-credit danger';
    }
  } else {
    if (title) title.textContent = 'Confirm Credit Update';
    if (addLabel) addLabel.textContent = 'Added Credits';
    if (addEl) addEl.textContent = `+${added}`;
    if (mathSymbol) mathSymbol.textContent = '+';
    if (confirmBtn) {
      confirmBtn.textContent = 'Approve & Add Credits';
      confirmBtn.className = 'btn-approve-credit';
    }
  }

  if (modal) modal.style.display = 'flex';
}

function closeApprovalModal() {
  const modal = document.getElementById('credit-approval-modal');
  if (modal) modal.style.display = 'none';
  pendingApproval = null;
}

// Inline Row Credit & Approval Actions
function onRowAmountChange(rowId, currentCredits) {
  const input = document.getElementById(`add-input-${rowId}`);
  const calcEl = document.getElementById(`row-calc-${rowId}`);
  const btnAmt = document.getElementById(`btn-amt-${rowId}`);
  if (!input) return;

  const raw = parseInt(input.value, 10);
  const safeAdded = isNaN(raw) || raw < 0 ? 0 : raw;
  const newTotal = (currentCredits || 0) + safeAdded;

  if (calcEl) {
    calcEl.innerHTML = `<span class="calc-arrow">→</span> Total after approval: <strong class="text-success">${newTotal} Songs</strong>`;
  }
  if (btnAmt) {
    btnAmt.textContent = `+${safeAdded}`;
  }

  const row = input.closest('tr');
  if (row) {
    row.querySelectorAll('.btn-preset-chip').forEach(btn => {
      const val = parseInt(btn.getAttribute('data-preset'), 10);
      btn.classList.toggle('active', val === safeAdded);
    });
  }
}

async function approveRowCredits(userId, email, rowId, currentCredits) {
  const input = document.getElementById(`add-input-${rowId}`);
  const btn = document.getElementById(`btn-approve-${rowId}`);
  const raw = input ? parseInt(input.value, 10) : 10;
  const added = isNaN(raw) || raw <= 0 ? 0 : raw;

  if (added <= 0) {
    showToast('Please specify a positive number of credits to add.', 'warning');
    if (input) input.focus();
    return;
  }

  const remaining = currentCredits || 0;
  const newTotal = remaining + added;

  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Approving...';
  }

  try {
    await setCredits(userId, email, newTotal);
  } catch (err) {
    console.error('Row approval error:', err);
    showToast(`Approval failed: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      const btnAmt = document.getElementById(`btn-amt-${rowId}`);
      if (btnAmt) btnAmt.textContent = `+${added}`;
    }
  }
}

// Live calculation preview in quick top-up
function updateTopupCalcPreview() {
  const emailInput = document.getElementById('direct-email-input');
  const amountInput = document.getElementById('direct-amount-input');
  const previewRem = document.getElementById('calc-preview-remaining');
  const previewAdded = document.getElementById('calc-preview-added');
  const previewTotal = document.getElementById('calc-preview-total');

  const email = (emailInput?.value || '').trim().toLowerCase();
  const rawAmt = parseInt(amountInput?.value || '0', 10);
  const added = isNaN(rawAmt) || rawAmt < 0 ? 0 : rawAmt;

  const existing = allUsers.find(u => (u.email || '').toLowerCase() === email);
  const remaining = existing ? (existing.credits || 0) : 0;
  const total = remaining + added;

  if (previewRem) previewRem.textContent = existing ? `${remaining} Songs` : '0 (New)';
  if (previewAdded) previewAdded.textContent = `+${added}`;
  if (previewTotal) previewTotal.textContent = `${total} Songs`;
}

// Toast notification helper
function showToast(msg, type = 'success') {
  const toast = document.getElementById('admin-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `admin-toast show ${type}`;
  setTimeout(() => {
    toast.className = 'admin-toast';
  }, 3500);
}

// XSS Escape Helper
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Global Event Delegation & Setup
window.addEventListener('DOMContentLoaded', () => {
  initSupabase();

  // Verify server session
  checkAdminSession();

  // Email Gate submit via server authentication API
  document.getElementById('form-admin-email')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email-input')?.value.trim().toLowerCase();
    const password = document.getElementById('admin-password-input')?.value;
    const errEl = document.getElementById('gate-error');
    const submitBtn = document.getElementById('btn-email-submit');

    if (!email || !password) {
      if (errEl) {
        errEl.textContent = 'Please enter both email and password.';
        errEl.style.display = 'block';
      }
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Authenticating with server...';
      }

      // 1. Authenticate against server-side endpoint with PBKDF2 verification & rate limiting
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (errEl) {
          errEl.textContent = data.message || 'Invalid administrator credentials. Access denied.';
          errEl.style.display = 'block';
        }
        return;
      }

      // 2. Successful server authentication
      if (errEl) errEl.style.display = 'none';
      if (data.token) {
        sessionStorage.setItem('karaoke_admin_token', data.token);
      }

      // 3. Connect Supabase session if configured
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.auth.signInWithPassword({ email, password });
        } catch (_) {}
      }

      unlockAdminPanel(data.email || email);
    } catch (err) {
      if (errEl) {
        errEl.textContent = `Server connection error: ${err.message}`;
        errEl.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In as Admin →';
      }
    }
  });

  // Lock button
  document.getElementById('btn-admin-lock')?.addEventListener('click', lockAdminPanel);

  // Refresh button
  document.getElementById('btn-refresh-data')?.addEventListener('click', () => {
    loadUsers();
    showToast('Refreshing user list...', 'success');
  });

  // Event delegation on table body (Safe from XSS)
  const tbody = document.getElementById('users-table-body');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      // Copy email button
      const copyBtn = e.target.closest('.btn-action-copy');
      if (copyBtn) {
        const text = copyBtn.getAttribute('data-copy');
        if (text) {
          navigator.clipboard?.writeText(text);
          showToast(`Copied: ${text}`, 'success');
        }
        return;
      }

      // Preset chips in table row
      const presetBtn = e.target.closest('.btn-preset-chip');
      if (presetBtn) {
        const chipsContainer = presetBtn.closest('.row-preset-chips');
        const rowId = chipsContainer?.getAttribute('data-row-id');
        const currentCredits = parseInt(chipsContainer?.getAttribute('data-credits') || '0', 10);
        const amount = parseInt(presetBtn.getAttribute('data-preset') || '10', 10);
        const input = document.getElementById(`add-input-${rowId}`);
        if (input) {
          input.value = amount;
          onRowAmountChange(rowId, currentCredits);
        }
        return;
      }

      // Approve row button
      const approveBtn = e.target.closest('.btn-action-approve');
      if (approveBtn) {
        const userId = approveBtn.getAttribute('data-user-id');
        const email = approveBtn.getAttribute('data-email');
        const rowId = approveBtn.getAttribute('data-row-id');
        const currentCredits = parseInt(approveBtn.getAttribute('data-credits') || '0', 10);
        approveRowCredits(userId, email, rowId, currentCredits);
        return;
      }

      // Reset row button
      const resetBtn = e.target.closest('.btn-action-reset');
      if (resetBtn) {
        const userId = resetBtn.getAttribute('data-user-id');
        const email = resetBtn.getAttribute('data-email');
        const user = allUsers.find(u => (userId && u.id === userId) || u.email === email);
        const remaining = user ? (user.credits || 0) : 0;
        openApprovalModal({ userId, email, remaining, added: 0, newTotal: 0, isReset: true });
        return;
      }
    });

    tbody.addEventListener('input', (e) => {
      const input = e.target.closest('.row-add-input');
      if (input) {
        const rowId = input.getAttribute('data-row-id');
        const currentCredits = parseInt(input.getAttribute('data-credits') || '0', 10);
        onRowAmountChange(rowId, currentCredits);
      }
    });

    tbody.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const input = e.target.closest('.row-add-input');
        if (input) {
          e.preventDefault();
          const tr = input.closest('tr');
          const userId = tr?.getAttribute('data-user-id');
          const email = tr?.getAttribute('data-email');
          const rowId = input.getAttribute('data-row-id');
          const currentCredits = parseInt(input.getAttribute('data-credits') || '0', 10);
          approveRowCredits(userId, email, rowId, currentCredits);
        }
      }
    });
  }

  // Live calculation preview listeners in quick top-up
  document.getElementById('direct-email-input')?.addEventListener('input', updateTopupCalcPreview);
  document.getElementById('direct-amount-input')?.addEventListener('input', updateTopupCalcPreview);

  // Direct Top-up Form
  document.getElementById('form-direct-topup')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('direct-email-input')?.value.trim();
    const amount = parseInt(document.getElementById('direct-amount-input')?.value || '0', 10);
    if (!email || isNaN(amount) || amount <= 0) return;

    const existing = allUsers.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
    const remaining = existing ? (existing.credits || 0) : 0;
    const newTotal = remaining + amount;

    openApprovalModal({
      userId: existing ? existing.id : null,
      email,
      remaining,
      added: amount,
      newTotal,
      isReset: false
    });
  });

  // Direct Top-up Presets (+5, +10, +20, +50)
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.getAttribute('data-amount');
      const amountInput = document.getElementById('direct-amount-input');
      if (amountInput) amountInput.value = val;
      updateTopupCalcPreview();
    });
  });

  // Approval Modal Confirm
  document.getElementById('btn-confirm-approval')?.addEventListener('click', async () => {
    if (!pendingApproval) return;
    const { userId, email, newTotal } = pendingApproval;
    const btn = document.getElementById('btn-confirm-approval');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Approving & Syncing...';
    }

    await setCredits(userId, email, newTotal);

    if (btn) btn.disabled = false;
    closeApprovalModal();
    const emailInput = document.getElementById('direct-email-input');
    if (emailInput) emailInput.value = '';
    updateTopupCalcPreview();
  });

  // Approval Modal Cancel
  document.getElementById('btn-cancel-approval')?.addEventListener('click', closeApprovalModal);
  document.getElementById('credit-approval-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'credit-approval-modal') closeApprovalModal();
  });

  // Search input live filter
  const searchInput = document.getElementById('user-search-input');
  const clearSearchBtn = document.getElementById('btn-clear-search');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      if (clearSearchBtn) clearSearchBtn.style.display = currentSearch ? 'block' : 'none';
      renderUsersTable();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      currentSearch = '';
      clearSearchBtn.style.display = 'none';
      renderUsersTable();
    });
  }

  // Filter chips (All, Zero, Active)
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter') || 'all';
      renderUsersTable();
    });
  });
});
