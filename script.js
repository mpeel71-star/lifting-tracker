// ================= FIREBASE (CDN Modular SDK) =================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// 🔥 YOUR REAL FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDwLIqo-aqD-D3yzEGafZMF2VWEB0rkQao",
  authDomain: "lifting-tracker-5ff1b.firebaseapp.com",
  projectId: "lifting-tracker-5ff1b",
  storageBucket: "lifting-tracker-5ff1b.firebasestorage.app",
  messagingSenderId: "880909478435",
  appId: "1:880909478435:web:43cd4c5b24a136b4f5df96",
  measurementId: "G-8PMT4LHEXT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= BASIC CLOUD FUNCTIONS =================

async function saveToCloud(uid, data) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { data, updated: Date.now() });
}

async function loadFromCloud(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().data : null;
}

// ================= AUTH BUTTON LOGIC =================

const emailInput = document.querySelector("input[placeholder='Email']");
const passwordInput = document.querySelector("input[placeholder='Password']");
const createBtn = document.querySelector("button:nth-of-type(1)");
const signInBtn = document.querySelector("button:nth-of-type(2)");

createBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert("Email and password required.");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Account created successfully.");
  } catch (err) {
    alert("Firebase Error: " + err.message);
  }
});

signInBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert("Email and password required.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Signed in successfully.");
  } catch (err) {
    alert("Firebase Error: " + err.message);
  }
});

// Detect login state
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("Logged in as:", user.email);

    const cloudData = await loadFromCloud(user.uid);
    if (cloudData) {
      localStorage.setItem("lifting_data", JSON.stringify(cloudData));
      console.log("Cloud data loaded.");
    }
  } else {
    console.log("User logged out.");
  }
});
