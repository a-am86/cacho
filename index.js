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

// Inicializar selección de jugadores
document.querySelectorAll(".player-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    numberOfPlayers = parseInt(btn.getAttribute("data-players"));
    startGame();
  });
});

// Iniciar el juego
function startGame() {
  // Inicializar jugadores con tabla de puntaje
  players = [];
  for (let i = 0; i < numberOfPlayers; i++) {
    players.push({
      name: `Jugador ${i + 1}`,
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
  throwInfo.textContent = "Haz clic en 'Lancer' para comenzar tu turno";
  launchButton.style.display = "inline-block";
  relaunchButton.style.display = "none";
  flipSection.style.display = "none";
  resultSection.style.display = "none";

  // Limpiar dados guardados y girados
  keptDice = [false, false, false, false, false];
  flippedDice = [false, false, false, false, false];
  diceElements.forEach((el) => {
    el.classList.remove("kept");
    el.classList.remove("flipped");
  });
}

// Pasar al siguiente jugador
function nextPlayer() {
  currentPlayerIndex = (currentPlayerIndex + 1) % numberOfPlayers;
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
