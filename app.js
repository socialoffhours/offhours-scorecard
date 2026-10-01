const sb = supabase.createClient(
  OFFHOURS_CONFIG.supabaseUrl,
  OFFHOURS_CONFIG.supabaseKey
);


const q =
  new URLSearchParams(
    location.search
  );


const groupNumber =
  Number(
    q.get("group")
  );


let eventId;

let groupId;

let route = [];

let playerId;

let playerName = "";

let current = 0;

let sips = 1;

let saved = {};

let roundFinished = false;
let currentRun = 1;

const $ =
  selector =>
    document.querySelector(
      selector
    );



// =============================================
// GROUP VALIDATION
// =============================================


if (
  !Number.isInteger(
    groupNumber
  ) ||

  groupNumber < 1 ||

  groupNumber > 5
) {

  $("#error").textContent =
    "Ungültiger Gruppenlink. Bitte QR-Code eurer Gruppe scannen.";


  $("#joinForm button")
    .disabled = true;

}

else {

  $("#groupBadge")
    .textContent =
      `GROUP 0${groupNumber}`;

}



// =============================================
// INITIALIZE
// =============================================


async function init() {


  if (!groupNumber) {

    return;

  }



  // EVENT


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


  if (eventError) {

    return showError(
      "Event konnte nicht geladen werden."
    );

  }


  eventId =
    event.id;
// =============================================
// CURRENT RUN
// =============================================

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
  !stateError &&
  eventState
) {

  currentRun =
    eventState.current_run;

}


  // GROUP


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


  if (groupError) {

    return showError(
      "Gruppe konnte nicht geladen werden."
    );

  }


  groupId =
    group.id;



  // ROUTE


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
    !routeData
  ) {

    return showError(
      "Route konnte nicht geladen werden."
    );

  }


  route =
    routeData;



  // LOCAL PLAYER SESSION


  const storageKey =
    `oh_g${groupNumber}`;


  const localData =
    JSON.parse(
      localStorage.getItem(
        storageKey
      ) || "null"
    );


  if (
    localData?.pid
  ) {

    playerId =
      localData.pid;

    playerName =
      localData.pname;

    saved =
      localData.saved || {};

    current =
      localData.cur || 0;

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



init();



// =============================================
// ERROR
// =============================================


function showError(
  text
) {

  $("#error")
    .textContent =
      text;

}



// =============================================
// SAVE LOCAL SESSION
// =============================================


function persist() {

  localStorage.setItem(

    `oh_g${groupNumber}`,

    JSON.stringify({

      pid:
        playerId,

      pname:
        playerName,

      saved:
        saved,

      cur:
        current,

      roundFinished:
        roundFinished

    })

  );

}



// =============================================
// PLAYER REGISTRATION
// =============================================


$("#joinForm")
  .onsubmit =
  async event => {


    event.preventDefault();


    playerName =
      $("#name")
        .value
        .trim();


    if (
      !playerName
    ) {

      return;

    }


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
    currentRun

});


    if (
      error
    ) {

      return showError(
        "Anmeldung fehlgeschlagen: " +
        error.message
      );

    }


    persist();


    showScorecard();

  };



// =============================================
// SCORECARD
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
    .add(
      "hidden"
    );


  $("#finish")
    .classList
    .add(
      "hidden"
    );


  $("#score")
    .classList
    .remove(
      "hidden"
    );


  $("#player")
    .textContent =
      playerName;


  renderHole();

}



// =============================================
// RENDER HOLE
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


  $("#num")
    .textContent =
      String(
        current + 1
      )
      .padStart(
        2,
        "0"
      );


  $("#par")
    .textContent =
      `PAR ${hole.par}`;


  $("#barName")
    .textContent =
      hole.bar_name;


  $("#drink")
    .textContent =
      hole.drink;


  $("#progressText")
    .textContent =
      `${current + 1} / 9`;


  $("#bar")
    .style
    .width =
      `${(
        (current + 1) /
        9
      ) * 100}%`;


  sips =
    saved[
      stop.id
    ] ?? 1;


  $("#value")
    .textContent =
      sips;


  $("#prev")
    .style
    .visibility =
      current > 0
        ? "visible"
        : "hidden";


  $("#next")
    .style
    .visibility =
      current < 8
        ? "visible"
        : "hidden";


  $("#msg")
    .textContent =

      saved[
        stop.id
      ] !== undefined

        ? "✓ GESPEICHERT"

        : "";

}



// =============================================
// COUNTER
// =============================================


$("#minus")
  .onclick =
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


    $("#value")
      .textContent =
        sips;

  };



$("#plus")
  .onclick =
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


    $("#value")
      .textContent =
        sips;

  };



// =============================================
// NAVIGATION
// =============================================


$("#prev")
  .onclick =
  () => {

    if (
      roundFinished
    ) {

      return;

    }


    if (
      current > 0
    ) {

      current--;

      persist();

      renderHole();

    }

  };



$("#next")
  .onclick =
  () => {

    if (
      roundFinished
    ) {

      return;

    }


    if (
      current < 8
    ) {

      current++;

      persist();

      renderHole();

    }

  };



// =============================================
// SAVE SCORE
// =============================================


$("#save")
  .onclick =
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


    if (
      error
    ) {

      $("#msg")
        .textContent =
          "Fehler: " +
          error.message;

      return;

    }


    saved[
      stop.id
    ] =
      sips;



    // LAST HOLE


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


  roundFinished =
    true;


  await sb
    .from("players")
    .update({

      completed:
        true

    })
    .eq(
      "id",
      playerId
    );


  persist();


  showFinalResults();

}



// =============================================
// FINAL RESULTS
// =============================================


function showFinalResults() {


  $("#join")
    .classList
    .add(
      "hidden"
    );


  $("#score")
    .classList
    .add(
      "hidden"
    );


  $("#finish")
    .classList
    .remove(
      "hidden"
    );


  $("#finishName")
    .textContent =
      playerName.toUpperCase();



  const total =
    Object
      .values(
        saved
      )
      .reduce(
        (
          sum,
          value
        ) =>
          sum +
          Number(value),
        0
      );


  $("#total")
    .textContent =
      total;



  // BUILD FINAL SCORECARD


  $("#finalResults")
    .innerHTML =

      route
        .map(
          (
            stop,
            index
          ) => {


            const hole =
              stop.hole;


            const score =
              saved[
                stop.id
              ] ?? "–";


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
// SAFE TEXT
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
