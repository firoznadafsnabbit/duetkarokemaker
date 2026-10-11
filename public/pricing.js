/**
 * Duet Karaoke Maker - Dedicated Token Purchase Page Controller
 * 
 * Features:
 * - Dynamic generation of NPCI-compliant UPI links (₹49, ₹99, ₹199, ₹399, custom)
 * - Real-time dynamic UPI QR Code (scan & pay from ANY phone with GPay, PhonePe, Paytm, BHIM)
 * - Direct 1-tap mobile payment buttons for Google Pay, PhonePe, Paytm, and Universal UPI
 * - Live user identification (reads Supabase session or allows instant email entry)
 * - Instant WhatsApp payment confirmation generator with full order details
 * - 1-click clipboard copy for UPI ID and exact Payable Amount
 */

const SUPABASE_CONFIG = {
  url: 'https://odvgmniswfpahwkqwtcw.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdmdtbmlzd2ZwYWh3a3F3dGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MzE4MTksImV4cCI6MjEwNzEwNzgxOX0.dl3gytRtsokArFxN_VH2nMABfAF35757ghOnm-dYESs',
  whatsappNumber: '919663396058',
  upiId: 'feroznadaf13008@ybl',
  payeeName: 'ArmaanKaraoke',
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

// Dynamic URI State
let currentUpiUri = '';
let currentGpayUri = '';
let currentPhonepeUri = '';
let currentPaytmUri = '';

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
      userEmail = session.user.email || '';

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
  const emailInput = document.getElementById('purchase-email-input');
  const badgeEl = document.getElementById('account-status-badge');
  const tokensEl = document.getElementById('contact-current-tokens');
  const videosEl = document.getElementById('contact-current-videos');

  if (emailInput) {
    if (userEmail && (!emailInput.value || emailInput.value === '')) {
      emailInput.value = userEmail;
    }
    if (isUserLoggedIn && userEmail) {
      if (badgeEl) badgeEl.style.display = 'inline-block';
    } else {
      if (badgeEl) badgeEl.style.display = 'none';
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

function getEffectiveEmail() {
  const inputEl = document.getElementById('purchase-email-input');
  const inputVal = inputEl ? inputEl.value.trim() : '';
  return inputVal || userEmail || 'user@example.com';
}

function updateOrderSummary() {
  const videosCount = Math.floor(selectedTokens / SUPABASE_CONFIG.tokensPerVideo);
  const totalPrice = calculateTokenPrice(selectedTokens);
  const formattedAmount = Number(totalPrice).toFixed(2); // Strict 2-decimal format for NPCI compliance
  const effectiveEmail = getEffectiveEmail();

  // 1. Update text displays
  const summaryTokens = document.getElementById('summary-tokens-num');
  const summaryVideos = document.getElementById('summary-videos-num');
  const summaryPrice = document.getElementById('summary-total-price');
  const qrAmountText = document.getElementById('qr-amount-text');

  if (summaryTokens) summaryTokens.textContent = `${selectedTokens} Tokens`;
  if (summaryVideos) summaryVideos.textContent = `${videosCount} Full Video${videosCount === 1 ? '' : 's'}`;
  if (summaryPrice) summaryPrice.textContent = `₹${totalPrice}`;
  if (qrAmountText) qrAmountText.textContent = `₹${totalPrice}`;

  // 2. Build Clean NPCI-Compliant UPI URIs
  // Note: Avoid spaces or special characters in payee name and note to ensure all bank apps parse it properly
  const cleanNote = `Tokens_${selectedTokens}`;
  currentUpiUri = `upi://pay?pa=${SUPABASE_CONFIG.upiId}&pn=${SUPABASE_CONFIG.payeeName}&am=${formattedAmount}&cu=INR&tn=${cleanNote}`;
  currentGpayUri = `tez://upi/pay?pa=${SUPABASE_CONFIG.upiId}&pn=${SUPABASE_CONFIG.payeeName}&am=${formattedAmount}&cu=INR&tn=${cleanNote}`;
  currentPhonepeUri = `phonepe://pay?pa=${SUPABASE_CONFIG.upiId}&pn=${SUPABASE_CONFIG.payeeName}&am=${formattedAmount}&cu=INR&tn=${cleanNote}`;
  currentPaytmUri = `paytmmp://pay?pa=${SUPABASE_CONFIG.upiId}&pn=${SUPABASE_CONFIG.payeeName}&am=${formattedAmount}&cu=INR&tn=${cleanNote}`;

  // 3. Update Dynamic QR Code Image
  const qrImg = document.getElementById('upi-qr-image');
  if (qrImg) {
    const encodedUpi = encodeURIComponent(currentUpiUri);
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodedUpi}`;
  }

  // 4. Update WhatsApp Confirmation CTA with full order details
  const waBtn = document.getElementById('btn-contact-whatsapp');
  if (waBtn) {
    const waMessage = 
`*Duet Karaoke Maker - Token Recharge Request*

*Login Email:* ${effectiveEmail}
*Package Selected:* ${selectedTokens} Tokens (${videosCount} Full Videos)
*Amount Payable:* ₹${totalPrice}
*Paid to UPI ID:* ${SUPABASE_CONFIG.upiId}

Hi Armaan Karaoke Team, I have initiated payment of ₹${totalPrice} for ${selectedTokens} Tokens. Please verify and credit to my account (${effectiveEmail}). Thank you!`;

    waBtn.href = `https://wa.me/${SUPABASE_CONFIG.whatsappNumber}?text=${encodeURIComponent(waMessage)}`;
  }
}

function triggerUpiPayment(primaryUri, fallbackUri = '') {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) {
    showCopyToast('On Computer/Laptop? Scan the QR code below with any mobile UPI app!');
    const qrSection = document.getElementById('upi-qr-card');
    if (qrSection) {
      qrSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      qrSection.classList.add('highlight-pulse');
      setTimeout(() => qrSection.classList.remove('highlight-pulse'), 1500);
    }
    return;
  }

  // On Mobile: attempt primary intent, with fallback to universal upi://
  try {
    window.location.href = primaryUri;
    if (fallbackUri && fallbackUri !== primaryUri) {
      setTimeout(() => {
        window.location.href = fallbackUri;
      }, 1200);
    }
  } catch (err) {
    window.location.href = currentUpiUri;
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
  }, 2600);
}

// Global initialization
window.addEventListener('DOMContentLoaded', async () => {
  // 1. Check URL parameters
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

  // 2. Package Cards Click Listeners
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

  // 3. Custom Quantity Stepper Controls
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

  // 4. Live Email Input Listener (Updates order for this specific user in real time)
  document.getElementById('purchase-email-input')?.addEventListener('input', () => {
    updateOrderSummary();
  });

  // 5. Quick Pay App Buttons
  document.getElementById('btn-pay-universal')?.addEventListener('click', () => {
    triggerUpiPayment(currentUpiUri);
  });

  document.getElementById('btn-pay-gpay')?.addEventListener('click', () => {
    triggerUpiPayment(currentGpayUri, currentUpiUri);
  });

  document.getElementById('btn-pay-phonepe')?.addEventListener('click', () => {
    triggerUpiPayment(currentPhonepeUri, currentUpiUri);
  });

  document.getElementById('btn-pay-paytm')?.addEventListener('click', () => {
    triggerUpiPayment(currentPaytmUri, currentUpiUri);
  });

  // 6. Copy Buttons
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

  document.getElementById('btn-copy-amount')?.addEventListener('click', () => {
    const totalPrice = calculateTokenPrice(selectedTokens);
    navigator.clipboard.writeText(String(totalPrice)).then(() => {
      const copyBtn = document.getElementById('btn-copy-amount');
      if (copyBtn) {
        const orig = copyBtn.textContent;
        copyBtn.textContent = '✓ Copied!';
        copyBtn.style.color = '#10b981';
        setTimeout(() => {
          copyBtn.textContent = orig;
          copyBtn.style.color = '';
        }, 2000);
      }
      showCopyToast(`Amount ₹${totalPrice} copied!`);
    }).catch(() => {
      showCopyToast(`Amount: ₹${totalPrice}`);
    });
  });

  // Initial calculation and session sync
  selectTokens(selectedTokens);
  await detectUserSession();
});
