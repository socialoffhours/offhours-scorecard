// =============================================
// OFFHOURS SCORECARD
// RUN + FINAL RESULTS VERSION
// =============================================

const sb = supabase.createClient(
  OFFHOURS_CONFIG.supabaseUrl,
  OFFHOURS_CONFIG.supabaseKey
);

const $ = selector => document.querySelector(selector);

const params = new URLSearchParams(
  window.location.search
);

const groupNumber = Number(
  params.get("group")
);


// =============================================
// STATE
// =============================================

let eventId = null;
let groupId = null;

let route = [];

let playerId = null;
let playerName = "";

let current = 0;
let sips = 1;

let saved = {};

let roundFinished = false;

let currentRun = 1;


// =============================================
// GROUP CHECK
// =============================================

if (
  !Number.isInteger(groupNumber) ||
  groupNumber < 1 ||
  groupNumber > 5
) {

  $("#error").textContent =
    "Ungültiger Gruppenlink. Bitte scannt den QR-Code eurer Gruppe.";

  $("#joinForm button").disabled =
    true;

}

else {

  $("#groupBadge").textContent =
    `GROUP ${String(groupNumber).padStart(2, "0")}`;

}


// =============================================
// INITIALIZE
// =============================================

async function init() {

  if (!groupNumber) {
    return;
  }


  // -------------------------------------------
  // EVENT
  // -------------------------------------------

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


  if (
    eventError ||
    !event
  ) {

    showError(
      "Event konnte nicht geladen werden."
    );

    return;

  }


  eventId =
    event.id;


  // -------------------------------------------
  // CURRENT RUN
  // -------------------------------------------

  const {
    data: eventState,
    error: stateError
  } = await sb
    .from("event_state")
    .select("current_run")
    .eq(
      "event_id",
      eventId
    )
    .single();


  if (
    stateError ||
    !eventState
  ) {

    showError(
      "Der aktuelle Durchgang konnte nicht geladen werden."
    );

    return;

  }


  currentRun =
    eventState.current_run;


  // -------------------------------------------
  // GROUP
  // -------------------------------------------

  const {
    data: group,
    error: groupError
  } = await sb
    .from("groups")
    .select("id")
    .eq(
      "event_id",
      eventId
    )
    .eq(
      "group_number",
      groupNumber
    )
    .single();


  if (
    groupError ||
    !group
  ) {

    showError(
      "Gruppe konnte nicht geladen werden."
    );

    return;

  }


  groupId =
    group.id;


  // -------------------------------------------
  // ROUTE
  // -------------------------------------------

  const {
    data: routeData,
    error: routeError
  } = await sb
    .from("route_stops")
    .select(`
      id,
      position,
      hole:holes(
        bar_name,
        drink,
        par
      )
    `)
    .eq(
      "group_id",
      groupId
    )
    .order(
      "position"
    );


  if (
    routeError ||
    !routeData ||
    routeData.length === 0
  ) {

    showError(
      "Route konnte nicht geladen werden."
    );

    return;

  }


  route =
    routeData;


  // -------------------------------------------
  // LOCAL SESSION
  //
  // WICHTIG:
  // Der Run ist Teil des Schlüssels.
  //
  // Dadurch bekommt derselbe Browser nach
  // einem Archivieren automatisch eine neue
  // Scorecard.
  // -------------------------------------------

  const storageKey =
    getStorageKey();


  const localData =
    JSON.parse(
      localStorage.getItem(
        storageKey
      ) || "null"
    );


  if (
    localData?.playerId
  ) {

    playerId =
      localData.playerId;

    playerName =
      localData.playerName || "";

    saved =
      localData.saved || {};

    current =
      localData.current || 0;

    roundFinished =
      localData.roundFinished === true;


    if (
      roundFinished
    ) {

      showFinalResults();

    }

    else {

      showScorecard();

    }

  }

}


// =============================================
// STORAGE KEY
// =============================================

function getStorageKey() {

  return (
    `offhours_` +
    `run_${currentRun}_` +
    `group_${groupNumber}`
  );

}


// =============================================
// LOCAL SAVE
// =============================================

function persist() {

  localStorage.setItem(

    getStorageKey(),

    JSON.stringify({

      playerId:
        playerId,

      playerName:
        playerName,

      currentRun:
        currentRun,

      current:
        current,

      saved:
        saved,

      roundFinished:
        roundFinished

    })

  );

}


// =============================================
// PLAYER REGISTRATION
// =============================================

$("#joinForm").onsubmit =
  async event => {

    event.preventDefault();


    playerName =
      $("#name")
        .value
        .trim();


    if (!playerName) {
      return;
    }


    // Neue eindeutige Player-ID

    playerId =
      crypto.randomUUID();


    const {
      error
    } = await sb
      .from("players")
      .insert({

        id:
          playerId,

        event_id:
          eventId,

        group_id:
          groupId,

        name:
          playerName,

        run_number:
          currentRun,

        completed:
          false

      });


    if (error) {

      showError(
        "Anmeldung fehlgeschlagen: " +
        error.message
      );

      return;

    }


    persist();

    showScorecard();

  };


// =============================================
// SHOW SCORECARD
// =============================================

function showScorecard() {

  if (
    roundFinished
  ) {

    showFinalResults();

    return;

  }


  $("#join")
    .classList
    .add("hidden");


  $("#finish")
    .classList
    .add("hidden");


  $("#score")
    .classList
    .remove("hidden");


  $("#player")
    .textContent =
      playerName;


  renderHole();

}


// =============================================
// RENDER CURRENT HOLE
// =============================================

function renderHole() {

  if (
    roundFinished
  ) {

    showFinalResults();

    return;

  }


  const stop =
    route[current];


  const hole =
    stop.hole;


  $("#num").textContent =
    String(
      current + 1
    ).padStart(
      2,
      "0"
    );


  $("#par").textContent =
    `PAR ${hole.par}`;


  $("#barName").textContent =
    hole.bar_name;


  $("#drink").textContent =
    hole.drink;


  $("#progressText").textContent =
    `${current + 1} / 9`;


  $("#bar").style.width =
    `${
      ((current + 1) / 9) * 100
    }%`;


  sips =
    saved[stop.id] ?? 1;


  $("#value").textContent =
    sips;


  $("#prev").style.visibility =
    current > 0
      ? "visible"
      : "hidden";


  $("#next").style.visibility =
    current < 8
      ? "visible"
      : "hidden";


  $("#msg").textContent =
    saved[stop.id] !== undefined
      ? "✓ GESPEICHERT"
      : "";

}


// =============================================
// COUNTER
// =============================================

$("#minus").onclick =
  () => {

    if (
      roundFinished
    ) {
      return;
    }


    sips =
      Math.max(
        1,
        sips - 1
      );


    $("#value").textContent =
      sips;

  };


$("#plus").onclick =
  () => {

    if (
      roundFinished
    ) {
      return;
    }


    sips =
      Math.min(
        99,
        sips + 1
      );


    $("#value").textContent =
      sips;

  };


// =============================================
// PREVIOUS / NEXT
// =============================================

$("#prev").onclick =
  () => {

    if (
      roundFinished ||
      current <= 0
    ) {
      return;
    }


    current--;

    persist();

    renderHole();

  };


$("#next").onclick =
  () => {

    if (
      roundFinished ||
      current >= 8
    ) {
      return;
    }


    current++;

    persist();

    renderHole();

  };


// =============================================
// SAVE SCORE
// =============================================

$("#save").onclick =
  async () => {

    if (
      roundFinished
    ) {
      return;
    }


    const stop =
      route[current];


    const {
      error
    } = await sb
      .from("scores")
      .upsert(

        {

          player_id:
            playerId,

          route_stop_id:
            stop.id,

          sips:
            sips,

          completed_at:
            new Date()
              .toISOString(),

          updated_at:
            new Date()
              .toISOString()

        },

        {

          onConflict:
            "player_id,route_stop_id"

        }

      );


    if (error) {

      $("#msg").textContent =
        "Fehler: " +
        error.message;

      return;

    }


    saved[stop.id] =
      sips;


    // -----------------------------------------
    // LAST HOLE
    // -----------------------------------------

    if (
      current === 8
    ) {

      await finishRound();

      return;

    }


    current++;

    persist();

    renderHole();

  };


// =============================================
// FINISH ROUND
// =============================================

async function finishRound() {

  // Erst Spieler in Supabase abschließen

  const {
    error
  } = await sb
    .from("players")
    .update({

      completed:
        true

    })
    .eq(
      "id",
      playerId
    );


  if (error) {

    $("#msg").textContent =
      "Runde konnte nicht abgeschlossen werden: " +
      error.message;

    return;

  }


  roundFinished =
    true;


  persist();


  showFinalResults();

}


// =============================================
// FINAL RESULTS
// =============================================

function showFinalResults() {

  $("#join")
    .classList
    .add("hidden");


  $("#score")
    .classList
    .add("hidden");


  $("#finish")
    .classList
    .remove("hidden");


  $("#finishName").textContent =
    playerName.toUpperCase();


  // -------------------------------------------
  // TOTAL
  // -------------------------------------------

  const total =
    Object
      .values(saved)
      .reduce(
        (
          sum,
          value
        ) => {

          return (
            sum +
            Number(value)
          );

        },
        0
      );


  $("#total").textContent =
    total;


  // -------------------------------------------
  // FINAL SCORECARD
  // -------------------------------------------

  const finalResults =
    $("#finalResults");


  if (
    !finalResults
  ) {

    return;

  }


  finalResults.innerHTML =

    route
      .map(
        (
          stop,
          index
        ) => {


          const hole =
            stop.hole;


          const score =
            saved[stop.id] ?? "–";


          return `

            <div
              class="finalResultRow"
            >

              <span
                class="finalHole"
              >
                ${String(
                  index + 1
                ).padStart(
                  2,
                  "0"
                )}
              </span>


              <strong
                class="finalBar"
              >
                ${escapeHtml(
                  hole.bar_name
                )}
              </strong>


              <span
                class="finalDrink"
              >
                ${escapeHtml(
                  hole.drink
                )}
              </span>


              <span
                class="finalPar"
              >
                PAR ${hole.par}
              </span>


              <strong
                class="finalScore"
              >
                ${score}
              </strong>

            </div>

          `;

        }
      )
      .join("");

}


// =============================================
// ESCAPE HTML
// =============================================

function escapeHtml(
  value
) {

  return String(value)
    .replace(

      /[&<>"']/g,

      character => ({

        "&":
          "&amp;",

        "<":
          "&lt;",

        ">":
          "&gt;",

        '"':
          "&quot;",

        "'":
          "&#39;"

      })[
        character
      ]

    );

}


// =============================================
// ERROR
// =============================================

function showError(
  text
) {

  $("#error").textContent =
    text;

}


// =============================================
// START APP
// =============================================

init();
