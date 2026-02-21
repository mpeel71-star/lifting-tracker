<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Lifting Tracker</title>
  <link rel="stylesheet" href="style.css" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
</head>

<body>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <div class="logo">🏋️</div>
        <div>
          <div class="title">Lifting Tracker</div>
          <div class="subtitle" id="activeRoutineLabel"></div>
          <div class="subtitle" id="cloudLabel">Local mode</div>
        </div>
      </div>

      <div class="top-actions">
        <button class="btn ghost" id="btnExport">Export JSON</button>
        <label class="btn ghost file">
          Import JSON
          <input id="fileImport" type="file" accept="application/json" />
        </label>
      </div>
    </header>

    <!-- Simple local lock -->
    <section id="loginView" class="card">
      <h2>Enter Password</h2>
      <p class="muted">Simple local lock (not secure). Default: <b>lift</b></p>
      <div class="row wrap">
        <input id="pwInput" type="password" placeholder="Password" />
        <button id="pwBtn" class="primary">Unlock</button>
      </div>
      <p id="pwMsg" class="error"></p>
    </section>

    <!-- Main app -->
    <main id="mainView" class="hidden">

      <!-- Firebase / Cloud Sync -->
      <section class="card" id="authCard">
        <h2>Cloud Sync (Firebase)</h2>
        <p class="muted">
          Sign in to sync routines + workout history across devices.
          Local storage remains a backup.
        </p>

        <div class="row wrap">
          <input id="fbEmail" type="email" placeholder="Email" />
          <input id="fbPassword" type="password" placeholder="Password" />
          <button class="btn" id="fbSignUp">Create account</button>
          <button class="btn" id="fbSignIn">Sign in</button>
          <button class="btn danger" id="fbSignOut" style="display:none;">Sign out</button>
        </div>

        <details class="mt">
          <summary>Advanced</summary>
          <div class="row wrap mt">
            <button class="btn ghost" id="btnPushCloud" style="display:none;">Push local → cloud</button>
            <button class="btn ghost" id="btnPullCloud" style="display:none;">Pull cloud → local</button>
            <button class="btn ghost" id="btnUseLocal">Use local (overwrite in-app)</button>
          </div>
          <p class="muted tiny">
            Pull overwrites your local backup with cloud. Push overwrites cloud with your local data.
          </p>
        </details>

        <div class="msg error" id="fbMsg"></div>
        <div class="msg ok" id="fbStatus"></div>
      </section>

      <!-- Tabs -->
      <nav class="tabs">
        <button class="tab active" data-tab="log">Log</button>
        <button class="tab" data-tab="routines">Routines</button>
        <button class="tab" data-tab="history">History</button>
        <button class="tab" data-tab="reports">Reports</button>
      </nav>

      <!-- LOG -->
      <section class="panel active" data-panel="log">
        <div class="card">
          <h2>Start a Workout</h2>
          <div class="row wrap">
            <label class="field">
              <span class="label">Day</span>
              <select id="daySelect"></select>
            </label>

            <label class="chip">
              <input type="checkbox" id="logCompoundOnly" />
              Compound only
            </label>

            <button class="btn" id="startWorkoutBtn">Start workout</button>
            <button class="btn ghost" id="clearWorkoutBtn">Clear</button>
            <button class="btn" id="saveWorkoutBtn">Save workout</button>
          </div>

          <div class="muted tiny mt" id="logHint">
            Titles show PR: <b>top weight</b> + <b>best reps at that weight</b>.
            Enter a weight and you’ll see your best reps ever at that weight.
          </div>
        </div>

        <div class="card" id="workoutCard">
          <h2>Workout</h2>
          <div id="exerciseLogList" class="list"></div>
        </div>
      </section>

      <!-- ROUTINES -->
      <section class="panel hidden" data-panel="routines">
        <div class="card">
          <h2>Routines</h2>
          <p class="muted">Keep old routines. Clone active to create a new version, then swap exercises.</p>

          <div class="row wrap">
            <button class="btn" id="newRoutineBtn">New routine</button>
            <button class="btn" id="cloneRoutineBtn">Clone active</button>
            <button class="btn ghost" id="renameRoutineBtn">Rename active</button>
            <button class="btn danger" id="deleteRoutineBtn">Delete active</button>
          </div>

          <div class="row wrap mt">
            <label class="field">
              <span class="label">Active routine</span>
              <select id="routineSelect"></select>
            </label>
            <button class="btn" id="setActiveBtn">Set active</button>

            <label class="chip">
              <input type="checkbox" id="routineCompoundOnly" />
              View compound only
            </label>
          </div>

          <div class="divider"></div>

          <div class="row wrap">
            <label class="field">
              <span class="label">Day</span>
              <select id="routineDaySelect"></select>
            </label>
            <button class="btn ghost" id="addDayBtn">+ Day</button>
            <button class="btn danger" id="deleteDayBtn">Delete day</button>
          </div>

          <div class="row wrap mt">
            <input id="newExerciseInput" placeholder="Add exercise (e.g., Bench Press)" />
            <select id="newExerciseTag">
              <option value="compound">compound</option>
              <option value="accessory">accessory</option>
            </select>
            <button class="btn" id="addExerciseBtn">Add</button>
          </div>

          <div class="divider"></div>

          <h3>Exercises</h3>
          <div id="exerciseList" class="list"></div>

          <div class="divider"></div>

          <h3>Swap an Exercise</h3>
          <p class="muted tiny">Swap within the selected routine/day only.</p>
          <div class="row wrap">
            <select id="swapFrom"></select>
            <input id="swapTo" placeholder="New exercise name" />
            <select id="swapTag">
              <option value="compound">compound</option>
              <option value="accessory">accessory</option>
            </select>
            <button class="btn" id="btnSwap">Swap</button>
          </div>
        </div>

        <div class="card">
          <h2>Local password</h2>
          <p class="muted">Optional: change local password.</p>
          <div class="row wrap">
            <input id="newPw" type="password" placeholder="New password" />
            <button id="setPwBtn" class="btn ghost">Set Password</button>
          </div>
          <p class="muted tiny">Security note: simple local lock only.</p>
        </div>
      </section>

      <!-- HISTORY -->
      <section class="panel hidden" data-panel="history">
        <div class="card">
          <h2>History</h2>
          <div class="row wrap">
            <button id="exportJsonBtn" class="btn ghost">Export JSON</button>
            <button id="exportCsvBtn" class="btn ghost">Export CSV</button>
            <button id="clearAllBtn" class="btn danger">Clear ALL Data</button>
            <input id="historySearch" placeholder="Search exercise…" />
          </div>
          <div id="historyList" class="list"></div>
        </div>
      </section>

      <!-- REPORTS -->
      <section class="panel hidden" data-panel="reports">
        <div class="card">
          <h2>Reports</h2>
          <div class="row wrap">
            <label class="chip">
              <input type="checkbox" id="reportCompoundOnly" />
              Compound only
            </label>

            <label class="field">
              <span class="label">Metric</span>
              <select id="reportMetric">
                <option value="e1rm">Estimated 1RM (best set)</option>
                <option value="topWeight">Top weight (best set)</option>
                <option value="volume">Total volume (sum weight×reps)</option>
              </select>
            </label>

            <label class="field">
              <span class="label">Exercise</span>
              <select id="reportExercise"></select>
            </label>
          </div>

          <div class="mt muted" id="reportSummary"></div>
          <div class="divider"></div>
          <div id="reportTable" class="list"></div>
        </div>

        <div class="card">
          <h2>Trend Chart</h2>
          <canvas id="reportChart" height="220"></canvas>
          <p class="muted tiny mt">Uses your best set per workout for the selected exercise.</p>
        </div>
      </section>

      <footer class="footer muted tiny">
        Local backup + Firebase cloud sync. Export JSON anytime.
      </footer>
    </main>
  </div>

  <script type="module" src="script.js"></script>
</body>
</html>
