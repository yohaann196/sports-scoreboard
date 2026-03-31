/* ============================================================
   Sports Scoreboard – app.js
   ============================================================ */

'use strict';

const MAX_HISTORY_SIZE = 50;

/* ----------------------------------------------------------------
   STATE
---------------------------------------------------------------- */
let state = {
  sport: null,       // 'basketball' | 'tennis' | 'icehockey' | 'pingpong'
  settings: {},      // customised settings from setup form
  game: null,        // live game state (sport-specific)
  timerInterval: null,
  shotclockInterval: null,
  history: [],       // stack of game snapshots for undo
};

/* ----------------------------------------------------------------
   SPORT META
---------------------------------------------------------------- */
const SPORTS = {
  basketball: { label: 'Basketball', icon: '🏀', theme: 'sport-basketball' },
  tennis:     { label: 'Tennis',     icon: '🎾', theme: 'sport-tennis' },
  icehockey:  { label: 'Ice Hockey', icon: '🏒', theme: 'sport-icehockey' },
  pingpong:   { label: 'Ping Pong',  icon: '🏓', theme: 'sport-pingpong' },
};

/* ----------------------------------------------------------------
   SCREEN MANAGEMENT
---------------------------------------------------------------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ----------------------------------------------------------------
   MENU
---------------------------------------------------------------- */
document.querySelectorAll('.sport-card').forEach(card => {
  card.addEventListener('click', () => selectSport(card.dataset.sport));
});

function selectSport(sport) {
  state.sport = sport;
  buildSetupScreen(sport);
  showScreen('screen-setup');
}

/* ----------------------------------------------------------------
   SETUP SCREEN
---------------------------------------------------------------- */
function buildSetupScreen(sport) {
  const meta = SPORTS[sport];

  // Update badge & title
  document.getElementById('setup-sport-badge').textContent = meta.icon;
  document.getElementById('setup-title').textContent = meta.label + ' Setup';

  // Apply sport theme class
  const el = document.getElementById('screen-setup');
  el.className = 'screen active sport-' + sport;

  // Show/hide sections
  const show = (...ids) => ids.forEach(id => document.getElementById(id).style.display = '');
  const hide = (...ids) => ids.forEach(id => document.getElementById(id).style.display = 'none');

  hide('setup-teams', 'setup-players', 'setup-basketball', 'setup-tennis', 'setup-icehockey', 'setup-pingpong');

  if (sport === 'basketball') { show('setup-teams', 'setup-basketball'); }
  if (sport === 'tennis')     { show('setup-players', 'setup-tennis'); }
  if (sport === 'icehockey')  { show('setup-teams', 'setup-icehockey'); }
  if (sport === 'pingpong')   { show('setup-players', 'setup-pingpong'); }
}

document.getElementById('btn-back-setup').addEventListener('click', () => {
  showScreen('screen-menu');
});

document.getElementById('btn-start').addEventListener('click', startGame);

function getSettings() {
  const sport = state.sport;
  if (sport === 'basketball') {
    return {
      homeTeam: document.getElementById('home-name').value.trim() || 'HOME',
      awayTeam: document.getElementById('away-name').value.trim() || 'AWAY',
      periodLen: parseInt(document.getElementById('bball-period-len').value),
      shotClock: parseInt(document.getElementById('bball-shotclock').value),
      foulLimit: parseInt(document.getElementById('bball-fouls').value),
    };
  }
  if (sport === 'tennis') {
    return {
      player1: document.getElementById('player1-name').value.trim() || 'Player 1',
      player2: document.getElementById('player2-name').value.trim() || 'Player 2',
      bestOf:  parseInt(document.getElementById('tennis-bestof').value),
      finalSetTiebreak: parseInt(document.getElementById('tennis-tiebreak').value),
    };
  }
  if (sport === 'icehockey') {
    return {
      homeTeam:  document.getElementById('home-name').value.trim() || 'HOME',
      awayTeam:  document.getElementById('away-name').value.trim() || 'AWAY',
      periodLen: parseInt(document.getElementById('hockey-period-len').value),
      otLen:     parseInt(document.getElementById('hockey-ot-len').value),
    };
  }
  if (sport === 'pingpong') {
    return {
      player1: document.getElementById('player1-name').value.trim() || 'Player 1',
      player2: document.getElementById('player2-name').value.trim() || 'Player 2',
      pointsToWin: parseInt(document.getElementById('pp-points').value),
      bestOf:  parseInt(document.getElementById('pp-bestof').value),
    };
  }
}

/* ----------------------------------------------------------------
   START GAME
---------------------------------------------------------------- */
function startGame() {
  stopAllTimers();
  state.settings = getSettings();
  state.history = [];

  switch (state.sport) {
    case 'basketball': state.game = createBasketballGame(); break;
    case 'tennis':     state.game = createTennisGame();     break;
    case 'icehockey':  state.game = createIceHockeyGame();  break;
    case 'pingpong':   state.game = createPingPongGame();   break;
  }

  buildScoreboardUI();
  renderScoreboard();
  showScreen('screen-scoreboard');
}

/* ----------------------------------------------------------------
   INITIAL GAME STATE FACTORIES
---------------------------------------------------------------- */
function createBasketballGame() {
  const s = state.settings;
  return {
    homeScore: 0, awayScore: 0,
    homeFouls: 0, awayFouls: 0,
    homeTimeoutsFull: 7, awayTimeoutsFull: 7,
    homeShortTimeouts: 2,   awayShortTimeouts: 2,
    period: 1, maxPeriod: 4,
    clockSecs: s.periodLen * 60,
    shotClockSecs: s.shotClock || 0,
    running: false,
    matchOver: false,
  };
}

function createTennisGame() {
  const s = state.settings;
  const setsNeeded = Math.ceil(s.bestOf / 2);
  return {
    setsNeeded,
    sets: [],          // array of [p1games, p2games] for completed sets
    currentSet: 0,     // index of current set (0-based)
    p1Games: 0, p2Games: 0,   // games in current set
    p1Points: 0, p2Points: 0, // current game raw points (0-4 where 3=40, 4=deuce/adv)
    deuce: false,      // currently at deuce
    advServer: null,   // null | 'p1' | 'p2' at advantage
    tiebreak: false,   // currently in tiebreak
    serving: 'p1',     // who is serving
    p1Sets: 0, p2Sets: 0,     // sets won
    matchOver: false,
    winner: null,
  };
}

function createIceHockeyGame() {
  const s = state.settings;
  return {
    homeScore: 0, awayScore: 0,
    homeShotsOnGoal: 0, awayShotsOnGoal: 0,
    homePenalties: [], awayPenalties: [], // {mins, secsLeft}
    period: 1, maxPeriod: 3,
    clockSecs: s.periodLen * 60,
    running: false,
    matchOver: false,
    ot: false,
  };
}

function createPingPongGame() {
  const s = state.settings;
  const gamesNeeded = Math.ceil(s.bestOf / 2);
  return {
    gamesNeeded,
    p1GamesWon: 0, p2GamesWon: 0,
    p1Points: 0, p2Points: 0,
    serving: 'p1',         // who serves currently
    serveCount: 0,         // how many points served in current serve stint
    gameHistory: [],       // [{p1,p2}] per completed game
    matchOver: false,
    winner: null,
  };
}

/* ----------------------------------------------------------------
   BUILD SCOREBOARD UI (wire up controls, show/hide sport sections)
---------------------------------------------------------------- */
function buildScoreboardUI() {
  const sport = state.sport;
  const s = state.settings;
  const meta = SPORTS[sport];

  // Apply theme
  const disp = document.getElementById('sb-display');
  disp.className = 'sb-display sport-' + sport;

  document.getElementById('sb-sport-label').textContent = meta.icon + ' ' + meta.label;

  // Team / player names
  const n1 = sport === 'basketball' || sport === 'icehockey' ? s.homeTeam : s.player1;
  const n2 = sport === 'basketball' || sport === 'icehockey' ? s.awayTeam : s.player2;
  document.getElementById('sb-home-name').textContent = n1;
  document.getElementById('sb-away-name').textContent = n2;
  document.getElementById('cp-home-label').textContent = n1;
  document.getElementById('cp-away-label').textContent = n2;
  document.getElementById('tennis-p1-name').textContent = n1;
  document.getElementById('tennis-p2-name').textContent = n2;

  // Show/hide clock, shotclock
  const wrap = document.getElementById('sb-shotclock-wrap');
  wrap.style.display = (sport === 'basketball' && s.shotClock > 0) ? 'flex' : 'none';

  // Shot clock reset button – only shown for basketball with shot clock enabled
  const scRow = document.getElementById('cp-shotclock-row');
  scRow.style.display = (sport === 'basketball' && s.shotClock > 0) ? '' : 'none';

  // Timer section visibility
  const timerSec = document.getElementById('cp-timer-section');
  timerSec.style.display = (sport === 'basketball' || sport === 'icehockey') ? '' : 'none';

  // Period section
  const periodSec = document.getElementById('cp-period-section');
  const periodTitle = document.getElementById('cp-period-title');
  if (sport === 'basketball') { periodTitle.textContent = 'Quarter'; }
  else if (sport === 'icehockey') { periodTitle.textContent = 'Period'; }
  else { periodSec.style.display = 'none'; }

  // Tennis / PP table
  document.getElementById('sb-tennis-table').style.display = sport === 'tennis' ? '' : 'none';
  document.getElementById('sb-pp-sets').style.display     = sport === 'pingpong' ? '' : 'none';

  // Sport-specific extras
  document.getElementById('cp-bball-extras').style.display   = sport === 'basketball' ? '' : 'none';
  document.getElementById('cp-hockey-extras').style.display  = sport === 'icehockey'  ? '' : 'none';

  // Score buttons
  buildScoreButtons();

  // Tennis sets columns
  if (sport === 'tennis') {
    const bestOf = s.bestOf;
    for (let i = 4; i <= 5; i++) {
      const display = bestOf >= i ? '' : 'none';
      document.getElementById('th-set' + i).style.display = display;
      document.getElementById('t-p1-s' + i).style.display = display;
      document.getElementById('t-p2-s' + i).style.display = display;
    }
  }
}

function buildScoreButtons() {
  const sport = state.sport;
  const homeRow = document.getElementById('cp-home-score-btns');
  const awayRow = document.getElementById('cp-away-score-btns');
  homeRow.innerHTML = '';
  awayRow.innerHTML = '';

  if (sport === 'basketball') {
    [1, 2, 3].forEach(pts => {
      const hb = makeBtn('+' + pts, 'green', () => addBasketballPoints('home', pts));
      const ab = makeBtn('+' + pts, 'green', () => addBasketballPoints('away', pts));
      homeRow.appendChild(hb);
      awayRow.appendChild(ab);
    });
  } else if (sport === 'icehockey') {
    homeRow.appendChild(makeBtn('+ Goal', 'green', () => addGoal('home')));
    awayRow.appendChild(makeBtn('+ Goal', 'green', () => addGoal('away')));
  } else if (sport === 'tennis') {
    homeRow.appendChild(makeBtn('+ Point', 'green', () => addTennisPoint('p1')));
    awayRow.appendChild(makeBtn('+ Point', 'green', () => addTennisPoint('p2')));
  } else if (sport === 'pingpong') {
    homeRow.appendChild(makeBtn('+ Point', 'green', () => addPingPongPoint('p1')));
    awayRow.appendChild(makeBtn('+ Point', 'green', () => addPingPongPoint('p2')));
  }
}

function makeBtn(label, cls, handler) {
  const b = document.createElement('button');
  b.className = 'cp-btn ' + cls;
  b.textContent = label;
  b.addEventListener('click', handler);
  return b;
}

/* ----------------------------------------------------------------
   RENDER SCOREBOARD
---------------------------------------------------------------- */
function renderScoreboard() {
  switch (state.sport) {
    case 'basketball': renderBasketball(); break;
    case 'tennis':     renderTennis();     break;
    case 'icehockey':  renderIceHockey();  break;
    case 'pingpong':   renderPingPong();   break;
  }
}

/* ---- Basketball ---- */
function renderBasketball() {
  const g = state.game;
  const s = state.settings;
  setEl('sb-home-score', g.homeScore);
  setEl('sb-away-score', g.awayScore);

  // Period label
  let pLabel = 'Q' + g.period;
  if (g.period > 4) pLabel = 'OT' + (g.period - 4);
  setEl('sb-period-label', pLabel);

  // Clock
  const clockEl = document.getElementById('sb-clock');
  clockEl.textContent = fmtTime(g.clockSecs);
  clockEl.className = 'sb-clock' + clockClass(g.clockSecs, s.periodLen * 60);

  // Shot clock
  if (s.shotClock > 0) {
    const scEl = document.getElementById('sb-shotclock');
    scEl.textContent = g.shotClockSecs;
    scEl.className = 'sb-shotclock' + (g.shotClockSecs <= 5 ? ' sc-critical' : g.shotClockSecs <= 10 ? ' sc-warning' : '');
  }

  // Stats
  setEl('sb-home-stats', `Fouls: ${g.homeFouls}  |  TOs: ${g.homeTimeoutsFull} full · ${g.homeShortTimeouts} short`);
  setEl('sb-away-stats', `Fouls: ${g.awayFouls}  |  TOs: ${g.awayTimeoutsFull} full · ${g.awayShortTimeouts} short`);

  setEl('sb-extra-info', '');
}

/* ---- Tennis ---- */
function renderTennis() {
  const g = state.game;
  const s = state.settings;

  // "Sets" as main score display
  setEl('sb-home-score', g.p1Sets);
  setEl('sb-away-score', g.p2Sets);

  setEl('sb-period-label', 'Set ' + (g.currentSet + 1));
  document.getElementById('sb-clock').textContent = '';
  document.getElementById('sb-clock').className = 'sb-clock';

  // Serve indicator in names
  const p1Name = state.settings.player1 + (g.serving === 'p1' ? ' ●' : '');
  const p2Name = state.settings.player2 + (g.serving === 'p2' ? ' ●' : '');
  setEl('sb-home-name', p1Name);
  setEl('sb-away-name', p2Name);

  // Points display
  const pointLabels = ['0', '15', '30', '40'];
  let p1Pts, p2Pts;
  if (g.tiebreak) {
    p1Pts = g.p1Points;
    p2Pts = g.p2Points;
  } else if (g.deuce) {
    if (g.advServer === 'p1')      { p1Pts = 'Adv'; p2Pts = '40'; }
    else if (g.advServer === 'p2') { p1Pts = '40'; p2Pts = 'Adv'; }
    else                            { p1Pts = 'Deuce'; p2Pts = 'Deuce'; }
  } else {
    p1Pts = pointLabels[g.p1Points] || g.p1Points;
    p2Pts = pointLabels[g.p2Points] || g.p2Points;
  }

  // Populate table
  setEl('t-p1-games', g.p1Games);
  setEl('t-p2-games', g.p2Games);
  setEl('t-p1-points', p1Pts);
  setEl('t-p2-points', p2Pts);

  // Completed sets
  for (let i = 0; i < 5; i++) {
    const sd = g.sets[i];
    setEl('t-p1-s' + (i + 1), sd ? sd[0] : '-');
    setEl('t-p2-s' + (i + 1), sd ? sd[1] : '-');
  }

  setEl('sb-extra-info', g.tiebreak ? 'Tiebreak' : '');
  setEl('sb-home-stats', '');
  setEl('sb-away-stats', '');
}

/* ---- Ice Hockey ---- */
function renderIceHockey() {
  const g = state.game;
  const s = state.settings;
  setEl('sb-home-score', g.homeScore);
  setEl('sb-away-score', g.awayScore);

  let pLabel = (g.ot ? 'OT' : 'P' + g.period);
  setEl('sb-period-label', pLabel);

  const clockEl = document.getElementById('sb-clock');
  clockEl.textContent = fmtTime(g.clockSecs);
  clockEl.className = 'sb-clock' + clockClass(g.clockSecs, (g.ot ? s.otLen : s.periodLen) * 60);

  // Penalties
  const homePen = g.homePenalties.map(p => fmtTime(p.secsLeft)).join(' | ') || 'None';
  const awayPen = g.awayPenalties.map(p => fmtTime(p.secsLeft)).join(' | ') || 'None';
  setEl('sb-home-stats', `SOG: ${g.homeShotsOnGoal} | Pen: ${homePen}`);
  setEl('sb-away-stats', `SOG: ${g.awayShotsOnGoal} | Pen: ${awayPen}`);

  setEl('sb-extra-info', '');
}

/* ---- Ping Pong ---- */
function renderPingPong() {
  const g = state.game;
  const s = state.settings;

  // Current points as main display
  setEl('sb-home-score', g.p1Points);
  setEl('sb-away-score', g.p2Points);

  // Games won as period label
  setEl('sb-period-label', `G${g.p1GamesWon + g.p2GamesWon + 1}`);
  document.getElementById('sb-clock').textContent = '';
  document.getElementById('sb-clock').className = 'sb-clock';

  // Serve indicator in names
  const p1Name = state.settings.player1 + (g.serving === 'p1' ? ' ●' : '');
  const p2Name = state.settings.player2 + (g.serving === 'p2' ? ' ●' : '');
  setEl('sb-home-name', p1Name);
  setEl('sb-away-name', p2Name);

  // Game history badges
  const container = document.getElementById('sb-pp-sets');
  container.innerHTML = '';
  g.gameHistory.forEach((game, i) => {
    const badge = document.createElement('div');
    badge.className = 'pp-set-badge' + (game.winner === 'p1' ? ' won-p1' : ' won-p2');
    badge.textContent = `G${i + 1}: ${game.p1}-${game.p2}`;
    container.appendChild(badge);
  });
  // Current game badge
  const cur = document.createElement('div');
  cur.className = 'pp-set-badge current-set';
  cur.textContent = `G${g.gameHistory.length + 1} (current)`;
  container.appendChild(cur);

  setEl('sb-extra-info', `Best of ${s.bestOf} | First to ${s.pointsToWin}`);
  setEl('sb-home-stats', `Games: ${g.p1GamesWon}`);
  setEl('sb-away-stats', `Games: ${g.p2GamesWon}`);
}

/* ----------------------------------------------------------------
   BASKETBALL LOGIC
---------------------------------------------------------------- */
function addBasketballPoints(team, pts) {
  saveHistory();
  if (team === 'home') state.game.homeScore += pts;
  else                 state.game.awayScore += pts;
  flashScore(team === 'home' ? 'sb-home-score' : 'sb-away-score');
  renderScoreboard();
}

function addFoul(team) {
  saveHistory();
  if (team === 'home') state.game.homeFouls++;
  else                 state.game.awayFouls++;
  renderScoreboard();
}

function addTimeout(team, type) {
  saveHistory();
  const g = state.game;
  if (type === 'full') {
    if (team === 'home' && g.homeTimeoutsFull > 0) g.homeTimeoutsFull--;
    else if (team === 'away' && g.awayTimeoutsFull > 0) g.awayTimeoutsFull--;
  } else {
    if (team === 'home' && g.homeShortTimeouts > 0) g.homeShortTimeouts--;
    else if (team === 'away' && g.awayShortTimeouts > 0) g.awayShortTimeouts--;
  }
  renderScoreboard();
}

function nextBasketballPeriod() {
  saveHistory();
  const g = state.game;
  stopAllTimers();
  g.running = false;
  g.period++;
  g.clockSecs = state.settings.periodLen * 60;
  if (g.shotClockSecs !== undefined) g.shotClockSecs = state.settings.shotClock;
  // Reset fouls per quarter (team fouls) - only count quarter fouls
  g.homeFouls = 0;
  g.awayFouls = 0;
  renderScoreboard();
}

/* ----------------------------------------------------------------
   TENNIS LOGIC
---------------------------------------------------------------- */
function addTennisPoint(player) {
  saveHistory();
  const g = state.game;
  if (g.matchOver) return;

  if (g.tiebreak) {
    // Tiebreak scoring
    if (player === 'p1') g.p1Points++;
    else                 g.p2Points++;

    // Swap serve after first point, then every 2 points
    g.serveCount = (g.serveCount || 0) + 1;
    if (g.serveCount === 1 || (g.serveCount > 1 && (g.serveCount - 1) % 2 === 0)) {
      g.serving = g.serving === 'p1' ? 'p2' : 'p1';
    }

    const tieTarget = state.settings.finalSetTiebreak || 7;
    const diff = Math.abs(g.p1Points - g.p2Points);
    const maxPts = Math.max(g.p1Points, g.p2Points);
    if (maxPts >= tieTarget && diff >= 2) {
      const winner = g.p1Points > g.p2Points ? 'p1' : 'p2';
      awardGame(winner);
    }
  } else {
    // Normal point scoring
    if (g.deuce) {
      if (g.advServer === null) {
        // At deuce, someone takes advantage
        g.advServer = player;
      } else if (g.advServer === player) {
        // Win game
        awardGame(player);
        return;
      } else {
        // Back to deuce
        g.advServer = null;
      }
    } else {
      if (player === 'p1') g.p1Points++;
      else                 g.p2Points++;

      // Check for deuce (both at 3 = "40")
      if (g.p1Points === 3 && g.p2Points === 3) {
        g.deuce = true;
        g.advServer = null;
      } else if (g.p1Points >= 4) {
        awardGame('p1');
        return;
      } else if (g.p2Points >= 4) {
        awardGame('p2');
        return;
      }
    }
  }

  flashScore(player === 'p1' ? 'sb-home-score' : 'sb-away-score');
  renderScoreboard();
}

function awardGame(winner) {
  const g = state.game;
  if (winner === 'p1') g.p1Games++;
  else                 g.p2Games++;

  // Reset points
  g.p1Points = 0; g.p2Points = 0;
  g.deuce = false; g.advServer = null;
  g.tiebreak = false;
  g.serveCount = 0;
  // Serve alternates after each game
  g.serving = g.serving === 'p1' ? 'p2' : 'p1';

  // Check set win
  checkSetWon();
  flashScore(winner === 'p1' ? 'sb-home-score' : 'sb-away-score');
  renderScoreboard();
}

function checkSetWon() {
  const g = state.game;
  const p1 = g.p1Games, p2 = g.p2Games;

  // Tiebreak condition
  if (p1 === 6 && p2 === 6) {
    const isDecidingSet = (g.p1Sets + g.p2Sets) === (state.settings.bestOf - 1);
    // Enter tiebreak if not advantage set format (finalSetTiebreak != 0)
    const allowTiebreak = !(isDecidingSet && state.settings.finalSetTiebreak === 0);
    if (allowTiebreak) {
      g.tiebreak = true;
      g.p1Points = 0; g.p2Points = 0;
      g.serveCount = 0;
      return;
    }
  }

  // Normal win: 6 games with 2 clear, or 7 after 6-5
  const diff = Math.abs(p1 - p2);
  const maxG = Math.max(p1, p2);
  let setWinner = null;
  if (maxG >= 6 && diff >= 2) {
    setWinner = p1 > p2 ? 'p1' : 'p2';
  } else if (maxG === 7) {
    setWinner = p1 > p2 ? 'p1' : 'p2';
  }

  if (setWinner) {
    g.sets.push([p1, p2]);
    g.p1Games = 0; g.p2Games = 0;
    g.currentSet++;
    if (setWinner === 'p1') g.p1Sets++;
    else                    g.p2Sets++;

    if (g.p1Sets >= g.setsNeeded || g.p2Sets >= g.setsNeeded) {
      g.matchOver = true;
      g.winner = setWinner;
      showWinner(state.settings[setWinner === 'p1' ? 'player1' : 'player2']);
    }
  }
}

/* ----------------------------------------------------------------
   ICE HOCKEY LOGIC
---------------------------------------------------------------- */
function addGoal(team) {
  saveHistory();
  if (team === 'home') state.game.homeScore++;
  else                 state.game.awayScore++;
  flashScore(team === 'home' ? 'sb-home-score' : 'sb-away-score');
  renderScoreboard();
}

function addPenalty(team, minutes) {
  saveHistory();
  const g = state.game;
  const pen = { mins: minutes, secsLeft: minutes * 60 };
  if (team === 'home') g.homePenalties.push(pen);
  else                 g.awayPenalties.push(pen);
  renderScoreboard();
}

function addShot(team) {
  saveHistory();
  if (team === 'home') state.game.homeShotsOnGoal++;
  else                 state.game.awayShotsOnGoal++;
  renderScoreboard();
}

function nextIceHockeyPeriod() {
  saveHistory();
  const g = state.game;
  const s = state.settings;
  stopAllTimers();
  g.running = false;

  if (g.period >= 3 && g.homeScore === g.awayScore) {
    // Overtime
    g.ot = true;
    g.period++;
    g.clockSecs = s.otLen * 60;
  } else if (g.period < 3) {
    g.period++;
    g.clockSecs = s.periodLen * 60;
  } else {
    // After OT (shootout situation, just advance period)
    g.period++;
    g.clockSecs = s.otLen * 60;
  }
  renderScoreboard();
}

/* ----------------------------------------------------------------
   PING PONG LOGIC
---------------------------------------------------------------- */
function addPingPongPoint(player) {
  saveHistory();
  const g = state.game;
  if (g.matchOver) return;

  if (player === 'p1') g.p1Points++;
  else                 g.p2Points++;

  // Advance serve counter
  g.serveCount++;
  const ptw = state.settings.pointsToWin;
  const isDeuce = g.p1Points >= (ptw - 1) && g.p2Points >= (ptw - 1);
  const serveChangeEvery = isDeuce ? 1 : 2;

  if (g.serveCount >= serveChangeEvery) {
    g.serving = g.serving === 'p1' ? 'p2' : 'p1';
    g.serveCount = 0;
  }

  // Check game won
  const diff = Math.abs(g.p1Points - g.p2Points);
  const maxPts = Math.max(g.p1Points, g.p2Points);
  if (maxPts >= ptw && diff >= 2) {
    const gameWinner = g.p1Points > g.p2Points ? 'p1' : 'p2';
    awardPPGame(gameWinner);
    return;
  }

  flashScore(player === 'p1' ? 'sb-home-score' : 'sb-away-score');
  renderScoreboard();
}

function awardPPGame(winner) {
  const g = state.game;
  g.gameHistory.push({ p1: g.p1Points, p2: g.p2Points, winner });

  if (winner === 'p1') g.p1GamesWon++;
  else                 g.p2GamesWon++;

  g.p1Points = 0; g.p2Points = 0;
  g.serveCount = 0;

  // Serve switches at the start of each game (loser of last game serves, or alternate)
  // Standard rule: server of last game becomes receiver
  g.serving = g.serving === 'p1' ? 'p2' : 'p1';

  if (g.p1GamesWon >= g.gamesNeeded || g.p2GamesWon >= g.gamesNeeded) {
    g.matchOver = true;
    g.winner = winner;
    const name = state.settings[winner === 'p1' ? 'player1' : 'player2'];
    showWinner(name);
  }

  flashScore(winner === 'p1' ? 'sb-home-score' : 'sb-away-score');
  renderScoreboard();
}

/* ----------------------------------------------------------------
   TIMER
---------------------------------------------------------------- */
function startTimer() {
  if (state.game.running) return;
  state.game.running = true;
  updateClockRunning(true);

  state.timerInterval = setInterval(() => {
    if (state.game.clockSecs > 0) {
      state.game.clockSecs--;
      if (state.sport === 'basketball' && state.settings.shotClock > 0) {
        if (state.game.shotClockSecs > 0) state.game.shotClockSecs--;
      }
      // Tick down penalties (ice hockey)
      if (state.sport === 'icehockey') {
        tickPenalties();
      }
      renderScoreboard();
    } else {
      // Time's up
      pauseTimer();
      renderScoreboard();
    }
  }, 1000);
}

function tickPenalties() {
  const g = state.game;
  ['homePenalties', 'awayPenalties'].forEach(key => {
    g[key] = g[key]
      .map(p => ({ ...p, secsLeft: p.secsLeft - 1 }))
      .filter(p => p.secsLeft > 0);
  });
}

function pauseTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  if (state.game) state.game.running = false;
  updateClockRunning(false);
}

function resetTimer() {
  pauseTimer();
  const g = state.game;
  const s = state.settings;
  if (state.sport === 'basketball') {
    g.clockSecs = s.periodLen * 60;
    if (s.shotClock > 0) g.shotClockSecs = s.shotClock;
  } else if (state.sport === 'icehockey') {
    g.clockSecs = (g.ot ? s.otLen : s.periodLen) * 60;
  }
  renderScoreboard();
}

function resetShotClock() {
  if (state.sport === 'basketball') {
    state.game.shotClockSecs = state.settings.shotClock;
    renderScoreboard();
  }
}

function stopAllTimers() {
  clearInterval(state.timerInterval);
  clearInterval(state.shotclockInterval);
  state.timerInterval = null;
  state.shotclockInterval = null;
}

function updateClockRunning(running) {
  const clockEl = document.getElementById('sb-clock');
  if (running) clockEl.classList.add('running');
  else         clockEl.classList.remove('running');
}

/* ----------------------------------------------------------------
   UNDO / RESET
---------------------------------------------------------------- */
function saveHistory() {
  state.history.push(JSON.stringify(state.game));
  if (state.history.length > MAX_HISTORY_SIZE) state.history.shift();
}

function undo() {
  if (state.history.length === 0) return;
  const prev = state.history.pop();
  state.game = JSON.parse(prev);
  document.getElementById('winner-overlay').style.display = 'none';
  renderScoreboard();
}

function resetGame() {
  stopAllTimers();
  state.history = [];
  document.getElementById('winner-overlay').style.display = 'none';
  switch (state.sport) {
    case 'basketball': state.game = createBasketballGame(); break;
    case 'tennis':     state.game = createTennisGame();     break;
    case 'icehockey':  state.game = createIceHockeyGame();  break;
    case 'pingpong':   state.game = createPingPongGame();   break;
  }
  renderScoreboard();
}

/* ----------------------------------------------------------------
   WINNER
---------------------------------------------------------------- */
function showWinner(name) {
  const overlay = document.getElementById('winner-overlay');
  setEl('winner-label', name + ' Wins!');
  overlay.style.display = 'flex';
}

/* ----------------------------------------------------------------
   CONTROL PANEL EVENTS
---------------------------------------------------------------- */
// Timer
document.getElementById('btn-timer-start').addEventListener('click', startTimer);
document.getElementById('btn-timer-pause').addEventListener('click', pauseTimer);
document.getElementById('btn-timer-reset').addEventListener('click', resetTimer);
document.getElementById('btn-sc-reset').addEventListener('click', resetShotClock);

// Period / Set advance
document.getElementById('btn-next-period').addEventListener('click', () => {
  if (state.sport === 'basketball') nextBasketballPeriod();
  else if (state.sport === 'icehockey') nextIceHockeyPeriod();
});

// Basketball extras
document.getElementById('btn-home-foul').addEventListener('click',         () => addFoul('home'));
document.getElementById('btn-away-foul').addEventListener('click',         () => addFoul('away'));
document.getElementById('btn-home-timeout-full').addEventListener('click', () => addTimeout('home', 'full'));
document.getElementById('btn-away-timeout-full').addEventListener('click', () => addTimeout('away', 'full'));
document.getElementById('btn-home-timeout-20').addEventListener('click',   () => addTimeout('home', '20'));
document.getElementById('btn-away-timeout-20').addEventListener('click',   () => addTimeout('away', '20'));

// Ice Hockey extras
document.getElementById('btn-home-minor').addEventListener('click', () => addPenalty('home', 2));
document.getElementById('btn-away-minor').addEventListener('click', () => addPenalty('away', 2));
document.getElementById('btn-home-major').addEventListener('click', () => addPenalty('home', 5));
document.getElementById('btn-away-major').addEventListener('click', () => addPenalty('away', 5));
document.getElementById('btn-home-shot').addEventListener('click',  () => addShot('home'));
document.getElementById('btn-away-shot').addEventListener('click',  () => addShot('away'));

// Undo & Reset
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-reset-game').addEventListener('click', resetGame);

// Toggle controls
document.getElementById('btn-toggle-controls').addEventListener('click', () => {
  document.getElementById('control-panel').classList.toggle('collapsed');
});

// Fullscreen
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);

// Back / End game
document.getElementById('btn-back-game').addEventListener('click', () => {
  stopAllTimers();
  showScreen('screen-menu');
});

// New game from winner overlay
document.getElementById('btn-new-game').addEventListener('click', () => {
  document.getElementById('winner-overlay').style.display = 'none';
  showScreen('screen-setup');
});

/* ----------------------------------------------------------------
   FULLSCREEN
---------------------------------------------------------------- */
function toggleFullscreen() {
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement) {
      const requestFn = el.requestFullscreen || el.webkitRequestFullscreen ||
                        el.mozRequestFullScreen || el.msRequestFullscreen;
      if (requestFn) requestFn.call(el);
    } else {
      const exitFn = document.exitFullscreen || document.webkitExitFullscreen ||
                     document.mozCancelFullScreen || document.msExitFullscreen;
      if (exitFn) exitFn.call(document);
    }
  } catch (e) {
    // Fullscreen not available in this environment
  }
}

/* ----------------------------------------------------------------
   HELPERS
---------------------------------------------------------------- */
function fmtTime(secs) {
  if (isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function clockClass(secs, total) {
  if (secs <= 30) return ' critical';
  if (secs <= total * 0.15) return ' warning';
  return '';
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(val);
}

function flashScore(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('score-flash');
  void el.offsetWidth; // reflow to restart animation
  el.classList.add('score-flash');
}
