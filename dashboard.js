// =============================================
// OFFHOURS CONTROL ROOM
// LIVE RUN + ARCHIVE SYSTEM
// =============================================

const sb = supabase.createClient(
  OFFHOURS_CONFIG.supabaseUrl,
  OFFHOURS_CONFIG.supabaseKey
);

const $ = selector => document.querySelector(selector);


// =============================================
// STATE
// =============================================

let eventId = null;

let currentRun = 1;

let displayedRun = 1;

let archiveMode = false;

let playersData = [];

let activeFilter = "all";


// =============================================
// INITIALIZE
// =============================================

async function initDashboard() {

  showMessage("Lade OFFHOURS Control Room...");


  // EVENT LADEN

  const {
    data: event,
    error: eventError
  } = await sb
    .from("events")
    .select("id")
    .eq(
      "name",
      OFFHOURS_CONFIG.eventName
    )
    .single();


  if (eventError || !event) {

    showMessage(
      "Event konnte nicht geladen werden: " +
      (
        eventError?.message ||
        "Event nicht gefunden"
      )
    );

    return;
  }


  eventId = event.id;


  // =============================================
  // AKTUELLEN RUN LADEN
  // =============================================

  const {
    data: state,
    error: stateError
  } = await sb
    .from("event_state")
    .select("current_run")
    .eq(
      "event_id",
      eventId
    )
    .single();


  if (stateError || !state) {

    showMessage(
      "Durchgangsstatus konnte nicht geladen werden. " +
      "Bitte prüfe event_state in Supabase."
    );

    return;
  }


  currentRun = state.current_run;

  displayedRun = currentRun;

  archiveMode = false;


  updateRunLabel();

  updateArchiveButton();


  await loadDashboard();
}


// =============================================
// LOAD CURRENT / ARCHIVED RUN
// =============================================

async function loadDashboard() {

  if (!eventId) {
    return;
  }


  showMessage(
    `Lade Run ${String(displayedRun).padStart(2, "0")}...`
  );


  // =============================================
  // PLAYERS
  // =============================================

  const {
    data: players,
    error: playersError
  } = await sb
    .from("players")
    .select(`
      id,
      name,
      completed,
      created_at,
      run_number,
      group:groups(
        group_number
      )
    `)
    .eq(
      "event_id",
      eventId
    )
    .eq(
      "run_number",
      displayedRun
    )
    .order(
      "created_at",
      {
        ascending: true
      }
    );


  if (playersError) {

    showMessage(
      "Spieler konnten nicht geladen werden: " +
      playersError.message
    );

    return;
  }


  // =============================================
  // PLAYER IDS
  // =============================================

  const playerIds =
    (players || []).map(
      player => player.id
    );


  // =============================================
  // SCORES
  // =============================================

  let scores = [];


  if (playerIds.length > 0) {

    const {
      data: scoreData,
      error: scoreError
    } = await sb
      .from("scores")
      .select(`
        player_id,
        sips,
        route_stop:route_stops(
          position
        )
      `)
      .in(
        "player_id",
        playerIds
      );


    if (scoreError) {

      showMessage(
        "Scores konnten nicht geladen werden: " +
        scoreError.message
      );

      return;
    }


    scores = scoreData || [];
  }


  // =============================================
  // SCORE MAP
  // =============================================

  const scoreMap = {};


  scores.forEach(score => {

    if (!scoreMap[score.player_id]) {

      scoreMap[score.player_id] = {};
    }


    const position =
      score.route_stop?.position;


    if (position) {

      scoreMap[
        score.player_id
      ][position] = score.sips;
    }

  });


  // =============================================
  // PLAYER DATA
  // =============================================

  playersData =
    (players || []).map(
      player => ({

        id:
          player.id,

        name:
          player.name,

        group:
          player.group?.group_number || 0,

        completed:
          player.completed === true,

        run:
          player.run_number,

        scores:
          scoreMap[player.id] || {}

      })
    );


  updateStatistics();

  renderTable();

  updateRunLabel();


  showMessage(
    `${archiveMode ? "ARCHIV" : "LIVE"} · ` +
    `RUN ${String(displayedRun).padStart(2, "0")} · ` +
    `zuletzt aktualisiert ${new Date().toLocaleTimeString("de-DE")}`
  );
}


// =============================================
// STATISTICS
// =============================================

function updateStatistics() {

  const playersElement =
    $("#players");

  const finishedElement =
    $("#finished");

  const groupsElement =
    $("#groups");

  const holesElement =
    $("#holes");


  if (playersElement) {

    playersElement.textContent =
      playersData.length;
  }


  if (finishedElement) {

    finishedElement.textContent =
      playersData.filter(
        player => player.completed
      ).length;
  }


  if (groupsElement) {

    const groups =
      new Set(
        playersData
          .map(
            player => player.group
          )
          .filter(
            group => group > 0
          )
      );


    groupsElement.textContent =
      groups.size;
  }


  if (holesElement) {

    holesElement.textContent =
      playersData.reduce(
        (total, player) => {

          return (
            total +
            Object.keys(
              player.scores
            ).length
          );

        },
        0
      );
  }
}


// =============================================
// RUN LABEL
// =============================================

function updateRunLabel() {

  const label =
    $("#currentRunLabel");


  if (!label) {
    return;
  }


  if (archiveMode) {

    label.textContent =
      `ARCHIV · RUN ${String(displayedRun).padStart(2, "0")}`;
  }

  else {

    label.textContent =
      `RUN ${String(currentRun).padStart(2, "0")}`;
  }
}


// =============================================
// RENDER TABLE
// =============================================

function renderTable() {

  const search =
    $("#search")
      ?.value
      ?.trim()
      ?.toLowerCase() || "";


  let filtered =
    playersData.filter(
      player => {


        let filterMatches = true;


        // FINISHED

        if (
          activeFilter === "finished"
        ) {

          filterMatches =
            player.completed;
        }


        // GROUP FILTER

        else if (
          activeFilter !== "all"
        ) {

          filterMatches =
            String(
              player.group
            ) === activeFilter;
        }


        // SEARCH

        const searchMatches =
          !search ||
          player.name
            .toLowerCase()
            .includes(search);


        return (
          filterMatches &&
          searchMatches
        );
      }
    );


  // =============================================
  // SORTIERUNG
  // =============================================

  filtered.sort(
    (a, b) => {

      if (
        a.group !== b.group
      ) {

        return (
          a.group -
          b.group
        );
      }


      return a.name.localeCompare(
        b.name,
        "de"
      );
    }
  );


  const rows =
    $("#rows");


  if (!rows) {
    return;
  }


  if (
    filtered.length === 0
  ) {

    rows.innerHTML = `

      <tr>

        <td colspan="14">

          Keine Spieler in diesem Durchgang gefunden.

        </td>

      </tr>

    `;

    return;
  }


  // =============================================
  // TABLE HTML
  // =============================================

  rows.innerHTML =
    filtered
      .map(
        player => {


          const values =
            Array.from(
              {
                length: 9
              },
              (_, index) => {

                return (
                  player.scores[
                    index + 1
                  ] ?? "–"
                );
              }
            );


          const progress =
            values.filter(
              value =>
                value !== "–"
            ).length;


          const total =
            values.reduce(
              (sum, value) => {

                if (
                  value === "–"
                ) {

                  return sum;
                }


                return (
                  sum +
                  Number(value)
                );

              },
              0
            );


          const status =
            player.completed
              ? "FINISHED"
              : "PLAYING";


          return `

            <tr>

              <td>
                ${escapeHtml(
                  player.name
                )}
              </td>

              <td class="orange">
                G${player.group}
              </td>

              <td class="${
                player.completed
                  ? "orange"
                  : ""
              }">
                ${status}
              </td>

              <td>
                ${progress}/9
              </td>

              ${values
                .map(
                  value =>
                    `<td>${value}</td>`
                )
                .join("")}

              <td class="orange">
                ${total}
              </td>

            </tr>

          `;

        }
      )
      .join("");
}


// =============================================
// ARCHIVE CURRENT RUN
// =============================================

async function archiveCurrentRun() {

  if (archiveMode) {

    alert(
      "Du befindest dich gerade im Archiv."
    );

    return;
  }


  const confirmed =
    confirm(

      `RUN ${String(currentRun).padStart(2, "0")} wirklich archivieren?\n\n` +

      `Die Spieler und Ergebnisse werden NICHT gelöscht.\n\n` +

      `Danach startet automatisch RUN ${String(currentRun + 1).padStart(2, "0")}.`

    );


  if (!confirmed) {
    return;
  }


  const oldRun =
    currentRun;


  const nextRun =
    currentRun + 1;


  // =============================================
  // EVENT STATE UPDATE
  // =============================================

  const {
    error
  } = await sb
    .from("event_state")
    .update({

      current_run:
        nextRun,

      updated_at:
        new Date()
          .toISOString()

    })
    .eq(
      "event_id",
      eventId
    );


  if (error) {

    alert(
      "Durchgang konnte nicht archiviert werden:\n" +
      error.message
    );

    return;
  }


  currentRun =
    nextRun;

  displayedRun =
    currentRun;

  archiveMode =
    false;


  resetFilters();

  updateArchiveButton();

  updateRunLabel();


  await loadDashboard();


  alert(
    `RUN ${String(oldRun).padStart(2, "0")} wurde archiviert.\n\n` +
    `RUN ${String(currentRun).padStart(2, "0")} ist jetzt aktiv.`
  );
}


// =============================================
// OPEN / CLOSE ARCHIVE
// =============================================

async function toggleArchive() {

  // =============================================
  // CLOSE ARCHIVE
  // =============================================

  if (archiveMode) {

    archiveMode =
      false;

    displayedRun =
      currentRun;


    resetFilters();

    updateArchiveButton();

    updateRunLabel();


    await loadDashboard();

    return;
  }


  // =============================================
  // NO ARCHIVE YET
  // =============================================

  if (
    currentRun <= 1
  ) {

    alert(
      "Es gibt noch keinen archivierten Durchgang."
    );

    return;
  }


  // =============================================
  // OPEN LATEST ARCHIVED RUN
  // =============================================

  archiveMode =
    true;

  displayedRun =
    currentRun - 1;


  resetFilters();

  updateArchiveButton();

  updateRunLabel();


  await loadDashboard();
}


// =============================================
// ARCHIVE BUTTON
// =============================================

function updateArchiveButton() {

  const button =
    $("#archiveToggle");


  if (!button) {
    return;
  }


  if (archiveMode) {

    button.textContent =
      "← ZURÜCK ZUM LIVE RUN";

    button.classList.add(
      "archiveMode"
    );
  }

  else {

    button.textContent =
      "ARCHIV →";

    button.classList.remove(
      "archiveMode"
    );
  }
}


// =============================================
// RESET FILTERS
// =============================================

function resetFilters() {

  activeFilter =
    "all";


  const search =
    $("#search");


  if (search) {

    search.value =
      "";
  }


  document
    .querySelectorAll(
      "[data-g]"
    )
    .forEach(
      button => {

        button.classList.remove(
          "active"
        );

      }
    );


  document
    .querySelector(
      '[data-g="all"]'
    )
    ?.classList
    .add(
      "active"
    );
}


// =============================================
// ESCAPE HTML
// =============================================

function escapeHtml(value) {

  return String(value)
    .replace(
      /[&<>"']/g,
      character => ({

        "&": "&amp;",

        "<": "&lt;",

        ">": "&gt;",

        '"': "&quot;",

        "'": "&#39;"

      })[character]
    );
}


// =============================================
// STATUS MESSAGE
// =============================================

function showMessage(text) {

  const message =
    $("#dashMsg");


  if (message) {

    message.textContent =
      text;
  }
}


// =============================================
// ARCHIVE BUTTON
// =============================================

const archiveRunButton =
  $("#archiveRun");


if (archiveRunButton) {

  archiveRunButton.addEventListener(
    "click",
    archiveCurrentRun
  );
}


// =============================================
// ARCHIVE VIEW BUTTON
// =============================================

const archiveToggleButton =
  $("#archiveToggle");


if (archiveToggleButton) {

  archiveToggleButton.addEventListener(
    "click",
    toggleArchive
  );
}


// =============================================
// REFRESH
// =============================================

const refreshButton =
  $("#refresh");


if (refreshButton) {

  refreshButton.addEventListener(
    "click",
    loadDashboard
  );
}


// =============================================
// SEARCH
// =============================================

const searchInput =
  $("#search");


if (searchInput) {

  searchInput.addEventListener(
    "input",
    renderTable
  );
}


// =============================================
// FILTERS
// =============================================

document
  .querySelectorAll(
    "[data-g]"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {


          document
            .querySelectorAll(
              "[data-g]"
            )
            .forEach(
              otherButton => {

                otherButton.classList.remove(
                  "active"
                );
              }
            );


          button.classList.add(
            "active"
          );


          activeFilter =
            button.dataset.g;


          renderTable();

        }
      );
    }
  );


// =============================================
// START DASHBOARD
// =============================================

initDashboard();


// =============================================
// AUTO REFRESH
// =============================================

setInterval(
  () => {

    if (eventId) {

      loadDashboard();
    }

  },

  15000
);
