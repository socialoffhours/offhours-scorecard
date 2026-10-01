const sb = supabase.createClient(
  OFFHOURS_CONFIG.supabaseUrl,
  OFFHOURS_CONFIG.supabaseKey
);

const $ = selector => document.querySelector(selector);

let selectedEventId = null; let playersData = [];

let activeFilter = "all";


// ============================================
// LOAD DASHBOARD
// ============================================

async function loadDashboard() {

  $("#dashMsg").textContent =
    "Lade OFFHOURS Daten...";


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


  if (eventError) {

    showMessage(
      "Event konnte nicht geladen werden: " +
      eventError.message
    );

    return;
  }



  // ============================================
  // PLAYERS LADEN
  // ============================================

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
      group:groups(
        group_number
      )
    `)
    .eq(
      "event_id",
      event.id
    )
    .order(
      "created_at"
    );


  if (playersError) {

    showMessage(
      "Spieler konnten nicht geladen werden: " +
      playersError.message
    );

    return;
  }



  // ============================================
  // SCORES LADEN
  // ============================================

  const playerIds =
    (players || []).map(
      player => player.id
    );


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



  // ============================================
  // SCORES NACH SPIELER SORTIEREN
  // ============================================

  const scoreMap = {};


  scores.forEach(score => {

    if (!scoreMap[score.player_id]) {

      scoreMap[score.player_id] = {};

    }


    const position =
      score.route_stop.position;


    scoreMap[score.player_id][position] =
      score.sips;

  });



  // ============================================
  // PLAYER DATEN BAUEN
  // ============================================

  playersData =
    (players || []).map(player => {

      return {

        id:
          player.id,

        name:
          player.name,

        group:
          player.group?.group_number || 0,

        completed:
          player.completed === true,

        scores:
          scoreMap[player.id] || {}

      };

    });



  // ============================================
  // STATS
  // ============================================

  $("#players").textContent =
    playersData.length;


  $("#finished").textContent =
    playersData.filter(
      player => player.completed
    ).length;


  $("#groups").textContent =
    new Set(
      playersData.map(
        player => player.group
      )
    ).size;


  $("#holes").textContent =
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



  showMessage(
    "Zuletzt aktualisiert: " +
    new Date().toLocaleTimeString(
      "de-DE"
    )
  );


  renderTable();

}



// ============================================
// TABLE RENDER
// ============================================

function renderTable() {

  const search =
    $("#search")
      .value
      .trim()
      .toLowerCase();



  let filtered =
    playersData.filter(player => {


      // GROUP FILTER

      let matchesFilter = true;


      if (
        activeFilter ===
        "finished"
      ) {

        matchesFilter =
          player.completed;

      }


      else if (
        activeFilter !==
        "all"
      ) {

        matchesFilter =
          String(player.group) ===
          activeFilter;

      }



      // SEARCH

      const matchesSearch =

        !search ||

        player.name
          .toLowerCase()
          .includes(search);



      return (
        matchesFilter &&
        matchesSearch
      );

    });



  // ============================================
  // SORTIERUNG
  // ============================================

  filtered.sort((a, b) => {

    // Fertige Spieler zuerst

    if (
      a.completed !==
      b.completed
    ) {

      return (
        b.completed -
        a.completed
      );

    }


    // Danach Gruppe

    if (
      a.group !==
      b.group
    ) {

      return (
        a.group -
        b.group
      );

    }


    // Danach Name

    return (
      a.name.localeCompare(
        b.name
      )
    );

  });



  // ============================================
  // HTML
  // ============================================

  $("#rows").innerHTML =

    filtered.map(player => {


      const values =
        Array.from(
          { length: 9 },
          (_, index) => {

            return (
              player.scores[
                index + 1
              ] ?? "–"
            );

          }
        );


      const completedHoles =
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

            ${completedHoles}/9

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

    }).join("");



  if (
    filtered.length === 0
  ) {

    $("#rows").innerHTML = `

      <tr>

        <td colspan="14">

          Keine Spieler gefunden.

        </td>

      </tr>

    `;

  }

}



// ============================================
// SECURITY
// ============================================

function escapeHtml(value) {

  return value.replace(
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



// ============================================
// MESSAGE
// ============================================

function showMessage(text) {

  $("#dashMsg").textContent =
    text;

}



// ============================================
// REFRESH
// ============================================

$("#refresh")
  .addEventListener(
    "click",
    loadDashboard
  );



// ============================================
// SEARCH
// ============================================

$("#search")
  .addEventListener(
    "input",
    renderTable
  );



// ============================================
// FILTER
// ============================================

document
  .querySelectorAll(
    "[data-g]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            "[data-g]"
          )
          .forEach(btn => {

            btn.classList.remove(
              "active"
            );

          });


        button.classList.add(
          "active"
        );


        activeFilter =
          button.dataset.g;


        renderTable();

      }
    );

  });



// ============================================
// START
// ============================================

loadDashboard();



// AUTO REFRESH ALLE 15 SEKUNDEN

setInterval(
  loadDashboard,
  15000
);
