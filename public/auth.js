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
  upiId: 'feroznadaf13008@ybl',
  tokenRate: 5,        // ₹5 per token
  tokensPerVideo: 2,   // 2 tokens needed to render 1 video
  freeCredits: 6       // 6 tokens bonus (3 videos)
};

let supabaseClient = null;
let currentUser = null;
let currentCredits = 0;
let currentUnlimitedUntil = null;
let pendingGuardedAction = null;

function isUserUnlimited() {
  if (!currentUnlimitedUntil) return false;
  return new Date(currentUnlimitedUntil).getTime() > Date.now();
}

function getUnlimitedRemainingTime() {
  if (!isUserUnlimited()) return null;
  const diffMs = new Date(currentUnlimitedUntil).getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffDays > 1) {
    return `${diffDays} days left`;
  }
  return `${diffHours} hours left`;
}

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
    supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'duet_karaoke_auth_session'
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'x-client-info': 'duet-karaoke-maker-web',
          'x-connection-pool': 'supavisor-transaction-6543'
        }
      }
    });
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
      .select('credits, unlimited_until')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[Auth] Error fetching profile:', error.message);
    }

    if (profile) {
      if (typeof profile.credits === 'number') {
        currentCredits = profile.credits;
      }
      currentUnlimitedUntil = profile.unlimited_until || null;
    } else {
      // First time user: initialize with 3 free credits
      const { data: newProfile, error: insertError } = await supabaseClient
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          credits: SUPABASE_CONFIG.freeCredits,
          unlimited_until: null
        })
        .select('credits, unlimited_until')
        .single();

      if (!insertError && newProfile) {
        currentCredits = newProfile.credits;
        currentUnlimitedUntil = newProfile.unlimited_until || null;
      } else {
        currentCredits = SUPABASE_CONFIG.freeCredits;
        currentUnlimitedUntil = null;
      }
    }
  } catch (err) {
    console.error('[Auth] loadUserProfile exception:', err);
    currentCredits = SUPABASE_CONFIG.freeCredits;
    currentUnlimitedUntil = null;
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
  const userCreditsLabel = document.getElementById('user-credits-label');
  const creditsPill = document.getElementById('credits-pill');

  if (!authBar) return;

  if (currentUser) {
    if (btnOpenAuth) btnOpenAuth.style.display = 'none';
    if (profileChip) profileChip.style.display = 'inline-flex';
    if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email || 'Singer';

    if (isUserUnlimited()) {
      const timeLeft = getUnlimitedRemainingTime();
      if (userCreditsVal) userCreditsVal.innerHTML = '👑 ∞';
      if (userCreditsLabel) userCreditsLabel.textContent = `Unlimited (${timeLeft})`;
      if (creditsPill) {
        creditsPill.setAttribute('title', `👑 VIP Unlimited Pass Active! You can generate unlimited karaoke videos without tokens. Valid: ${timeLeft}. Click to manage.`);
        creditsPill.classList.remove('zero', 'low', 'good');
        creditsPill.classList.add('unlimited');
      }
    } else {
      if (userCreditsVal) userCreditsVal.textContent = currentCredits;
      if (userCreditsLabel) userCreditsLabel.textContent = 'Tokens';

      const videosCount = Math.floor(currentCredits / SUPABASE_CONFIG.tokensPerVideo);

      if (creditsPill) {
        creditsPill.setAttribute('title', `${currentCredits} Tokens available (${videosCount} full video${videosCount === 1 ? '' : 's'}). Click to recharge tokens.`);
        creditsPill.classList.remove('zero', 'low', 'good', 'unlimited');
        if (currentCredits < SUPABASE_CONFIG.tokensPerVideo) {
          creditsPill.classList.add('zero');
        } else if (currentCredits < SUPABASE_CONFIG.tokensPerVideo * 2) {
          creditsPill.classList.add('low');
        } else {
          creditsPill.classList.add('good');
        }
      }
    }
  } else {
    if (btnOpenAuth) btnOpenAuth.style.display = 'inline-flex';
    if (profileChip) profileChip.style.display = 'none';
  }

  // Sync token balance in open recharge modal if present
  const modalTokensVal = document.getElementById('contact-current-tokens');
  const modalVideosVal = document.getElementById('contact-current-videos');
  const modalEmailVal = document.getElementById('contact-user-email');
  if (modalTokensVal) {
    if (isUserUnlimited()) {
      modalTokensVal.innerHTML = `👑 ∞ (${getUnlimitedRemainingTime()})`;
    } else {
      modalTokensVal.textContent = currentCredits;
    }
  }
  if (modalVideosVal) {
    if (isUserUnlimited()) {
      modalVideosVal.textContent = 'Unlimited';
    } else {
      modalVideosVal.textContent = Math.floor(currentCredits / SUPABASE_CONFIG.tokensPerVideo);
    }
  }
  if (modalEmailVal && currentUser?.email) modalEmailVal.textContent = currentUser.email;
}

async function deductSongCredit(amount = SUPABASE_CONFIG.tokensPerVideo) {
  if (!currentUser) return false;

  // 👑 Unlimited Pass bypasses token deduction completely!
  if (isUserUnlimited()) {
    console.log('[Auth] Active Unlimited Pass - 0 tokens deducted.');
    return true;
  }

  if (currentCredits < amount) return false;

  const nextCredits = Math.max(0, currentCredits - amount);
  currentCredits = nextCredits;
  updateAuthUI();

  if (supabaseClient) {
    try {
      await supabaseClient
        .from('profiles')
        .update({ credits: nextCredits })
        .eq('id', currentUser.id);
    } catch (err) {
      console.warn('[Auth] Failed to sync deducted tokens to database:', err);
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

let selectedTokens = 20;

function selectTokens(tokens) {
  const parsed = parseInt(tokens, 10);
  if (isNaN(parsed) || parsed < SUPABASE_CONFIG.tokensPerVideo) {
    selectedTokens = SUPABASE_CONFIG.tokensPerVideo;
  } else {
    selectedTokens = parsed;
  }
  updateTokenRechargeUI();
}

function updateTokenRechargeUI() {
  const qtyInput = document.getElementById('token-quantity-input');
  if (qtyInput && parseInt(qtyInput.value, 10) !== selectedTokens) {
    qtyInput.value = selectedTokens;
  }

  // Highlight active package card
  document.querySelectorAll('.token-pkg-card').forEach(card => {
    const cardTokens = parseInt(card.getAttribute('data-tokens'), 10);
    if (cardTokens === selectedTokens) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  const videosCount = Math.floor(selectedTokens / SUPABASE_CONFIG.tokensPerVideo);
  const totalPrice = selectedTokens * SUPABASE_CONFIG.tokenRate;
  const userEmail = currentUser?.email || 'my-account';

  // Update order summary card
  const summaryTokens = document.getElementById('summary-tokens-num');
  const summaryVideos = document.getElementById('summary-videos-num');
  const summaryPrice = document.getElementById('summary-total-price');

  if (summaryTokens) summaryTokens.textContent = `${selectedTokens} Tokens`;
  if (summaryVideos) summaryVideos.textContent = `${videosCount} Full Video${videosCount === 1 ? '' : 's'}`;
  if (summaryPrice) summaryPrice.textContent = `₹${totalPrice}`;

  // Update user balance displays in modal
  const emailVal = document.getElementById('contact-user-email');
  const currentTokensVal = document.getElementById('contact-current-tokens');
  const currentVideosVal = document.getElementById('contact-current-videos');
  if (emailVal) emailVal.textContent = userEmail;
  if (currentTokensVal) currentTokensVal.textContent = currentCredits;
  if (currentVideosVal) currentVideosVal.textContent = Math.floor(currentCredits / SUPABASE_CONFIG.tokensPerVideo);

  // Generate UPI Intent Pay URL
  const payeeName = 'Duet Karaoke Maker';
  const upiNote = encodeURIComponent(`Recharge ${selectedTokens} Tokens for ${userEmail}`);
  const upiUri = `upi://pay?pa=${SUPABASE_CONFIG.upiId}&pn=${encodeURIComponent(payeeName)}&am=${totalPrice}&cu=INR&tn=${upiNote}`;

  const intentPayBtn = document.getElementById('btn-upi-intent-pay');
  if (intentPayBtn) {
    intentPayBtn.href = upiUri;
  }

  // Pre-formatted WhatsApp confirmation message with login email and payment link
  const waBtn = document.getElementById('btn-contact-whatsapp');
  if (waBtn) {
    const waMessage = 
`*Duet Karaoke Maker - Token Recharge Request*

*Login Email:* ${userEmail}
*Tokens Needed:* ${selectedTokens} Tokens
*Videos to Render:* ${videosCount} Videos (2 tokens/video)
*Total Amount:* ₹${totalPrice} (₹5/token)
*UPI ID:* ${SUPABASE_CONFIG.upiId}

*UPI Payment Link:*
${upiUri}

I have initiated / completed the payment. Please credit ${selectedTokens} tokens to my account (${userEmail}). Thank you!`;

    waBtn.href = `https://wa.me/${SUPABASE_CONFIG.whatsappNumber}?text=${encodeURIComponent(waMessage)}`;
  }
}

function openOutOfCreditsModal() {
  const modal = document.getElementById('credits-contact-modal');
  if (!modal) return;

  updateTokenRechargeUI();
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
  const consentTerms = document.getElementById('auth-consent-terms')?.checked;
  const consentAge = document.getElementById('auth-consent-age')?.checked;

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
  if (!consentTerms || !consentAge) {
    showAuthError('Please accept the Terms & Privacy Policy and confirm you are at least 13 years old to continue.');
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
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Account'; }
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

  const consentTerms = document.getElementById('gate-consent-terms')?.checked;
  const consentAge = document.getElementById('gate-consent-age')?.checked;
  if (!consentTerms || !consentAge) {
    showGateError('Please accept the Terms of Service & Privacy Policy and confirm you are at least 13 years old to continue.');
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
    alert('Supabase connected successfully.');
  }
}

/**
 * Guard any song generation/render operation:
 * Checks if user is logged in and has >= 2 tokens (2 tokens per video).
 * If yes, executes callback and decrements 2 tokens.
 * If no, shows auth modal or recharge tokens modal.
 */
async function guardCreditAction(actionCallback) {
  // 1. Must be logged in: STRICT ENFORCEMENT - No song can be rendered without signing in!
  if (!currentUser) {
    pendingGuardedAction = actionCallback;
    openAuthModal('signin', 'Sign In Required: You must sign in or create an account to render your karaoke video.');
    return false;
  }

  // 👑 2. Unlimited Pass: VIP singers have unlimited song renders without deducting tokens!
  if (isUserUnlimited()) {
    console.log('[Auth] 👑 Unlimited Pass Active - executing render without token deduction.');
    return await actionCallback();
  }

  // 3. Check tokens: 2 tokens required per video render
  const requiredTokens = SUPABASE_CONFIG.tokensPerVideo;
  if (currentCredits < requiredTokens) {
    openOutOfCreditsModal();
    return false;
  }

  // 4. User has enough tokens: execute action and deduct 2 tokens
  try {
    const result = await actionCallback();
    await deductSongCredit(requiredTokens);
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
        btn.textContent = 'Hide';
      } else {
        input.type = 'password';
        btn.textContent = 'Show';
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

  // Recharge Modal Listeners
  document.getElementById('btn-close-contact-modal')?.addEventListener('click', closeOutOfCreditsModal);

  // Allow clicking on header credits pill to recharge tokens anytime
  document.getElementById('credits-pill')?.addEventListener('click', () => {
    openOutOfCreditsModal();
  });

  // Modal backdrop click to close
  document.getElementById('credits-contact-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'credits-contact-modal') {
      closeOutOfCreditsModal();
    }
  });

  // Token Package Cards Selection
  document.querySelectorAll('.token-pkg-card').forEach(card => {
    card.addEventListener('click', () => {
      const tokens = parseInt(card.getAttribute('data-tokens'), 10);
      if (tokens) selectTokens(tokens);
    });
  });

  // Custom Token Stepper Controls (min 2 tokens, step 2)
  document.getElementById('btn-token-minus')?.addEventListener('click', () => {
    selectTokens(Math.max(SUPABASE_CONFIG.tokensPerVideo, selectedTokens - SUPABASE_CONFIG.tokensPerVideo));
  });

  document.getElementById('btn-token-plus')?.addEventListener('click', () => {
    selectTokens(selectedTokens + SUPABASE_CONFIG.tokensPerVideo);
  });

  document.getElementById('token-quantity-input')?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1) {
      selectTokens(val);
    }
  });

  // Copy UPI ID to Clipboard
  document.getElementById('btn-copy-upi')?.addEventListener('click', () => {
    const copyBtn = document.getElementById('btn-copy-upi');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(SUPABASE_CONFIG.upiId).then(() => {
        if (copyBtn) {
          const oldText = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = oldText; }, 2000);
        }
      }).catch(() => {
        prompt('Copy UPI ID:', SUPABASE_CONFIG.upiId);
      });
    } else {
      prompt('Copy UPI ID:', SUPABASE_CONFIG.upiId);
    }
  });

  // Copy User Email
  document.getElementById('btn-copy-user-email')?.addEventListener('click', () => {
    if (currentUser?.email) {
      navigator.clipboard.writeText(currentUser.email);
      const copyBtn = document.getElementById('btn-copy-user-email');
      if (copyBtn) {
        const oldText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = oldText; }, 2000);
      }
    }
  });

  // --- Cookie Consent Banner ---
  function initCookieConsent() {
    const banner = document.getElementById('cookie-consent-banner');
    const btnAccept = document.getElementById('btn-cookie-accept');
    const btnDismiss = document.getElementById('btn-cookie-dismiss');
    const btnReopen = document.getElementById('btn-reopen-cookie-banner');

    const consent = localStorage.getItem('duet_cookie_consent');
    if (!consent && banner) {
      banner.style.display = 'block';
    }

    btnAccept?.addEventListener('click', () => {
      localStorage.setItem('duet_cookie_consent', 'accepted');
      if (banner) banner.style.display = 'none';
    });

    btnDismiss?.addEventListener('click', () => {
      localStorage.setItem('duet_cookie_consent', 'dismissed');
      if (banner) banner.style.display = 'none';
    });

    btnReopen?.addEventListener('click', () => {
      if (banner) banner.style.display = 'block';
    });
  }
  initCookieConsent();

  // --- Legal, Privacy, & Licenses Modal ---
  function openPrivacyModal(targetTab = 'privacy') {
    const modal = document.getElementById('privacy-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    setLegalTab(targetTab);
  }

  function closePrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    if (modal) modal.style.display = 'none';
  }

  function setLegalTab(tabName) {
    const tabs = document.querySelectorAll('.legal-nav-tab');
    const panes = document.querySelectorAll('.legal-pane');

    tabs.forEach(tab => {
      const isTarget = tab.getAttribute('data-target') === tabName;
      tab.classList.toggle('active', isTarget);
      tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    panes.forEach(pane => {
      const isTarget = pane.id === `pane-legal-${tabName}`;
      pane.style.display = isTarget ? 'block' : 'none';
    });
  }

  // Bind legal tabs
  document.querySelectorAll('.legal-nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-target') || 'privacy';
      setLegalTab(target);
    });
  });

  // Bind all triggers that open the legal modal
  document.querySelectorAll('.link-open-privacy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = btn.getAttribute('data-tab') || 'privacy';
      openPrivacyModal(tab);
    });
  });

  document.getElementById('btn-close-privacy-modal')?.addEventListener('click', closePrivacyModal);
  document.getElementById('privacy-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'privacy-modal') closePrivacyModal();
  });

  document.getElementById('btn-switch-to-deletion')?.addEventListener('click', () => {
    closePrivacyModal();
    openDataDeletionModal();
  });

  // --- Data Deletion Request Modal ---
  function openDataDeletionModal() {
    const modal = document.getElementById('data-deletion-modal');
    const emailInput = document.getElementById('del-email');
    const errBanner = document.getElementById('deletion-error-banner');
    const succBanner = document.getElementById('deletion-success-banner');
    const form = document.getElementById('form-data-deletion');

    if (errBanner) { errBanner.textContent = ''; errBanner.style.display = 'none'; }
    if (succBanner) { succBanner.innerHTML = ''; succBanner.style.display = 'none'; }
    if (form) form.style.display = 'block';

    if (emailInput) {
      emailInput.value = currentUser?.email || '';
    }

    if (modal) modal.style.display = 'flex';
  }

  function closeDataDeletionModal() {
    const modal = document.getElementById('data-deletion-modal');
    if (modal) modal.style.display = 'none';
  }

  async function handleDataDeletionSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('del-email')?.value.trim();
    const reason = document.getElementById('del-reason')?.value || 'user_requested';
    const confirmed = document.getElementById('del-confirm-checkbox')?.checked;
    const errBanner = document.getElementById('deletion-error-banner');
    const succBanner = document.getElementById('deletion-success-banner');
    const submitBtn = document.getElementById('btn-submit-deletion');
    const form = document.getElementById('form-data-deletion');

    if (errBanner) { errBanner.textContent = ''; errBanner.style.display = 'none'; }

    if (!email) {
      if (errBanner) { errBanner.textContent = 'Please provide your account email address.'; errBanner.style.display = 'block'; }
      return;
    }
    if (!confirmed) {
      if (errBanner) { errBanner.textContent = 'Please check the confirmation box to proceed.'; errBanner.style.display = 'block'; }
      return;
    }

    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Processing Deletion...'; }
      const res = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reason, confirmed: true })
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to submit deletion request.');
      }

      if (form) form.style.display = 'none';
      if (succBanner) {
        succBanner.innerHTML = `
          <div class="del-ticket-box">
            <h4>Account Deletion Scheduled</h4>
            <p>Your request has been registered under ticket reference <strong>${result.ticketId}</strong>.</p>
            <p>Your account records and associated session data will be permanently purged in accordance with GDPR, CCPA, and India DPDP 2023 regulations.</p>
          </div>
        `;
        succBanner.style.display = 'block';
      }

      // If logged-in user matches this email, trigger sign out after a delay
      if (currentUser && currentUser.email?.toLowerCase() === email.toLowerCase()) {
        setTimeout(() => {
          handleSignOut();
        }, 3500);
      }
    } catch (err) {
      if (errBanner) {
        errBanner.textContent = err.message || 'Error processing deletion request.';
        errBanner.style.display = 'block';
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Permanently Delete My Account & Data'; }
    }
  }

  // Bind deletion triggers
  document.querySelectorAll('.link-open-data-deletion').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openDataDeletionModal();
    });
  });

  document.getElementById('btn-close-deletion-modal')?.addEventListener('click', closeDataDeletionModal);
  document.getElementById('btn-cancel-deletion')?.addEventListener('click', closeDataDeletionModal);
  document.getElementById('data-deletion-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'data-deletion-modal') closeDataDeletionModal();
  });
  document.getElementById('form-data-deletion')?.addEventListener('submit', handleDataDeletionSubmit);

  // Keyboard navigation: Escape key closes all open dialogs
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePrivacyModal();
      closeDataDeletionModal();
      closeAuthModal();
      closeOutOfCreditsModal();
      const syntaxModal = document.getElementById('syntax-help-modal');
      if (syntaxModal) syntaxModal.style.display = 'none';
    }
  });

  // Export functions to window
  window.KaraokeAuth = {
    guardCreditAction,
    deductSongCredit,
    isUserUnlimited,
    getUnlimitedRemainingTime,
    getUnlimitedUntil: () => currentUnlimitedUntil,
    openAuthModal,
    openOutOfCreditsModal,
    openPrivacyModal,
    openDataDeletionModal,
    selectTokens,
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

