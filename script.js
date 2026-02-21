import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
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

const firebaseConfig = {
  apiKey: "AIzaSyDwL1Qo-aqD-3Dy2EGafZMF2VWEB0rkQao",
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

async function cloudLoad(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().data ?? null) : null;
}

async function cloudSave(uid, dataObj) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { data: dataObj, updatedAt: Date.now() }, { merge: true });
}
// ================= End Firebase =================


// ================= Local Data Model =================
const LS_KEY = "lt_data_v3";

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
            { name: "Overhead Press", tag: "compound" },
            { name: "Incline DB Press", tag: "accessory" },
            { name: "Triceps Pushdown", tag: "accessory" },
          ]},
          { name: "Pull", exercises: [
            { name: "Pull-up / Lat Pulldown", tag: "compound" },
            { name: "Barbell Row", tag: "compound" },
            { name: "Face Pull", tag: "accessory" },
            { name: "Biceps Curl", tag: "accessory" },
          ]},
          { name: "Legs", exercises: [
            { name: "Back Squat", tag: "compound" },
            { name: "RDL", tag: "compound" },
            { name: "Leg Press", tag: "accessory" },
            { name: "Calf Raise", tag: "accessory" },
          ]},
        ]
      }
    ],
    // workouts: [{id,date,routineId,routineName,dayName,entries:[{exercise,tag,sets:[{weight,reps}]}]}]
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
  try {
    const d = JSON.parse(raw);
    return normalize(d);
  } catch {
    const d = defaultData();
    saveLocal(d);
    return d;
  }
}

function saveLocal(d) {
  localStorage.setItem(LS_KEY, JSON.stringify(d));
}

function normalize(d) {
  if (!d || typeof d !== "object") return defaultData();
  d.schemaVersion ??= 3;
  d.routines ??= [];
  d.workouts ??= [];
  if (!d.activeRoutineId && d.routines[0]) d.activeRoutineId = d.routines[0].id;
  return d;
}

// ================= Stats Helpers =================
function buildExerciseStats(workouts) {
  // stats[name] = { topWeight: number, bestRepsAtTopWeight: number, repsAtWeight: Map(weight->bestReps) }
  const stats = new Map();

  for (const w of (workouts || [])) {
    for (const e of (w.entries || [])) {
      const name = e.exercise;
      if (!stats.has(name)) {
        stats.set(name, {
          topWeight: 0,
          bestRepsAtTopWeight: 0,
          repsAtWeight: new Map()
        });
      }
      const s = stats.get(name);

      for (const set of (e.sets || [])) {
        const weight = Number(set.weight || 0);
        const reps = Number(set.reps || 0);
        if (!weight || !reps) continue;

        // reps-at-weight best
        const prev = s.repsAtWeight.get(weight) || 0;
        if (reps > prev) s.repsAtWeight.set(weight, reps);

        // topWeight + best reps at that weight
        if (weight > s.topWeight) {
          s.topWeight = weight;
          s.bestRepsAtTopWeight = reps;
        } else if (weight === s.topWeight && reps > s.bestRepsAtTopWeight) {
          s.bestRepsAtTopWeight = reps;
        }
      }
    }
  }
  return stats;
}

function est1RM(weight, reps) {
  // Epley (simple)
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}

function formatPR(statsEntry) {
  if (!statsEntry || !statsEntry.topWeight) return "PR: —";
  return `PR: ${statsEntry.topWeight} × ${statsEntry.bestRepsAtTopWeight}`;
}

// ================= App State =================
let data = loadLocal();
let exerciseStats = buildExerciseStats(data.workouts);
let currentWorkout = null; // {routineId, routineName, dayName, entries:[{exercise,tag,sets:[]}]}
let reportChart = null;

// ================= DOM =================
const $ = (id) => document.getElementById(id);

const elCloudLabel = $("cloudLabel");

// Auth
const elEmail = $("fbEmail");
const elPassword = $("fbPassword");
const elSignUp = $("fbSignUp");
const elSignIn = $("fbSignIn");
const elSignOut = $("fbSignOut");
const elSyncNow = $("fbSyncNow");
const elFbMsg = $("fbMsg");
const elFbStatus = $("fbStatus");
const btnUseLocal = $("btnUseLocal");
const btnPullCloud = $("btnPullCloud");
const btnPushCloud = $("btnPushCloud");

// Export/Import
const btnExport = $("btnExport");
const fileImport = $("fileImport");

// Tabs
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    $(`tab-${tab}`).classList.add("active");
    if (tab === "reports") renderReports();
    if (tab === "history") renderHistory();
  });
});

// ================= Firebase UI + Sync =================
function setAuthMsg(errText = "", okText = "") {
  elFbMsg.textContent = errText || "";
  elFbStatus.textContent = okText || "";
}

async function pullCloudOverwriteLocal() {
  const user = auth.currentUser;
  if (!user) return;
  const cloud = await cloudLoad(user.uid);
  if (!cloud) {
    setAuthMsg("No cloud data found for this account.", "");
    return;
  }
  data = normalize(cloud);
  saveLocal(data);
  exerciseStats = buildExerciseStats(data.workouts);
  setAuthMsg("", "Pulled cloud → overwrote local backup ✅");
  rerenderAll();
}

async function pushLocalOverwriteCloud() {
  const user = auth.currentUser;
  if (!user) return;
  await cloudSave(user.uid, data);
  setAuthMsg("", "Pushed local → overwrote cloud ✅");
}

async function autoSyncOnLogin(user) {
  // Strategy: cloud wins if it exists; otherwise upload local
  setAuthMsg("", "Loading cloud…");
  const cloud = await cloudLoad(user.uid);
  if (cloud) {
    data = normalize(cloud);
    saveLocal(data);
    exerciseStats = buildExerciseStats(data.workouts);
    setAuthMsg("", "Cloud loaded ✅");
  } else {
    await cloudSave(user.uid, data);
    setAuthMsg("", "Cloud initialized from this device ✅");
  }
  rerenderAll();
}

function initFirebaseAuth() {
  elSignUp.addEventListener("click", async () => {
    setAuthMsg("", "");
    try {
      await createUserWithEmailAndPassword(auth, elEmail.value.trim(), elPassword.value.trim());
    } catch (e) {
      setAuthMsg(e?.message || String(e), "");
    }
  });

  elSignIn.addEventListener("click", async () => {
    setAuthMsg("", "");
    try {
      await signInWithEmailAndPassword(auth, elEmail.value.trim(), elPassword.value.trim());
    } catch (e) {
      setAuthMsg(e?.message || String(e), "");
    }
  });

  elSignOut.addEventListener("click", async () => {
    await signOut(auth);
    setAuthMsg("", "Signed out.");
    elCloudLabel.textContent = "Local mode";
    // keep local data as-is
  });

  elSyncNow.addEventListener("click", async () => {
    setAuthMsg("", "");
    try {
      const user = auth.currentUser;
      if (!user) return setAuthMsg("Not signed in.", "");
      await cloudSave(user.uid, data);
      setAuthMsg("", "Synced to cloud ✅");
    } catch (e) {
      setAuthMsg(e?.message || String(e), "");
    }
  });

  btnUseLocal.addEventListener("click", async () => {
    data = loadLocal();
    exerciseStats = buildExerciseStats(data.workouts);
    setAuthMsg("", "Using local backup ✅");
    rerenderAll();
  });

  btnPullCloud.addEventListener("click", () => pullCloudOverwriteLocal().catch(err => setAuthMsg(err?.message || String(err), "")));
  btnPushCloud.addEventListener("click", () => pushLocalOverwriteCloud().catch(err => setAuthMsg(err?.message || String(err), "")));

  onAuthStateChanged(auth, async (user) => {
    elSignOut.style.display = user ? "inline-block" : "none";
    elSyncNow.style.display = user ? "inline-block" : "none";
    btnPullCloud.style.display = user ? "inline-block" : "none";
    btnPushCloud.style.display = user ? "inline-block" : "none";

    if (!user) return;

    elCloudLabel.textContent = `Cloud: signed in`;
    try {
      await autoSyncOnLogin(user);
    } catch (e) {
      setAuthMsg("Cloud sync error: " + (e?.message || String(e)), "");
    }
  });
}

async function maybeCloudSave() {
  const user = auth.currentUser;
  if (!user) return;
  // fire-and-forget
  cloudSave(user.uid, data).catch(console.error);
}

// ================= Routines Helpers =================
function getActiveRoutine() {
  return data.routines.find(r => r.id === data.activeRoutineId) || data.routines[0] || null;
}

function getRoutineById(id) {
  return data.routines.find(r => r.id === id) || null;
}

function upsertRoutine(r) {
  const i = data.routines.findIndex(x => x.id === r.id);
  if (i >= 0) data.routines[i] = r;
  else data.routines.push(r);
}

function listAllExercisesWithTags() {
  const m = new Map(); // name -> tag (last seen)
  for (const r of data.routines) {
    for (const d of (r.days || [])) {
      for (const e of (d.exercises || [])) {
        m.set(e.name, e.tag || "accessory");
      }
    }
  }
  return m;
}

function rerenderAll() {
  renderRoutineSelects();
  renderLogDaySelect();
  renderWorkoutUI();
  renderRoutinesPanel();
  renderHistory();
  renderReports();
}

function persist() {
  saveLocal(data);
  exerciseStats = buildExerciseStats(data.workouts);
  maybeCloudSave();
}

// ================= LOG UI =================
const logDay = $("logDay");
const logCompoundOnly = $("logCompoundOnly");
const btnStartWorkout = $("btnStartWorkout");
const btnClearWorkout = $("btnClearWorkout");
const btnSaveWorkout = $("btnSaveWorkout");
const workoutList = $("workoutList");

function renderLogDaySelect() {
  const r = getActiveRoutine();
  logDay.innerHTML = "";
  if (!r) return;
  for (let i = 0; i < r.days.length; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = r.days[i].name;
    logDay.appendChild(opt);
  }
}

function buildWorkoutFromDay(dayIdx) {
  const r = getActiveRoutine();
  if (!r) return null;
  const day = r.days[dayIdx];
  if (!day) return null;

  const compoundOnly = logCompoundOnly.checked;

  const entries = (day.exercises || [])
    .filter(e => !compoundOnly || e.tag === "compound")
    .map(e => ({
      exercise: e.name,
      tag: e.tag || "accessory",
      sets: [{ weight: "", reps: "" }] // start with one empty set
    }));

  return {
    id: crypto.randomUUID(),
    date: Date.now(),
    routineId: r.id,
    routineName: r.name,
    dayName: day.name,
    entries
  };
}

function renderWorkoutUI() {
  workoutList.innerHTML = "";
  if (!currentWorkout) {
    workoutList.innerHTML = `<div class="muted">No active workout. Pick a day and click “Start workout”.</div>`;
    return;
  }

  for (const entry of currentWorkout.entries) {
    const statsEntry = exerciseStats.get(entry.exercise);
    const prLabel = formatPR(statsEntry);

    const card = document.createElement("div");
    card.className = "exercise";

    const head = document.createElement("div");
    head.className = "exerciseHead";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="exerciseName">${entry.exercise}</div>
      <div class="muted tiny">${prLabel}</div>
    `;

    const right = document.createElement("div");
    right.className = "badge";
    right.textContent = entry.tag;

    head.appendChild(left);
    head.appendChild(right);
    card.appendChild(head);

    const sets = document.createElement("div");
    sets.className = "sets";

    entry.sets.forEach((s, idx) => {
      const row = document.createElement("div");
      row.className = "setRow";

      const w = document.createElement("input");
      w.type = "number";
      w.placeholder = "Weight";
      w.value = s.weight;
      w.addEventListener("input", () => {
        s.weight = w.value;
        hint.textContent = bestRepsHint(entry.exercise, Number(w.value || 0));
      });

      const r = document.createElement("input");
      r.type = "number";
      r.placeholder = "Reps";
      r.value = s.reps;
      r.addEventListener("input", () => {
        s.reps = r.value;
      });

      const del = document.createElement("button");
      del.className = "btn ghost";
      del.textContent = "Remove";
      del.addEventListener("click", () => {
        entry.sets.splice(idx, 1);
        if (entry.sets.length === 0) entry.sets.push({ weight: "", reps: "" });
        renderWorkoutUI();
      });

      const add = document.createElement("button");
      add.className = "btn ghost";
      add.textContent = "+ Set";
      add.addEventListener("click", () => {
        entry.sets.splice(idx + 1, 0, { weight: "", reps: "" });
        renderWorkoutUI();
      });

      const hint = document.createElement("div");
      hint.className = "setHint";
      hint.textContent = bestRepsHint(entry.exercise, Number(s.weight || 0));

      row.appendChild(w);
      row.appendChild(r);
      row.appendChild(add);
      row.appendChild(del);

      sets.appendChild(row);
      sets.appendChild(hint);
    });

    card.appendChild(sets);
    workoutList.appendChild(card);
  }
}

function bestRepsHint(exName, weight) {
  if (!weight) return "";
  const statsEntry = exerciseStats.get(exName);
  if (!statsEntry) return "Best at this weight: —";
  const best = statsEntry.repsAtWeight.get(weight) || 0;
  return `Best reps ever at ${weight}: ${best ? best : "—"}`;
}

btnStartWorkout.addEventListener("click", () => {
  const idx = Number(logDay.value || 0);
  currentWorkout = buildWorkoutFromDay(idx);
  renderWorkoutUI();
});

btnClearWorkout.addEventListener("click", () => {
  currentWorkout = null;
  renderWorkoutUI();
});

btnSaveWorkout.addEventListener("click", () => {
  if (!currentWorkout) return;

  // Clean empty sets
  for (const e of currentWorkout.entries) {
    e.sets = (e.sets || [])
      .map(s => ({ weight: Number(s.weight || 0), reps: Number(s.reps || 0) }))
      .filter(s => s.weight > 0 && s.reps > 0);
  }
  currentWorkout.entries = currentWorkout.entries.filter(e => e.sets.length > 0);

  if (currentWorkout.entries.length === 0) {
    alert("No sets entered.");
    return;
  }

  data.workouts.unshift(currentWorkout); // newest first
  persist();
  currentWorkout = null;
  renderWorkoutUI();
  alert("Workout saved ✅");
});

// ================= ROUTINES UI =================
const routineSelect = $("routineSelect");
const routineDay = $("routineDay");
const routineCompoundOnly = $("routineCompoundOnly");
const routineExercises = $("routineExercises");
const newExerciseName = $("newExerciseName");
const newExerciseTag = $("newExerciseTag");
const swapFrom = $("swapFrom");
const swapTo = $("swapTo");
const swapTag = $("swapTag");

$("btnNewRoutine").addEventListener("click", () => {
  const name = prompt("Routine name?", "New routine");
  if (!name) return;
  const r = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    days: [{ name: "Day 1", exercises: [] }]
  };
  upsertRoutine(r);
  data.activeRoutineId = r.id;
  persist();
  rerenderAll();
});

$("btnCloneRoutine").addEventListener("click", () => {
  const r = getActiveRoutine();
  if (!r) return;
  const clone = JSON.parse(JSON.stringify(r));
  clone.id = crypto.randomUUID();
  clone.name = `${r.name} (copy)`;
  clone.createdAt = Date.now();
  upsertRoutine(clone);
  data.activeRoutineId = clone.id;
  persist();
  rerenderAll();
});

$("btnRenameRoutine").addEventListener("click", () => {
  const r = getActiveRoutine();
  if (!r) return;
  const name = prompt("New name for active routine?", r.name);
  if (!name) return;
  r.name = name;
  upsertRoutine(r);
  persist();
  rerenderAll();
});

$("btnDeleteRoutine").addEventListener("click", () => {
  const r = getActiveRoutine();
  if (!r) return;
  if (!confirm(`Delete routine "${r.name}"?`)) return;
  data.routines = data.routines.filter(x => x.id !== r.id);
  if (data.routines[0]) data.activeRoutineId = data.routines[0].id;
  persist();
  rerenderAll();
});

$("btnSetActive").addEventListener("click", () => {
  const id = routineSelect.value;
  data.activeRoutineId = id;
  persist();
  rerenderAll();
});

$("btnAddDay").addEventListener("click", () => {
  const r = getActiveRoutine();
  if (!r) return;
  const name = prompt("Day name?", `Day ${r.days.length + 1}`);
  if (!name) return;
  r.days.push({ name, exercises: [] });
  upsertRoutine(r);
  persist();
  rerenderAll();
});

$("btnDeleteDay").addEventListener("click", () => {
  const r = getActiveRoutine();
  if (!r) return;
  const idx = Number(routineDay.value || 0);
  if (!r.days[idx]) return;
  if (!confirm(`Delete day "${r.days[idx].name}"?`)) return;
  r.days.splice(idx, 1);
  if (r.days.length === 0) r.days.push({ name: "Day 1", exercises: [] });
  upsertRoutine(r);
  persist();
  rerenderAll();
});

$("btnAddExercise").addEventListener("click", () => {
  const r = getActiveRoutine();
  if (!r) return;
  const idx = Number(routineDay.value || 0);
  const day = r.days[idx];
  if (!day) return;

  const name = (newExerciseName.value || "").trim();
  if (!name) return;

  day.exercises.push({ name, tag: newExerciseTag.value });
  newExerciseName.value = "";
  upsertRoutine(r);
  persist();
  rerenderAll();
});

$("btnSwap").addEventListener("click", () => {
  const r = getActiveRoutine();
  if (!r) return;
  const idx = Number(routineDay.value || 0);
  const day = r.days[idx];
  if (!day) return;

  const from = swapFrom.value;
  const to = (swapTo.value || "").trim();
  if (!from || !to) return;

  const ex = day.exercises.find(e => e.name === from);
  if (!ex) return;

  ex.name = to;
  ex.tag = swapTag.value;
  swapTo.value = "";
  upsertRoutine(r);
  persist();
  rerenderAll();
});

routineCompoundOnly.addEventListener("change", renderRoutinesPanel);
routineDay.addEventListener("change", renderRoutinesPanel);

function renderRoutineSelects() {
  routineSelect.innerHTML = "";
  for (const r of data.routines) {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.name;
    if (r.id === data.activeRoutineId) opt.selected = true;
    routineSelect.appendChild(opt);
  }
}

function renderRoutinesPanel() {
  const r = getActiveRoutine();
  if (!r) return;

  // day select
  routineDay.innerHTML = "";
  for (let i = 0; i < r.days.length; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = r.days[i].name;
    routineDay.appendChild(opt);
  }

  const idx = Number(routineDay.value || 0);
  const day = r.days[idx] || r.days[0];

  // list exercises
  routineExercises.innerHTML = "";
  const compoundOnly = routineCompoundOnly.checked;
  for (const e of (day.exercises || []).filter(x => !compoundOnly || x.tag === "compound")) {
    const div = document.createElement("div");
    div.className = "exercise";
    const st = exerciseStats.get(e.name);
    div.innerHTML = `
      <div class="exerciseHead">
        <div>
          <div class="exerciseName">${e.name}</div>
          <div class="muted tiny">${formatPR(st)}</div>
        </div>
        <div class="badge">${e.tag}</div>
      </div>
    `;
    routineExercises.appendChild(div);
  }

  // swap list
  swapFrom.innerHTML = "";
  for (const e of (day.exercises || [])) {
    const opt = document.createElement("option");
    opt.value = e.name;
    opt.textContent = e.name;
    swapFrom.appendChild(opt);
  }

  $("activeRoutineLabel").textContent = `${r.name}`;
  renderLogDaySelect();
}

// ================= HISTORY UI =================
const historyList = $("historyList");
const historySearch = $("historySearch");
$("btnClearHistorySearch").addEventListener("click", () => {
  historySearch.value = "";
  renderHistory();
});
historySearch.addEventListener("input", renderHistory);

function renderHistory() {
  const q = (historySearch.value || "").trim().toLowerCase();
  historyList.innerHTML = "";

  if (!data.workouts.length) {
    historyList.innerHTML = `<div class="muted">No workouts yet.</div>`;
    return;
  }

  for (const w of data.workouts) {
    const dateStr = new Date(w.date).toLocaleString();
    const card = document.createElement("div");
    card.className = "exercise";

    let html = `<div class="exerciseHead">
      <div>
        <div class="exerciseName">${w.routineName} — ${w.dayName}</div>
        <div class="muted tiny">${dateStr}</div>
      </div>
      <div class="badge">${w.entries.length} exercises</div>
    </div>`;

    html += `<div class="sets">`;

    for (const e of w.entries) {
      if (q && !e.exercise.toLowerCase().includes(q)) continue;

      const bestSet = (e.sets || []).reduce((a, s) => {
        const score = (s.weight || 0) * 1000 + (s.reps || 0);
        const aScore = (a.weight || 0) * 1000 + (a.reps || 0);
        return score > aScore ? s : a;
      }, { weight: 0, reps: 0 });

      html += `<div class="setHint"><b>${e.exercise}</b> — best: ${bestSet.weight} × ${bestSet.reps}</div>`;
    }
    html += `</div>`;

    card.innerHTML = html;
    historyList.appendChild(card);
  }
}

// ================= REPORTS UI =================
const reportCompoundOnly = $("reportCompoundOnly");
const reportMetric = $("reportMetric");
const reportExercise = $("reportExercise");
const reportSummary = $("reportSummary");

reportCompoundOnly.addEventListener("change", renderReports);
reportMetric.addEventListener("change", renderReports);
reportExercise.addEventListener("change", renderReports);

function renderReports() {
  // Build exercise list from routines (prefer), fallback to history
  const exMap = listAllExercisesWithTags();
  if (exMap.size === 0) {
    // fallback: from workouts
    for (const w of data.workouts) for (const e of w.entries) exMap.set(e.exercise, e.tag || "accessory");
  }

  const compoundOnly = reportCompoundOnly.checked;

  const names = [...exMap.entries()]
    .filter(([_, tag]) => !compoundOnly || tag === "compound")
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));

  const current = reportExercise.value;
  reportExercise.innerHTML = "";
  for (const n of names) {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    reportExercise.appendChild(opt);
  }
  if (current && names.includes(current)) reportExercise.value = current;

  const ex = reportExercise.value;
  if (!ex) {
    reportSummary.textContent = "No exercises to report yet.";
    drawReportChart([], [], "No data");
    return;
  }

  const metric = reportMetric.value;

  // per workout data points
  const points = [];
  for (const w of data.workouts.slice().reverse()) {
    const entry = (w.entries || []).find(e => e.exercise === ex);
    if (!entry) continue;

    // best set for that exercise in that workout
    const sets = entry.sets || [];
    if (!sets.length) continue;

    const bestSet = sets.reduce((a, s) => {
      const score = (s.weight || 0) * 1000 + (s.reps || 0);
      const aScore = (a.weight || 0) * 1000 + (a.reps || 0);
      return score > aScore ? s : a;
    }, sets[0]);

    let y = 0;
    if (metric === "topWeight") y = bestSet.weight || 0;
    else if (metric === "e1rm") y = est1RM(bestSet.weight || 0, bestSet.reps || 0);
    else if (metric === "volume") y = sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);

    points.push({ x: new Date(w.date).toLocaleDateString(), y: Math.round(y * 10) / 10 });
  }

  const ys = points.map(p => p.y);
  const last = ys[ys.length - 1];
  const best = ys.length ? Math.max(...ys) : 0;
  reportSummary.textContent = `${ex} — points: ${ys.length} | last: ${last ?? "—"} | best: ${best || "—"}`;

  drawReportChart(points.map(p => p.x), ys, `${ex} — ${metric}`);
}

function drawReportChart(labels, dataPoints, title) {
  const ctx = $("reportChart");
  if (!ctx) return;

  if (reportChart) reportChart.destroy();

  reportChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: title,
        data: dataPoints,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: { ticks: { color: "#9fb0c8" }, grid: { color: "rgba(36,48,68,.4)" } },
        y: { ticks: { color: "#9fb0c8" }, grid: { color: "rgba(36,48,68,.4)" } }
      }
    }
  });
}

// ================= Export / Import =================
btnExport.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lifting-tracker-export-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

fileImport.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = normalize(JSON.parse(text));
    data = imported;
    saveLocal(data);
    exerciseStats = buildExerciseStats(data.workouts);
    await maybeCloudSave();
    rerenderAll();
    alert("Import complete ✅");
  } catch (err) {
    alert("Import failed: " + (err?.message || String(err)));
  } finally {
    fileImport.value = "";
  }
});

// ================= Init =================
function init() {
  // Update label
  const r = getActiveRoutine();
  const activeLabel = document.getElementById("activeRoutineLabel");
  if (activeLabel && r) activeLabel.textContent = r.name;

  renderRoutineSelects();
  renderLogDaySelect();
  renderWorkoutUI();
  renderRoutinesPanel();
  renderHistory();
  renderReports();
  initFirebaseAuth();
}

init();
