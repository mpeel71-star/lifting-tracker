// ================= Firebase (Auth + Firestore) =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// 🔐 Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDwL1Qo-aqD-3Dy2EGafZMF2VWEB0rkQao",
  authDomain: "lifting-tracker-5ff1b.firebaseapp.com",
  projectId: "lifting-tracker-5ff1b",
  storageBucket: "lifting-tracker-5ff1b.firebasestorage.app",
  messagingSenderId: "880909478435",
  appId: "1:880909478435:web:43cd4c5b24a136b4f5df96"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= Local Data =================
const LS_KEY = "lt_data_v4";

function defaultData() {
  return {
    routines: [],
    workouts: []
  };
}

function loadLocal() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    const d = defaultData();
    saveLocal(d);
    return d;
  }
  return JSON.parse(raw);
}

function saveLocal(d) {
  localStorage.setItem(LS_KEY, JSON.stringify(d));
}

let data = loadLocal();

// ================= Cloud Functions =================
async function cloudSave(uid) {
  await setDoc(doc(db, "users", uid), {
    data,
    updatedAt: Date.now()
  });
}

async function cloudLoad(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data().data;
}

// ================= DOM =================
const $ = id => document.getElementById(id);

const emailEl = $("fbEmail");
const passEl = $("fbPassword");
const signUpBtn = $("fbSignUp");
const signInBtn = $("fbSignIn");
const signOutBtn = $("fbSignOut");
const syncBtn = $("fbSyncNow");
const msgEl = $("fbMsg");
const statusEl = $("fbStatus");
const cloudLabel = $("cloudLabel");

// ================= Auth =================
function showError(text) {
  msgEl.textContent = text;
  statusEl.textContent = "";
}

function showStatus(text) {
  statusEl.textContent = text;
  msgEl.textContent = "";
}

signUpBtn.addEventListener("click", async () => {
  showError("");
  try {
    const email = emailEl.value.trim();
    const pass = passEl.value.trim();
    if (!email || !pass) return showError("Email and password required.");
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    showError(e.message);
  }
});

signInBtn.addEventListener("click", async () => {
  showError("");
  try {
    const email = emailEl.value.trim();
    const pass = passEl.value.trim();
    if (!email || !pass) return showError("Email and password required.");
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    showError(e.message);
  }
});

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

syncBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return showError("Not signed in.");
  await cloudSave(user.uid);
  showStatus("Synced to cloud ✅");
});

// ================= Auth State Listener =================
onAuthStateChanged(auth, async user => {
  if (!user) {
    cloudLabel.textContent = "Local mode";
    signOutBtn.style.display = "none";
    syncBtn.style.display = "none";
    return;
  }

  cloudLabel.textContent = "Cloud connected";
  signOutBtn.style.display = "inline-block";
  syncBtn.style.display = "inline-block";

  showStatus("Loading cloud...");
  const cloudData = await cloudLoad(user.uid);

  if (cloudData) {
    data = cloudData;
    saveLocal(data);
    showStatus("Cloud data loaded ✅");
  } else {
    await cloudSave(user.uid);
    showStatus("Cloud initialized from this device ✅");
  }
});
