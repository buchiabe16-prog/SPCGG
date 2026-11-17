// Free replacement for the Cloud Functions. Run every ~5 minutes by GitHub Actions.
//  1. Sends notifications queued in the app (status "pending") and scheduled ones whose time has come.
//  2. Sends automatic event reminders (Admin ▸ Automatic event reminders) from 08:00 Addis Ababa time.
const admin = require("firebase-admin");

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.error("Missing FIREBASE_SERVICE_ACCOUNT secret."); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
const db = admin.firestore();

const TOPICS = ["all", "lang_am", "lang_en"];

function push(d) {
  const topic = TOPICS.includes(d.topic) ? d.topic : "all";
  return admin.messaging().send({
    topic,
    notification: {
      title: String(d.title || "").slice(0, 100),
      body: String(d.body || "").slice(0, 500),
    },
    android: { priority: "high", notification: { channelId: "announcements" } },
  });
}

async function sendQueued() {
  const snap = await db.collection("outbox").where("status", "in", ["pending", "scheduled"]).limit(50).get();
  const now = Date.now();
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.status === "scheduled" && !(Number(d.sendAt) <= now)) continue; // not time yet
    // Claim it first so two overlapping runs cannot send it twice.
    try {
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        if (fresh.get("status") !== d.status) throw new Error("taken");
        tx.update(doc.ref, { status: "sending" });
      });
    } catch (e) { continue; }
    try {
      await push(d);
      await doc.ref.update({ status: "sent", sentAt: admin.firestore.FieldValue.serverTimestamp() });
      console.log("sent:", d.title);
    } catch (e) {
      await doc.ref.update({ status: "error", error: String(e).slice(0, 300) });
      console.error("error:", d.title, e.message);
    }
  }
}

// ---- Ethiopian calendar (same algorithm as the app) ----
function fromGregorian(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  const offset = 1723856;
  const r = (jdn - offset) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * Math.floor((jdn - offset) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  return [year, Math.floor(n / 30) + 1, (n % 30) + 1];
}
const ethKey = (y, m, d) => y * 10000 + m * 100 + d;

function nowInAddis() {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t) => Number(f.find((p) => p.type === t).value);
  return { y: get("year"), m: get("month"), d: get("day"), hour: get("hour") };
}

async function sendReminders() {
  const cfg = (await db.doc("config/reminders").get()).data() || {};
  if (cfg.enabled !== "yes") return;
  const t = nowInAddis();
  if (t.hour < 8) return; // reminders go out from 08:00
  const daysBefore = Math.max(0, Math.min(30, Number(cfg.daysBefore) || 0));
  const target = new Date(Date.UTC(t.y, t.m - 1, t.d + daysBefore));
  const [ey, em, ed] = fromGregorian(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate());
  const key = ethKey(ey, em, ed);

  const events = await db.collection("events").where("sortKey", "==", key).get();
  for (const doc of events.docs) {
    const e = doc.data();
    if (e.published === "no" || e.remindedFor === key) continue; // draft, or already reminded
    await doc.ref.update({ remindedFor: key }); // mark first so it can never be sent twice
    const en = daysBefore === 0 ? "Today" : daysBefore === 1 ? "Tomorrow" : `In ${daysBefore} days`;
    const am = daysBefore === 0 ? "ዛሬ" : daysBefore === 1 ? "ነገ" : `ከ${daysBefore} ቀን በኋላ`;
    try {
      await push({ topic: "lang_am", title: e.titleAm || e.titleEn, body: `${am}፦ ${e.metaAm || ""}`.trim() });
      await push({ topic: "lang_en", title: e.titleEn || e.titleAm, body: `${en}: ${e.metaEn || ""}`.trim() });
      await db.collection("outbox").add({
        title: `[auto] ${e.titleEn || e.titleAm || "Event"}`, body: "Automatic event reminder", topic: "all",
        by: "system", ts: Date.now(), status: "sent",
      });
      console.log("reminder sent:", e.titleEn || e.titleAm);
    } catch (err) {
      console.error("reminder failed:", err.message);
    }
  }
}

(async () => {
  await sendQueued();
  await sendReminders();
})().catch((e) => { console.error(e); process.exit(1); });
