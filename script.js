// ====== Storage Keys ======
const KEY = {
  data: "lt_data_v1",
  pw: "lt_pw_v1",
  session: "lt_session_unlocked_v1"
};

// ====== Default Data ======
function defaultData() {
  const now = Date.now();
  const routineId = crypto.randomUUID();
  return {
    activeRoutineId: routineId,
    routines: [
      {
        id: routineId,
        name: "PPL v1",
        createdAt: now,
        days: [
          { name: "Push", exercises: ["Bench Press", "Overhead Press", "Incline DB Press", "Triceps Pushdown"] },
          { name: "Pull", exercises: ["Pull-up / Lat Pulldown", "Barbell Row", "Face Pull", "Biceps Curl"] },
          { name: "Legs", exercises: ["Back Squat", "RDL", "Leg Press", "Calf Raise"] }
        ]
      }
    ],
    workouts: [] // each: {id, date, routineId, routineName, dayName, entries:[{exercise, sets:[{weight,reps}]}], notes}
  };
}

function loadData() {
  const raw = localStorage.getItem(KEY.data);
  if (!raw) {
    const d = defaultData();
    saveData(d);
    return d;
  }
  try {
    return JSON.parse(raw);
  } catch {
    const d = defaultData();
    saveData(d);
    return d;
  }
}

function saveData(d) {
  localStorage.setItem(KEY.data, JSON.stringify(d));
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
  // Epley formula: 1RM = w * (1 + reps/30)
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}
function unique(arr) {
  return Array.from(new Set(arr));
}

// ====== App State ======
let data = loadData();
let currentWorkout = null; // {routineId, routineName, dayName, date, entries: [{exercise, sets:[{weight,reps}]}]}

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
      if (tab === "progress") renderProgress();
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

    currentWorkout = {
      routineId: r.id,
      routineName: r.name,
      dayName: day.name,
      date: Date.now(),
      entries: day.exercises.map(ex => ({ exercise: ex, sets: [] })),
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

    // Validate: drop empty-set exercises
    const cleaned = {
      ...currentWorkout,
      id: crypto.randomUUID(),
      entries: currentWorkout.entries
        .map(e => ({
          exercise: e.exercise,
          sets: e.sets
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

    alert("Workout saved ✅");
    currentWorkout = null;
    $("#workoutBuilder").classList.add("hidden");
  });
}

function renderWorkoutBuilder() {
  const wrap = $("#workoutBuilder");
  const list = $("#exerciseLogList");
  wrap.classList.remove("hidden");

  $("#workoutTitle").textContent = `${currentWorkout.dayName} Workout`;
  $("#workoutMeta").textContent = `${currentWorkout.routineName} • ${formatDate(currentWorkout.date)}`;

  list.innerHTML = "";

  currentWorkout.entries.forEach((entry, entryIdx) => {
    const block = document.createElement("div");
    block.className = "exBlock";

    const header = document.createElement("div");
    header.className = "exHeader";

    const title = document.createElement("div");
    title.className = "exTitle";
    title.textContent = entry.exercise;

    const addSetBtn = document.createElement("button");
    addSetBtn.className = "ghost small";
    addSetBtn.textContent = "+ Set";
    addSetBtn.addEventListener("click", () => {
      entry.sets.push({ weight: "", reps: "" });
      renderWorkoutBuilder();
    });

    header.appendChild(title);
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
        w.addEventListener("input", () => {
          s.weight = w.value;
        });

        const r = document.createElement("input");
        r.type = "number";
        r.inputMode = "numeric";
        r.placeholder = "Reps";
        r.value = s.reps;
        r.addEventListener("input", () => {
          s.reps = r.value;
        });

        const del = document.createElement("button");
        del.className = "danger small";
        del.textContent = "✕";
        del.addEventListener("click", () => {
          entry.sets.splice(setIdx, 1);
          renderWorkoutBuilder();
        });

        row.appendChild(w);
        row.appendChild(r);
        row.appendChild(del);
        setsDiv.appendChild(row);
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

  day.exercises.forEach((ex, i) => {
    const item = document.createElement("div");
    item.className = "item";

    const left = document.createElement("div");
    left.className = "left";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = ex;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `#${i + 1}`;
    left.appendChild(name);
    left.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "actions";

    const up = document.createElement("button");
    up.className = "ghost small";
    up.textContent = "↑";
    up.disabled = i === 0;
    up.addEventListener("click", () => {
      day.exercises.splice(i - 1, 0, day.exercises.splice(i, 1)[0]);
      saveData(data);
      renderExerciseList();
      renderReplaceFrom();
    });

    const down = document.createElement("button");
    down.className = "ghost small";
    down.textContent = "↓";
    down.disabled = i === day.exercises.length - 1;
    down.addEventListener("click", () => {
      day.exercises.splice(i + 1, 0, day.exercises.splice(i, 1)[0]);
      saveData(data);
      renderExerciseList();
      renderReplaceFrom();
    });

    const del = document.createElement("button");
    del.className = "danger small";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm(`Delete "${ex}" from this day?`)) return;
      day.exercises.splice(i, 1);
      saveData(data);
      renderExerciseList();
      renderReplaceFrom();
    });

    actions.appendChild(up);
    actions.appendChild(down);
    actions.appendChild(del);

    item.appendChild(left);
    item.appendChild(actions);
    container.appendChild(item);
  });

  if (day.exercises.length === 0) {
    container.innerHTML = `<div class="muted tiny">No exercises yet. Add one above.</div>`;
  }
}

function renderReplaceFrom() {
  const { day } = getSelectedDay();
  const sel = $("#replaceFrom");
  sel.innerHTML = "";
  if (!day || !day.exercises.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No exercises";
    sel.appendChild(opt);
    return;
  }
  day.exercises.forEach(ex => {
    const opt = document.createElement("option");
    opt.value = ex;
    opt.textContent = ex;
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

  $("#setActiveBtn").addEventListener("click", () => {
    const id = $("#routineSelect").value;
    setActiveRoutine(id);
    renderRoutineSelect();
    renderLogDaySelect();
  });

  $("#newRoutineBtn").addEventListener("click", () => {
    const name = prompt("Routine name?", "New Routine");
    if (!name) return;
    const r = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: Date.now(),
      days: [
        { name: "Day 1", exercises: [] }
      ]
    };
    data.routines.unshift(r);
    data.activeRoutineId = r.id;
    saveData(data);
    renderActiveRoutineLabel();
    renderRoutineUI();
    renderLogDaySelect();
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
    day.exercises.push(v);
    $("#newExerciseInput").value = "";
    saveData(data);
    renderExerciseList();
    renderReplaceFrom();
  });

  $("#newExerciseInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#addExerciseBtn").click();
  });

  $("#replaceBtn").addEventListener("click", () => {
    const { day } = getSelectedDay();
    if (!day) return;
    const from = $("#replaceFrom").value;
    const to = ($("#replaceTo").value || "").trim();
    if (!from || !to) return;

    const idx = day.exercises.findIndex(x => x === from);
    if (idx === -1) return;

    day.exercises[idx] = to;
    $("#replaceTo").value = "";
    saveData(data);
    renderExerciseList();
    renderReplaceFrom();
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
      renderHistory();
      renderProgress();
    });
    right.appendChild(del);

    top.appendChild(left);
    top.appendChild(right);

    const details = document.createElement("div");
    details.className = "muted tiny";
    details.style.marginTop = "10px";

    const lines = [];
    w.entries.forEach(e => {
      const sets = e.sets.map(s => `${s.weight}x${s.reps}`).join(", ");
      lines.push(`<div><b>${e.exercise}</b>: ${sets}</div>`);
    });

    details.innerHTML = lines.join("");

    card.appendChild(top);
    card.appendChild(details);
    wrap.appendChild(card);
  });
}

function setupHistoryActions() {
  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lifting-tracker-export.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  $("#clearAllBtn").addEventListener("click", () => {
    if (!confirm("This will delete ALL routines and workout history on this browser. Continue?")) return;
    localStorage.removeItem(KEY.data);
    data = loadData();
    currentWorkout = null;
    saveData(data);
    alert("Cleared.");
    bootRender();
  });
}

// ====== Progress Tab ======
function getAllExerciseNames() {
  // From workouts + routines to populate selector
  const fromWorkouts = data.workouts.flatMap(w => w.entries.map(e => e.exercise));
  const fromRoutines = data.routines.flatMap(r => r.days.flatMap(d => d.exercises));
  return unique([...fromWorkouts, ...fromRoutines]).sort((a,b)=>a.localeCompare(b));
}

function renderProgress() {
  const sel = $("#progressExercise");
  const all = getAllExerciseNames();
  sel.innerHTML = "";
  if (!all.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No exercises yet";
    sel.appendChild(opt);
    $("#progressSummary").textContent = "";
    $("#progressTable").innerHTML = "";
    return;
  }
  all.forEach(ex => {
    const opt = document.createElement("option");
    opt.value = ex;
    opt.textContent = ex;
    sel.appendChild(opt);
  });

  // keep selection if possible
  const prev = sel.dataset.prev || all[0];
  sel.value = all.includes(prev) ? prev : all[0];
  sel.dataset.prev = sel.value;

  renderProgressFor(sel.value);
}

function renderProgressFor(exerciseName) {
  const rows = [];

  data.workouts.forEach(w => {
    w.entries.forEach(e => {
      if (e.exercise !== exerciseName) return;
      // best set in that workout for this exercise by estimated 1RM
      let best = null;
      e.sets.forEach(s => {
        const wgt = Number(s.weight);
        const reps = Number(s.reps);
        const one = est1RM(wgt, reps);
        if (!best || one > best.oneRM) best = { weight: wgt, reps, oneRM: one };
      });
      if (best) {
        rows.push({
          date: w.date,
          day: w.dayName,
          routine: w.routineName,
          weight: best.weight,
          reps: best.reps,
          oneRM: best.oneRM
        });
      }
    });
  });

  rows.sort((a,b)=>a.date-b.date);

  const sum = $("#progressSummary");
  const table = $("#progressTable");

  if (!rows.length) {
    sum.textContent = "No logged sets for this exercise yet.";
    table.innerHTML = "";
    return;
  }

  const bestEver = rows.reduce((m, r) => r.oneRM > m.oneRM ? r : m, rows[0]);
  sum.innerHTML = `
    <div><b>Best estimated 1RM:</b> ${bestEver.oneRM.toFixed(1)} (from ${bestEver.weight}x${bestEver.reps})</div>
    <div class="tiny muted">Based on your best set per workout using Epley estimate.</div>
  `;

  table.innerHTML = "";
  rows.slice().reverse().forEach(r => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="left">
        <div class="name">${r.weight} x ${r.reps} <span class="muted tiny"> (est 1RM ${r.oneRM.toFixed(1)})</span></div>
        <div class="meta">${formatDate(r.date)} • ${r.routine} • ${r.day}</div>
      </div>
    `;
    table.appendChild(item);
  });
}

function setupProgressActions() {
  $("#progressExercise").addEventListener("change", (e) => {
    const ex = e.target.value;
    e.target.dataset.prev = ex;
    renderProgressFor(ex);
  });
}

// ====== Boot Render ======
function bootRender() {
  data = loadData();
  renderActiveRoutineLabel();
  renderLogDaySelect();
  renderRoutineUI();
  renderHistory();
  renderProgress();
}

// ====== Init ======
function init() {
  setupTabs();
  setupLogin();

  // Only wire main actions once
  setupLogActions();
  setupRoutineActions();
  setupHistoryActions();
  setupProgressActions();

  if (isUnlocked()) {
    $("#loginView").classList.add("hidden");
    $("#mainView").classList.remove("hidden");
    bootRender();
  }
}

init();
