# 🚀 Powerplay · Online Hosting & Deployment Guide

This guide provides simple, step-by-step instructions to host **Powerplay: IPL Mega Auction & Franchise Strategy** online so you and your friends can play together on laptops, tablets, and mobile phones from anywhere.

---

## ⚡ Key Highlights
- **Zero Third-Party Dependencies**: The backend (`server.py`) is built purely on Python's standard library. No complex package installations needed.
- **Full Responsive Design**: Optimized for desktop laptops, iPads/tablets, and mobile phones (iOS Safari & Android Chrome).
- **Independent & Private**: All third-party redirects have been completely removed. Your room codes, bids, chat, and tournament saves run privately.

---

## 🌐 Method 1: Render.com (Free & Recommended)
*Render offers free cloud hosting that keeps your app online 24/7 with automatic free SSL (HTTPS).*

### Steps:
1. **Push your code to GitHub**:
   - If not already on GitHub, create a repository (e.g. `powerplay-cricket`) and push this project folder to it.
2. **Sign up on Render**:
   - Go to [render.com](https://render.com) and create a free account.
3. **Create a New Web Service**:
   - Click the **New +** button in the dashboard and select **Web Service**.
   - Connect your GitHub account and choose your `powerplay-cricket` repository.
4. **Configure the Service**:
   - **Name**: `powerplay-cricket` (or any name you like)
   - **Region**: Choose the closest region (e.g., Singapore, Frankfurt, or Oregon)
   - **Environment**: `Python 3`
   - **Build Command**: `echo 'Ready'`
   - **Start Command**: `python server.py`
   - **Plan Type**: `Free`
5. **Deploy**:
   - Click **Create Web Service**.
   - In 1 to 2 minutes, Render will build and deploy your app.
   - You will get a live link such as: `https://powerplay-cricket.onrender.com`!

---

## 🚂 Method 2: Railway.app (Instant 1-Click)
*Railway automatically detects the provided `Procfile` and `Dockerfile`.*

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your repository. Railway will detect `python server.py` and deploy automatically.
4. Go to **Settings** → **Networking** → Click **Generate Domain**.
5. Your app is live!

---

## ⚡ Method 3: Instant Play Right Now (No Hosting Setup Needed)
*If you want to play with friends immediately without setting up GitHub/Render:*

1. Keep `server.py` running on your laptop (`python server.py`).
2. In a new terminal window, run either:
   ```bash
   # Using free Cloudflare Tunnel (no account required):
   npx cloudflared tunnel --url http://localhost:3000
   ```
   *OR*
   ```bash
   # Using Ngrok:
   ngrok http 3000
   ```
3. Copy the public `https://...` link generated in your terminal and send it to your friends. They can join your room directly from their phones!

---

## 📱 Mobile Play & PWA Installation
Powerplay is designed to look and feel like a native mobile app:
- **iPhone / iPad**: Open the link in **Safari**, tap the **Share** button (box with up arrow), and select **"Add to Home Screen"**.
- **Android**: Open the link in **Chrome**, tap the three dots in the top right, and select **"Install app"** or **"Add to Home Screen"**.
- When launched from your home screen, Powerplay opens full-screen without browser address bars!

---

## 🔑 Custom Google Sign-In (Optional)
If you wish to enable Google accounts for your hosted site:
1. Create a free project on [supabase.com](https://supabase.com).
2. Under **Authentication** → **URL Configuration**, set your site URL (e.g. `https://powerplay-cricket.onrender.com`).
3. Under **Authentication** → **Providers**, turn on Google and enter your Google OAuth Client ID and Secret.
4. In your hosting dashboard (Render or Railway), add two Environment Variables:
   - `SUPABASE_URL`: `https://your-project.supabase.co`
   - `SUPABASE_ANON_KEY`: `your-anon-public-key`
Powerplay will automatically activate Google Sign-In for your domain!
*(If left empty, players play smoothly with local profiles and real-time display names with zero external setup).*
