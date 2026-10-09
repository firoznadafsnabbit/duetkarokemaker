/**
 * Duet Karaoke Maker - Free Supabase Auth & Credit Management
 * 
 * - 3 Free Songs for every logged-in user
 * - Real-time credit deduction
 * - WhatsApp Out-of-Credits Contact Modal (+91 96633 96058)
 * - 100% Free Supabase backend integration
 */

const SUPABASE_CONFIG = {
  url: 'https://odvgmniswfpahwkqwtcw.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdmdtbmlzd2ZwYWh3a3F3dGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MzE4MTksImV4cCI6MjEwNzEwNzgxOX0.dl3gytRtsokArFxN_VH2nMABfAF35757ghOnm-dYESs',
  whatsappNumber: '919663396058',
  freeCredits: 3
};

let supabaseClient = null;
let currentUser = null;
let currentCredits = 0;
let pendingGuardedAction = null;

function initSupabase() {
  if (typeof supabase === 'undefined') {
    console.warn('[Auth] Supabase JS library not loaded.');
    return null;
  }
  if (!SUPABASE_CONFIG.anonKey) {
    console.info('[Auth] Supabase Anon key not configured yet.');
    return null;
  }
  try {
    supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    return supabaseClient;
  } catch (err) {
    console.error('[Auth] Failed to initialize Supabase client:', err);
    return null;
  }
}

async function loadUserProfile(user) {
  if (!supabaseClient || !user) return 0;
  try {
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[Auth] Error fetching profile:', error.message);
    }

    if (profile && typeof profile.credits === 'number') {
      currentCredits = profile.credits;
    } else {
      // First time user: initialize with 3 free credits
      const { data: newProfile, error: insertError } = await supabaseClient
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          credits: SUPABASE_CONFIG.freeCredits
        })
        .select('credits')
        .single();

      if (!insertError && newProfile) {
        currentCredits = newProfile.credits;
      } else {
        currentCredits = SUPABASE_CONFIG.freeCredits;
      }
    }
  } catch (err) {
    console.error('[Auth] loadUserProfile exception:', err);
    currentCredits = SUPABASE_CONFIG.freeCredits;
  }
  updateAuthUI();
  return currentCredits;
}

function updateAuthUI() {
  const authBar = document.getElementById('user-auth-bar');
  const btnOpenAuth = document.getElementById('btn-open-auth');
  const profileChip = document.getElementById('user-profile-chip');
  const userEmailDisplay = document.getElementById('user-email-display');
  const userCreditsVal = document.getElementById('user-credits-val');
  const creditsPill = document.getElementById('credits-pill');

  if (!authBar) return;

  if (currentUser) {
    if (btnOpenAuth) btnOpenAuth.style.display = 'none';
    if (profileChip) profileChip.style.display = 'inline-flex';
    if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email || 'Singer';
    if (userCreditsVal) userCreditsVal.textContent = currentCredits;

    if (creditsPill) {
      creditsPill.classList.remove('zero', 'low', 'good');
      if (currentCredits <= 0) {
        creditsPill.classList.add('zero');
      } else if (currentCredits === 1) {
        creditsPill.classList.add('low');
      } else {
        creditsPill.classList.add('good');
      }
    }
  } else {
    if (btnOpenAuth) btnOpenAuth.style.display = 'inline-flex';
    if (profileChip) profileChip.style.display = 'none';
  }
}

async function deductSongCredit() {
  if (!currentUser) return false;
  if (currentCredits <= 0) return false;

  const nextCredits = currentCredits - 1;
  currentCredits = nextCredits;
  updateAuthUI();

  if (supabaseClient) {
    try {
      await supabaseClient
        .from('profiles')
        .update({ credits: nextCredits })
        .eq('id', currentUser.id);
    } catch (err) {
      console.warn('[Auth] Failed to sync deducted credit to database:', err);
    }
  }

  return true;
}

function openAuthModal(initialTab = 'signin', pendingNotice = '') {
  const modal = document.getElementById('auth-modal');
  const noticeEl = document.getElementById('auth-modal-notice');
  const errEl = document.getElementById('auth-modal-error');
  if (!modal) return;

  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (noticeEl) {
    if (pendingNotice) {
      noticeEl.textContent = pendingNotice;
      noticeEl.style.display = 'block';
    } else {
      noticeEl.style.display = 'none';
    }
  }

  setAuthTab(initialTab);
  modal.style.display = 'flex';
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.style.display = 'none';
  pendingGuardedAction = null;
}

function setAuthTab(tab) {
  const tabSignIn = document.getElementById('tab-auth-signin');
  const tabSignUp = document.getElementById('tab-auth-signup');
  const formSignIn = document.getElementById('form-auth-signin');
  const formSignUp = document.getElementById('form-auth-signup');

  if (tab === 'signup') {
    tabSignUp?.classList.add('active');
    tabSignIn?.classList.remove('active');
    if (formSignUp) formSignUp.style.display = 'block';
    if (formSignIn) formSignIn.style.display = 'none';
  } else {
    tabSignIn?.classList.add('active');
    tabSignUp?.classList.remove('active');
    if (formSignIn) formSignIn.style.display = 'block';
    if (formSignUp) formSignUp.style.display = 'none';
  }
}

function openOutOfCreditsModal() {
  const modal = document.getElementById('credits-contact-modal');
  const emailVal = document.getElementById('contact-user-email');
  const waBtn = document.getElementById('btn-contact-whatsapp');
  if (!modal) return;

  const userEmail = currentUser?.email || 'my-account';
  if (emailVal) emailVal.textContent = userEmail;

  if (waBtn) {
    const message = encodeURIComponent(
      `Hi Armaan! I used my 3 free karaoke songs on Karoke Maker and want to buy more credits for my account:\n📧 Email: ${userEmail}`
    );
    waBtn.href = `https://wa.me/${SUPABASE_CONFIG.whatsappNumber}?text=${message}`;
  }

  modal.style.display = 'flex';
}

function closeOutOfCreditsModal() {
  const modal = document.getElementById('credits-contact-modal');
  if (modal) modal.style.display = 'none';
}

async function handleSignIn(e) {
  e.preventDefault();
  const errEl = document.getElementById('auth-modal-error');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const email = document.getElementById('auth-signin-email')?.value.trim();
  const password = document.getElementById('auth-signin-password')?.value;

  if (!email || !password) {
    showAuthError('Please enter both email and password.');
    return;
  }

  if (!supabaseClient) {
    // Check if anon key needs to be set
    openKeySetupModal('Please configure your Supabase Anon Key to enable live database sign in.');
    return;
  }

  try {
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Signing in...'; }
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    currentUser = data.user;
    await loadUserProfile(currentUser);
    closeAuthModal();
    syncAuthGateState();

    if (pendingGuardedAction) {
      const pendingFn = pendingGuardedAction;
      pendingGuardedAction = null;
      setTimeout(() => {
        guardCreditAction(pendingFn);
      }, 350);
    }
  } catch (err) {
    showAuthError(err.message || 'Failed to sign in.');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Sign In'; }
  }
}

async function handleSignUp(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const email = document.getElementById('auth-signup-email')?.value.trim();
  const password = document.getElementById('auth-signup-password')?.value;
  const confirm = document.getElementById('auth-signup-confirm')?.value;

  if (!email || !password) {
    showAuthError('Please fill out all fields.');
    return;
  }
  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters long.');
    return;
  }
  if (password !== confirm) {
    showAuthError('Passwords do not match.');
    return;
  }

  if (!supabaseClient) {
    openKeySetupModal('Please configure your Supabase Anon Key to enable live database signup.');
    return;
  }

  try {
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating Account...'; }
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password
    });
    if (error) throw error;

    if (data.user && data.session) {
      currentUser = data.user;
      await loadUserProfile(currentUser);
      closeAuthModal();
      syncAuthGateState();

      if (pendingGuardedAction) {
        const pendingFn = pendingGuardedAction;
        pendingGuardedAction = null;
        setTimeout(() => {
          guardCreditAction(pendingFn);
        }, 350);
      }
    } else {
      const noticeEl = document.getElementById('auth-modal-notice');
      if (noticeEl) {
        noticeEl.textContent = 'Registration successful! Please check your email to confirm your account, then sign in.';
        noticeEl.style.display = 'block';
      }
      setAuthTab('signin');
    }
  } catch (err) {
    showAuthError(err.message || 'Failed to sign up.');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Account (Get 3 Free Songs)'; }
  }
}

async function handleSignOut() {
  if (supabaseClient) {
    try { await supabaseClient.auth.signOut(); } catch (_) {}
  }
  currentUser = null;
  currentCredits = 0;
  updateAuthUI();
  syncAuthGateState();
}

function showAuthError(msg) {
  const errEl = document.getElementById('auth-modal-error');
  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
}

function showGateError(msg) {
  const errEl = document.getElementById('gate-auth-error');
  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
}

function showGateNotice(msg) {
  const noticeEl = document.getElementById('gate-auth-notice');
  if (noticeEl) {
    noticeEl.textContent = msg;
    noticeEl.style.display = 'block';
  }
}

function setGateTab(tab) {
  const tabSignIn = document.getElementById('gate-tab-signin');
  const tabSignUp = document.getElementById('gate-tab-signup');
  const formSignIn = document.getElementById('form-gate-signin');
  const formSignUp = document.getElementById('form-gate-signup');
  const errEl = document.getElementById('gate-auth-error');
  const noticeEl = document.getElementById('gate-auth-notice');

  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (noticeEl) { noticeEl.textContent = ''; noticeEl.style.display = 'none'; }

  if (tab === 'signup') {
    tabSignUp?.classList.add('active');
    tabSignIn?.classList.remove('active');
    if (formSignUp) formSignUp.style.display = 'flex';
    if (formSignIn) formSignIn.style.display = 'none';
  } else {
    tabSignIn?.classList.add('active');
    tabSignUp?.classList.remove('active');
    if (formSignIn) formSignIn.style.display = 'flex';
    if (formSignUp) formSignUp.style.display = 'none';
  }
}

/**
 * Synchronize Authentication Gate Screen with Application Visibility:
 * - If user is NOT signed in: display full-page login gate, hide actual app container
 * - If user IS signed in: hide login gate with smooth animation, reveal actual studio
 */
function syncAuthGateState() {
  const gate = document.getElementById('auth-gate-screen');
  const appContainer = document.getElementById('app-container');
  const loader = document.getElementById('auth-gate-loader');

  // Dismiss initial session loader with smooth fade-out
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 250);
  }

  if (currentUser) {
    // Authenticated: Jump into actual app
    if (gate) {
      gate.classList.add('fade-out');
      setTimeout(() => {
        if (currentUser) {
          gate.style.display = 'none';
          gate.classList.remove('fade-out');
        }
      }, 300);
    }
    if (appContainer) {
      appContainer.style.display = 'flex';
      requestAnimationFrame(() => {
        appContainer.classList.add('app-visible');
      });
      // Ensure canvas is crisply rendered
      if (typeof renderCanvasFrame === 'function') {
        try { renderCanvasFrame(0); } catch (_) {}
      }
    }
  } else {
    // Unauthenticated: Lock app container, show login portal
    if (appContainer) {
      appContainer.classList.remove('app-visible');
      appContainer.style.display = 'none';
    }
    if (gate) {
      gate.style.display = 'flex';
      gate.classList.remove('fade-out');
    }
  }
}

async function handleGateSignIn(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('btn-gate-signin-submit');
  const email = document.getElementById('gate-signin-email')?.value.trim();
  const password = document.getElementById('gate-signin-password')?.value;
  const errEl = document.getElementById('gate-auth-error');
  const noticeEl = document.getElementById('gate-auth-notice');

  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (noticeEl) { noticeEl.textContent = ''; noticeEl.style.display = 'none'; }

  if (!email || !password) {
    showGateError('Please enter both email and password.');
    return;
  }

  if (!supabaseClient) {
    showGateError('Database connection error. Please refresh the page.');
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span><span>Signing In...</span>';
    }
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    currentUser = data.user;
    await loadUserProfile(currentUser);
    syncAuthGateState();
  } catch (err) {
    showGateError(err.message || 'Failed to sign in. Please verify your email & password.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Sign In to Studio</span><span class="btn-arrow">→</span>';
    }
  }
}

async function handleGateSignUp(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('btn-gate-signup-submit');
  const email = document.getElementById('gate-signup-email')?.value.trim();
  const password = document.getElementById('gate-signup-password')?.value;
  const confirm = document.getElementById('gate-signup-confirm')?.value;
  const errEl = document.getElementById('gate-auth-error');
  const noticeEl = document.getElementById('gate-auth-notice');

  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (noticeEl) { noticeEl.textContent = ''; noticeEl.style.display = 'none'; }

  if (!email || !password) {
    showGateError('Please fill out all fields.');
    return;
  }
  if (password.length < 6) {
    showGateError('Password must be at least 6 characters long.');
    return;
  }
  if (password !== confirm) {
    showGateError('Passwords do not match. Please verify your confirm password.');
    return;
  }

  if (!supabaseClient) {
    showGateError('Database connection error. Please refresh the page.');
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span><span>Creating Account...</span>';
    }
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;

    if (data.user && data.session) {
      currentUser = data.user;
      await loadUserProfile(currentUser);
      syncAuthGateState();
    } else {
      showGateNotice('🎉 Account created! If confirmation is required, please check your email, then Sign In.');
      setGateTab('signin');
      const signInEmail = document.getElementById('gate-signin-email');
      if (signInEmail) signInEmail.value = email;
    }
  } catch (err) {
    showGateError(err.message || 'Failed to create account.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Create Account</span><span class="btn-arrow">→</span>';
    }
  }
}

function openKeySetupModal(reason = '') {
  const key = prompt(
    (reason ? reason + '\n\n' : '') +
    'Enter your Supabase Anon Public Key (from https://supabase.com/dashboard/project/odvgmniswfpahwkqwtcw/settings/api):'
  );
  if (key && key.trim()) {
    localStorage.setItem('supabase_anon_key', key.trim());
    SUPABASE_CONFIG.anonKey = key.trim();
    initSupabase();
    alert('✅ Supabase connected successfully!');
  }
}

/**
 * Guard any song generation/render operation:
 * Checks if user is logged in and has > 0 credits.
 * If yes, executes callback and decrements credit.
 * If no, shows auth modal or contact popup.
 */
async function guardCreditAction(actionCallback) {
  // 1. Must be logged in: STRICT ENFORCEMENT - No song can be rendered without signing in!
  if (!currentUser) {
    pendingGuardedAction = actionCallback;
    openAuthModal('signin', '🔒 Sign In Required: You must sign in or create an account to render your karaoke song! (🎁 You will get 3 Free Songs)');
    return false;
  }

  // 2. Check credits
  if (currentCredits <= 0) {
    openOutOfCreditsModal();
    return false;
  }

  // 3. User has credit: execute action
  try {
    const result = await actionCallback();
    // Decrement 1 credit upon starting generation
    await deductSongCredit();
    return result;
  } catch (err) {
    throw err;
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', async () => {
  initSupabase();

  if (supabaseClient) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user) {
        currentUser = session.user;
        await loadUserProfile(currentUser);
      }
      syncAuthGateState();

      supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          currentUser = session.user;
          await loadUserProfile(currentUser);
          syncAuthGateState();
        } else {
          currentUser = null;
          currentCredits = 0;
          updateAuthUI();
          syncAuthGateState();
        }
      });
    } catch (err) {
      console.warn('[Auth] Session check failed:', err);
      syncAuthGateState();
    }
  } else {
    syncAuthGateState();
  }

  // Gate Form & Tab Listeners
  document.getElementById('gate-tab-signin')?.addEventListener('click', () => setGateTab('signin'));
  document.getElementById('gate-tab-signup')?.addEventListener('click', () => setGateTab('signup'));
  document.getElementById('form-gate-signin')?.addEventListener('submit', handleGateSignIn);
  document.getElementById('form-gate-signup')?.addEventListener('submit', handleGateSignUp);

  // Toggle Password Visibility
  document.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
      }
    });
  });

  // Modal Event Listeners
  document.getElementById('btn-open-auth')?.addEventListener('click', () => openAuthModal('signin'));
  document.getElementById('btn-close-auth-modal')?.addEventListener('click', closeAuthModal);
  document.getElementById('tab-auth-signin')?.addEventListener('click', () => setAuthTab('signin'));
  document.getElementById('tab-auth-signup')?.addEventListener('click', () => setAuthTab('signup'));
  document.getElementById('form-auth-signin')?.addEventListener('submit', handleSignIn);
  document.getElementById('form-auth-signup')?.addEventListener('submit', handleSignUp);
  document.getElementById('btn-logout')?.addEventListener('click', handleSignOut);

  document.getElementById('btn-close-contact-modal')?.addEventListener('click', closeOutOfCreditsModal);
  document.getElementById('btn-copy-user-email')?.addEventListener('click', () => {
    if (currentUser?.email) {
      navigator.clipboard.writeText(currentUser.email);
      const copyBtn = document.getElementById('btn-copy-user-email');
      if (copyBtn) {
        const oldText = copyBtn.textContent;
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => { copyBtn.textContent = oldText; }, 2000);
      }
    }
  });

  // Export functions to window
  window.KaraokeAuth = {
    guardCreditAction,
    deductSongCredit,
    openAuthModal,
    openOutOfCreditsModal,
    syncAuthGateState,
    getCurrentUser: () => currentUser,
    getCredits: () => currentCredits,
    setAnonKey: (key) => {
      localStorage.setItem('supabase_anon_key', key);
      SUPABASE_CONFIG.anonKey = key;
      initSupabase();
    }
  };
});

