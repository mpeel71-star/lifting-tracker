// ======================= Firebase (Auth + Firestore) =======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// Your Firebase config (from your screenshot)
const firebaseConfig = {
  apiKey: "AIzaSyDwLIqo-aqD-D3yzEGafZMF2VWEB0rkQao",
  authDomain: "lifting-tracker-5ff1b.firebaseapp.com",
  projectId: "lifting-tracker-5ff1b",
  storageBucket: "lifting-tracker-5ff1b.firebasestorage.app",
  messagingSenderId: "880909478435",
  appId: "1:880909478435:web:43cd4c5b24a136b4f5df96",
  measurementId: "G-8PMT4LHEXT"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

// DOM
const elEmail = document.getElementById("fbEmail");
const elPass = document.getElementById("fbPassword");
const btnCreate = document.getElementById("fbCreateAccount");
const btnSignIn = document.getElementById("fbSignIn");
const btnSignOut = document.getElementById("fbSignOut");
const btnPush = document.getElementById("fbPush");
const btnPull = document.getElementById("fbPull");
const btnUseLocal = document.getElementById("fbUseLocal");
const fbMsg = document.getElementById("fbMsg");
const fbStatus = document.getElementById("fbStatus");

function showErr(e) {
  const msg = e?.message ? e.message : String(e);
  fbMsg.textContent = "Firebase: " + msg;
  console.error(e);
}
function clearErr() { fbMsg.textContent = ""; }
function showStatus(t) { fbStatus.textContent = t || ""; }

// IMPORTANT: This must match your app’s localStorage key.
const LOCAL_KEY = "lt_data_v2";

async function cloudSave(uid, dataObj) {
  await setDoc(doc(db, "users", uid), { data: dataObj, updatedAt: Date.now() }, { merge: true });
}
async function cloudLoad(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data()?.data ?? null;
}

async function pushLocalToCloud(user) {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (!raw) throw new Error(`No local data found in localStorage key: ${LOCAL_KEY}`);
  const data = JSON.parse(raw);
  await cloudSave(user.uid, data);
  showStatus("✅ Pushed local → cloud.");
}

async function pullCloudToLocal(user) {
  const data = await cloudLoad(user.uid);
  if (!data) throw new Error("No cloud data found for this user yet.");
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  showStatus("✅ Pulled cloud → local. Reloading…");
  setTimeout(() => location.reload(), 400);
}

// Auth handlers
btnCreate.addEventListener("click", async () => {
  clearErr(); showStatus("");
  const email = elEmail.value.trim();
  const pass = elPass.value;
  if (!email || !pass) { fbMsg.textContent = "Email and password required."; return; }
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    showStatus("✅ Account created and signed in.");
  } catch (e) { showErr(e); }
});

btnSignIn.addEventListener("click", async () => {
  clearErr(); showStatus("");
  const email = elEmail.value.trim();
  const pass = elPass.value;
  if (!email || !pass) { fbMsg.textContent = "Email and password required."; return; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showStatus("✅ Signed in.");
  } catch (e) { showErr(e); }
});

btnSignOut.addEventListener("click", async () => {
  clearErr(); showStatus("");
  try {
    await signOut(auth);
    showStatus("Signed out.");
  } catch (e) { showErr(e); }
});

btnUseLocal.addEventListener("click", () => {
  clearErr();
  showStatus("Using local only. (Cloud is optional.)");
});

// Show/hide controls on auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    btnSignOut.style.display = "inline-block";
    btnPush.style.display = "inline-block";
    btnPull.style.display = "inline-block";
    showStatus(`Signed in as ${user.email}`);

    btnPush.onclick = async () => {
      clearErr(); showStatus("");
      try { await pushLocalToCloud(user); }
      catch (e) { showErr(e); }
    };

    btnPull.onclick = async () => {
      clearErr(); showStatus("");
      try { await pullCloudToLocal(user); }
      catch (e) { showErr(e); }
    };

  } else {
    btnSignOut.style.display = "none";
    btnPush.style.display = "none";
    btnPull.style.display = "none";
  }
});

// ======================= Your App (Local storage based) =======================
// Below is a minimal working skeleton that will not break your UI.
// If you already had a full working lifting tracker, paste it HERE instead,
// but keep the Firebase section above intact.

const $ = (id) => document.getElementById(id);

// Tabs
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tabpage").forEach(p => p.classList.remove("active"));
    $(`tab-${tab}`).classList.add("active");
  });
});

// Export/Import JSON
$("exportBtn").addEventListener("click", () => {
  const raw = localStorage.getItem(LOCAL_KEY) || "{}";
  const blob = new Blob([raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lifting-tracker.json";
  a.click();
  URL.revokeObjectURL(url);
});

$("importBtn").addEventListener("click", () => $("importFile").click());

$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    JSON.parse(text);
    localStorage.setItem(LOCAL_KEY, text);
    alert("Imported. Reloading…");
    location.reload();
  } catch {
    alert("Invalid JSON.");
  }
});

// Minimal placeholder to avoid empty UI
$("activeRoutineLabel").textContent = "Local mode";
$("daySelect").innerHTML = `<option>Push</option><option>Pull</option><option>Legs</option>`;
$("workoutArea").innerHTML = `<div class="muted">Your workout UI comes from your original app code.</div>`;
$("routinesArea").innerHTML = `<div class="muted">Your routines UI comes from your original app code.</div>`;
$("historyArea").innerHTML = `<div class="muted">Your history UI comes from your original app code.</div>`;
$("reportExercise").innerHTML = `<option>Bench Press</option><option>Squat</option><option>Row</option>`;
$("reportTable").innerHTML = `<div class="muted">Your report table comes from your original app code.</div>`;
