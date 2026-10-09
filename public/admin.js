/**
 * Duet Karaoke Maker - Admin Dashboard Controller
 * 
 * Secure management of all user song credits, real-time statistics,
 * instant search, and one-click credit top-up.
 */

const ADMIN_CONFIG = {
  supabaseUrl: 'https://odvgmniswfpahwkqwtcw.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdmdtbmlzd2ZwYWh3a3F3dGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MzE4MTksImV4cCI6MjEwNzEwNzgxOX0.dl3gytRtsokArFxN_VH2nMABfAF35757ghOnm-dYESs',
  masterAdminEmail: 'feroznadafm@gmail.com',
  masterAdminPassword: 'FerozSana@521#',
  defaultPin: '9663',
  whatsappNumber: '919663396058'
};

let supabaseAdmin = null;
let allUsers = [];
let currentFilter = 'all'; // 'all' | 'zero' | 'active'
let currentSearch = '';

// Initialize Supabase
function initSupabase() {
  if (typeof supabase !== 'undefined') {
    try {
      supabaseAdmin = supabase.createClient(ADMIN_CONFIG.supabaseUrl, ADMIN_CONFIG.anonKey);
    } catch (e) {
      console.error('[Admin] Failed to init Supabase:', e);
    }
  }
}

// Check PIN & Session
function getSavedPin() {
  return localStorage.getItem('karaoke_admin_pin') || ADMIN_CONFIG.defaultPin;
}

function isSessionUnlocked() {
  return sessionStorage.getItem('karaoke_admin_unlocked') === 'true';
}

function unlockAdminPanel(modeLabel = 'PIN Authorized') {
  sessionStorage.setItem('karaoke_admin_unlocked', 'true');
  document.getElementById('admin-gate-overlay').style.display = 'none';
  document.getElementById('admin-main').style.display = 'block';
  document.getElementById('admin-header-actions').style.display = 'flex';
  document.getElementById('admin-auth-tag').textContent = `🔓 ${modeLabel}`;
  loadUsers();
}

function lockAdminPanel() {
  sessionStorage.removeItem('karaoke_admin_unlocked');
  document.getElementById('admin-gate-overlay').style.display = 'flex';
  document.getElementById('admin-main').style.display = 'none';
  document.getElementById('admin-header-actions').style.display = 'none';
  document.getElementById('admin-pin-input').value = '';
}

// Fetch all users from Supabase
async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Loading users from database...</td></tr>';

  if (!supabaseAdmin) {
    showToast('Supabase client not initialized.', 'error');
    return;
  }

  try {
    let users = null;
    let error = null;

    // 1. Try secure Postgres RPC function first
    const rpcRes = await supabaseAdmin.rpc('admin_get_all_users');
    if (!rpcRes.error && Array.isArray(rpcRes.data)) {
      users = rpcRes.data;
    } else {
      // 2. Direct table select fallback
      const tableRes = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (tableRes.error) {
        error = tableRes.error;
      } else {
        users = tableRes.data;
      }
    }

    if (error) {
      console.warn('[Admin] Query error:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty">
            <div style="margin-bottom: 8px;">⚠️ Note: Table 'profiles' is currently empty or awaiting SQL setup.</div>
            <div style="font-size: 0.8rem; color: #8b9bb4;">
              If you haven't run the table creation query in Supabase SQL editor yet, please run it once to activate live sync.
            </div>
          </td>
        </tr>`;
      allUsers = [];
      updateMetrics([]);
      return;
    }

    allUsers = users || [];
    updateMetrics(allUsers);
    renderUsersTable();
  } catch (err) {
    console.error('[Admin] Fetch error:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Error loading users: ${err.message}</td></tr>`;
  }
}

// Compute & display dashboard metrics
function updateMetrics(users) {
  const total = users.length;
  const zeroCredits = users.filter(u => (u.credits || 0) <= 0).length;
  const activeUsers = users.filter(u => (u.credits || 0) > 0).length;
  const totalCredits = users.reduce((acc, u) => acc + (u.credits || 0), 0);

  document.getElementById('stat-total-users').textContent = total;
  document.getElementById('stat-zero-credits').textContent = zeroCredits;
  document.getElementById('stat-active-users').textContent = activeUsers;
  document.getElementById('stat-total-credits').textContent = totalCredits;

  document.getElementById('count-filter-all').textContent = total;
  document.getElementById('count-filter-zero').textContent = zeroCredits;
  document.getElementById('count-filter-active').textContent = activeUsers;
}

// Render user rows with filter and search
function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  
  // Filter logic
  let filtered = allUsers.filter(u => {
    // Search query
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const id = (u.id || '').toLowerCase();
      if (!email.includes(q) && !id.includes(q)) return false;
    }

    // Filter tab
    const creds = u.credits || 0;
    if (currentFilter === 'zero') return creds <= 0;
    if (currentFilter === 'active') return creds > 0;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">
          ${allUsers.length === 0 ? 'No registered users found yet.' : 'No users match your search/filter.'}
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    const credits = u.credits ?? 0;
    let badgeClass = 'good';
    if (credits <= 0) badgeClass = 'zero';
    else if (credits === 1) badgeClass = 'low';

    const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Recent';
    const email = escapeHtml(u.email || 'No email');

    return `
      <tr data-user-id="${u.id}" data-email="${email}">
        <td>
          <div class="user-email-cell">
            <span>${email}</span>
            <button type="button" class="btn-copy-mini" onclick="copyText('${email}')" title="Copy Email">📋</button>
            ${credits <= 0 ? `<a href="https://wa.me/${ADMIN_CONFIG.whatsappNumber}?text=Hi+${encodeURIComponent(email)}+your+credits+are+ready" target="_blank" class="btn-copy-mini" title="Send WhatsApp Message">💬</a>` : ''}
          </div>
        </td>
        <td>
          <span class="credit-badge ${badgeClass}">
            ⚡ ${credits} ${credits === 1 ? 'Song' : 'Songs'}
          </span>
        </td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">
          ${dateStr}
        </td>
        <td>
          <div class="actions-cell">
            <button type="button" class="btn-quick-add btn-add-5" onclick="quickAddCredits('${u.id}', '${email}', ${credits}, 5)">+5</button>
            <button type="button" class="btn-quick-add btn-add-10" onclick="quickAddCredits('${u.id}', '${email}', ${credits}, 10)">+10</button>
            <button type="button" class="btn-quick-add btn-add-25" onclick="quickAddCredits('${u.id}', '${email}', ${credits}, 25)">+25</button>
            <button type="button" class="btn-quick-add btn-custom-edit" onclick="promptCustomCredits('${u.id}', '${email}', ${credits})">✏️ Custom</button>
          </div>
        </td>
        <td>
          <button type="button" class="btn-reset-zero" onclick="quickSetCredits('${u.id}', '${email}', 0)" title="Reset credits to 0">Reset (0)</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Modify credits
async function setCredits(userId, email, newCredits) {
  if (!supabaseAdmin) return;
  const num = Math.max(0, parseInt(newCredits, 10));

  try {
    let success = false;

    // 1. Try RPC update first
    const rpcRes = await supabaseAdmin.rpc('admin_update_credits', {
      target_email: email,
      new_credits: num
    });

    if (!rpcRes.error && rpcRes.data?.success) {
      success = true;
    } else {
      // 2. Direct table update
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ credits: num })
        .match(userId ? { id: userId } : { email: email });

      if (!error) success = true;
    }

    if (success) {
      showToast(`✅ Set ${num} credits for ${email}`, 'success');
      // Update local state
      const target = allUsers.find(u => (userId && u.id === userId) || u.email === email);
      if (target) {
        target.credits = num;
      }
      updateMetrics(allUsers);
      renderUsersTable();
    } else {
      showToast(`⚠️ Could not update credits. Please check Supabase RLS permissions.`, 'error');
    }
  } catch (err) {
    console.error('[Admin] Update credits error:', err);
    showToast(`Error: ${err.message}`, 'error');
  }
}

// Quick Add Helper
window.quickAddCredits = function(userId, email, current, amount) {
  const next = (current || 0) + amount;
  setCredits(userId, email, next);
};

// Quick Set Helper
window.quickSetCredits = function(userId, email, amount) {
  if (confirm(`Are you sure you want to set credits for ${email} to ${amount}?`)) {
    setCredits(userId, email, amount);
  }
};

// Custom Prompt Helper
window.promptCustomCredits = function(userId, email, current) {
  const input = prompt(`Enter total credits for ${email}:`, current || 0);
  if (input !== null && !isNaN(parseInt(input, 10))) {
    setCredits(userId, email, parseInt(input, 10));
  }
};

// Copy text utility
window.copyText = function(text) {
  navigator.clipboard.writeText(text);
  showToast('Copied to clipboard: ' + text, 'success');
};

// Toast notification helper
function showToast(msg, type = 'success') {
  const toast = document.getElementById('admin-toast');
  toast.textContent = msg;
  toast.className = `admin-toast show ${type}`;
  setTimeout(() => {
    toast.className = 'admin-toast';
  }, 3500);
}

// Escape HTML
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// DOM Setup
window.addEventListener('DOMContentLoaded', () => {
  initSupabase();

  // Check existing session
  if (isSessionUnlocked()) {
    unlockAdminPanel();
  }

  // Gate tab switching (PIN vs Email)
  document.getElementById('tab-pin').addEventListener('click', () => {
    document.getElementById('tab-pin').classList.add('active');
    document.getElementById('tab-email').classList.remove('active');
    document.getElementById('form-admin-pin').style.display = 'block';
    document.getElementById('form-admin-email').style.display = 'none';
  });

  document.getElementById('tab-email').addEventListener('click', () => {
    document.getElementById('tab-email').classList.add('active');
    document.getElementById('tab-pin').classList.remove('active');
    document.getElementById('form-admin-pin').style.display = 'none';
    document.getElementById('form-admin-email').style.display = 'block';
  });

  // PIN Gate submit
  document.getElementById('form-admin-pin').addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = document.getElementById('admin-pin-input').value.trim();
    const savedPin = getSavedPin();
    const errEl = document.getElementById('gate-error');

    if (pin === savedPin) {
      errEl.style.display = 'none';
      unlockAdminPanel('PIN Authorized');
    } else {
      errEl.textContent = '❌ Incorrect PIN. Please try again.';
      errEl.style.display = 'block';
    }
  });

  // Email Gate submit
  document.getElementById('form-admin-email').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email-input').value.trim().toLowerCase();
    const password = document.getElementById('admin-password-input').value;
    const errEl = document.getElementById('gate-error');
    const submitBtn = document.getElementById('btn-email-submit');

    // 1. Strict admin verification: Never leak the admin email to unauthorized viewers!
    if (email !== ADMIN_CONFIG.masterAdminEmail.toLowerCase() || password !== ADMIN_CONFIG.masterAdminPassword) {
      errEl.textContent = '❌ Invalid admin credentials. Access denied.';
      errEl.style.display = 'block';
      return;
    }

    // 2. Validated successfully!
    errEl.style.display = 'none';

    if (supabaseAdmin) {
      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Authenticating...';
        await supabaseAdmin.auth.signInWithPassword({ email, password });
      } catch (err) {
        console.warn('[Admin] Cloud session note:', err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In as Admin →';
      }
    }

    unlockAdminPanel(ADMIN_CONFIG.masterAdminEmail);
  });

  // Lock button
  document.getElementById('btn-admin-lock')?.addEventListener('click', lockAdminPanel);

  // Refresh button
  document.getElementById('btn-refresh-data')?.addEventListener('click', () => {
    loadUsers();
    showToast('Refreshing user list...', 'success');
  });

  // Direct Top-up Form
  document.getElementById('form-direct-topup').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('direct-email-input').value.trim();
    const amount = parseInt(document.getElementById('direct-amount-input').value, 10);
    if (!email || isNaN(amount)) return;

    // Check if user exists in list
    const existing = allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
    const current = existing ? (existing.credits || 0) : 0;
    const next = current + amount;

    setCredits(existing ? existing.id : null, email, next);
    document.getElementById('direct-email-input').value = '';
  });

  // Direct Top-up Presets (+5, +10, +20, +50)
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.getAttribute('data-amount');
      document.getElementById('direct-amount-input').value = val;
    });
  });

  // Search input live filter
  const searchInput = document.getElementById('user-search-input');
  const clearSearchBtn = document.getElementById('btn-clear-search');

  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.trim();
    clearSearchBtn.style.display = currentSearch ? 'block' : 'none';
    renderUsersTable();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearch = '';
    clearSearchBtn.style.display = 'none';
    renderUsersTable();
  });

  // Filter chips (All, Zero, Active)
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      renderUsersTable();
    });
  });

  // Update PIN in Settings
  document.getElementById('btn-update-pin')?.addEventListener('click', () => {
    const newPin = document.getElementById('input-new-pin').value.trim();
    if (newPin.length < 4) {
      alert('PIN must be at least 4 characters long.');
      return;
    }
    localStorage.setItem('karaoke_admin_pin', newPin);
    document.getElementById('input-new-pin').value = '';
    showToast(`✅ Admin PIN updated to "${newPin}"`, 'success');
  });
});
