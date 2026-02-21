// ===========================
// Lifting Tracker + Firebase Sync
// ===========================

// ---------- Firebase (Auth + Firestore) ----------
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

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);
const setText = (id, txt) => { const el = $(id); if (el) el.textContent = txt || ""; };
const show = (id, on) => { const el = $(id); if (el) el.style.display = on ? "" : "none"; };
const cls = (el, c, on) => el && el.classList.toggle(c, !!on);

// ---------- Storage ----------
const LS_KEY = "lt_data_v3";
const LS_PW = "lt_pw_v1";

function defaultData() {
  const now = Date.now();
  const routineId = crypto.randomUUID();
  return {
    schemaVersion: 3,
    activeRoutineId: routineId,
    routines: [
      {
        id: routineId,
        name: "PPL v1",
        createdAt: now,
        days: [
          { name: "Push", exercises: [
            { name: "Bench Press", tag: "compound" },
            { name: "Incline DB Press", tag: "compound" },
            { name: "Overhead Press", tag: "compound" },
            { name: "Triceps Pushdown", tag: "accessory" }
          ]},
          { name: "Pull", exercises: [
            { name: "Pull-up / Lat Pulldown", tag: "compound" },
            { name: "Barbell Row", tag: "compound" },
            { name: "Face Pull", tag: "accessory" },
            { name: "Biceps Curl", tag: "accessory" }
          ]},
          { name: "Legs", exercises: [
            { name: "Squat", tag: "compound" },
            { name: "RDL", tag: "compound" },
            { name: "Leg Press", tag: "compound" },
            { name: "Calf Raise", tag: "accessory" }
          ]}
        ]
      }
    ],
    history: [], // workout entries
    updatedAt: now
  };
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultData();
    const data = JSON.parse(raw);
    if (!data || !data.routines) return defaultData();
    return data;
  } catch {
    return defaultData();
  }
}

function saveLocal(data) {
  data.updatedAt = Date.now();
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function getLocalPassword() {
  return localStorage.getItem(LS_PW) || "lift";
}

function setLocalPassword(pw) {
  localStorage.setItem(LS_PW, pw);
}

// ---------- App state ----------
let state = {
  data: loadLocal(),
  unlocked: false,
  currentUser: null,
  activeWorkout: null, // { routineId, dayName, startedAt, exercises:[{name, tag, sets:[]}] }
  chart: null
};

// ---------- UI wiring (tabs) ----------
function initTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab"));
  tabs.forEach(t => {
    t.addEventListener("click", () => {
      tabs.forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      const tab = t.dataset.tab;
      Array.from(document.querySelectorAll(".panel")).forEach(p => {
        const on = p.dataset.panel === tab;
        p.classList.toggle("hidden", !on);
        p.classList.toggle("active", on);
      });
      if (tab === "history") renderHistory();
      if (tab === "reports") renderReports();
      if (tab === "routines") renderRoutines();
    });
  });
}

// ---------- Render helpers ----------
function activeRoutine() {
  return state.data.routines.find(r => r.id === state.data.activeRoutineId) || state.data.routines[0];
}

function uniqueExercisesFromHistory() {
  const set = new Set();
  for (const w of state.data.history) {
    for (const ex of w.exercises) set.add(ex.name);
  }
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function filterByCompoundOnly(exercises, compoundOnly) {
  if (!compoundOnly) return exercises;
  return exercises.filter(e => e.tag === "compound");
}

// ---------- Labels ----------
function refreshLabels() {
  const r = activeRoutine();
  setText("activeRoutineLabel", r ? `Active: ${r.name}` : "");
  setText("cloudLabel", state.currentUser ? `Cloud: ${state.currentUser.email}` : "Local mode");
}

// ---------- Login lock ----------
function initLock() {
  $("pwBtn").addEventListener("click", () => {
    const pw = ($("pwInput").value || "").trim();
    if (!pw) { setText("pwMsg", "Enter a password."); return; }
    if (pw !== getLocalPassword()) { setText("pwMsg", "Wrong password."); return; }
    state.unlocked = true;
    setText("pwMsg", "");
    cls($("loginView"), "hidden", true);
    cls($("mainView"), "hidden", false);
    bootAppUI();
  });

  $("pwInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("pwBtn").click();
  });
}

// ---------- Firebase UI ----------
function fbMsg(errTxt = "", okTxt = "") {
  setText("fbMsg", errTxt);
  setText("fbStatus", okTxt);
}

function userDocRef(uid) {
  return doc(db, "users", uid);
}

async function cloudLoad(uid) {
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const payload = snap.data();
  return payload?.data ?? null;
}

async function cloudSave(uid, dataObj) {
  const ref = userDocRef(uid);
  await setDoc(ref, { data: dataObj, updatedAt: Date.now() }, { merge: true });
}

function initFirebaseUI() {
  const emailEl = $("fbEmail");
  const passEl  = $("fbPassword");

  $("fbSignUp").addEventListener("click", async () => {
    fbMsg("");
    const email = (emailEl.value || "").trim();
    const pass  = (passEl.value || "").trim();
    if (!email || !pass) { fbMsg("Email and password required."); return; }
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      fbMsg("", "Account created + signed in.");
    } catch (e) {
      fbMsg(`Firebase Error: ${e?.message || e}`);
    }
  });

  $("fbSignIn").addEventListener("click", async () => {
    fbMsg("");
    const email = (emailEl.value || "").trim();
    const pass  = (passEl.value || "").trim();
    if (!email || !pass) { fbMsg("Email and password required."); return; }
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      fbMsg("", "Signed in successfully.");
    } catch (e) {
      fbMsg(`Firebase Error: ${e?.message || e}`);
    }
  });

  $("fbSignOut").addEventListener("click", async () => {
    fbMsg("");
    try {
      await signOut(auth);
      fbMsg("", "Signed out.");
    } catch (e) {
      fbMsg(`Firebase Error: ${e?.message || e}`);
    }
  });

  // Advanced: Push / Pull / Use local
  $("btnPushCloud").addEventListener("click", async () => {
    fbMsg("");
    if (!state.currentUser) { fbMsg("Sign in first."); return; }
    try {
      await cloudSave(state.currentUser.uid, state.data);
      fbMsg("", "✅ Pushed local → cloud.");
    } catch (e) {
      fbMsg(`Firebase Error: ${e?.message || e}`);
    }
  });

  $("btnPullCloud").addEventListener("click", async () => {
    fbMsg("");
    if (!state.currentUser) { fbMsg("Sign in first."); return; }
    try {
      const cloud = await cloudLoad(state.currentUser.uid);
      if (!cloud) { fbMsg("No cloud data yet for this user."); return; }
      state.data = cloud;
      saveLocal(state.data);
      refreshLabels();
      renderAll();
      fbMsg("", "✅ Pulled cloud → local (overwrote local).");
    } catch (e) {
      fbMsg(`Firebase Error: ${e?.message || e}`);
    }
  });

  $("btnUseLocal").addEventListener("click", () => {
    fbMsg("", "Using local data in-app.");
    state.data = loadLocal();
    refreshLabels();
    renderAll();
  });

  onAuthStateChanged(auth, async (user) => {
    state.currentUser = user || null;
    refreshLabels();

    show("fbSignOut", !!user);
    show("btnPushCloud", !!user);
    show("btnPullCloud", !!user);

    if (!user) return;

    // If cloud exists, do NOT overwrite automatically. Just inform.
    try {
      const cloud = await cloudLoad(user.uid);
      if (cloud) {
        fbMsg("", "Cloud data found. Use Pull/Push in Advanced.");
      } else {
        fbMsg("", "No cloud data yet. Use Advanced → Push local → cloud to create it.");
      }
    } catch (e) {
      fbMsg(`Firebase Error: ${e?.message || e}`);
    }
  });
}

// ---------- Core app UI ----------
function bootAppUI() {
  initTabs();
  initButtons();
  refreshLabels();
  renderAll();
}

function initButtons() {
  // Export / Import
  $("btnExport").addEventListener("click", () => exportJson(state.data));
  $("exportJsonBtn").addEventListener("click", () => exportJson(state.data));
  $("exportCsvBtn").addEventListener("click", () => exportCsv());

  $("fileImport").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const obj = JSON.parse(txt);
      if (!obj || !obj.routines) throw new Error("Invalid JSON (missing routines).");
      state.data = obj;
      saveLocal(state.data);
      refreshLabels();
      renderAll();
      alert("Imported JSON successfully.");
    } catch (err) {
      alert(`Import failed: ${err?.message || err}`);
    } finally {
      e.target.value = "";
    }
  });

  // Log buttons
  $("startWorkoutBtn").addEventListener("click", startWorkout);
  $("clearWorkoutBtn").addEventListener("click", () => {
    state.activeWorkout = null;
    renderWorkout();
  });
  $("saveWorkoutBtn").addEventListener("click", saveWorkout);

  $("logCompoundOnly").addEventListener("change", renderWorkout);

  // Routines buttons
  $("newRoutineBtn").addEventListener("click", newRoutine);
  $("cloneRoutineBtn").addEventListener("click", cloneRoutine);
  $("renameRoutineBtn").addEventListener("click", renameRoutine);
  $("deleteRoutineBtn").addEventListener("click", deleteRoutine);

  $("setActiveBtn").addEventListener("click", () => {
    const id = $("routineSelect").value;
    if (!id) return;
    state.data.activeRoutineId = id;
    saveLocal(state.data);
    refreshLabels();
    renderAll();
  });

  $("addDayBtn").addEventListener("click", () => {
    const r = activeRoutine();
    const name = prompt("Day name?", "Day");
    if (!name) return;
    r.days.push({ name, exercises: [] });
    saveLocal(state.data);
    renderRoutines();
    renderLogDaySelect();
  });

  $("deleteDayBtn").addEventListener("click", () => {
    const r = activeRoutine();
    const idx = $("routineDaySelect").selectedIndex;
    if (idx < 0) return;
    if (!confirm(`Delete day "${r.days[idx].name}"?`)) return;
    r.days.splice(idx, 1);
    saveLocal(state.data);
    renderRoutines();
    renderLogDaySelect();
  });

  $("addExerciseBtn").addEventListener("click", () => {
    const r = activeRoutine();
    const dIdx = $("routineDaySelect").selectedIndex;
    if (dIdx < 0) return;
    const name = ($("newExerciseInput").value || "").trim();
    const tag  = $("newExerciseTag").value;
    if (!name) return;
    r.days[dIdx].exercises.push({ name, tag });
    $("newExerciseInput").value = "";
    saveLocal(state.data);
    renderRoutines();
    renderLogDaySelect();
  });

  $("routineDaySelect").addEventListener("change", renderRoutines);
  $("routineCompoundOnly").addEventListener("change", renderRoutines);

  // Password change
  $("setPwBtn").addEventListener("click", () => {
    const pw = ($("newPw").value || "").trim();
    if (!pw) return alert("Enter a new password.");
    setLocalPassword(pw);
    $("newPw").value = "";
    alert("Password updated.");
  });

  // History
  $("historySearch").addEventListener("input", renderHistory);
  $("clearAllBtn").addEventListener("click", () => {
    if (!confirm("This clears ALL local data. Continue?")) return;
    state.data = defaultData();
    saveLocal(state.data);
    state.activeWorkout = null;
    renderAll();
  });

  // Reports
  $("reportCompoundOnly").addEventListener("change", renderReports);
  $("reportMetric").addEventListener("change", renderReports);
  $("reportExercise").addEventListener("change", renderReports);
}

// ---------- Rendering ----------
function renderAll() {
  renderLogDaySelect();
  renderWorkout();
  renderRoutines();
  renderHistory();
  renderReports();
}

function renderLogDaySelect() {
  const r = activeRoutine();
  const sel = $("daySelect");
  sel.innerHTML = "";
  r.days.forEach((d, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = d.name;
    sel.appendChild(opt);
  });
}

function startWorkout() {
  const r = activeRoutine();
  const dIdx = parseInt($("daySelect").value || "0", 10);
  const day = r.days[dIdx];
  if (!day) return;

  const compoundOnly = $("logCompoundOnly").checked;
  const exercises = filterByCompoundOnly(day.exercises, compoundOnly);

  state.activeWorkout = {
    routineId: r.id,
    routineName: r.name,
    dayName: day.name,
    startedAt: Date.now(),
    exercises: exercises.map(ex => ({
      name: ex.name,
      tag: ex.tag,
      sets: [{ weight: "", reps: "" }]
    }))
  };
  renderWorkout();
}

function renderWorkout() {
  const list = $("exerciseLogList");
  list.innerHTML = "";

  const w = state.activeWorkout;
  if (!w) {
    list.innerHTML = `<div class="muted">No active workout. Click <b>Start workout</b>.</div>`;
    return;
  }

  w.exercises.forEach((ex, exIdx) => {
    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("div");
    title.innerHTML = `<h3 style="margin:0 0 6px 0;">${escapeHtml(ex.name)} <span class="muted tiny">(${ex.tag})</span></h3>`;
    card.appendChild(title);

    const setsWrap = document.createElement("div");

    ex.sets.forEach((s, sIdx) => {
      const row = document.createElement("div");
      row.className = "row wrap";

      const wIn = document.createElement("input");
      wIn.placeholder = "Weight";
      wIn.value = s.weight;
      wIn.addEventListener("input", () => { s.weight = wIn.value; });

      const rIn = document.createElement("input");
      rIn.placeholder = "Reps";
      rIn.value = s.reps;
      rIn.addEventListener("input", () => { s.reps = rIn.value; });

      const del = document.createElement("button");
      del.className = "btn danger";
      del.textContent = "Remove set";
      del.addEventListener("click", () => {
        ex.sets.splice(sIdx, 1);
        if (ex.sets.length === 0) ex.sets.push({ weight: "", reps: "" });
        renderWorkout();
      });

      row.appendChild(wIn);
      row.appendChild(rIn);
      row.appendChild(del);
      setsWrap.appendChild(row);
    });

    const addSet = document.createElement("button");
    addSet.className = "btn ghost";
    addSet.textContent = "+ Add set";
    addSet.addEventListener("click", () => {
      ex.sets.push({ weight: "", reps: "" });
      renderWorkout();
    });

    card.appendChild(setsWrap);
    card.appendChild(addSet);
    list.appendChild(card);
  });
}

function saveWorkout() {
  const w = state.activeWorkout;
  if (!w) return alert("No active workout.");

  // Clean sets
  const cleaned = JSON.parse(JSON.stringify(w));
  cleaned.exercises.forEach(ex => {
    ex.sets = ex.sets
      .map(s => ({
        weight: parseFloat(String(s.weight).trim()),
        reps: parseInt(String(s.reps).trim(), 10)
      }))
      .filter(s => Number.isFinite(s.weight) && Number.isFinite(s.reps) && s.reps > 0);
  });
  cleaned.exercises = cleaned.exercises.filter(ex => ex.sets.length > 0);

  if (cleaned.exercises.length === 0) return alert("No valid sets to save.");

  cleaned.savedAt = Date.now();
  state.data.history.unshift(cleaned);
  saveLocal(state.data);

  state.activeWorkout = null;
  renderWorkout();
  renderHistory();
  renderReports();
  alert("Workout saved.");
}

function renderRoutines() {
  const rSel = $("routineSelect");
  const dSel = $("routineDaySelect");
  const list = $("exerciseList");
  const compoundOnly = $("routineCompoundOnly").checked;

  // Routine select
  rSel.innerHTML = "";
  state.data.routines.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.name;
    if (r.id === state.data.activeRoutineId) opt.selected = true;
    rSel.appendChild(opt);
  });

  const r = activeRoutine();
  dSel.innerHTML = "";
  r.days.forEach((d, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = d.name;
    dSel.appendChild(opt);
  });

  const dIdx = dSel.selectedIndex >= 0 ? dSel.selectedIndex : 0;
  const day = r.days[dIdx];

  // Exercise list
  list.innerHTML = "";
  if (!day) {
    list.innerHTML = `<div class="muted">No days yet.</div>`;
    return;
  }

  const exs = filterByCompoundOnly(day.exercises, compoundOnly);

  exs.forEach((ex, i) => {
    const row = document.createElement("div");
    row.className = "row wrap";

    const name = document.createElement("div");
    name.className = "chip";
    name.textContent = `${ex.name} (${ex.tag})`;

    const del = document.createElement("button");
    del.className = "btn danger";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      const realIdx = day.exercises.findIndex(e => e.name === ex.name && e.tag === ex.tag);
      if (realIdx < 0) return;
      if (!confirm(`Delete exercise "${ex.name}"?`)) return;
      day.exercises.splice(realIdx, 1);
      saveLocal(state.data);
      renderRoutines();
      renderLogDaySelect();
    });

    row.appendChild(name);
    row.appendChild(del);
    list.appendChild(row);
  });
}

function newRoutine() {
  const name = prompt("New routine name?", "Routine");
  if (!name) return;
  const r = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    days: [{ name: "Day 1", exercises: [] }]
  };
  state.data.routines.unshift(r);
  state.data.activeRoutineId = r.id;
  saveLocal(state.data);
  refreshLabels();
  renderAll();
}

function cloneRoutine() {
  const r = activeRoutine();
  const copy = JSON.parse(JSON.stringify(r));
  copy.id = crypto.randomUUID();
  copy.name = `${r.name} (copy)`;
  copy.createdAt = Date.now();
  state.data.routines.unshift(copy);
  state.data.activeRoutineId = copy.id;
  saveLocal(state.data);
  refreshLabels();
  renderAll();
}

function renameRoutine() {
  const r = activeRoutine();
  const name = prompt("Rename routine:", r.name);
  if (!name) return;
  r.name = name;
  saveLocal(state.data);
  refreshLabels();
  renderAll();
}

function deleteRoutine() {
  if (state.data.routines.length <= 1) return alert("Keep at least one routine.");
  const r = activeRoutine();
  if (!confirm(`Delete routine "${r.name}"?`)) return;
  state.data.routines = state.data.routines.filter(x => x.id !== r.id);
  state.data.activeRoutineId = state.data.routines[0].id;
  saveLocal(state.data);
  refreshLabels();
  renderAll();
}

function renderHistory() {
  const q = ($("historySearch").value || "").trim().toLowerCase();
  const list = $("historyList");
  list.innerHTML = "";

  const items = state.data.history.filter(w => {
    if (!q) return true;
    return w.exercises.some(ex => ex.name.toLowerCase().includes(q));
  });

  if (items.length === 0) {
    list.innerHTML = `<div class="muted">No history yet.</div>`;
    return;
  }

  items.forEach((w, idx) => {
    const card = document.createElement("div");
    card.className = "card";

    const dt = new Date(w.savedAt || w.startedAt || Date.now());
    const head = document.createElement("div");
    head.innerHTML = `<h3 style="margin:0 0 6px 0;">${escapeHtml(w.routineName || "")} — ${escapeHtml(w.dayName || "")}
      <span class="muted tiny">(${dt.toLocaleString()})</span></h3>`;

    const body = document.createElement("div");
    body.className = "muted";
    body.innerHTML = w.exercises.map(ex => {
      const sets = ex.sets.map(s => `${s.weight}×${s.reps}`).join(", ");
      return `<div><b>${escapeHtml(ex.name)}:</b> ${escapeHtml(sets)}</div>`;
    }).join("");

    const del = document.createElement("button");
    del.className = "btn danger";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm("Delete this workout?")) return;
      const realIdx = state.data.history.findIndex(x => x.savedAt === w.savedAt && x.startedAt === w.startedAt);
      if (realIdx >= 0) state.data.history.splice(realIdx, 1);
      saveLocal(state.data);
      renderHistory();
      renderReports();
    });

    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(del);
    list.appendChild(card);
  });
}

function renderReports() {
  const exSel = $("reportExercise");
  const metric = $("reportMetric").value;
  const compoundOnly = $("reportCompoundOnly").checked;

  // Populate exercise dropdown from history
  const allEx = uniqueExercisesFromHistory();
  const exFromRoutines = (() => {
    const set = new Set();
    for (const r of state.data.routines) {
      for (const d of r.days) for (const ex of d.exercises) set.add(ex.name);
    }
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  })();

  const merged = Array.from(new Set([...allEx, ...exFromRoutines])).sort((a,b)=>a.localeCompare(b));
  const prev = exSel.value;

  exSel.innerHTML = "";
  merged.forEach(name => {
    // compound filter uses routine tags if available
    if (compoundOnly) {
      const isCompound = state.data.routines.some(r =>
        r.days.some(d => d.exercises.some(e => e.name === name && e.tag === "compound"))
      );
      if (!isCompound) return;
    }
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    exSel.appendChild(opt);
  });

  if (prev && Array.from(exSel.options).some(o => o.value === prev)) exSel.value = prev;

  const chosen = exSel.value;
  const rows = [];

  if (chosen) {
    for (const w of state.data.history) {
      const ex = w.exercises.find(e => e.name === chosen);
      if (!ex) continue;

      // pick best set for chart / metric
      const sets = ex.sets || [];
      if (sets.length === 0) continue;

      const best = sets.reduce((a,b) => {
        const aE = est1rm(a.weight, a.reps);
        const bE = est1rm(b.weight, b.reps);
        return bE > aE ? b : a;
      });

      const topWeight = Math.max(...sets.map(s => s.weight));
      const volume = sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
      const e1rm = est1rm(best.weight, best.reps);

      const dt = new Date(w.savedAt || w.startedAt || Date.now());
      rows.push({
        date: dt,
        topWeight,
        volume,
        e1rm
      });
    }
  }

  rows.sort((a,b)=>a.date - b.date);

  // Summary + table
  const summaryEl = $("reportSummary");
  const tableEl = $("reportTable");

  if (!chosen || rows.length === 0) {
    summaryEl.textContent = "No data yet. Save a few workouts to see trends.";
    tableEl.innerHTML = "";
    destroyChart();
    return;
  }

  const latest = rows[rows.length - 1];
  const best = rows.reduce((m, r) => Math.max(m, r[metric]), -Infinity);

  summaryEl.textContent = `Exercise: ${chosen} • Workouts: ${rows.length} • Best ${metricLabel(metric)}: ${round(best)}`;

  tableEl.innerHTML = rows.slice().reverse().slice(0, 15).map(r => {
    return `<div class="row wrap">
      <div class="chip">${r.date.toLocaleDateString()}</div>
      <div class="chip">${metricLabel(metric)}: <b>${round(r[metric])}</b></div>
    </div>`;
  }).join("");

  // Chart
  const ctx = $("reportChart");
  destroyChart();
  state.chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: rows.map(r => r.date.toLocaleDateString()),
      datasets: [{
        label: `${chosen} — ${metricLabel(metric)}`,
        data: rows.map(r => r[metric])
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function destroyChart() {
  if (state.chart) {
    try { state.chart.destroy(); } catch {}
    state.chart = null;
  }
}

// ---------- Export helpers ----------
function exportJson(obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lifting-tracker.json";
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  // basic: workout rows per set
  const lines = ["date,routine,day,exercise,weight,reps"];
  for (const w of state.data.history) {
    const dt = new Date(w.savedAt || w.startedAt || Date.now()).toISOString();
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        lines.push([
          dt,
          csv(w.routineName || ""),
          csv(w.dayName || ""),
          csv(ex.name),
          s.weight,
          s.reps
        ].join(","));
      }
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lifting-tracker.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function csv(s) {
  const t = String(s).replaceAll('"', '""');
  return `"${t}"`;
}

// ---------- Math ----------
function est1rm(weight, reps) {
  const w = Number(weight);
  const r = Number(reps);
  if (!Number.isFinite(w) || !Number.isFinite(r) || r <= 0) return 0;
  // Epley
  return w * (1 + r / 30);
}

function round(n) {
  if (!Number.isFinite(n)) return "";
  return Math.round(n * 100) / 100;
}

function metricLabel(m) {
  if (m === "e1rm") return "Est 1RM";
  if (m === "topWeight") return "Top weight";
  if (m === "volume") return "Volume";
  return m;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

// ---------- Boot ----------
function boot() {
  // Hide main until unlocked
  cls($("mainView"), "hidden", true);
  cls($("loginView"), "hidden", false);

  initLock();
  initFirebaseUI();
  refreshLabels();
}

boot();
