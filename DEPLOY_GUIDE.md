# Shopify Section App - Railway Deployment Guide (Roman English)

Yeh rahi aapki step-by-step guide app ko Railway par live karne ke liye. Har step ko gaur se follow karein.

## Step 1: Code ko GitHub par dalna
Sabse pehle aapka code internet par hona chahiye taake Railway wahan se utha sake.

1.  **Terminal kholein** aur apne project folder `shopi-section` mein hon.
2.  Ye commands one-by-one run karein:
    ```bash
    git init
    git add .
    git commit -m "My first shopify app"
    ```
3.  **GitHub.com** par jayen aur login karein.
4.  Top right par `+` nishaan par click karein aur **New Repository** banayein.
    - Repository ka naam rakhein (jaise: `shopify-section-app`).
    - "Private" ya "Public" jo marzi select karein.
    - "Create repository" button dabayein.
5.  GitHub aapko kuch commands dega "…or push an existing repository from the command line" ke neeche. Wo copy karein aur apne terminal mein paste karein. Wo kuch aisi hongi:
    ```bash
    git remote add origin https://github.com/AAP_KA_USERNAME/shopify-section-app.git
    git push -u origin main
    ```

## Step 2: Railway par Project Banana
Ab hum Railway par server banayenge.

1.  [Railway.app](https://railway.app/) par jayen aur GitHub se login karein.
2.  **+ New Project** par click karein.
3.  **Deploy from GitHub repo** select karein.
4.  Apni list mein se `shopify-section-app` (jo abhi banayi) select karein.
5.  **Deploy Now** par click karein.
    - *Note:* Pehli baar deployment fail ho sakti hai kyunke humne abhi settings (variables) nahi dali. Ye normal hai.

## Step 3: Database Add Karna
Shopify app ko data save karne ke liye database chahiye.

1.  Railway par apne project ke andar, **+ New** button (ya right click) dabayein.
2.  **Database** select karein aur phir **PostgreSQL** choose karein.
3.  Thora wait karein, Railway automatically ek database bana dega.
    - *Faida:* Railway automatically `DATABASE_URL` nam ka variable aapki app mein inject kar dega, apko khud kuch karne ki zaroorat nahi.

## Step 4: Variables (Settings) Set Karna
Ab hum app ko batayenge ke Shopify se kaise connect hona hai.

1.  Railway mein apne App wale box (Repo card) par click karein.
2.  **Variables** tab mein jayen.
3.  **New Variable** par click karke neeche diye gaye variables add karein:

| Variable Name | Value (Kahan se milega?) |
|--------------|--------------------------|
| `SHOPIFY_API_KEY` | `a21834654b350e333c82807b0369850c` (Ye maine `shopify.app.toml` file se liya hai) |
| `SHOPIFY_API_SECRET` | 1. [Shopify Partners](https://partners.shopify.com/) mein jayen.<br>2. **Apps** > **Shopi Section** par click karein.<br>3. **Client credentials** mein "Client secret" copy karein. |
| `SCOPES` | `write_products` |
| `HOST` | 1. Railway mein **Settings** tab mein jayen.<br>2. **Networking** ke neeche **Generate Domain** par click karein.<br>3. Jo domain aye (e.g. `xxx.up.railway.app`), uske shuru mein `https://` lagayen. (e.g. `https://shopi-section.up.railway.app`) |
| `SHOPIFY_APP_URL` | Jo upar `HOST` ki value hai, wahi same yahan dalein. |

4.  Jab saare variables dal jayen, Railway khud hi dobara deploy shuru kar dega. Agar nahi kiya, to **Deployments** tab mein jakar **Redeploy** karein.

## Step 5: Shopify Partners Dashboard Update Karna
Ab Shopify ko batana hai ke aapki app Railway par chal rahi hai.

1.  [Shopify Partners Dashboard](https://partners.shopify.com/) mein wapis jayen.
2.  Side menu mein **App Setup** par click karein.
3.  **App URL** walay box mein apna Railway ka domain dalein (`https://...railway.app`).
4.  **Allowed redirection URL(s)** mein neeche diye gaye 4 URLs add karein (apna domain replace karein):
    - `https://AAPKA-RAILWAY-DOMAIN.up.railway.app/auth/callback`
    - `https://AAPKA-RAILWAY-DOMAIN.up.railway.app/auth/shopify/callback`
    - `https://AAPKA-RAILWAY-DOMAIN.up.railway.app/api/auth/callback`
    - `https://AAPKA-RAILWAY-DOMAIN.up.railway.app/login`
5.  **Save** par click karein.

## Step 6: Extension (Section) Publish Karna
App ab live hai, lekin jo Section humne banaya hai wo abhi Shopify par nahi gaya.

1.  Apne computer ke terminal mein wapis ayen.
2.  Ye command chalayein:
    ```bash
    npm run deploy
    ```
3.  Aapse poocha jayega "Do you want to create a new version?", **Yes** select karein.
4.  Jab complete ho jaye, to **Partners Dashboard** mein **Extensions** par click karein.
5.  Wahan apko apna extension nazar ayega. Usay open karke **Versions** mein jayen aur **Publish** kar dein.

---
**Mubarak ho!** Ab koi bhi user jab ye app install karega, wo Theme Editor mein "My Custom Section" add kar sakega.
