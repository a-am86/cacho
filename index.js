// ===== CLASE DE SONIDOS CON ARCHIVOS DE AUDIO =====
class SoundManager {
  constructor() {
    this.isMuted = true; // Empezar DESACTIVADO por defecto (mejor UX)

    // Precargar todos los sonidos
    this.sounds = {
      rollDice: new Audio('sounds/Dice-editado-1.wav'),
      click: new Audio('sounds/click2.wav'),
      kill: new Audio('sounds/Matar.wav'),
      win: new Audio('sounds/Win.wav')
    };

    // Configurar volúmenes
    this.sounds.rollDice.volume = 0.5; // 50% volumen
    this.sounds.click.volume = 0.4; // 40% volumen (seleccionar)
    this.sounds.kill.volume = 0.6; // 60% volumen (burbuja)
    this.sounds.win.volume = 0.5; // 50% volumen (victoria)
  }

  // Alternar silencio
  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // Verificar si está silenciado antes de reproducir
  shouldPlay() {
    return !this.isMuted;
  }

  // Función auxiliar para reproducir un sonido
  playSound(sound, volume = 1.0) {
    if (!this.shouldPlay()) return;

    // Clonar el audio para permitir múltiples reproducciones simultáneas
    const audioClone = sound.cloneNode();
    audioClone.volume = sound.volume * volume;
    audioClone.play().catch(err => console.log('Error reproduciendo sonido:', err));
  }

  // 1. Sonido de TIRAR DADOS - Archivo Dice.wav
  rollDice() {
    this.playSound(this.sounds.rollDice);
  }

  // 2. Sonido de GUARDAR DADO - click2.wav más suave (50% volumen)
  keepDice() {
    this.playSound(this.sounds.click, 0.5);
  }

  // 3. Sonido de GIRAR DADO - Mismo click pero aún más suave
  flipDice() {
    this.playSound(this.sounds.click, 0.6);
  }

  // 4. Sonido de SELECCIONAR COMBINACIÓN - click2.wav volumen normal
  selectCombination() {
    this.playSound(this.sounds.click);
  }

  // 5. Sonido de MATAR CASILLA - Matar.wav (burbuja)
  killCell() {
    this.playSound(this.sounds.kill);
  }

  // 6. Sonido de DORMIDA / GRANDE - Win.wav (crowd cheering)
  victory() {
    this.playSound(this.sounds.win);
  }

  // 7. Sonido de PASAR DE TURNO - Click muy suave
  nextTurn() {
    this.playSound(this.sounds.click, 0.3);
  }
}

// Crear instancia global de SoundManager
const soundManager = new SoundManager();

// Variables globales
let diceValues = [6, 6, 6, 6, 6]; // Valeurs initiales
let keptDice = [false, false, false, false, false]; // Quels dés sont gardés
let launchCount = 0; // Compteur de lancers (max 2)
let numberOfPlayers = 0; // Cantidad de jugadores
let currentPlayerIndex = 0; // Índice del jugador actual (0, 1, 2...)
let players = []; // Array con información de cada jugador
let flippedDice = [false, false, false, false, false]; // Dados que han sido girados
let flipCount = 0; // Contador de dados girados (max 2)
let isFlipMode = false; // Modo de giro activado
let isDeMano = false; // Si la jugada es "de mano" (sin giros)
let gameMode = null; // 'human' o 'bot'
let botDifficulty = null; // 'easy', 'medium', 'hard'
let isProcessingBotTurn = false; // Flag para evitar múltiples turnos del bot

// ===== CLASE BOT CON INTELIGENCIA ARTIFICIAL =====
class CachoBot {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
  }

  // Función auxiliar: Obtener lado opuesto del dado
  getOpposite(value) {
    return 7 - value;
  }

  // Función auxiliar: Evaluar el puntaje potencial de una combinación de dados
  evaluateDiceValue(diceValues) {
    const sorted = diceValues.slice().sort((a, b) => a - b);
    const str = sorted.join('');
    const counts = {};
    diceValues.forEach(val => counts[val] = (counts[val] || 0) + 1);
    const maxCount = Math.max(...Object.values(counts));

    // Asignar valor a cada tipo de combinación
    if (maxCount === 5) return 1000; // Grande
    if (maxCount === 4) return 500;  // Póquer
    if (maxCount === 3 && Object.keys(counts).length === 2) return 400; // Full
    if (str === '12345' || str === '23456') return 300; // Escalera
    if (maxCount === 3) return 150; // Triple
    if (maxCount === 2) {
      // Par - valorar más los pares altos
      const pairNum = parseInt(Object.keys(counts).find(k => counts[k] === 2));
      return 50 + (pairNum * 10); // Par de 6s vale más que par de 1s
    }

    // Sin combinación - sumar valores
    return diceValues.reduce((sum, val) => sum + val, 0);
  }

  // Función avanzada: Simular todas las posibilidades de giro
  evaluateFlipPotential(diceValues) {
    // Generar todas las combinaciones posibles de giros (0 a 2 dados)
    const possibilities = [];

    // Sin girar
    possibilities.push({
      flipped: [],
      result: diceValues.slice(),
      score: this.evaluateDiceValue(diceValues)
    });

    // Girar 1 dado
    for (let i = 0; i < 5; i++) {
      const newDice = diceValues.slice();
      newDice[i] = this.getOpposite(newDice[i]);
      possibilities.push({
        flipped: [i],
        result: newDice,
        score: this.evaluateDiceValue(newDice)
      });
    }

    // Girar 2 dados
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        const newDice = diceValues.slice();
        newDice[i] = this.getOpposite(newDice[i]);
        newDice[j] = this.getOpposite(newDice[j]);
        possibilities.push({
          flipped: [i, j],
          result: newDice,
          score: this.evaluateDiceValue(newDice)
        });
      }
    }

    // Retornar la mejor opción
    return possibilities.reduce((best, curr) =>
      curr.score > best.score ? curr : best
    );
  }

  // DECISIÓN 1: ¿Qué dados guardar después del primer lanzamiento?
  decideKeepDice(diceValues) {
    if (this.difficulty === 'easy') {
      return this.decideKeepDiceEasy(diceValues);
    } else if (this.difficulty === 'medium') {
      return this.decideKeepDiceMedium(diceValues);
    } else {
      return this.decideKeepDiceHard(diceValues);
    }
  }

  // Fácil: Guardar dados de forma aleatoria o básica
  decideKeepDiceEasy(diceValues) {
    const keep = [false, false, false, false, false];
    // Guardar aleatoriamente 0-3 dados
    const numToKeep = Math.floor(Math.random() * 4);
    for (let i = 0; i < numToKeep; i++) {
      const randomIndex = Math.floor(Math.random() * 5);
      keep[randomIndex] = true;
    }
    return keep;
  }

  // Medio: Guardar dados que forman pares o triples
  decideKeepDiceMedium(diceValues) {
    const keep = [false, false, false, false, false];
    const counts = {};

    diceValues.forEach((val, idx) => {
      if (!counts[val]) counts[val] = [];
      counts[val].push(idx);
    });

    // Guardar el número que más se repite
    let maxCount = 0;
    let maxNum = null;
    for (let num in counts) {
      if (counts[num].length > maxCount) {
        maxCount = counts[num].length;
        maxNum = num;
      }
    }

    if (maxNum && maxCount >= 2) {
      counts[maxNum].forEach(idx => keep[idx] = true);
    }

    return keep;
  }

  // Difícil: Estrategia óptima considerando probabilidades Y giros potenciales
  decideKeepDiceHard(diceValues, player) {
    const keep = [false, false, false, false, false];

    // Evaluar el mejor resultado posible con giros desde la posición actual
    const bestWithFlip = this.evaluateFlipPotential(diceValues);

    const counts = {};
    diceValues.forEach((val, idx) => {
      if (!counts[val]) counts[val] = [];
      counts[val].push(idx);
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1].length - a[1].length);
    const maxCount = sorted[0][1].length;

    // Si tengo 5 iguales, guardar todos (Grande garantizado)
    if (maxCount === 5) {
      sorted[0][1].forEach(idx => keep[idx] = true);
      return keep;
    }

    // Si tengo 4 iguales
    if (maxCount === 4) {
      const majorityNum = parseInt(sorted[0][0]);
      const minorityIdx = diceValues.findIndex(val => val !== majorityNum);
      const minorityVal = diceValues[minorityIdx];

      // Considerar: ¿Vale la pena intentar Grande girando el diferente?
      const flippedVal = this.getOpposite(minorityVal);

      if (flippedVal === majorityNum) {
        // ¡Giro da Grande! Guardar todo
        sorted[0][1].forEach(idx => keep[idx] = true);
        keep[minorityIdx] = true;
        return keep;
      } else {
        // Guardar los 4 + el diferente si es alto
        sorted[0][1].forEach(idx => keep[idx] = true);
        if (minorityVal >= 5 || flippedVal >= 5) {
          keep[minorityIdx] = true;
        }
        return keep;
      }
    }

    // Si tengo 3 iguales
    if (maxCount === 3) {
      sorted[0][1].forEach(idx => keep[idx] = true);

      // Si hay un par, guardarlo (full)
      if (sorted.length > 1 && sorted[1][1].length === 2) {
        sorted[1][1].forEach(idx => keep[idx] = true);
        return keep;
      }

      // Si no hay par, guardar valores altos o que al girar sean altos
      diceValues.forEach((val, idx) => {
        if (!keep[idx]) {
          const flipped = this.getOpposite(val);
          if (val >= 5 || flipped >= 5) {
            keep[idx] = true;
          }
        }
      });

      return keep;
    }

    // Verificar escalera potencial
    const sortedVals = diceValues.slice().sort();
    const str = sortedVals.join('');
    if (str === '12345' || str === '23456') {
      // Escalera completa, guardar todo
      return [true, true, true, true, true];
    }
    if (str.includes('1234') || str.includes('2345') || str.includes('3456')) {
      // 4 consecutivos, guardar esos
      const target = str.includes('1234') ? [1,2,3,4] : str.includes('2345') ? [2,3,4,5] : [3,4,5,6];
      diceValues.forEach((val, idx) => {
        if (target.includes(val)) keep[idx] = true;
      });
      return keep;
    }

    // Si tengo un par, analizar si vale la pena guardarlo
    if (maxCount === 2) {
      const pairNum = parseInt(sorted[0][0]);
      const pairIndices = sorted[0][1];

      // ¿El par es alto (5-6) o bajo (1-2)?
      if (pairNum >= 5) {
        // Par alto, guardarlo
        pairIndices.forEach(idx => keep[idx] = true);
      } else if (pairNum <= 2) {
        // Par bajo - considerar girarlos después
        const flippedPairNum = this.getOpposite(pairNum);
        if (flippedPairNum >= 5) {
          // Si al girar se vuelven altos, guardar
          pairIndices.forEach(idx => keep[idx] = true);
        }
      } else {
        // Par medio (3-4), guardar
        pairIndices.forEach(idx => keep[idx] = true);
      }

      // Guardar también valores que sean altos o al girar sean altos
      diceValues.forEach((val, idx) => {
        if (!keep[idx]) {
          const flipped = this.getOpposite(val);
          if (val >= 5 || flipped >= 5) {
            keep[idx] = true;
          }
        }
      });

      return keep;
    }

    // No tengo nada especial - guardar dados con potencial alto
    // Guardar valores que sean >=5 O que al girar sean >=5
    diceValues.forEach((val, idx) => {
      const flipped = this.getOpposite(val);
      if (val >= 5 || flipped >= 5) {
        keep[idx] = true;
      }
    });

    return keep;
  }

  // DECISIÓN 2: ¿Relanzar o terminar turno?
  decideRelaunch(diceValues, player) {
    const combinations = detectAllCombinations(diceValues.slice().sort((a,b) => a-b), true);

    if (this.difficulty === 'easy') {
      // Aleatorio
      return Math.random() > 0.5;
    } else if (this.difficulty === 'medium') {
      // Si tiene algo bueno (>=35 pts), no relanzar
      const hasBigCombo = combinations.some(c => c.points >= 35);
      return !hasBigCombo;
    } else {
      // Difícil: Analizar si conviene relanzar considerando giros
      // Evaluar el mejor resultado posible CON giros
      const bestWithFlip = this.evaluateFlipPotential(diceValues);

      const availableCombos = combinations.filter(c => {
        if (c.casilla === 'grande') return player.grandeCount < 2;
        return player.scorecard[c.casilla] === null;
      });

      if (availableCombos.length === 0) return true; // No tiene opciones, relanzar

      const bestPoints = Math.max(...availableCombos.map(c => c.points));

      // Considerar el potencial de giro
      // Si el mejor resultado con giro es muy bueno (score > 400 = full o mejor), quedarse
      if (bestWithFlip.score >= 400) return false;

      // Si tiene combinación decente (>=35 pts) y buen potencial de giro, no relanzar
      if (bestPoints >= 35 && bestWithFlip.score >= 200) return false;

      // Si tiene menos de 25 puntos, relanzar
      if (bestPoints < 25) return true;

      // Entre 25-35 puntos, decidir según potencial de giro
      return bestWithFlip.score < 150;
    }
  }

  // DECISIÓN 3: ¿Qué dados girar?
  decideFlipDice(diceValues, player) {
    if (this.difficulty === 'easy') {
      // No girar o girar aleatoriamente
      if (Math.random() > 0.5) return [];
      const numToFlip = Math.random() > 0.5 ? 1 : 2;
      const indices = [];
      while (indices.length < numToFlip) {
        const idx = Math.floor(Math.random() * 5);
        if (!indices.includes(idx)) indices.push(idx);
      }
      return indices;
    } else if (this.difficulty === 'medium') {
      // Girar los dados más bajos solo si mejora
      const indexed = diceValues.map((val, idx) => ({val, idx}));
      indexed.sort((a, b) => a.val - b.val);
      // Girar los 2 más bajos si valen menos de 4
      const toFlip = [];
      for (let i = 0; i < Math.min(2, indexed.length); i++) {
        if (indexed[i].val < 4) {
          toFlip.push(indexed[i].idx);
        }
      }
      return toFlip;
    } else {
      // Difícil: Usar evaluación completa de todas las posibilidades
      const bestOption = this.evaluateFlipPotential(diceValues);

      // Si la mejor opción es no girar nada, retornar array vacío
      if (bestOption.flipped.length === 0) {
        return [];
      }

      // Retornar los índices de los dados a girar
      return bestOption.flipped;
    }
  }

  // DECISIÓN 4: ¿Qué combinación seleccionar?
  decideSelectCombination(combinations, player) {
    // Filtrar solo las disponibles
    const available = combinations.filter(combo => {
      if (combo.casilla === 'grande') {
        return player.grandeCount < 2;
      }
      return player.scorecard[combo.casilla] === null;
    });

    if (available.length === 0) {
      // Debe matar una casilla - elegir la menos valiosa disponible
      return this.decideBestCellToKill(player);
    }

    if (this.difficulty === 'easy') {
      // Elegir aleatoriamente
      return available[Math.floor(Math.random() * available.length)];
    } else if (this.difficulty === 'medium') {
      // Elegir la de mayor puntaje
      return available.reduce((best, curr) => curr.points > best.points ? curr : best);
    } else {
      // Difícil: Considerar estrategia a largo plazo
      // Priorizar: Grande > Póquer > Full > Escalera > Números altos
      const priority = {
        'grande': 1000,
        'poker': 900,
        'full': 800,
        'escalera': 700,
        'cenas': 600,
        'quinas': 500,
        'cuadras': 400,
        'trenes': 300,
        'duques': 200,
        'balas': 100
      };

      // Calcular score ponderado
      const scored = available.map(combo => ({
        combo,
        score: combo.points + (priority[combo.casilla] || 0)
      }));

      return scored.reduce((best, curr) => curr.score > best.score ? curr : best).combo;
    }
  }

  // Decidir qué casilla matar (cuando no hay opciones)
  decideBestCellToKill(player) {
    const killPriority = ['balas', 'duques', 'trenes', 'cuadras', 'quinas', 'cenas', 'escalera', 'full', 'poker'];

    for (let casilla of killPriority) {
      if (player.scorecard[casilla] === null) {
        return { casilla, points: 0 };
      }
    }

    // Si todo lo demás está usado, matar Grande
    if (player.grandeCount < 2) {
      return { casilla: 'grande', points: 0 };
    }

    return null;
  }
}

// Éléments DOM
const playerSelection = document.getElementById("playerSelection");
const gameArea = document.getElementById("gameArea");
const scoreTableContainer = document.getElementById("scoreTableContainer");
const gameTitle = document.getElementById("gameTitle");
const currentPlayerSpan = document.getElementById("currentPlayer");
const throwInfo = document.getElementById("throwInfo");
const launchButton = document.getElementById("launchButton");
const relaunchButton = document.getElementById("relaunchButton");
const endTurnButton = document.getElementById("endTurnButton");
const flipSection = document.getElementById("flipSection");
const flipInfo = document.getElementById("flipInfo");
const flippedCountSpan = document.getElementById("flippedCount");
const obligatoryDoneSpan = document.getElementById("obligatoryDone");
const confirmFlipButton = document.getElementById("confirmFlipButton");
const resultSection = document.getElementById("resultSection");
const combinationsList = document.getElementById("combinationsList");
const diceElements = [
  document.getElementById("dice1"),
  document.getElementById("dice2"),
  document.getElementById("dice3"),
  document.getElementById("dice4"),
  document.getElementById("dice5"),
];

// ===== NAVEGACIÓN DEL MENÚ DE SELECCIÓN =====
const humanModeBtn = document.getElementById("humanModeBtn");
const botModeBtn = document.getElementById("botModeBtn");
const humanModeSelection = document.getElementById("humanModeSelection");
const botModeSelection = document.getElementById("botModeSelection");
const backFromHuman = document.getElementById("backFromHuman");
const backFromBot = document.getElementById("backFromBot");

// Mostrar selección de jugadores humanos
humanModeBtn.addEventListener("click", () => {
  document.querySelector(".mode-buttons").style.display = "none";
  humanModeSelection.style.display = "block";
  gameMode = 'human';
});

// Mostrar selección de dificultad del bot
botModeBtn.addEventListener("click", () => {
  document.querySelector(".mode-buttons").style.display = "none";
  botModeSelection.style.display = "block";
  gameMode = 'bot';
});

// Volver desde selección de humanos
backFromHuman.addEventListener("click", () => {
  humanModeSelection.style.display = "none";
  document.querySelector(".mode-buttons").style.display = "flex";
  gameMode = null;
});

// Volver desde selección de bot
backFromBot.addEventListener("click", () => {
  botModeSelection.style.display = "none";
  document.querySelector(".mode-buttons").style.display = "flex";
  gameMode = null;
});

// Inicializar selección de jugadores (modo humanos)
document.querySelectorAll(".player-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    numberOfPlayers = parseInt(btn.getAttribute("data-players"));
    startGame();
  });
});

// Inicializar selección de dificultad (modo bot)
document.querySelectorAll(".difficulty-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    botDifficulty = btn.getAttribute("data-difficulty");
    numberOfPlayers = 2; // Siempre 2 jugadores en modo bot
    startGame();
  });
});

// Iniciar el juego
function startGame() {
  // Inicializar jugadores con tabla de puntaje
  players = [];
  for (let i = 0; i < numberOfPlayers; i++) {
    const isBot = (gameMode === 'bot' && i === 1);
    players.push({
      name: isBot ? '🤖 Bot' : `Jugador ${i + 1}`,
      isBot: isBot,
      bot: isBot ? new CachoBot(botDifficulty) : null,
      scorecard: {
        balas: null,      // null = vacía, número = puntos, 0 = matada
        duques: null,
        trenes: null,
        cuadras: null,
        quinas: null,
        cenas: null,
        escalera: null,
        full: null,
        poker: null,
        grande: []        // Array para permitir hasta 2 Grandes
      },
      totalScore: 0,
      grandeCount: 0      // Contador de Grandes usados
    });
  }

  currentPlayerIndex = 0;
  playerSelection.style.display = "none";
  gameArea.style.display = "block";

  // Crear la tabla de puntaje
  createScoreTable();

  updatePlayerDisplay();
}

// Crear la tabla de puntaje
function createScoreTable() {
  const categories = [
    { key: 'balas', name: 'Balas (1)' },
    { key: 'duques', name: 'Duques (2)' },
    { key: 'trenes', name: 'Trenes (3)' },
    { key: 'cuadras', name: 'Cuadras (4)' },
    { key: 'quinas', name: 'Quinas (5)' },
    { key: 'cenas', name: 'Cenas (6)' },
    { key: 'escalera', name: 'Escalera' },
    { key: 'full', name: 'Full' },
    { key: 'poker', name: 'Póquer' },
    { key: 'grande', name: 'Grande (x2)' }
  ];

  let html = '<table class="score-table"><thead><tr><th>Casilla</th>';

  // Encabezados de jugadores
  players.forEach(player => {
    html += `<th>${player.name}</th>`;
  });
  html += '</tr></thead><tbody>';

  // Filas de categorías
  categories.forEach(cat => {
    html += `<tr><td class="category-name">${cat.name}</td>`;

    players.forEach((player, playerIndex) => {
      const value = cat.key === 'grande' ? player.scorecard.grande : player.scorecard[cat.key];
      let cellContent = '';

      if (cat.key === 'grande') {
        // Grande puede tener hasta 2 valores
        if (value.length === 0) {
          cellContent = '<span class="empty-cell">___</span>';
        } else if (value.length === 1) {
          const firstDisplay = value[0] === 0 ? '<span class="killed-cell">✗</span>' : `<span class="filled-cell">${value[0]}</span>`;
          cellContent = `${firstDisplay} / <span class="empty-cell">___</span>`;
        } else {
          const firstDisplay = value[0] === 0 ? '<span class="killed-cell">✗</span>' : `<span class="filled-cell">${value[0]}</span>`;
          const secondDisplay = value[1] === 0 ? '<span class="killed-cell">✗</span>' : `<span class="filled-cell">${value[1]}</span>`;
          cellContent = `${firstDisplay} / ${secondDisplay}`;
        }
      } else {
        if (value === null) {
          cellContent = '<span class="empty-cell">___</span>';
        } else if (value === 0) {
          cellContent = '<span class="killed-cell">✗</span>';
        } else {
          cellContent = `<span class="filled-cell">${value}</span>`;
        }
      }

      html += `<td class="score-cell" data-player="${playerIndex}" data-category="${cat.key}">${cellContent}</td>`;
    });

    html += '</tr>';
  });

  // Fila de totales
  html += '<tr class="total-row"><td class="category-name"><strong>TOTAL</strong></td>';
  players.forEach((player, playerIndex) => {
    html += `<td class="total-cell" id="total-${playerIndex}"><strong>${player.totalScore}</strong></td>`;
  });
  html += '</tr>';

  html += '</tbody></table>';

  scoreTableContainer.innerHTML = html;
}

// Actualizar la visualización del jugador actual
function updatePlayerDisplay() {
  currentPlayerSpan.textContent = players[currentPlayerIndex].name;

  // Verificar si el jugador actual ya completó todas sus jugadas
  const currentPlayer = players[currentPlayerIndex];
  if (hasPlayerFinished(currentPlayer)) {
    // Mostrar mensaje y pasar automáticamente al siguiente jugador
    throwInfo.textContent = `${currentPlayer.name} ya completó todas sus jugadas. Pasando al siguiente...`;
    launchButton.style.display = "none";
    relaunchButton.style.display = "none";
    flipSection.style.display = "none";
    resultSection.style.display = "none";

    setTimeout(() => {
      nextPlayer();
    }, 2000);
    return;
  }

  launchCount = 0;
  throwInfo.textContent = "Haz clic en 'Lanzar' para comenzar tu turno";
  launchButton.style.display = "inline-block";
  relaunchButton.style.display = "none";
  flipSection.style.display = "none";
  resultSection.style.display = "none";

  // Limpiar dados guardados y girados
  keptDice = [false, false, false, false, false];
  flippedDice = [false, false, false, false, false];
  flipCount = 0;
  isFlipMode = false; // IMPORTANTE: Resetear modo de giro
  isDeMano = false;
  diceElements.forEach((el) => {
    el.classList.remove("kept");
    el.classList.remove("flipped");
  });

  // Si es el turno del bot, ejecutar automáticamente
  if (currentPlayer.isBot && !isProcessingBotTurn) {
    isProcessingBotTurn = true;
    throwInfo.textContent = `🤖 ${currentPlayer.name} está pensando...`;
    launchButton.style.display = "none";

    setTimeout(() => {
      executeBotTurn();
    }, 1000);
  }
}

// ===== EJECUCIÓN DEL TURNO DEL BOT =====
async function executeBotTurn() {
  const player = players[currentPlayerIndex];
  const bot = player.bot;

  // FASE 1: Lanzar dados
  throwInfo.textContent = `🤖 ${player.name} lanza los dados...`;
  await sleep(1000);
  launchDice(true);
  await sleep(1500);

  // FASE 2: Decidir si guardar dados y relanzar
  const shouldRelaunch = bot.decideRelaunch(diceValues, player);

  if (shouldRelaunch) {
    // Guardar dados según decisión del bot
    const keepDecision = bot.decideKeepDice(diceValues);
    keptDice = keepDecision;

    // Mostrar visualmente los dados guardados
    diceElements.forEach((el, idx) => {
      if (keptDice[idx]) {
        el.classList.add("kept");
      }
    });

    throwInfo.textContent = `🤖 ${player.name} guarda algunos dados y relanza...`;
    await sleep(1500);
    launchDice(false);
    await sleep(1500);
  } else {
    throwInfo.textContent = `🤖 ${player.name} decide no relanzar`;
    await sleep(1000);
  }

  // FASE 3: Decidir si girar dados
  const flipDecision = bot.decideFlipDice(diceValues, player);

  if (flipDecision.length > 0) {
    throwInfo.textContent = `🤖 ${player.name} gira ${flipDecision.length} dado(s)...`;
    isFlipMode = true;

    for (let idx of flipDecision) {
      flipDie(idx);
      await sleep(500);
    }

    isFlipMode = false;
    await sleep(1000);
  }

  // FASE 4: Seleccionar combinación
  const sortedValues = diceValues.slice().sort((a, b) => a - b);
  const esRealmenteDeMano = (launchCount === 1 && flipDecision.length === 0);
  const allCombinations = detectAllCombinations(sortedValues, esRealmenteDeMano);

  // Verificar dormida
  if (allCombinations.length > 0 && allCombinations[0].type === "dormida") {
    soundManager.victory();
    combinationsList.innerHTML = `
      <div class="combination dormida-win">
        <h2>🎉 ¡¡¡DORMIDA!!! 🎉</h2>
        <p>${allCombinations[0].description}</p>
        <p class="winner-text">¡${player.name} GANA LA PARTIDA!</p>
      </div>
    `;
    resultSection.style.display = "block";
    throwInfo.textContent = "¡Partida terminada!";
    isProcessingBotTurn = false;
    return;
  }

  const selectedCombo = bot.decideSelectCombination(allCombinations, player);

  // Crear mensaje descriptivo de la selección
  const casillaNames = {
    'balas': 'Balas',
    'duques': 'Duques',
    'trenes': 'Trenes',
    'cuadras': 'Cuadras',
    'quinas': 'Quinas',
    'cenas': 'Cenas',
    'escalera': 'Escalera',
    'full': 'Full',
    'poker': 'Póquer',
    'grande': 'Grande'
  };

  const casillaDisplay = casillaNames[selectedCombo.casilla] || selectedCombo.casilla;
  const puntosDisplay = selectedCombo.points === 0 ? 'MATADA (0 pts)' : `${selectedCombo.points} pts`;
  const puntosColor = selectedCombo.points === 0 ? '#FF6B6B' : selectedCombo.points >= 40 ? '#4ECCA3' : '#FFD700';

  // Mostrar resultado visual
  resultSection.style.display = "block";
  combinationsList.innerHTML = `
    <div class="bot-selection-display" style="background: linear-gradient(135deg, rgba(78, 204, 163, 0.2), rgba(78, 204, 163, 0.05));
         padding: 20px; border-radius: 10px; border: 2px solid ${puntosColor}; text-align: center;">
      <h3 style="color: #4ECCA3; margin: 10px 0;">🤖 Decisión del Bot</h3>
      <p style="font-size: 1.5rem; color: #FFD700; margin: 10px 0; font-family: 'Lobster', cursive;">
        ${casillaDisplay}
      </p>
      <p style="font-size: 2rem; color: ${puntosColor}; font-weight: bold; margin: 10px 0; font-family: 'Lobster', cursive;">
        ${puntosDisplay}
      </p>
      <p style="font-size: 1rem; color: #EEEEEE; margin-top: 15px; font-style: italic;">
        Dados finales: ${diceValues.join(' - ')}
      </p>
    </div>
  `;

  throwInfo.textContent = `🤖 ${player.name} anotó su jugada`;
  await sleep(2500); // Más tiempo para leer

  // Registrar la selección
  if (selectedCombo.points === 0) {
    soundManager.killCell();
  } else if (selectedCombo.casilla === 'grande' && selectedCombo.points > 0) {
    soundManager.victory();
  } else {
    soundManager.selectCombination();
  }

  if (selectedCombo.casilla === 'grande') {
    player.scorecard.grande.push(selectedCombo.points);
    player.grandeCount++;
  } else {
    player.scorecard[selectedCombo.casilla] = selectedCombo.points;
  }

  calculatePlayerTotal(currentPlayerIndex);
  createScoreTable();

  // Verificar fin del juego
  if (checkGameOver()) {
    announceWinner();
    isProcessingBotTurn = false;
    return;
  }

  // Pasar al siguiente jugador
  await sleep(1500);
  resultSection.style.display = "none"; // Ocultar resultado del bot
  isProcessingBotTurn = false;
  nextPlayer();
}

// Función auxiliar para delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Pasar al siguiente jugador
function nextPlayer() {
  currentPlayerIndex = (currentPlayerIndex + 1) % numberOfPlayers;
  isProcessingBotTurn = false; // Reset del flag
  updatePlayerDisplay();
}

// Fonction pour lancer un dé aléatoire
function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

// Función para obtener el lado opuesto de un dado
function getOppositeSide(value) {
  // Los lados opuestos de un dado suman 7
  return 7 - value;
}

// Función para girar un dado
function flipDie(index) {
  if (!isFlipMode) return;

  // Verificar si ya se giraron 2 dados
  if (flipCount >= 2 && !flippedDice[index]) {
    throwInfo.textContent = "Ya giraste 2 dados. Confirma para terminar el turno.";
    return;
  }

  // Si el dado ya fue girado, permitir des-girarlo
  if (flippedDice[index]) {
    diceValues[index] = getOppositeSide(diceValues[index]);
    flippedDice[index] = false;
    flipCount--;
    diceElements[index].classList.remove("flipped");
  } else {
    // Girar el dado
    diceValues[index] = getOppositeSide(diceValues[index]);
    flippedDice[index] = true;
    flipCount++;
    diceElements[index].classList.add("flipped");
  }

  // 🔊 SONIDO: Girar dado
  soundManager.flipDice();

  // Actualizar la imagen del dado
  updateDieImage(index, diceValues[index]);

  // Actualizar contador
  flippedCountSpan.textContent = flipCount;
  obligatoryDoneSpan.textContent = flipCount >= 1 ? "Sí" : "No";

  // Actualizar mensaje
  if (flipCount === 0) {
    throwInfo.textContent = "Puedes girar hasta 2 dados (opcional) o confirmar para ver opciones";
  } else if (flipCount === 1) {
    throwInfo.textContent = "Puedes girar 1 dado más (opcional) o confirmar para ver opciones";
  } else {
    throwInfo.textContent = "Haz clic en 'Confirmar' para ver opciones";
  }
}

// Fonction pour mettre à jour l'image d'un dé
function updateDieImage(index, value) {
  const img = diceElements[index].querySelector("img");
  img.setAttribute("src", "images/dice" + value + ".png");
}

// Fonction pour lancer ou relancer les dés
function launchDice(isFirstLaunch = true) {
  // 🔊 SONIDO: Tirar dados
  soundManager.rollDice();

  // 🎨 ANIMACIÓN: Aplicar clase rolling a los dados que se van a tirar
  diceElements.forEach((dice, i) => {
    if (isFirstLaunch || !keptDice[i]) {
      dice.classList.add("rolling");
    }
  });

  // Remover la animación después de que termine
  setTimeout(() => {
    diceElements.forEach(dice => dice.classList.remove("rolling"));
  }, 600);

  if (isFirstLaunch) {
    // Premier lancer : Tout relancer, réinitialiser
    keptDice = [false, false, false, false, false];
    diceElements.forEach((el) => el.classList.remove("kept"));
    launchCount = 1;
    isDeMano = true; // Comienza como "de mano"
    throwInfo.textContent = "Lanzamiento 1 de 2 - Selecciona los dados que quieres guardar";
  } else {
    // Relance : Seulement les non gardés
    launchCount = 2;
    isDeMano = false; // Ya no es "de mano" porque relanzó
    throwInfo.textContent = "Lanzamiento 2 de 2 - Resultado final";
  }

  for (let i = 0; i < 5; i++) {
    if (isFirstLaunch || !keptDice[i]) {
      diceValues[i] = rollDie();
      updateDieImage(i, diceValues[i]);
    }
  }

  if (launchCount === 1) {
    // Afficher le bouton de relance après el primer lancer
    launchButton.style.display = "none";
    relaunchButton.style.display = "inline-block";
    endTurnButton.style.display = "inline-block";
    flipSection.style.display = "none";
  } else {
    // Après le deuxième, activar modo de giro
    launchButton.style.display = "none";
    relaunchButton.style.display = "none";
    endTurnButton.style.display = "none";
    flipSection.style.display = "block";

    // Activar modo de giro
    isFlipMode = true;
    flipCount = 0;
    flippedDice = [false, false, false, false, false];
    flippedCountSpan.textContent = "0";
    obligatoryDoneSpan.textContent = "No";

    const combination = detectCombination(
      diceValues.slice().sort((a, b) => a - b)
    );
    throwInfo.textContent = combination + " - Puedes girar hasta 2 dados (opcional)";
  }
}

// Événement pour le bouton de lancement
launchButton.addEventListener("click", () => launchDice(true));

// Événement pour le bouton de relance
relaunchButton.addEventListener("click", () => launchDice(false));

// Événement para terminar turno después del primer lanzamiento
endTurnButton.addEventListener("click", () => {
  // Si estamos después del primer lanzamiento, ofrecer girar dados primero
  if (launchCount === 1) {
    // Cambiar a modo de giro obligatorio
    launchButton.style.display = "none";
    relaunchButton.style.display = "none";
    endTurnButton.style.display = "none";
    flipSection.style.display = "block";

    // Activar modo de giro
    isFlipMode = true;
    flipCount = 0;
    flippedDice = [false, false, false, false, false];
    flippedCountSpan.textContent = "0";
    obligatoryDoneSpan.textContent = "No";

    // Mantener isDeMano true porque aún puede ser de mano si no gira nada
    throwInfo.textContent = "Puedes girar hasta 2 dados (opcional) antes de ver las opciones";
  } else {
    // Ya vio las opciones, pasar al siguiente jugador
    nextPlayer();
  }
});

// Función para seleccionar una combinación y anotarla
function selectCombination(element) {
  const casilla = element.getAttribute('data-casilla');
  const points = parseInt(element.getAttribute('data-points'));
  const player = players[currentPlayerIndex];

  // 🔊 SONIDO: Matar casilla, Grande, o seleccionar combinación
  if (points === 0) {
    soundManager.killCell(); // Sonido grave para matar
  } else if (casilla === 'grande' && points > 0) {
    soundManager.victory(); // Sonido de victoria para Grande
  } else {
    soundManager.selectCombination(); // Ding satisfactorio
  }

  // Registrar la jugada
  if (casilla === 'grande') {
    // Si es Grande, agregar al array (aunque sea 0 para matar)
    player.scorecard.grande.push(points);
    player.grandeCount++;
  } else {
    player.scorecard[casilla] = points;
  }

  // Actualizar total
  calculatePlayerTotal(currentPlayerIndex);

  // Actualizar la tabla visual
  createScoreTable();

  // Verificar si el juego ha terminado
  if (checkGameOver()) {
    announceWinner();
    return;
  }

  // Pasar al siguiente jugador
  resultSection.style.display = "none";
  nextPlayer();
}

// Calcular el total de un jugador
function calculatePlayerTotal(playerIndex) {
  const player = players[playerIndex];
  let total = 0;

  // Sumar todas las casillas excepto Grande
  for (let key in player.scorecard) {
    if (key !== 'grande' && player.scorecard[key] !== null) {
      total += player.scorecard[key];
    }
  }

  // Sumar Grandes
  player.scorecard.grande.forEach(val => {
    total += val;
  });

  player.totalScore = total;

  // Actualizar en la tabla
  const totalCell = document.getElementById(`total-${playerIndex}`);
  if (totalCell) {
    totalCell.innerHTML = `<strong>${total}</strong>`;
  }
}

// Verificar si un jugador específico completó todas sus jugadas (11 turnos)
function hasPlayerFinished(player) {
  const filled = Object.keys(player.scorecard).filter(key => {
    if (key === 'grande') {
      return player.grandeCount >= 2 || player.scorecard.grande.length >= 2;
    }
    return player.scorecard[key] !== null;
  });
  return filled.length >= 10; // 9 casillas normales + grande = 11 jugadas totales
}

// Verificar si el juego ha terminado
function checkGameOver() {
  // El juego termina cuando todos los jugadores han llenado todas sus casillas
  return players.every(player => hasPlayerFinished(player));
}

// Anunciar el ganador
function announceWinner() {
  let maxScore = -1;
  let winner = null;

  players.forEach(player => {
    if (player.totalScore > maxScore) {
      maxScore = player.totalScore;
      winner = player;
    }
  });

  // 🔊 SONIDO: Victoria final
  soundManager.victory();

  combinationsList.innerHTML = `
    <div class="winner-announcement">
      <h2>🎉 ¡Fin del juego! 🎉</h2>
      <p class="winner-text">¡${winner.name} GANA con ${maxScore} puntos!</p>
      <button onclick="location.reload()" class="restart-button">Jugar de nuevo</button>
    </div>
  `;

  resultSection.style.display = "block";
  throwInfo.textContent = "Partida terminada";
}

// Función para mostrar todas las opciones disponibles
function showAllOptions() {
  // Verificar si el jugador actual ya completó todas sus jugadas
  const currentPlayer = players[currentPlayerIndex];
  if (hasPlayerFinished(currentPlayer)) {
    // El jugador ya terminó, pasar automáticamente al siguiente
    combinationsList.innerHTML = `
      <div class="info-message">
        <p>✅ ${currentPlayer.name} ya completó todas sus jugadas (11/11)</p>
        <p>Pasando automáticamente al siguiente jugador...</p>
      </div>
    `;
    setTimeout(() => {
      resultSection.style.display = "none";
      nextPlayer();
    }, 2000);
    return;
  }

  // Determinar si es "de mano"
  // Solo es "de mano" si: primer lanzamiento Y no giró ningún dado
  const esRealmenteDeMano = (launchCount === 1 && flipCount === 0);

  // Detectar todas las combinaciones posibles
  const sortedValues = diceValues.slice().sort((a, b) => a - b);
  const allCombinations = detectAllCombinations(sortedValues, esRealmenteDeMano);

  // Verificar si hay DORMIDA (gana instantáneamente)
  if (allCombinations.length > 0 && allCombinations[0].type === "dormida") {
    // 🔊 SONIDO: Victoria por Dormida
    soundManager.victory();

    combinationsList.innerHTML = `
      <div class="combination dormida-win">
        <h2>🎉 ¡¡¡DORMIDA!!! 🎉</h2>
        <p>${allCombinations[0].description}</p>
        <p class="winner-text">¡${players[currentPlayerIndex].name} GANA LA PARTIDA!</p>
      </div>
    `;
    throwInfo.textContent = "¡Partida terminada!";
    return;
  }

  // Mostrar todas las opciones
  let html = '';
  if (esRealmenteDeMano) {
    html += '<p class="de-mano-badge">✨ ¡Jugada DE MANO! (bonus +5 puntos en especiales)</p>';
  }

  // Verificar cuántas opciones están disponibles
  let availableCount = 0;

  allCombinations.forEach((combo) => {
    // Verificar si la casilla está disponible para este jugador
    const player = players[currentPlayerIndex];
    let isAvailable = false;
    let reason = '';

    if (combo.casilla === 'grande') {
      isAvailable = player.grandeCount < 2;
      reason = isAvailable ? '' : ' (Máximo 2 usados)';
    } else {
      isAvailable = player.scorecard[combo.casilla] === null;
      reason = isAvailable ? '' : ' (Ya usada)';
    }

    if (isAvailable) {
      availableCount++;
    }

    const availableClass = isAvailable ? 'available' : 'unavailable';

    html += `
      <div class="combination-option ${availableClass}"
           data-casilla="${combo.casilla}"
           data-points="${combo.points}"
           ${isAvailable ? 'onclick="selectCombination(this)"' : ''}>
        <span class="combo-name">${combo.name}${reason}</span>
        <span class="combo-desc">${combo.description}</span>
        <span class="combo-points">${combo.points} pts</span>
      </div>
    `;
  });

  // SOLO mostrar opciones de "matar" si NO hay ninguna opción disponible
  if (availableCount === 0) {
    html += '<hr><p class="kill-option-title">⚠️ No tienes opciones disponibles. Debes matar una casilla:</p>';

    const categories = ['balas', 'duques', 'trenes', 'cuadras', 'quinas', 'cenas', 'escalera', 'full', 'poker'];
    const player = players[currentPlayerIndex];

    let hasKillOptions = false;

    categories.forEach(cat => {
      if (player.scorecard[cat] === null) {
        hasKillOptions = true;
        const catNames = {
          balas: 'Balas', duques: 'Duques', trenes: 'Trenes',
          cuadras: 'Cuadras', quinas: 'Quinas', cenas: 'Cenas',
          escalera: 'Escalera', full: 'Full', poker: 'Póquer'
        };

        html += `
          <div class="combination-option kill-option available"
               data-casilla="${cat}"
               data-points="0"
               onclick="selectCombination(this)">
            <span class="combo-name">✗ ${catNames[cat]}</span>
            <span class="combo-desc">Matar casilla</span>
            <span class="combo-points">0 pts</span>
          </div>
        `;
      }
    });

    // Agregar opción para matar Grande si tiene menos de 2
    if (player.grandeCount < 2) {
      hasKillOptions = true;
      html += `
        <div class="combination-option kill-option available"
             data-casilla="grande"
             data-points="0"
             onclick="selectCombination(this)">
          <span class="combo-name">✗ Grande</span>
          <span class="combo-desc">Matar casilla</span>
          <span class="combo-points">0 pts</span>
        </div>
      `;
    }

    // Si no hay opciones de matar, el jugador ya terminó sus 11 jugadas
    // Esto no debería suceder porque ya verificamos al inicio de showAllOptions()
    if (!hasKillOptions) {
      html += '<p class="info-message">⚠️ No hay casillas disponibles para matar.</p>';
      html += '<p class="info-message">El jugador ya completó todas sus jugadas. Pasando al siguiente...</p>';
      setTimeout(() => {
        resultSection.style.display = "none";
        nextPlayer();
      }, 2000);
    }
  }

  combinationsList.innerHTML = html;

  if (availableCount === 0) {
    throwInfo.textContent = "⚠️ Debes matar una casilla - Haz clic en una opción";
  } else {
    throwInfo.textContent = "Haz clic en una opción para anotarla";
  }
}

// Événement para confirmar giro y ver resultado
confirmFlipButton.addEventListener("click", () => {
  // Ya no es obligatorio girar dados - el jugador puede confirmar directamente

  // Desactivar modo de giro
  isFlipMode = false;

  // Ocultar sección de giro y mostrar resultado
  flipSection.style.display = "none";
  resultSection.style.display = "block";

  // Mostrar todas las opciones
  showAllOptions();

  // Limpiar clases de dados girados (dejar solo el resultado visual)
  diceElements.forEach((el) => el.classList.remove("flipped"));
});

// Événements pour sélectionner les dés (cliquer para guardar o girar)
diceElements.forEach((dice, index) => {
  dice.addEventListener("click", () => {
    if (isFlipMode) {
      // Modo de giro: girar dados
      flipDie(index);
    } else if (launchCount === 1) {
      // Modo normal: guardar dados después del primer lanzamiento
      keptDice[index] = !keptDice[index];
      if (keptDice[index]) {
        dice.classList.add("kept");
        // 🔊 SONIDO: Guardar dado
        soundManager.keepDice();
      } else {
        dice.classList.remove("kept");
        // 🔊 SONIDO: Soltar dado (mismo sonido pero más suave)
        soundManager.keepDice();
      }
    }
  });
});

// Función para obtener el nombre boliviano de un dado
function getDiceName(num) {
  const names = {
    1: "Bala",
    2: "Duque",
    3: "Tren",
    4: "Cuadra",
    5: "Quina",
    6: "Cena"
  };
  return names[num];
}

// Función para obtener el nombre plural de los dados
function getDiceNamePlural(num) {
  const names = {
    1: "Balas",
    2: "Duques",
    3: "Trenes",
    4: "Cuadras",
    5: "Quinas",
    6: "Cenas"
  };
  return names[num];
}

// Función para detectar TODAS las combinaciones posibles
function detectAllCombinations(values, isDeMano = false) {
  const combinations = [];

  // Contar las ocurrencias
  const counts = {};
  values.forEach((num) => {
    counts[num] = (counts[num] || 0) + 1;
  });

  const uniqueNums = Object.keys(counts).length;
  const maxCount = Math.max(...Object.values(counts));

  // Dormida: 5 dados iguales DE MANO (gana instantáneamente)
  if (maxCount === 5 && isDeMano) {
    const num = parseInt(Object.keys(counts).find(key => counts[key] === 5));
    combinations.push({
      type: "dormida",
      name: "¡DORMIDA!",
      description: "5 " + getDiceName(num) + "s de mano",
      points: "WIN",
      casilla: "dormida"
    });
    return combinations; // Solo retornar dormida si aplica
  }

  // Grande: 5 dados iguales (no de mano)
  if (maxCount === 5) {
    const num = parseInt(Object.keys(counts).find(key => counts[key] === 5));
    combinations.push({
      type: "grande",
      name: "Grande",
      description: "5 " + getDiceName(num) + "s",
      points: 50,
      casilla: "grande"
    });
  }

  // Póquer: 4 dados iguales
  if (maxCount === 4) {
    const num = parseInt(Object.keys(counts).find(key => counts[key] === 4));
    const points = isDeMano ? 50 : 45;
    combinations.push({
      type: "poker",
      name: isDeMano ? "Póquer de mano" : "Póquer",
      description: "4 " + getDiceName(num) + "s",
      points: points,
      casilla: "poker"
    });
  }

  // Full: 3 + 2
  if (maxCount === 3 && uniqueNums === 2) {
    const num3 = parseInt(Object.keys(counts).find(key => counts[key] === 3));
    const num2 = parseInt(Object.keys(counts).find(key => counts[key] === 2));
    const points = isDeMano ? 40 : 35;
    combinations.push({
      type: "full",
      name: isDeMano ? "Full de mano" : "Full",
      description: "3 " + getDiceName(num3) + "s + 2 " + getDiceName(num2) + "s",
      points: points,
      casilla: "full"
    });
  }

  // Escalera: Secuencia de 5 (1-2-3-4-5 o 2-3-4-5-6)
  const isStraight1 = values.join("") === "12345";
  const isStraight2 = values.join("") === "23456";
  if (isStraight1 || isStraight2) {
    const points = isDeMano ? 30 : 25;
    combinations.push({
      type: "escalera",
      name: isDeMano ? "Escalera de mano" : "Escalera",
      description: "Secuencia de 5",
      points: points,
      casilla: "escalera"
    });
  }

  // Números: Agregar todas las opciones de números
  for (let num = 1; num <= 6; num++) {
    if (counts[num]) {
      const sum = counts[num] * num;
      combinations.push({
        type: "numero",
        name: getDiceNamePlural(num),
        description: counts[num] + " x " + num,
        points: sum,
        casilla: getDiceNamePlural(num).toLowerCase()
      });
    }
  }

  return combinations;
}

// Función para mostrar la descripción de una combinación (para compatibilidad)
function detectCombination(values) {
  const combinations = detectAllCombinations(values, false);
  if (combinations.length === 0) return "Sin combinación";

  // Retornar la primera (mejor) combinación
  const best = combinations[0];
  return best.name + " - " + best.description + " (" + best.points + " puntos)";
}

// ===== CONTROL DE SONIDO =====
const muteButton = document.getElementById("muteButton");

if (muteButton) {
  muteButton.addEventListener("click", () => {
    const isMuted = soundManager.toggleMute();
    muteButton.textContent = isMuted ? "🔇" : "🔊";
    muteButton.title = isMuted ? "Activar sonido" : "Silenciar sonido";
  });
}

// ===== MODAL DE CÓMO JUGAR =====
const helpButton = document.getElementById("helpButton");
const helpModal = document.getElementById("helpModal");
const closeModal = document.querySelector(".close-modal");

if (helpButton) {
  helpButton.addEventListener("click", () => {
    helpModal.style.display = "flex";
  });
}

if (closeModal) {
  closeModal.addEventListener("click", () => {
    helpModal.style.display = "none";
  });
}

// Cerrar modal al hacer click fuera de él
window.addEventListener("click", (event) => {
  if (event.target === helpModal) {
    helpModal.style.display = "none";
  }
});

// ===== REGISTRAR SERVICE WORKER PARA PWA =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((registration) => {
        console.log('✅ Service Worker registrado correctamente:', registration.scope);
      })
      .catch((error) => {
        console.log('❌ Error al registrar Service Worker:', error);
      });
  });
}
