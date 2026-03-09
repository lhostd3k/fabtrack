# FabTrack — Deployment Guide

## What You're Getting

A complete web app your team opens from their phone browser, then taps "Add to Home Screen" to install. It looks and works like a native app — no App Store, no Google Play, no developer fees.

**Stack:** React frontend + Node.js/Express backend + PostgreSQL database  
**Hosting:** Render.com (free tier available, paid starts at $7/mo)  
**Cost:** $0–$7/month depending on usage

---

## Step 1: Get the Code on GitHub

1. Create a GitHub account at github.com (free)
2. Install Git on your computer:
   - **Mac:** Open Terminal, type `git --version` (it'll prompt to install)
   - **Windows:** Download from git-scm.com
3. In Terminal / Command Prompt:

```bash
cd fabtrack
git init
git add .
git commit -m "Initial FabTrack setup"
```

4. On GitHub, click **New Repository** → name it `fabtrack` → **Create**
5. Follow the instructions GitHub shows to push your code:

```bash
git remote add origin https://github.com/YOUR_USERNAME/fabtrack.git
git branch -M main
git push -u origin main
```

---

## Step 2: Set Up the Database (Render)

1. Go to [render.com](https://render.com) and sign up (use GitHub login)
2. Click **New → PostgreSQL**
   - Name: `fabtrack-db`
   - Region: Oregon (closest to most US locations)
   - Plan: **Free** (good for starting, 256MB)
   - Click **Create Database**
3. Once created, copy the **Internal Database URL** — you'll need it next

---

## Step 3: Deploy the Server (Render)

1. On Render, click **New → Web Service**
2. Connect your GitHub repo (`fabtrack`)
3. Settings:
   - **Name:** `fabtrack`
   - **Region:** Same as your database
   - **Branch:** `main`
   - **Runtime:** Docker
   - **Plan:** Free (or Starter at $7/mo for always-on)
4. Add these **Environment Variables:**

| Key | Value |
|-----|-------|
| `DATABASE_URL` | *(paste the Internal Database URL from Step 2)* |
| `JWT_SECRET` | *(generate: run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` in your terminal)* |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `UPLOAD_DIR` | `./uploads` |
| `MAX_FILE_SIZE` | `10485760` |

5. Click **Deploy Web Service**

---

## Step 4: Initialize the Database

After the first deploy succeeds, you need to create tables and add your team.

1. On Render, go to your **PostgreSQL** service
2. Click **Shell** (or use the External Database URL with `psql`)
3. Or, add a **one-time job** on Render:
   - Go to your Web Service → **Shell**
   - Run:

```bash
node db/init.js
node db/seed.js
```

This creates all tables and adds your 17 team members with default PIN `1234`.

---

## Step 5: Set Up Your Domain (Optional but Recommended)

**Option A — Free Render URL:**  
Your app will be at `https://fabtrack.onrender.com` (or similar). This works fine.

**Option B — Custom domain ($10–15/year):**
1. Buy a domain at [Namecheap](https://namecheap.com) or [Porkbun](https://porkbun.com)
   - Example: `fabtrack.app` or `yourcompanyname.app`
2. On Render → your Web Service → **Settings → Custom Domain**
3. Add your domain and follow the DNS instructions

---

## Step 6: Install on Phones (PWA)

Send your team the link. Here's how they "install" it:

### iPhone (Safari)
1. Open the FabTrack URL in **Safari** (must be Safari, not Chrome)
2. Tap the **Share** button (square with arrow)
3. Scroll down, tap **"Add to Home Screen"**
4. Tap **"Add"**
5. FabTrack icon now appears on home screen

### Android (Chrome)
1. Open the FabTrack URL in **Chrome**
2. Tap the **three dots** menu (top right)
3. Tap **"Install app"** or **"Add to Home Screen"**
4. Tap **"Install"**
5. FabTrack icon now appears on home screen

That's it. It opens full-screen like a real app.

---

## Step 7: First Login

1. Everyone's default PIN is **1234**
2. Each person taps their name on the login screen
3. Enters PIN `1234`
4. **Important:** Have everyone change their PIN in settings after first login

---

## Ongoing Maintenance

### The app auto-deploys
Every time you push code changes to GitHub, Render automatically rebuilds and deploys. No manual steps.

```bash
# Make a change, then:
git add .
git commit -m "Updated project types"
git push
```

### Backups
Render's paid PostgreSQL plans include automatic daily backups. On the free plan, you can manually export:

```bash
pg_dump YOUR_DATABASE_URL > backup.sql
```

### Adding/Removing Team Members
You can either:
- Edit `db/seed.js` and re-run it (careful: this resets all PINs)
- Or use the Render database shell to add individual users:

```sql
INSERT INTO users (name, pin, role, sub_role, division, avatar_color)
VALUES ('NewPerson', '$2a$10$...', 'fabricator', 'Fabricator', 'metal', '#7c9aff');
```

(Use `node -e "require('bcryptjs').hash('1234',10).then(console.log)"` to generate the hashed PIN)

---

## Cost Summary

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| Render Web Service | Free (spins down after 15min idle) | $7/mo (always on) |
| Render PostgreSQL | Free (256MB, expires in 90 days) | $7/mo (1GB) |
| Domain (optional) | Use Render's free URL | $10-15/year |
| **Total** | **$0/mo** | **$14/mo + domain** |

**Recommendation:** Start free to test with your team. When ready for daily use, upgrade to the $14/mo paid tier so the app loads instantly (free tier has a ~30 second cold start after being idle).

---

## Troubleshooting

**App shows blank screen:**  
Check browser console (inspect → console). Usually a build error. Run `npm run build` locally to see errors.

**"Add to Home Screen" not showing on iPhone:**  
Must use Safari. Chrome on iOS doesn't support PWA install.

**Photos not uploading:**  
Check that `UPLOAD_DIR` environment variable is set. On Render free tier, uploads are cleared on each deploy (use Cloudinary or S3 for persistent storage on production).

**Database connection error:**  
Make sure you used the **Internal** Database URL (not External) on Render.

**App is slow to load first time:**  
Free tier Render services spin down after 15 minutes of no traffic. First request takes ~30 seconds to wake up. Upgrade to Starter plan ($7/mo) to fix this.
