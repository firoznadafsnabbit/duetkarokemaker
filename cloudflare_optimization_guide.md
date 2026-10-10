# Cloudflare Free Tier Optimization Guide for Duet Karaoke Maker

This guide walks you through activating Cloudflare's **100% Free CDN & DDoS Shield** to absorb 95% of traffic, enable global Gzip/Brotli edge compression, and handle thousands of concurrent users at **₹0 cost**.

---

### Step 1: Add Your Domain to Cloudflare (Free Plan)

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) and click **Add a Site**.
2. Enter your custom domain (e.g., `armaankaraoke.com`).
3. Select the **Free Plan ($0 / month)**.
4. Cloudflare will scan your existing DNS records and provide two nameservers (e.g., `aria.ns.cloudflare.com` and `noah.ns.cloudflare.com`).
5. Replace your existing domain nameservers at your domain registrar (GoDaddy, Namecheap, Hostinger, etc.) with Cloudflare's nameservers.

---

### Step 2: Configure DNS with the Orange Proxy Cloud (Active)

In Cloudflare Dashboard -> **DNS** -> **Records**:
- Add an `A` record pointing to your server's public IP address.
- Ensure the **Proxy status** toggle is set to **Proxied (Orange Cloud)**.
- This hides your real server IP and routes all incoming traffic through Cloudflare's global edge network.

---

### Step 3: Enable SSL/TLS Encryption

In Cloudflare Dashboard -> **SSL/TLS**:
- Select **Full** or **Full (Strict)** encryption mode.
- Go to **Edge Certificates**:
  - Turn **Always Use HTTPS** ON.
  - Turn **Automatic HTTPS Rewrites** ON.
  - Set **Minimum TLS Version** to `TLS 1.2`.

---

### Step 4: Configure Edge Caching Rules (Zero Server Bandwidth)

In Cloudflare Dashboard -> **Rules** -> **Page Rules** (or Cache Rules):

#### Rule A: Cache Everything for Static Code & Media
- **URL Pattern**: `*armaankaraoke.com/*.css*`, `*armaankaraoke.com/*.js*`, `*armaankaraoke.com/*.svg*`
- **Settings**:
  - **Cache Level**: `Cache Everything`
  - **Edge Cache TTL**: `1 month`
  - **Browser Cache TTL**: `7 days`

#### Rule B: Dynamic Bypass for APIs & Auth
- **URL Pattern**: `*armaankaraoke.com/api/*`
- **Settings**:
  - **Cache Level**: `Bypass` (Passes real-time API requests directly to your Node server)

---

### Step 5: Verify Cloudflare Integration in `server.js`

The codebase is already pre-configured to detect Cloudflare:
- **`CF-Connecting-IP`**: `server.js` automatically inspects `req.headers['cf-connecting-ip']` so that rate limiting applies to each real singer's IP, never Cloudflare's proxy IP.
- **Edge Cache Headers**: Static file routes emit `s-maxage=2592000` and `Cloudflare-CDN-Cache-Control` headers automatically.
- **`_headers` file**: Saved in [`public/_headers`](file:///c:/Users/Admin/Desktop/Duet%20karoke%20maker/public/_headers) for automatic rule ingestion if using Cloudflare Pages.
