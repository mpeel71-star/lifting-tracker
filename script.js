import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// 🔥 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDwLIqo-aqD-D3yzEGafZMF2VWEB0rkQao",
  authDomain: "lifting-tracker-5ff1b.firebaseapp.com",
  projectId: "lifting-tracker-5ff1b",
  storageBucket: "lifting-tracker-5ff1b.firebasestorage.app",
  messagingSenderId: "880909478435",
  appId: "1:880909478435:web:43cd4c5b24a136b4f5df96",
  measurementId: "G-8PMT4LHEXT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const emailInput = document.querySelector("input[placeholder='Email']");
const passwordInput = document.querySelector("input[placeholder='Password']");
const createBtn = document.querySelector("button:nth-of-type(1)");
const signInBtn = document.querySelector("button:nth-of-type(2)");
const useLocalBtn = document.querySelector(".advanced button");

// ---------------- AUTH ----------------

createBtn.addEventListener("click", async () => {
  try {
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    alert("Account created successfully.");
  } catch (err) {
    alert(err.message);
  }
});

signInBtn.addEventListener("click", async () => {
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    alert("Signed in successfully.");
  } catch (err) {
    alert(err.message);
  }
});

// ---------------- CLOUD SYNC ----------------

async function pushToCloud(user) {
  const localData = localStorage.getItem("lifting_data");
  if (!localData) {
    alert("No local data to push.");
    return;
  }
  await setDoc(doc(db, "users", user.uid), {
    data: JSON.parse(localData),
    updated: Date.now()
  });
  alert("Data pushed to cloud.");
}

async function pullFromCloud(user) {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    alert("No cloud data found.");
    return;
  }
  localStorage.setItem("lifting_data", JSON.stringify(snap.data().data));
  alert("Cloud data loaded.");
  location.reload();
}

// When login state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Logged in as:", user.email);

    // Make advanced button become push button
    useLocalBtn.textContent = "Push local → Cloud";
    useLocalBtn.onclick = () => pushToCloud(user);

  } else {
    console.log("Logged out.");
  }
});
