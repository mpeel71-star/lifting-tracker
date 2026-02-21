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
// ====== Storage Keys ======
const KEY = {
  data: "lt_data_v2",
  pw: "lt_pw_v2",
  session: "lt_session_unlocked_v2",
  legacy: "lt_data_v1"
};

// ====== Default Data ======
function defaultData() {
  const now = Date.now();
  const routineId = crypto.randomUUID();
  return {
    schemaVersion: 2,
    activeRoutineId: routineId,
    routines: [
      {
        id: routineId,
        name: "PPL v1",
        createdAt: now,
        days: [
          { name: "Push", exercises: [
            { name:"Bench Press", tag:"compound" },
            { name:"Overhead Press", tag:"compound" },
            { name:"Incline DB Press", tag:"accessory" },
            { name:"Triceps Pushdown", tag:"accessory" }
          ]},
          { name: "Pull", exercises: [
            { name:"Pull-up / Lat Pulldown", tag:"compound" },
            { name:"Barbell Row", tag:"compound" },
            { name:"Face Pull", tag:"accessory" },
            { name:"Biceps Curl", tag:"accessory" }
          ]},
          { name: "Legs", exercises: [
            { name:"Back Squat", tag:"compound" },
            { name:"RDL", tag:"compound" },
            { name:"Leg Press", tag:"accessory" },
            { name:"Calf Raise", tag:"accessory" }
          ]}
        ]
      }
    ],
    workouts: [] // {id,date,routineId,routineName,dayName,entries:[{exercise, sets:[{weight,reps}]}]}
  };
}

// ====== Load/Save + Migration from v1 ======
function loadData() {
  // If v2 exists, use it
  const rawV2 = localStorage.getItem(KEY.data);
  if (rawV2) {
    try {
      const d = JSON.parse(rawV2);
      return normalizeAndMigrate(d);
    } catch {
      const d = defaultData();
      saveData(d);
      return d;
    }
  }

  // Else, try legacy v1
  const rawV1 = localStorage.getItem(KEY.legacy);
  if (rawV1) {
    try {
      const legacy = JSON.parse(rawV1);
      const migrated = migrateFromV1(legacy);
      saveData(migrated);
      return migrated;
    } catch {
      const d = defaultData();
      saveData(d);
      return d;
    }
  }

  // Else new
  const d = defaultData();
  saveData(d);
  return d;
}

function saveData(d) {
  localStorage.setItem(KEY.data, JSON.stringify(d));
}

function migrateFromV1(v1) {
  // v1 routines had exercises as strings; v1 workouts are compatible (exercise name is string)
  const d = {
    schemaVersion: 2,
    activeRoutineId: v1.activeRoutineId,
    routines: (v1.routines || []).map(r => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt || Date.now(),
      days: (r.days || []).map(day => ({
        name: day.name,
        exercises: (day.exercises || []).map(ex => ({
          name: typeof ex === "string" ? ex : ex?.name || "Exercise",
          tag: "compound" // default; you can edit tags after migration
        }))
      }))
    })),
    workouts: Array.isArray(v1.workouts) ? v1.workouts : []
  };

  // If something went weird, ensure at least one routine exists
  if (!d.routines.length) {
    const def = defaultData();
    d.routines = def.routines;
    d.activeRoutineId = def.activeRoutineId;
  }
  return d;
}

function normalizeAndMigrate(d) {
  // Ensure schemaVersion
  if (!d.schemaVersion) d.schemaVersion = 2;

  // Normalize routines/day/exercises to object form {name, tag}
  d.routines = (d.routines || []).map(r => ({
    ...r,
    days: (r.days || []).map(day => ({
      ...day,
      exercises: (day.exercises || []).map(ex => {
        if (typeof ex === "string") return { name: ex, tag: "compound" };
        return {
          name: ex?.name || "Exercise",
          tag: ex?.tag === "accessory" ? "accessory" : "compound"
        };
      })
    }))
  }));

  // Ensure workouts array
  d.workouts = Array.isArray(d.workouts) ? d.workouts : [];

  // Ensure active routine id points somewhere
  if (!d.activeRoutineId || !d.routines.some(r => r.id === d.activeRoutineId)) {
    d.activeRoutineId = d.routines[0]?.id || crypto.randomUUID();
  }

  return d;
}

// ====== Password ======
function getPassword() {
  return localStorage.getItem(KEY.pw) || "lift";
}
function setPassword(pw) {
  localStorage.setItem(KEY.pw, pw);
}
function isUnlocked() {
  return sessionStorage.getItem(KEY.session) === "1";
}
function unlock() {
  sessionStorage.setItem(KEY.session, "1");
}

// ====== Helpers ======
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" });
}
function clampNum(n) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return n;
}
function est1RM(weight, reps) {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}
function unique(arr) {
  return Array.from(new Set(arr));
}
function normalizeName(s) {
  return (s || "").trim();
}
function downloadFile(filename, content, mime="application/octet-stream") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ====== Stats Engine (from history) ======
// Returns map: exerciseName -> { maxWeight, repsAtMaxWeight, bestE1RM, bestSet:{weight,reps,oneRM}, repsByWeight: Map(weightStr->maxReps) }
function buildExerciseStats(workouts) {
  const stats = new Map();

  for (const w of workouts) {
    for (const entry of (w.entries || [])) {
      const ex = normalizeName(entry.exercise);
      if (!ex) continue;

      if (!stats.has(ex)) {
        stats.set(ex, {
          maxWeight: 0,
          repsAtMaxWeight: 0,
          bestE1RM: 0,
          bestSet: null,
          repsByWeight: new Map()
        });
      }
      const s = stats.get(ex);

      for (const set of (entry.sets || [])) {
        const weight = clampNum(Number(set.weight));
        const reps = clampNum(Number(set.reps));
        if (weight <= 0 || reps <= 0) continue;

        // max weight + reps at that weight
        if (weight > s.maxWeight) {
          s.maxWeight = weight;
          s.repsAtMaxWeight = reps;
        } else if (weight === s.maxWeight && reps > s.repsAtMaxWeight) {
          s.repsAtMaxWeight = reps;
        }

        // reps by weight
        const key = String(weight);
        const prev = s.repsByWeight.get(key) || 0;
        if (reps > prev) s.repsByWeight.set(key, reps);

        // best e1rm
        const one = est1RM(weight, reps);
        if (one > s.bestE1RM) {
          s.bestE1RM = one;
          s.bestSet = { weight, reps, oneRM: one };
        }
      }
    }
  }

  return stats;
}

// ====== App State ======
let data = loadData();
let currentWorkout = null; // {routineId,routineName,dayName,date,entries:[{exercise, tag, sets:[{weight,reps}]}]}
let exerciseStats = buildExerciseStats(data.workouts);

// Charts
let reportChart = null;

// ====== Tabs ======
function setupTabs() {
  $all(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      $all(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      $all(".panel").forEach(p => p.classList.add("hidden"));
      document.querySelector(`.panel[data-panel="${tab}"]`).classList.remove("hidden");

      // refresh tab content
      if (tab === "history") renderHistory();
      if (tab === "reports") renderReports();
      if (tab === "log") renderLogDaySelect();
      if (tab === "routines") renderRoutineUI();
    });
  });
}

// ====== Login ======
function setupLogin() {
  const loginView = $("#loginView");
  const mainView = $("#mainView");

  if (isUnlocked()) {
    loginView.classList.add("hidden");
    mainView.classList.remove("hidden");
    return;
  }

  $("#pwBtn").addEventListener("click", () => {
    const pw = $("#pwInput").value || "";
    if (pw === getPassword()) {
      unlock();
      $("#pwMsg").textContent = "";
      loginView.classList.add("hidden");
      mainView.classList.remove("hidden");
      bootRender();
    } else {
      $("#pwMsg").textContent = "Incorrect password.";
    }
  });

  $("#pwInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#pwBtn").click();
  });
}

// ====== Active Routine ======
function getActiveRoutine() {
  return data.routines.find(r => r.id === data.activeRoutineId) || data.routines[0];
}
function setActiveRoutine(id) {
  data.activeRoutineId = id;
  saveData(data);
  renderActiveRoutineLabel();
}
function renderActiveRoutineLabel() {
  const r = getActiveRoutine();
  $("#activeRoutineLabel").textContent = r ? `Active routine: ${r.name}` : "No routine";
}

// ====== Log Tab ======
function renderLogDaySelect() {
  const r = getActiveRoutine();
  const sel = $("#daySelect");
  sel.innerHTML = "";
  if (!r || !r.days.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No days found (create in Routines tab)";
    sel.appendChild(opt);
    return;
  }
  r.days.forEach((d, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = d.name;
    sel.appendChild(opt);
  });
}

function setupLogActions() {
  $("#startWorkoutBtn").addEventListener("click", () => {
    const r = getActiveRoutine();
    if (!r) return;

    const dayIdx = Number($("#daySelect").value);
    const day = r.days[dayIdx];
    if (!day) return;

    const compoundOnly = $("#logCompoundOnly").checked;

    const dayExercises = (day.exercises || [])
      .filter(ex => !compoundOnly || ex.tag === "compound")
      .map(ex => ({ exercise: ex.name, tag: ex.tag, sets: [] }));

    currentWorkout = {
      routineId: r.id,
      routineName: r.name,
      dayName: day.name + (compoundOnly ? " (Compound)" : ""),
      date: Date.now(),
      entries: dayExercises,
      notes: ""
    };

    renderWorkoutBuilder();
  });

  $("#clearWorkoutBtn").addEventListener("click", () => {
    currentWorkout = null;
    $("#workoutBuilder").classList.add("hidden");
  });

  $("#saveWorkoutBtn").addEventListener("click", () => {
    if (!currentWorkout) return;

    const cleaned = {
      ...currentWorkout,
      id: crypto.randomUUID(),
      entries: currentWorkout.entries
        .map(e => ({
          exercise: e.exercise,
          sets: (e.sets || [])
            .map(s => ({ weight: clampNum(Number(s.weight)), reps: clampNum(Number(s.reps)) }))
            .filter(s => s.weight > 0 && s.reps > 0)
        }))
        .filter(e => e.sets.length > 0)
    };

    if (cleaned.entries.length === 0) {
      alert("Add at least one set (weight + reps) before saving.");
      return;
    }

    data.workouts.unshift(cleaned);
    saveData(data);

    // rebuild stats
    exerciseStats = buildExerciseStats(data.workouts);

    alert("Workout saved ✅");
    currentWorkout = null;
    $("#workoutBuilder").classList.add("hidden");
  });
}

function prBadgeForExercise(exName) {
  const s = exerciseStats.get(exName);
  if (!s || !s.maxWeight) return `<span class="badge muted">No PR yet</span>`;
  return `<span class="badge">PR: ${s.maxWeight}×${s.repsAtMaxWeight}</span>`;
}

function tagBadge(tag) {
  const t = tag === "compound" ? "Compound" : "Accessory";
  return `<span class="badge muted">${t}</span>`;
}

function maxRepsAtWeightHint(exName, weight) {
  if (!weight || weight <= 0) return "";
  const s = exerciseStats.get(exName);
  if (!s) return "";
  const key = String(weight);
  const maxReps = s.repsByWeight.get(key);
  if (!maxReps) return "";
  return `At ${weight}, your best is <b>${maxReps}</b> reps.`;
}

function renderWorkoutBuilder() {
  const wrap = $("#workoutBuilder");
  const list = $("#exerciseLogList");
  wrap.classList.remove("hidden");

  $("#workoutTitle").textContent = `${currentWorkout.dayName} Workout`;
  $("#workoutMeta").textContent = `${currentWorkout.routineName} • ${formatDate(currentWorkout.date)}`;

  list.innerHTML = "";

  if (!currentWorkout.entries.length) {
    list.innerHTML = `<div class="muted">No exercises (check your routine or filters).</div>`;
    return;
  }

  currentWorkout.entries.forEach((entry) => {
    const exName = normalizeName(entry.exercise);

    const block = document.createElement("div");
    block.className = "exBlock";

    const header = document.createElement("div");
    header.className = "exHeader";

    const titleWrap = document.createElement("div");
    titleWrap.className = "exTitleWrap";

    const title = document.createElement("div");
    title.className = "exTitle";
    title.textContent = exName;

    const pr = document.createElement("div");
    pr.innerHTML = prBadgeForExercise(exName);

    const tag = document.createElement("div");
    tag.innerHTML = tagBadge(entry.tag);

    titleWrap.appendChild(title);
    titleWrap.appendChild(pr);
    titleWrap.appendChild(tag);

    const addSetBtn = document.createElement("button");
    addSetBtn.className = "ghost small";
    addSetBtn.textContent = "+ Set";
    addSetBtn.addEventListener("click", () => {
      entry.sets.push({ weight: "", reps: "" });
      renderWorkoutBuilder();
    });

    header.appendChild(titleWrap);
    header.appendChild(addSetBtn);

    const setsDiv = document.createElement("div");
    setsDiv.className = "sets";

    if (entry.sets.length === 0) {
      const empty = document.createElement("div");
      empty.className = "muted tiny";
      empty.textContent = "No sets yet. Tap + Set.";
      setsDiv.appendChild(empty);
    } else {
      entry.sets.forEach((s, setIdx) => {
        const row = document.createElement("div");
        row.className = "setRow";

        const w = document.createElement("input");
        w.type = "number";
        w.inputMode = "decimal";
        w.placeholder = "Weight";
        w.value = s.weight;

        const r = document.createElement("input");
        r.type = "number";
        r.inputMode = "numeric";
        r.placeholder = "Reps";
        r.value = s.reps;

        const del = document.createElement("button");
        del.className = "danger small";
        del.textContent = "✕";
        del.addEventListener("click", () => {
          entry.sets.splice(setIdx, 1);
          renderWorkoutBuilder();
        });

        // hint line (updates as weight changes)
        const hint = document.createElement("div");
        hint.className = "hint";
        const currentWeight = clampNum(Number(w.value));
        hint.innerHTML = maxRepsAtWeightHint(exName, currentWeight);

        w.addEventListener("input", () => {
          s.weight = w.value;
          const wt = clampNum(Number(w.value));
          hint.innerHTML = maxRepsAtWeightHint(exName, wt);
        });

        r.addEventListener("input", () => {
          s.reps = r.value;
        });

        const setWrap = document.createElement("div");
        setWrap.style.display = "flex";
        setWrap.style.flexDirection = "column";
        setWrap.style.gap = "6px";

        row.appendChild(w);
        row.appendChild(r);
        row.appendChild(del);

        setWrap.appendChild(row);
        setWrap.appendChild(hint);

        setsDiv.appendChild(setWrap);
      });
    }

    block.appendChild(header);
    block.appendChild(setsDiv);
    list.appendChild(block);
  });
}

// ====== Routines Tab ======
function renderRoutineUI() {
  renderRoutineSelect();
  renderRoutineDaySelect();
  renderExerciseList();
  renderReplaceFrom();
}

function renderRoutineSelect() {
  const sel = $("#routineSelect");
  sel.innerHTML = "";
  data.routines.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.name + (r.id === data.activeRoutineId ? " (Active)" : "");
    sel.appendChild(opt);
  });
  sel.value = data.activeRoutineId;
}

function getSelectedRoutine() {
  const id = $("#routineSelect").value;
  return data.routines.find(r => r.id === id) || getActiveRoutine();
}

function renderRoutineDaySelect() {
  const r = getSelectedRoutine();
  const sel = $("#routineDaySelect");
  sel.innerHTML = "";
  if (!r || !r.days.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No days (add one)";
    sel.appendChild(opt);
    return;
  }
  r.days.forEach((d, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = d.name;
    sel.appendChild(opt);
  });
}

function getSelectedDay() {
  const r = getSelectedRoutine();
  const idx = Number($("#routineDaySelect").value);
  return { r, idx, day: r?.days?.[idx] };
}

function renderExerciseList() {
  const { day } = getSelectedDay();
  const container = $("#exerciseList");
  container.innerHTML = "";

  if (!day) {
    container.innerHTML = `<div class="muted tiny">Select or create a day.</div>`;
    return;
  }

  const compoundOnly = $("#routineCompoundOnly").checked;
  const exercises = (day.exercises || []).filter(ex => !compoundOnly || ex.tag === "compound");

  exercises.forEach((ex, i) => {
    const item = document.createElement("div");
    item.className = "item";

    const left = document.createElement("div");
    left.className = "left";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = ex.name;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `${ex.tag === "compound" ? "Compound" : "Accessory"} • ${prBadgeForExercise(ex.name)}`;
    left.appendChild(name);
    left.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "actions";

    const tagToggle = document.createElement("button");
    tagToggle.className = "ghost small";
    tagToggle.textContent = ex.tag === "compound" ? "→ Accessory" : "→ Compound";
    tagToggle.addEventListener("click", () => {
      ex.tag = ex.tag === "compound" ? "accessory" : "compound";
      saveData(data);
      renderExerciseList();
      renderReplaceFrom();
      renderReports(); // keep tags consistent
    });

    const up = document.createElement("button");
    up.className = "ghost small";
    up.textContent = "↑";
    up.disabled = i === 0;
    up.addEventListener("click", () => {
      // Need original index in day.exercises (not filtered index)
      const origIdx = day.exercises.findIndex(e => e.name === ex.name && e.tag === ex.tag);
      if (origIdx > 0) {
        day.exercises.splice(origIdx - 1, 0, day.exercises.splice(origIdx, 1)[0]);
        saveData(data);
        renderExerciseList();
        renderReplaceFrom();
      }
    });

    const down = document.createElement("button");
    down.className = "ghost small";
    down.textContent = "↓";
    down.addEventListener("click", () => {
      const origIdx = day.exercises.findIndex(e => e.name === ex.name && e.tag === ex.tag);
      if (origIdx >= 0 && origIdx < day.exercises.length - 1) {
        day.exercises.splice(origIdx + 1, 0, day.exercises.splice(origIdx, 1)[0]);
        saveData(data);
        renderExerciseList();
        renderReplaceFrom();
      }
    });

    const del = document.createElement("button");
    del.className = "danger small";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm(`Delete "${ex.name}" from this day?`)) return;
      const idx = day.exercises.indexOf(ex);
      if (idx >= 0) day.exercises.splice(idx, 1);
      saveData(data);
      renderExerciseList();
      renderReplaceFrom();
      renderReports();
    });

    actions.appendChild(tagToggle);
    actions.appendChild(up);
    actions.appendChild(down);
    actions.appendChild(del);

    item.appendChild(left);
    item.appendChild(actions);
    container.appendChild(item);
  });

  if (exercises.length === 0) {
    container.innerHTML = `<div class="muted tiny">No exercises match this filter. Add one above.</div>`;
  }
}

function renderReplaceFrom() {
  const { day } = getSelectedDay();
  const sel = $("#replaceFrom");
  sel.innerHTML = "";
  if (!day || !(day.exercises || []).length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No exercises";
    sel.appendChild(opt);
    return;
  }
  day.exercises.forEach(ex => {
    const opt = document.createElement("option");
    opt.value = ex.name;
    opt.textContent = `${ex.name} (${ex.tag})`;
    sel.appendChild(opt);
  });
}

function setupRoutineActions() {
  $("#routineSelect").addEventListener("change", () => {
    renderRoutineDaySelect();
    renderExerciseList();
    renderReplaceFrom();
  });

  $("#routineDaySelect").addEventListener("change", () => {
    renderExerciseList();
    renderReplaceFrom();
  });

  $("#routineCompoundOnly").addEventListener("change", () => {
    renderExerciseList();
  });

  $("#setActiveBtn").addEventListener("click", () => {
    const id = $("#routineSelect").value;
    setActiveRoutine(id);
    renderRoutineSelect();
    renderLogDaySelect();
    renderReports();
  });

  $("#newRoutineBtn").addEventListener("click", () => {
    const name = prompt("Routine name?", "New Routine");
    if (!name) return;
    const r = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: Date.now(),
      days: [{ name: "Day 1", exercises: [] }]
    };
    data.routines.unshift(r);
    data.activeRoutineId = r.id;
    saveData(data);
    renderActiveRoutineLabel();
    renderRoutineUI();
    renderLogDaySelect();
    renderReports();
  });

  $("#cloneRoutineBtn").addEventListener("click", () => {
    const r = getActiveRoutine();
    if (!r) return;
    const name = prompt("Name for cloned routine?", `${r.name} (copy)`);
    if (!name) return;
    const clone = structuredClone(r);
    clone.id = crypto.randomUUID();
    clone.name = name.trim();
    clone.createdAt = Date.now();

    data.routines.unshift(clone);
    data.activeRoutineId = clone.id;
    saveData(data);

    renderActiveRoutineLabel();
    renderRoutineUI();
    renderLogDaySelect();
    renderReports();
  });

  $("#renameRoutineBtn").addEventListener("click", () => {
    const r = getActiveRoutine();
    if (!r) return;
    const name = prompt("New name?", r.name);
    if (!name) return;
    r.name = name.trim();
    saveData(data);
    renderActiveRoutineLabel();
    renderRoutineUI();
    renderLogDaySelect();
    renderReports();
  });

  $("#deleteRoutineBtn").addEventListener("click", () => {
    if (data.routines.length <= 1) {
      alert("You must have at least one routine.");
      return;
    }
    const r = getActiveRoutine();
    if (!r) return;
    if (!confirm(`Delete routine "${r.name}"? (Workouts remain in history.)`)) return;

    data.routines = data.routines.filter(x => x.id !== r.id);
    data.activeRoutineId = data.routines[0].id;
    saveData(data);

    renderActiveRoutineLabel();
    renderRoutineUI();
    renderLogDaySelect();
    renderReports();
  });

  $("#addDayBtn").addEventListener("click", () => {
    const r = getSelectedRoutine();
    if (!r) return;
    const name = prompt("Day name?", `Day ${r.days.length + 1}`);
    if (!name) return;
    r.days.push({ name: name.trim(), exercises: [] });
    saveData(data);
    renderRoutineDaySelect();
    renderExerciseList();
    renderReplaceFrom();
  });

  $("#deleteDayBtn").addEventListener("click", () => {
    const { r, idx, day } = getSelectedDay();
    if (!r || !day) return;
    if (r.days.length <= 1) {
      alert("A routine must have at least one day.");
      return;
    }
    if (!confirm(`Delete day "${day.name}"?`)) return;
    r.days.splice(idx, 1);
    saveData(data);
    renderRoutineDaySelect();
    renderExerciseList();
    renderReplaceFrom();
  });

  $("#addExerciseBtn").addEventListener("click", () => {
    const { day } = getSelectedDay();
    if (!day) return;
    const v = ($("#newExerciseInput").value || "").trim();
    if (!v) return;
    const tag = $("#newExerciseTag").value === "accessory" ? "accessory" : "compound";
    day.exercises.push({ name: v, tag });
    $("#newExerciseInput").value = "";
    saveData(data);
    renderExerciseList();
    renderReplaceFrom();
    renderReports();
  });

  $("#newExerciseInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#addExerciseBtn").click();
  });

  $("#replaceBtn").addEventListener("click", () => {
    const { day } = getSelectedDay();
    if (!day) return;
    const fromName = $("#replaceFrom").value;
    const to = ($("#replaceTo").value || "").trim();
    const tag = $("#replaceToTag").value === "accessory" ? "accessory" : "compound";
    if (!fromName || !to) return;

    const idx = (day.exercises || []).findIndex(x => x.name === fromName);
    if (idx === -1) return;

    day.exercises[idx] = { name: to, tag };
    $("#replaceTo").value = "";
    saveData(data);
    renderExerciseList();
    renderReplaceFrom();
    renderReports();
  });

  $("#setPwBtn").addEventListener("click", () => {
    const pw = ($("#newPw").value || "").trim();
    if (!pw) return;
    setPassword(pw);
    $("#newPw").value = "";
    alert("Password updated (local).");
  });
}

// ====== History Tab ======
function renderHistory() {
  const wrap = $("#historyList");
  wrap.innerHTML = "";

  if (!data.workouts.length) {
    wrap.innerHTML = `<div class="muted">No workouts saved yet.</div>`;
    return;
  }

  data.workouts.forEach(w => {
    const card = document.createElement("div");
    card.className = "historyCard";

    const top = document.createElement("div");
    top.className = "historyTop";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="historyTitle">${w.dayName}</div>
      <div class="muted tiny">${w.routineName} • ${formatDate(w.date)}</div>
    `;

    const right = document.createElement("div");
    const del = document.createElement("button");
    del.className = "danger small";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm("Delete this workout?")) return;
      data.workouts = data.workouts.filter(x => x.id !== w.id);
      saveData(data);
      exerciseStats = buildExerciseStats(data.workouts);
      renderHistory();
      renderReports();
    });
    right.appendChild(del);

    top.appendChild(left);
    top.appendChild(right);

    const details = document.createElement("div");
    details.className = "muted tiny";
    details.style.marginTop = "10px";

    const lines = [];
    (w.entries || []).forEach(e => {
      const sets = (e.sets || []).map(s => `${s.weight}x${s.reps}`).join(", ");
      lines.push(`<div><b>${e.exercise}</b>: ${sets}</div>`);
    });

    details.innerHTML = lines.join("");

    card.appendChild(top);
    card.appendChild(details);
    wrap.appendChild(card);
  });
}

function toCsv() {
  // Workout-level, set-level rows
  const header = [
    "workout_id","workout_date","routine_name","day_name",
    "exercise","set_index","weight","reps"
  ];
  const rows = [header.join(",")];

  for (const w of data.workouts) {
    const dateIso = new Date(w.date).toISOString();
    for (const entry of (w.entries || [])) {
      (entry.sets || []).forEach((s, idx) => {
        const r = [
          w.id,
          dateIso,
          csvSafe(w.routineName),
          csvSafe(w.dayName),
          csvSafe(entry.exercise),
          idx + 1,
          s.weight,
          s.reps
        ];
        rows.push(r.join(","));
      });
    }
  }
  return rows.join("\n");
}
function csvSafe(v) {
  const s = String(v ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replaceAll('"','""')}"`;
  return s;
}

function setupHistoryActions() {
  $("#exportJsonBtn").addEventListener("click", () => {
    downloadFile("lifting-tracker-export.json", JSON.stringify(data, null, 2), "application/json");
  });

  $("#exportCsvBtn").addEventListener("click", () => {
    downloadFile("lifting-tracker-export.csv", toCsv(), "text/csv");
  });

  $("#clearAllBtn").addEventListener("click", () => {
    if (!confirm("This will delete ALL routines and workout history on this browser. Continue?")) return;
    localStorage.removeItem(KEY.data);
    localStorage.removeItem(KEY.legacy);
    data = loadData();
    currentWorkout = null;
    exerciseStats = buildExerciseStats(data.workouts);
    saveData(data);
    alert("Cleared.");
    bootRender();
  });
}

// ====== Reports Tab ======
function getAllExercisesWithTags() {
  // Prefer routine tags (source of truth)
  const all = [];
  for (const r of data.routines) {
    for (const d of (r.days || [])) {
      for (const ex of (d.exercises || [])) {
        all.push({ name: ex.name, tag: ex.tag });
      }
    }
  }
  // Include exercises that only exist in history (tag unknown => accessory)
  for (const exName of exerciseStats.keys()) {
    if (!all.some(x => x.name === exName)) all.push({ name: exName, tag: "accessory" });
  }
  // unique by name (keep first tag found)
  const seen = new Set();
  const uniq = [];
  for (const x of all) {
    if (seen.has(x.name)) continue;
    seen.add(x.name);
    uniq.push(x);
  }
  uniq.sort((a,b)=>a.name.localeCompare(b.name));
  return uniq;
}

function buildReportSeries(exerciseName, metric) {
  // One point per workout: use best set for that exercise (by e1rm)
  const points = [];
  for (const w of data.workouts.slice().reverse()) {
    let best = null;
    let volume = 0;

    for (const entry of (w.entries || [])) {
      if (entry.exercise !== exerciseName) continue;

      for (const set of (entry.sets || [])) {
        const weight = clampNum(Number(set.weight));
        const reps = clampNum(Number(set.reps));
        if (weight <= 0 || reps <= 0) continue;

        volume += weight * reps;

        const one = est1RM(weight, reps);
        if (!best || one > best.oneRM) best = { weight, reps, oneRM: one };
      }
    }

    if (!best && metric !== "volume") continue;

    let y = 0;
    if (metric === "e1rm") y = best.oneRM;
    if (metric === "topWeight") y = best.weight;
    if (metric === "volume") y = volume;

    // include volume even if zero? skip empty workouts
    if (metric === "volume" && y === 0) continue;

    points.push({ x: w.date, y, workout: w, best });
  }
  return points;
}

function renderReports() {
  // populate exercise dropdown based on search + tag filter
  const all = getAllExercisesWithTags();
  const q = ($("#reportSearch")?.value || "").trim().toLowerCase();
  const compoundOnly = $("#reportCompoundOnly").checked;

  const filtered = all.filter(x => {
    if (compoundOnly && x.tag !== "compound") return false;
    if (q && !x.name.toLowerCase().includes(q)) return false;
    return true;
  });

  const sel = $("#reportExercise");
  sel.innerHTML = "";

  if (!filtered.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No matches";
    sel.appendChild(opt);
    $("#reportSummary").textContent = "";
    $("#reportTable").innerHTML = "";
    destroyChart();
    return;
  }

  filtered.forEach(x => {
    const opt = document.createElement("option");
    opt.value = x.name;
    opt.textContent = `${x.name}${x.tag === "compound" ? " (compound)" : ""}`;
    sel.appendChild(opt);
  });

  // keep prior selection if possible
  const prev = sel.dataset.prev;
  if (prev && filtered.some(x => x.name === prev)) sel.value = prev;
  sel.dataset.prev = sel.value;

  renderSelectedReport();
}

function destroyChart() {
  if (reportChart) {
    reportChart.destroy();
    reportChart = null;
  }
}

function renderSelectedReport() {
  const exerciseName = $("#reportExercise").value;
  const metric = $("#reportMetric").value;

  if (!exerciseName) {
    $("#reportSummary").textContent = "";
    $("#reportTable").innerHTML = "";
    destroyChart();
    return;
  }

  const series = buildReportSeries(exerciseName, metric);

  // Summary
  const s = exerciseStats.get(exerciseName);
  const prText = (s && s.maxWeight) ? `${s.maxWeight}×${s.repsAtMaxWeight}` : "—";
  const bestE = (s && s.bestSet) ? `${s.bestSet.weight}×${s.bestSet.reps} (e1RM ${s.bestSet.oneRM.toFixed(1)})` : "—";

  $("#reportSummary").innerHTML = `
    <div><b>PR (max weight):</b> ${prText}</div>
    <div><b>Best estimated 1RM set:</b> ${bestE}</div>
    <div class="tiny muted">Points shown: ${series.length}</div>
  `;

  // Table (recent points)
  const table = $("#reportTable");
  table.innerHTML = "";
  const recent = series.slice().reverse().slice(0, 12);

  recent.forEach(p => {
    const item = document.createElement("div");
    item.className = "item";

    let line = "";
    if (metric === "e1rm") line = `e1RM ${p.y.toFixed(1)} (best ${p.best.weight}×${p.best.reps})`;
    if (metric === "topWeight") line = `Top weight ${p.y} (best ${p.best.weight}×${p.best.reps})`;
    if (metric === "volume") line = `Volume ${Math.round(p.y)}`;

    item.innerHTML = `
      <div class="left">
        <div class="name">${line}</div>
        <div class="meta">${formatDate(p.x)} • ${p.workout.routineName} • ${p.workout.dayName}</div>
      </div>
    `;
    table.appendChild(item);
  });

  // Chart
  renderChart(exerciseName, metric, series);
}

function renderChart(exerciseName, metric, series) {
  const ctx = $("#reportChart").getContext("2d");
  destroyChart();

  const label = metric === "e1rm" ? "Estimated 1RM" : metric === "topWeight" ? "Top Weight" : "Volume";
  const dataPoints = series.map(p => ({ x: new Date(p.x), y: p.y }));

  reportChart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [{
        label: `${exerciseName} • ${label}`,
        data: dataPoints,
        tension: 0.25,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      scales: {
        x: { type: "time", time: { unit: "week" } },
        y: { beginAtZero: false }
      },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) => `${label}: ${metric === "e1rm" ? ctx.parsed.y.toFixed(1) : Math.round(ctx.parsed.y)}`
          }
        }
      }
    }
  });
}

function setupReportsActions() {
  $("#reportSearch").addEventListener("input", () => renderReports());
  $("#reportCompoundOnly").addEventListener("change", () => renderReports());
  $("#reportMetric").addEventListener("change", () => renderSelectedReport());
  $("#reportExercise").addEventListener("change", (e) => {
    e.target.dataset.prev = e.target.value;
    renderSelectedReport();
  });
}

// ====== Boot Render ======
function bootRender() {
  data = loadData();
  exerciseStats = buildExerciseStats(data.workouts);

  renderActiveRoutineLabel();
  renderLogDaySelect();
  renderRoutineUI();
  renderHistory();
  renderReports();
}

// ====== Init ======
function setupMainWiring() {
  setupLogActions();
  setupRoutineActions();
  setupHistoryActions();
  setupReportsActions();

  // When toggling in log tab, don't rerender workout; it only affects start
  $("#logCompoundOnly").addEventListener("change", () => {});
}

function init() {
  setupTabs();
  setupLogin();
  setupMainWiring();

  if (isUnlocked()) {
    $("#loginView").classList.add("hidden");
    $("#mainView").classList.remove("hidden");
    bootRender();
  }
}

init();
