// One-time import of the daily readings (Katameros) into Firestore. Run from GitHub Actions: Actions ▸ "Import Katameros" ▸ Run workflow.
//   katameros/{unitId}  = one set of readings (a day's, a Sunday's or a feast's)
//   katday/{month}_{day} = which set of readings is used on each Ethiopian date (month 1-13)
const admin = require("firebase-admin");
const fs = require("fs");
const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.error("Missing FIREBASE_SERVICE_ACCOUNT secret."); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore(admin.app(), process.env.FIRESTORE_DATABASE_ID || "default");

(async () => {
  const data = JSON.parse(fs.readFileSync(__dirname + "/katameros-data.json", "utf8"));
  const writes = [];
  for (const [id, u] of Object.entries(data.units)) writes.push([db.collection("katameros").doc(id), { title: u.title, readings: u.readings }]);
  for (const [id, d] of Object.entries(data.days)) writes.push([db.collection("katday").doc(id), { occ: d.occ, unit: d.unit }]);
  console.log("Writing", writes.length, "documents…");
  for (let i = 0; i < writes.length; i += 20) {
    const batch = db.batch();
    writes.slice(i, i + 20).forEach(([ref, val]) => batch.set(ref, val));
    await batch.commit();
    console.log("  " + Math.min(i + 20, writes.length) + " / " + writes.length);
  }
  console.log("Done.");
})().catch((e) => { console.error(e); process.exit(1); });
