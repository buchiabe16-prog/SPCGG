# Free notification sender (no credit card, no Firebase Blaze plan)

This replaces the Cloud Functions. A GitHub Actions job runs every ~5 minutes and:
- sends notifications you queue in the app (Admin ▸ Send a notification) — **"Now" messages arrive within about 5–15 minutes**
- sends **scheduled** notifications when their time arrives
- sends **automatic event reminders** from 08:00 Addis Ababa time (Admin ▸ Automatic event reminders)

If you want instant sending, use Firebase Console ▸ Messaging instead (also free).

## Setup (about 15 minutes, once)

### 1. Get a Firebase service-account key
Firebase Console ▸ ⚙ ▸ **Project settings ▸ Service accounts ▸ Generate new private key** → a `.json` file downloads.
**Treat it like a password.** Never e-mail it, never put it in your Android project, never upload it to GitHub as a file.

### 2. Create a GitHub repository for this folder
1. Make a free account at github.com (no card needed).
2. **New repository** → name it e.g. `spcgg-notifier` → choose **Public** → Create.
   Why public: GitHub gives unlimited free Actions minutes to public repositories; a private one would run out. This is safe because
   the repository only holds this small script — your secret key is stored separately (step 3), encrypted, and is never visible.
3. Upload the **contents of this `free-automation` folder** (`run.js`, `package.json`, `.gitignore`, `FREE_AUTOMATION.md`, and the hidden `.github` folder with `workflows/notify.yml`).
   - Easiest: on your PC install **GitHub Desktop**, or use the website: *Add file ▸ Upload files* (drag the files; for `.github/workflows/notify.yml` use *Add file ▸ Create new file*, type the name `.github/workflows/notify.yml`, and paste the text).

### 3. Add the key as a secret
Repository ▸ **Settings ▸ Secrets and variables ▸ Actions ▸ New repository secret**
- Name: `FIREBASE_SERVICE_ACCOUNT`
- Secret: open the downloaded `.json` file in Notepad, copy **everything**, paste it.
Then delete the downloaded `.json` from Downloads (or keep it somewhere private).

### 4. Test it
Repository ▸ **Actions** tab ▸ *Send notifications* ▸ **Run workflow**. A green tick = it works.
Then in the app send a test notification: Recent should go **pending → sent** within a few minutes, and your phone should receive it
(the phone must have the app installed with notifications allowed).

### 5. Publish the new Firestore rules
Firebase Console ▸ Firestore Database ▸ Rules → paste `firestore.rules` from the project → Publish.
(Skip `storage.rules` and Cloud Functions — not needed here.)

## Things to know
- GitHub's timer can be late by a few minutes at busy times. Scheduled messages therefore arrive "around" the chosen time.
- GitHub **switches off scheduled workflows after 60 days with no activity in the repository.** If notifications stop one day, open the Actions tab and click *Enable workflow*, or edit any file in the repo. Put a reminder in your calendar every 2 months.
- If a message shows **error** in the app, open the repo's Actions tab ▸ the latest run ▸ see the log.
- Audio: this setup does not upload audio. Host the mp3 elsewhere (GitHub Releases, Supabase Storage…) and paste the direct link into the sermon's "Audio link" field.
