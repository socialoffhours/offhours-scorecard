// =============================================
// OFFHOURS CONTROL ROOM
// dashboard.js
// =============================================


// SUPABASE CLIENT

const sb = supabase.createClient(
  OFFHOURS_CONFIG.supabaseUrl,
  OFFHOURS_CONFIG.supabaseKey
);


// SHORT SELECTOR

const $ = selector =>
  document.querySelector(selector);


// =============================================
// GLOBAL STATE
// =============================================

let playersData = [];

let activeFilter = "all";

let selectedEventId = null;

let eventsData = [];


// =============================================
// LOAD EVENTS / DURCHGÄNGE
// =============================================

async function loadEvents() {

  showMessage(
    "Lade Durchgänge..."
  );


  const {
    data: events,
    error
  } = await sb
    .from("events")
    .select(`
      id,
      name,
      city,
      event_date,
      created_at
    `)
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {

    showMessage(
      "Events konnten nicht geladen werden: " +
      error.message
    );

    return;
  }


  eventsData =
    events || [];


  const select =
    $("#eventSelect");


  if (!select) {

    showMessage(
      "Event-Auswahl wurde in dashboard.html nicht gefunden."
    );

    return;
  }


  // Keine Events vorhanden

  if (
    eventsData.length === 0
  ) {

    select.innerHTML = `
      <option>
        Keine Events vorhanden
      </option>
    `;


    showMessage(
      "Keine OFFHOURS Events gefunden."
    );


    return;
  }


  // Dropdown aufbauen

  select.innerHTML =

    eventsData
      .map(event => {


        let dateText =
          "ohne Datum";


        if (
          event.event_date
        ) {

          const date =
            new Date(
              event.event_date +
              "T12:00:00"
            );


          dateText =
            date.toLocaleDateString(
              "de-DE"
            );

        }


        return `

          <option
            value="${event.id}"
          >

            ${escapeHtml(
              event.name
            )}

            · ${dateText}

          </option>

        `;

      })
      .join("");


  // Standard:
  // neuester Durchgang

  selectedEventId =
    eventsData[0].id;


  select.value =
    selectedEventId;


  // Bei Auswahl wechseln

  select.addEventListener(
    "change",
    () => {


      selectedEventId =
        select.value;


      // Suche zurücksetzen

      const search =
        $("#search");


      if (search) {

        search.value = "";

      }


      // Filter zurücksetzen

      activeFilter =
        "all";


      document
        .querySelectorAll(
          "[data-g]"
        )
        .forEach(button => {

          button.classList.remove(
            "active"
          );

        });


      const allButton =
        document.querySelector(
          '[data-g="all"]'
        );


      if (allButton) {

        allButton.classList.add(
          "active"
        );

      }


      loadDashboard();

    }
  );


  // Erstes Event laden

  await loadDashboard();

}



// =============================================
// LOAD DASHBOARD
// =============================================

async function loadDashboard() {


  if (
    !selectedEventId
  ) {

    return;

  }


  showMessage(
    "Lade OFFHOURS Daten..."
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
      group:groups(
        group_number
      )
    `)
    .eq(
      "event_id",
      selectedEventId
    )
    .order(
      "created_at",
      {
        ascending: true
      }
    );


  if (
    playersError
  ) {

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
    (players || [])
      .map(
        player =>
          player.id
      );



  // =============================================
  // SCORES
  // =============================================


  let scores = [];


  if (
    playerIds.length > 0
  ) {


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


    if (
      scoreError
    ) {

      showMessage(
        "Scores konnten nicht geladen werden: " +
        scoreError.message
      );

      return;
    }


    scores =
      scoreData || [];

  }



  // =============================================
  // SCORE MAP
  // =============================================


  const scoreMap = {};


  scores.forEach(
    score => {


      if (
        !scoreMap[
          score.player_id
        ]
      ) {

        scoreMap[
          score.player_id
        ] = {};

      }


      const position =
        score
          .route_stop
          ?.position;


      if (
        position
      ) {

        scoreMap[
          score.player_id
        ][position] =
          score.sips;

      }

    }
  );



  // =============================================
  // PLAYER DATA
  // =============================================


  playersData =
    (players || [])
      .map(
        player => {


          return {

            id:
              player.id,

            name:
              player.name,

            group:
              player
                .group
                ?.group_number || 0,

            completed:
              player.completed === true,

            scores:
              scoreMap[
                player.id
              ] || {}

          };

        }
      );



  // =============================================
  // UPDATE STATISTICS
  // =============================================


  updateStatistics();



  // =============================================
  // RENDER
  // =============================================


  renderTable();


  showMessage(

    "Zuletzt aktualisiert: " +

    new Date()
      .toLocaleTimeString(
        "de-DE"
      )

  );

}



// =============================================
// STATISTICS
// =============================================

function updateStatistics() {


  // PLAYERS

  const playersElement =
    $("#players");


  if (
    playersElement
  ) {

    playersElement.textContent =
      playersData.length;

  }



  // FINISHED

  const finishedElement =
    $("#finished");


  if (
    finishedElement
  ) {

    finishedElement.textContent =

      playersData
        .filter(
          player =>
            player.completed
        )
        .length;

  }



  // GROUPS

  const groupsElement =
    $("#groups");


  if (
    groupsElement
  ) {


    const groups =
      new Set(

        playersData

          .map(
            player =>
              player.group
          )

          .filter(
            group =>
              group > 0
          )

      );


    groupsElement.textContent =
      groups.size;

  }



  // HOLES COMPLETED

  const holesElement =
    $("#holes");


  if (
    holesElement
  ) {


    const completedHoles =

      playersData
        .reduce(

          (
            total,
            player
          ) => {


            return (

              total +

              Object
                .keys(
                  player.scores
                )
                .length

            );

          },

          0

        );


    holesElement.textContent =
      completedHoles;

  }

}



// =============================================
// RENDER TABLE
// =============================================

function renderTable() {


  const searchInput =
    $("#search");


  const search =
    searchInput
      ? searchInput
          .value
          .trim()
          .toLowerCase()
      : "";



  // =============================================
  // FILTER
  // =============================================


  let filtered =
    playersData
      .filter(
        player => {


          let matchesFilter =
            true;



          // FINISHED

          if (
            activeFilter ===
            "finished"
          ) {

            matchesFilter =
              player.completed;

          }



          // GROUP FILTER

          else if (
            activeFilter !==
            "all"
          ) {

            matchesFilter =

              String(
                player.group
              ) ===
              activeFilter;

          }



          // SEARCH

          const matchesSearch =

            !search ||

            player
              .name
              .toLowerCase()
              .includes(
                search
              );



          return (

            matchesFilter &&

            matchesSearch

          );

        }
      );



  // =============================================
  // SORT
  // =============================================


  filtered.sort(
    (
      playerA,
      playerB
    ) => {


      // Finished first

      if (
        playerA.completed !==
        playerB.completed
      ) {

        return (

          Number(
            playerB.completed
          ) -

          Number(
            playerA.completed
          )

        );

      }



      // Group

      if (
        playerA.group !==
        playerB.group
      ) {

        return (

          playerA.group -

          playerB.group

        );

      }



      // Name

      return (

        playerA
          .name
          .localeCompare(
            playerB.name,
            "de"
          )

      );

    }
  );



  // =============================================
  // TABLE BODY
  // =============================================


  const rows =
    $("#rows");


  if (
    !rows
  ) {

    return;

  }



  if (
    filtered.length === 0
  ) {


    rows.innerHTML = `

      <tr>

        <td colspan="14">

          Keine Spieler
          in diesem Durchgang gefunden.

        </td>

      </tr>

    `;


    return;

  }



  rows.innerHTML =

    filtered

      .map(
        player => {


          // H1 - H9

          const values =

            Array.from(

              {
                length: 9
              },

              (
                _,
                index
              ) => {


                return (

                  player
                    .scores[
                      index + 1
                    ]

                  ?? "–"

                );

              }

            );



          // COMPLETED HOLES

          const completedHoles =

            values
              .filter(
                value =>
                  value !== "–"
              )
              .length;



          // TOTAL

          const total =

            values
              .reduce(

                (
                  sum,
                  value
                ) => {


                  if (
                    value === "–"
                  ) {

                    return sum;

                  }


                  return (

                    sum +

                    Number(
                      value
                    )

                  );

                },

                0

              );



          // STATUS

          const status =

            player.completed
              ? "FINISHED"
              : "PLAYING";



          // ROW

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

                    `<td>
                      ${value}
                    </td>`

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
// ESCAPE HTML
// =============================================

function escapeHtml(
  value
) {


  return String(
    value
  )
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
// STATUS MESSAGE
// =============================================

function showMessage(
  text
) {


  const element =
    $("#dashMsg");


  if (
    element
  ) {

    element.textContent =
      text;

  }

}



// =============================================
// MANUAL REFRESH
// =============================================


const refreshButton =
  $("#refresh");


if (
  refreshButton
) {

  refreshButton
    .addEventListener(
      "click",
      loadDashboard
    );

}



// =============================================
// SEARCH
// =============================================


const searchInput =
  $("#search");


if (
  searchInput
) {

  searchInput
    .addEventListener(
      "input",
      renderTable
    );

}



// =============================================
// FILTER BUTTONS
// =============================================


document
  .querySelectorAll(
    "[data-g]"
  )
  .forEach(
    button => {


      button
        .addEventListener(
          "click",
          () => {


            document
              .querySelectorAll(
                "[data-g]"
              )
              .forEach(
                otherButton => {


                  otherButton
                    .classList
                    .remove(
                      "active"
                    );

                }
              );


            button
              .classList
              .add(
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
// START
// =============================================


// First load all available events.
// loadEvents() then automatically loads
// the newest event.

loadEvents();



// =============================================
// AUTO REFRESH
// =============================================


// Every 15 seconds only reload
// the currently selected event.

setInterval(
  () => {


    if (
      selectedEventId
    ) {

      loadDashboard();

    }

  },

  15000
);
