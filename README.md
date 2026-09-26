# Urnik – shift sign-up for a clinic

A small web app that replaces "SMS everyone, first to reply gets the shift".

- **Admin (the clinic):** adds open dates (morning/afternoon, 1–4 people), sees who applied, approves with one tap or uses **Pametno razporedi** (smart assign) which spreads hours as evenly as possible. The proposal is always shown first and only saved after she confirms. The overview shows hours and shifts per person for the month.
- **Workers:** each person gets one personal link (sent once, valid forever). They tap the shifts they can do and see the result: *čaka potrditev* (waiting), *Potrjeno* (approved, green), *Ni izbrano* (not chosen). Speed of reply doesn't matter.

The interface is in Slovenian. No accounts or passwords for workers. SMS messages are sent from the admin's own phone (the app opens the SMS app with the text ready), so there are no SMS costs.

## Rules built in

- A shift can't get more people than needed.
- One person can't be assigned both shifts on the same day.
- Workers can withdraw a request until it's approved. After that they must call (the phone number from settings is shown).
- New dates can be added and approvals made at any time (e.g. "we need someone tomorrow").
- Smart assign: fills the hardest-to-cover shifts first and always picks the applicant with the fewest hours that month. On a tie, the person who applied for fewer shifts wins, then a stable random order.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000/admin, password: admin
npm test             # smart-assign tests
```

Locally the data is stored in `data/urnik.db` (SQLite). No setup is needed.

## Deploy for free (Vercel + Turso)

1. **Database:** create a free account at [turso.tech](https://turso.tech), then create a database (region: Europe). On the database page choose *Connect* / *Create token* and copy the **Database URL** (`libsql://…`) and the **token**.
2. **Hosting:** create a free account at [vercel.com](https://vercel.com), click *Add New → Project* and import this GitHub repository.
3. Before deploying, add these **Environment Variables**:
   | Name | Value |
   | --- | --- |
   | `ADMIN_PASSWORD` | the password the clinic will use |
   | `TURSO_DATABASE_URL` | `libsql://…` from step 1 |
   | `TURSO_AUTH_TOKEN` | the token from step 1 |
4. Click **Deploy**. Tables are created automatically on first use.
5. Open `https://<your-project>.vercel.app/admin`, log in, and add the clinic name and shift times under **Nastavitve**.

Tip: on the admin's phone, open `/admin` and choose *Add to Home Screen*. It then opens like an app and she stays logged in for a year.

To change the password, change `ADMIN_PASSWORD` in Vercel and redeploy. Everyone is logged out.

## Structure

```
app/admin            admin screen (client app in components/AdminApp.js + components/admin/*)
app/w/[token]        worker's personal page (components/WorkerApp.js)
app/api/admin/*      admin JSON API (cookie-protected)
app/api/w/[token]    worker JSON API (token = personal link)
lib/assign.js        smart-assign algorithm (pure, tested in tests/)
lib/data.js          all database queries and rules
lib/db.js            libSQL client, local file or Turso, schema auto-created
```

See `NAVODILA.md` for the short Slovenian guide for the clinic.
