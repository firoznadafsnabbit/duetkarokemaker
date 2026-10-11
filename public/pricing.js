/**
 * Duet Karaoke Maker - Dedicated Token Purchase Page Controller
 * Handles token package selection, custom quantity calculation,
 * real-time user balance detection via Supabase, UPI intent generation,
 * and WhatsApp instant confirmation dispatch.
 */

const SUPABASE_CONFIG = {
  url: 'https://odvgmniswfpahwkqwtcw.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdmdtbmlzd2ZwYWh3a3F3dGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MzE4MTksImV4cCI6MjEwNzEwNzgxOX0.dl3gytRtsokArFxN_VH2nMABfAF35757ghOnm-dYESs',
  whatsappNumber: '919663396058',
  upiId: 'feroznadaf13008@ybl',
  tokensPerVideo: 2,
  freeCredits: 6
};

const TOKEN_PACKAGES = {
  10: 49,
  20: 99,
  45: 199,
  100: 399
};

function calculateTokenPrice(tokens) {
  const count = parseInt(tokens, 10);
  if (isNaN(count) || count <= 0) return 0;
  if (TOKEN_PACKAGES[count]) {
    return TOKEN_PACKAGES[count];
  }
  if (count <= 10) return Math.max(10, Math.round(count * 4.9));
  if (count <= 20) return Math.round(49 + ((count - 10) * 5.0));
  if (count <= 45) return Math.round(99 + ((count - 20) * 4.0));
  if (count <= 100) return Math.round(199 + ((count - 45) * 3.63));
  return Math.round(count * 3.99);
}

let selectedTokens = 20;
let userEmail = '';
let userCredits = 0;
let isUserLoggedIn = false;
let supabaseClient = null;

function initSupabaseAuth() {
  if (typeof supabase === 'undefined') return null;
  try {
    supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'duet_karaoke_auth_session'
      }
    });
    return supabaseClient;
  } catch (err) {
    console.warn('[Pricing] Supabase init warning:', err);
    return null;
  }
}

async function detectUserSession() {
  initSupabaseAuth();
  if (!supabaseClient) {
    updateAccountUI();
    return;
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      isUserLoggedIn = true;
      userEmail = session.user.email || 'Singer';

      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('credits')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile && typeof profile.credits === 'number') {
        userCredits = profile.credits;
      } else {
        userCredits = SUPABASE_CONFIG.freeCredits;
      }
    } else {
      isUserLoggedIn = false;
      userEmail = '';
      userCredits = 0;
    }
  } catch (err) {
    console.warn('[Pricing] Could not load user session:', err);
  }

  updateAccountUI();
}

function updateAccountUI() {
  const emailEl = document.getElementById('contact-user-email');
  const tokensEl = document.getElementById('contact-current-tokens');
  const videosEl = document.getElementById('contact-current-videos');

  if (emailEl) {
    if (isUserLoggedIn && userEmail) {
      emailEl.textContent = userEmail;
      emailEl.style.color = 'var(--brand-cyan)';
    } else {
      emailEl.innerHTML = '<a href="/" style="color: #94a3b8; text-decoration: underline;">Sign In at Studio</a> to sync account';
    }
  }

  if (tokensEl) tokensEl.textContent = userCredits;
  if (videosEl) videosEl.textContent = Math.floor(userCredits / SUPABASE_CONFIG.tokensPerVideo);

  updateOrderSummary();
}

function selectTokens(tokens) {
  const parsed = parseInt(tokens, 10);
  if (isNaN(parsed) || parsed < SUPABASE_CONFIG.tokensPerVideo) {
    selectedTokens = SUPABASE_CONFIG.tokensPerVideo;
  } else {
    selectedTokens = parsed;
  }

  const qtyInput = document.getElementById('token-quantity-input');
  if (qtyInput && parseInt(qtyInput.value, 10) !== selectedTokens) {
    qtyInput.value = selectedTokens;
  }

  // Update active state on package cards
  document.querySelectorAll('.token-pkg-card').forEach(card => {
    const cardTokens = parseInt(card.getAttribute('data-tokens'), 10);
    if (cardTokens === selectedTokens) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  updateOrderSummary();
}

function updateOrderSummary() {
  const videosCount = Math.floor(selectedTokens / SUPABASE_CONFIG.tokensPerVideo);
  const totalPrice = calculateTokenPrice(selectedTokens);
  const effectiveEmail = userEmail || 'my-account';

  const summaryTokens = document.getElementById('summary-tokens-num');
  const summaryVideos = document.getElementById('summary-videos-num');
  const summaryPrice = document.getElementById('summary-total-price');

  if (summaryTokens) summaryTokens.textContent = `${selectedTokens} Tokens`;
  if (summaryVideos) summaryVideos.textContent = `${videosCount} Full Video${videosCount === 1 ? '' : 's'}`;
  if (summaryPrice) summaryPrice.textContent = `₹${totalPrice}`;

  // Generate UPI Intent Pay URL
  const payeeName = 'Duet Karaoke Maker';
  const upiNote = encodeURIComponent(`Recharge ${selectedTokens} Tokens for ${effectiveEmail}`);
  const upiUri = `upi://pay?pa=${SUPABASE_CONFIG.upiId}&pn=${encodeURIComponent(payeeName)}&am=${totalPrice}&cu=INR&tn=${upiNote}`;

  const intentPayBtn = document.getElementById('btn-upi-intent-pay');
  if (intentPayBtn) {
    intentPayBtn.href = upiUri;
  }

  // Pre-formatted WhatsApp confirmation message
  const waBtn = document.getElementById('btn-contact-whatsapp');
  if (waBtn) {
    const waMessage = 
`*Duet Karaoke Maker - Token Recharge Request*

*Login Email:* ${effectiveEmail}
*Tokens Needed:* ${selectedTokens} Tokens
*Videos to Render:* ${videosCount} Videos (2 tokens/video)
*Total Amount:* ₹${totalPrice}
*UPI ID:* ${SUPABASE_CONFIG.upiId}

*UPI Payment Link:*
${upiUri}

I have initiated / completed the payment. Please credit ${selectedTokens} tokens to my account (${effectiveEmail}). Thank you!`;

    waBtn.href = `https://wa.me/${SUPABASE_CONFIG.whatsappNumber}?text=${encodeURIComponent(waMessage)}`;
  }
}

function showCopyToast(msg = 'Copied to clipboard!') {
  let toast = document.getElementById('copy-feedback-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'copy-feedback-toast';
    toast.className = 'copy-feedback-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// Initialization on DOMContentLoaded
window.addEventListener('DOMContentLoaded', async () => {
  // Check URL query parameters
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('reason');
  const reqTokens = params.get('tokens');

  if (reason === 'out_of_tokens') {
    const alertBanner = document.getElementById('out-of-tokens-banner');
    if (alertBanner) alertBanner.style.display = 'flex';
  }

  if (reqTokens) {
    const num = parseInt(reqTokens, 10);
    if (!isNaN(num) && num > 0) {
      selectedTokens = num;
    }
  }

  // Card click listeners
  document.querySelectorAll('.token-pkg-card').forEach(card => {
    card.addEventListener('click', () => {
      const tokens = parseInt(card.getAttribute('data-tokens'), 10);
      if (tokens) selectTokens(tokens);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const tokens = parseInt(card.getAttribute('data-tokens'), 10);
        if (tokens) selectTokens(tokens);
      }
    });
  });

  // Stepper controls
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

  // Copy UPI button
  document.getElementById('btn-copy-upi')?.addEventListener('click', () => {
    const upiId = SUPABASE_CONFIG.upiId;
    navigator.clipboard.writeText(upiId).then(() => {
      const copyBtn = document.getElementById('btn-copy-upi');
      if (copyBtn) {
        const orig = copyBtn.textContent;
        copyBtn.textContent = '✓ Copied!';
        copyBtn.style.color = '#10b981';
        setTimeout(() => {
          copyBtn.textContent = orig;
          copyBtn.style.color = '';
        }, 2000);
      }
      showCopyToast('UPI ID copied: ' + upiId);
    }).catch(() => {
      showCopyToast('UPI ID: ' + upiId);
    });
  });

  // Initial session detection and rendering
  selectTokens(selectedTokens);
  await detectUserSession();
});
