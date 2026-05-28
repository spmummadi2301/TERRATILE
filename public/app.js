/**
 * TERRATILE — CLIENT APPLICATION ENGINE
 * Real-time Strategic Grid Control & Map Telemetry System
 */

// --- 1. DESIGN & COLOR CONFIGURATION ---
const AURA_COLORS = [
  { name: 'Clay Red', hex: '#B85C38' },
  { name: 'Moss Green', hex: '#5E7C5A' },
  { name: 'Dust Blue', hex: '#5C7285' },
  { name: 'Sand Gold', hex: '#C29B5A' },
  { name: 'Burnt Orange', hex: '#C96B3B' },
  { name: 'Slate Purple', hex: '#72637E' }
];

// --- 2. GLOBAL STATE SYSTEM ---
let state = {
  // Player Identity
  playerId: localStorage.getItem('terratile_player_id') || null,
  playerName: localStorage.getItem('terratile_name') || '',
  playerColor: localStorage.getItem('terratile_color') || AURA_COLORS[2].hex, // Default Dust Blue
  
  // Game & Connection State
  gridSize: 40,
  gridTiles: {}, // tileId -> tileData
  players: [],   // Array of player identities
  logs: [],      // Telemetry logs
  selectedTileId: null,
  
  // Viewport Settings
  panX: 0,
  panY: 0,
  zoomScale: 0.85,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,

  // Audio Context & Config
  audioCtx: null,
  soundEnabled: false,
  
  // Cooldown Rates
  cooldownActive: false,
  cooldownDuration: 800, // default 800ms
  cooldownStart: 0,
  cooldownTimer: null,
  
  // Network Telemetry
  pingInterval: null,
  lastPingTimestamp: 0,
  
  // Custom Gateway
  wsGatewayUrl: localStorage.getItem('terratile_ws_gateway') || '',
  
  // Game End State
  victoryDeclared: false
};

// DOM References
const DOM = {
  audioConsent: document.getElementById('audio-consent'),
  btnSoundOn: document.getElementById('btn-sound-on'),
  btnSoundOff: document.getElementById('btn-sound-off'),
  
  heroOverlay: document.getElementById('hero-overlay'),
  heroOnlineCount: document.getElementById('hero-online-count'),
  heroTicker: document.getElementById('hero-ticker'),
  btnEnterGrid: document.getElementById('btn-enter-grid'),
  
  appContainer: document.querySelector('.app-container'),
  latencyVal: document.getElementById('latency-val'),
  conqueredRatio: document.getElementById('conquered-ratio'),
  liveOperators: document.getElementById('live-operators'),
  connStatusDot: document.getElementById('conn-status-dot'),
  connStatusText: document.getElementById('conn-status-text'),
  
  playerNameInput: document.getElementById('player-name-input'),
  auraColorsGrid: document.getElementById('aura-colors-grid'),
  auraPreviewDot: document.getElementById('aura-preview-dot'),
  auraPreviewName: document.getElementById('aura-preview-name'),
  btnUpdateProfile: document.getElementById('btn-update-profile'),
  btnResetIdentity: document.getElementById('btn-reset-identity'),
  
  leaderboardList: document.getElementById('leaderboard-list'),
  currentCoordsIndicator: document.getElementById('current-coords-indicator'),
  viewportContainer: document.getElementById('grid-viewport'),
  gridCanvas: document.getElementById('grid-canvas'),
  axisGuideX: document.getElementById('axis-guide-x'),
  axisGuideY: document.getElementById('axis-guide-y'),
  
  hudTileCoord: document.getElementById('hud-tile-coord'),
  hudTileStatus: document.getElementById('hud-tile-status'),
  btnCaptureTile: document.getElementById('btn-capture-tile'),
  
  liveFeedTicker: document.getElementById('live-feed-ticker'),
  toastContainer: document.getElementById('toast-container'),
  
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomReset: document.getElementById('btn-zoom-reset'),

  wsBridgeInput: document.getElementById('ws-bridge-input'),
  btnSaveBridge: document.getElementById('btn-save-bridge'),

  victoryModal: document.getElementById('victory-modal'),
  btnVictoryClose: document.getElementById('btn-victory-close'),
  vicName: document.getElementById('vic-name'),
  vicScore: document.getElementById('vic-score'),
  vicControl: document.getElementById('vic-control'),
  vicAvatar: document.getElementById('vic-avatar')
};

// --- 3. WEB AUDIO SYNTHESIZER ---
function initAudio() {
  if (state.audioCtx) return;
  
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioContextClass();
    state.soundEnabled = true;
  } catch (e) {
    console.warn("Failed to initialize Web Audio context:", e);
    state.soundEnabled = false;
  }
}

// Synthesize a crisp high-frequency micro click sound (for UI hovers/selections)
function playSynthClick() {
  if (!state.soundEnabled || !state.audioCtx) return;
  if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
  
  const ctx = state.audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  // High pitched short synth pulse
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.015);
  
  gain.gain.setValueAtTime(0.18, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.015);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.02);
}

// Synthesize a heavy tactical paper stamp/emboss noise (for captures)
function playSynthStamp() {
  if (!state.soundEnabled || !state.audioCtx) return;
  if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
  
  const ctx = state.audioCtx;
  const time = ctx.currentTime;
  
  // Bass impact
  const oscBass = ctx.createOscillator();
  const gainBass = ctx.createGain();
  oscBass.connect(gainBass);
  gainBass.connect(ctx.destination);
  
  oscBass.type = 'triangle';
  oscBass.frequency.setValueAtTime(130, time);
  oscBass.frequency.exponentialRampToValueAtTime(45, time + 0.12);
  
  gainBass.gain.setValueAtTime(0.8, time);
  gainBass.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
  
  oscBass.start(time);
  oscBass.stop(time + 0.15);
  
  // Crisp stamp resonance (simulates stamping metal/paper friction)
  const oscSnap = ctx.createOscillator();
  const gainSnap = ctx.createGain();
  oscSnap.connect(gainSnap);
  gainSnap.connect(ctx.destination);
  
  oscSnap.type = 'sine';
  oscSnap.frequency.setValueAtTime(600, time);
  oscSnap.frequency.exponentialRampToValueAtTime(200, time + 0.04);
  
  gainSnap.gain.setValueAtTime(0.28, time);
  gainSnap.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  
  oscSnap.start(time);
  oscSnap.stop(time + 0.06);
}

// Synthesize a warning alert beep (for cooldown block)
function playSynthWarning() {
  if (!state.soundEnabled || !state.audioCtx) return;
  if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
  
  const ctx = state.audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  // Muted synth tick / low alarm
  osc.type = 'square';
  osc.frequency.setValueAtTime(140, ctx.currentTime);
  
  gain.gain.setValueAtTime(0.22, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

// Synthesize an epic retro arpeggio resolved by a deep stamp note (for victories)
function playSynthVictoryChime() {
  if (!state.soundEnabled || !state.audioCtx) return;
  if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
  
  const ctx = state.audioCtx;
  const now = ctx.currentTime;
  
  // Rising major triad arpeggio: C4, E4, G4, C5, E5, G5, C6
  const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
  
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.08);
    
    gain.gain.setValueAtTime(0, now + idx * 0.08);
    gain.gain.linearRampToValueAtTime(0.22, now + idx * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
    
    osc.start(now + idx * 0.08);
    osc.stop(now + idx * 0.08 + 0.35);
  });
  
  // Final heavy bass stamp sound to resolve the chime
  setTimeout(() => playSynthStamp(), 560);
}

// Declare a Conquest Victory, populate stats card, play synthesizers and trigger modal popup
function declareVictory(victor) {
  state.victoryDeclared = true;
  
  DOM.vicName.innerText = victor.name;
  DOM.vicScore.innerText = `${victor.maxConnected || 30} connected (${victor.score} total)`;
  
  const totalTiles = state.gridSize * state.gridSize;
  const controlPercent = Math.round((victor.score / totalTiles) * 100);
  DOM.vicControl.innerText = `${controlPercent}%`;
  
  DOM.vicAvatar.style.backgroundColor = victor.color;
  DOM.vicAvatar.style.borderColor = victor.color;
  
  DOM.victoryModal.classList.add('active');
  
  playSynthVictoryChime();
  showToast(`Tactical Victory: Operator ${victor.name} has built a connected territory of ${victor.maxConnected || 30} tiles!`, 'success');
}

// --- 4. NAVIGATION & ZOOM LOGIC (GRID VIEWPORT) ---
function initViewportEngine() {
  const container = DOM.viewportContainer;
  const canvas = DOM.gridCanvas;
  
  // Mouse Drag to Pan Grid
  container.addEventListener('mousedown', (e) => {
    // Avoid dragging if selecting a tile or interactive buttons
    if (e.target.classList.contains('grid-tile') && e.detail > 1) return; // Allow double clicks
    
    state.isDragging = true;
    container.style.cursor = 'grabbing';
    
    // Account for zoom scale multiplier when dragging
    state.dragStartX = e.clientX - state.panX;
    state.dragStartY = e.clientY - state.panY;
  });
  
  window.addEventListener('mousemove', (e) => {
    if (!state.isDragging) return;
    
    state.panX = e.clientX - state.dragStartX;
    state.panY = e.clientY - state.dragStartY;
    applyViewportTransform();
  });
  
  window.addEventListener('mouseup', () => {
    if (state.isDragging) {
      state.isDragging = false;
      container.style.cursor = 'grab';
    }
  });

  // Touch support for Mobile Devices (Single-finger drag)
  let touchStartX = 0;
  let touchStartY = 0;
  
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      state.isDragging = true;
      touchStartX = e.touches[0].clientX - state.panX;
      touchStartY = e.touches[0].clientY - state.panY;
    }
  }, { passive: true });
  
  container.addEventListener('touchmove', (e) => {
    if (state.isDragging && e.touches.length === 1) {
      state.panX = e.touches[0].clientX - touchStartX;
      state.panY = e.touches[0].clientY - touchStartY;
      applyViewportTransform();
    }
  }, { passive: true });
  
  container.addEventListener('touchend', () => {
    state.isDragging = false;
  });

  // Trackpad / Mouse Scroll Wheel Zoom (Centered)
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    // Zoom sensitivity factor
    const zoomFactor = 0.06;
    let oldScale = state.zoomScale;
    
    if (e.deltaY < 0) {
      state.zoomScale = Math.min(2.5, state.zoomScale + zoomFactor);
    } else {
      state.zoomScale = Math.max(0.25, state.zoomScale - zoomFactor);
    }
    
    // Keep panning offset scaled relative to zoom to prevent major shifting
    if (oldScale !== state.zoomScale) {
      applyViewportTransform();
    }
  }, { passive: false });

  // Grid Guideline Tracker (Rulers)
  canvas.addEventListener('mousemove', (e) => {
    const tile = e.target.closest('.grid-tile');
    if (!tile) {
      DOM.axisGuideX.style.display = 'none';
      DOM.axisGuideY.style.display = 'none';
      return;
    }
    
    // Position guidelines relative to viewport
    const containerRect = container.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    
    const tileCenterX = tileRect.left + tileRect.width / 2 - containerRect.left;
    const tileCenterY = tileRect.top + tileRect.height / 2 - containerRect.top;
    
    DOM.axisGuideX.style.top = `${tileCenterY}px`;
    DOM.axisGuideX.style.display = 'block';
    
    DOM.axisGuideY.style.left = `${tileCenterX}px`;
    DOM.axisGuideY.style.display = 'block';
  });
  
  canvas.addEventListener('mouseleave', () => {
    DOM.axisGuideX.style.display = 'none';
    DOM.axisGuideY.style.display = 'none';
  });

  // Button Zoom Hookups
  DOM.btnZoomIn.addEventListener('click', () => {
    state.zoomScale = Math.min(2.5, state.zoomScale + 0.2);
    playSynthClick();
    applyViewportTransform();
  });
  
  DOM.btnZoomOut.addEventListener('click', () => {
    state.zoomScale = Math.max(0.25, state.zoomScale - 0.2);
    playSynthClick();
    applyViewportTransform();
  });
  
  DOM.btnZoomReset.addEventListener('click', () => {
    state.zoomScale = 0.85;
    state.panX = 0;
    state.panY = 0;
    playSynthClick();
    applyViewportTransform();
  });
  
  // Center grid canvas initially
  applyViewportTransform();
}

function applyViewportTransform() {
  // Apply direct GPU acceleration translate3d & scale transforms
  DOM.gridCanvas.style.transform = `translate(calc(-50% + ${state.panX}px), calc(-50% + ${state.panY}px)) scale(${state.zoomScale})`;
}

// --- 5. TACTICAL GRID COORDINATES HELPER ---
function getColLetter(colIndex) {
  // Generates spreadsheet labels: A-Z, then AA-AN (for grid size 40)
  if (colIndex < 26) {
    return String.fromCharCode(65 + colIndex);
  } else {
    return 'A' + String.fromCharCode(65 + (colIndex - 26));
  }
}

function getTileCoordinatesString(x, y) {
  const col = getColLetter(x);
  const row = (y + 1).toString().padStart(2, '0');
  return `${col}-${row}`;
}

// --- 6. REAL-TIME WEBSOCKET PIPELINE ---
let socket = null;
let reconnectTimeout = null;
let reconnectDelay = 1000;

function connectWS() {
  if (socket) {
    socket.close();
  }
  
  // Dynamically target WS port based on active web host
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = window.location.hostname || 'localhost';
  
  let defaultWsUri = `${wsProtocol}//${wsHost}:5174`;
  // If running on a live cloud host (like Netlify or Vercel), route to Render backend by default
  if (wsHost !== 'localhost' && wsHost !== '127.0.0.1' && !wsHost.startsWith('192.168.')) {
    defaultWsUri = 'wss://terratile-backend.onrender.com';
  }
  
  const wsUri = state.wsGatewayUrl || defaultWsUri;
  
  setConnectionStatus('connecting');
  
  socket = new WebSocket(wsUri);
  
  socket.onopen = () => {
    console.log("[WS] Secure link established.");
    setConnectionStatus('online');
    reconnectDelay = 1000; // Reset reconnect exponential backoff
    
    // Register player registration packet
    sendWSMessage({
      type: 'join',
      player_id: state.playerId,
      name: state.playerName,
      color: state.playerColor
    });
    
    // Initialize latency ping sweeps
    startPingSweep();
  };
  
  socket.onmessage = (event) => {
    try {
      const packet = JSON.parse(event.data);
      handleWSPacket(packet);
    } catch (err) {
      console.error("[WS] Error reading incoming packet:", err);
    }
  };
  
  socket.onerror = (err) => {
    console.error("[WS] Connection channel error:", err);
  };
  
  socket.onclose = () => {
    console.warn("[WS] Connection lost. Commencing re-link sweep...");
    setConnectionStatus('offline');
    stopPingSweep();
    
    // Queue reconnect with progressive exponential backoff
    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
      reconnectDelay = Math.min(10000, reconnectDelay * 1.5);
      connectWS();
    }, reconnectDelay);
  };
}

function sendWSMessage(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function setConnectionStatus(status) {
  DOM.connStatusDot.className = 'status-dot';
  
  if (status === 'online') {
    DOM.connStatusDot.classList.add('online');
    DOM.connStatusText.innerText = 'ONLINE';
    DOM.heroOnlineCount.innerText = 'GRID SYSTEM LINKED';
    DOM.btnEnterGrid.disabled = false;
  } else if (status === 'connecting') {
    DOM.connStatusDot.classList.add('reconnecting');
    DOM.connStatusText.innerText = 'LINKING...';
    DOM.heroOnlineCount.innerText = 'LINKING SYSTEM...';
  } else {
    DOM.connStatusText.innerText = 'OFFLINE';
    DOM.heroOnlineCount.innerText = 'GRID TELEMETRY STANDBY';
    showToast('Network interface lost. Attempting sync...', 'warn');
  }
}

// Latency Ping-Pong sweeps
function startPingSweep() {
  clearInterval(state.pingInterval);
  state.pingInterval = setInterval(() => {
    state.lastPingTimestamp = Date.now();
    sendWSMessage({
      type: 'ping',
      timestamp: state.lastPingTimestamp
    });
  }, 5000);
}

function stopPingSweep() {
  clearInterval(state.pingInterval);
  DOM.latencyVal.innerText = '-- ms';
}

// --- 7. WEBSOCKET PACKET DISPATCHER ---
function handleWSPacket(packet) {
  switch (packet.type) {
    case 'init':
      // Store local player session variables returned by server
      state.playerId = packet.player_id;
      state.playerName = packet.name;
      state.playerColor = packet.color;
      
      localStorage.setItem('terratile_player_id', state.playerId);
      localStorage.setItem('terratile_name', state.playerName);
      localStorage.setItem('terratile_color', state.playerColor);
      
      // Update config inputs to match
      DOM.playerNameInput.value = state.playerName;
      updateProfilePreview();
      
      // Load board tiles
      state.gridSize = packet.grid_size;
      buildGridCanvasDOM(packet.grid);
      
      // Sync players and telemetry events list
      state.players = packet.players;
      state.logs = packet.logs;
      
      rebuildLeaderboard();
      rebuildTelemetryFeed();
      syncGlobalHUDMetrics();
      
      // Set static preview log in landing screen
      if (state.logs.length > 0) {
        const latest = state.logs[state.logs.length - 1];
        DOM.heroTicker.innerText = `● [${latest.type.toUpperCase()}] ${latest.msg}`;
      }
      break;
      
    case 'player_join':
    case 'player_leave':
      state.players = packet.players;
      if (packet.logs) {
        state.logs = packet.logs;
        rebuildTelemetryFeed();
      }
      rebuildLeaderboard();
      syncGlobalHUDMetrics();
      break;
      
    case 'tile_update':
      // Extract tile details
      const newTile = packet.tile;
      state.gridTiles[newTile.id] = newTile;
      state.players = packet.players;
      state.logs = packet.logs;
      
      // Re-render target cell and trigger micro-animations
      updateSingleTileDOM(newTile.id, true);
      
      // Trigger neighboring vibration ripple
      triggerNeighborVibration(newTile.id);
      
      rebuildLeaderboard();
      rebuildTelemetryFeed();
      syncGlobalHUDMetrics();
      
      // Update selected HUD details if the modified cell is currently active
      if (state.selectedTileId === newTile.id) {
        selectTile(newTile.id);
      }
      break;
      
    case 'victory':
      // Sync the fresh wiped grid, players and logs
      state.players = packet.players;
      state.logs = packet.logs;
      
      packet.grid.forEach(cell => {
        state.gridTiles[cell.id] = cell;
        updateSingleTileDOM(cell.id, false);
      });
      
      rebuildLeaderboard();
      rebuildTelemetryFeed();
      syncGlobalHUDMetrics();
      
      // Open the victory modal popup for all active operators
      declareVictory(packet.victor);
      break;
      
    case 'claim_ack':
      if (packet.success) {
        playSynthStamp();
        // Activate Cooldown Rates (local validation)
        triggerLocalRateLimit(packet.cooldown);
        showToast('Terratile captured successfully.', 'success');
      }
      break;
      
    case 'cooldown_reject':
      playSynthWarning();
      triggerLocalRateLimit(packet.remaining);
      showToast('Rate limit: Cool down active.', 'warn');
      break;
      
    case 'profile_changed':
      state.players = packet.players;
      state.logs = packet.logs;
      
      // Re-sync all tiles mapping to this updated profile
      packet.grid.forEach(cell => {
        state.gridTiles[cell.id] = cell;
        updateSingleTileDOM(cell.id, false);
      });
      
      rebuildLeaderboard();
      rebuildTelemetryFeed();
      syncGlobalHUDMetrics();
      break;
      
    case 'pong':
      // Calculate latency metrics
      const pingMs = Date.now() - packet.timestamp;
      DOM.latencyVal.innerText = `${pingMs} ms`;
      break;
  }
}

// --- 8. DOM ELEMENT GENERATION & SYNCING ---

// Construct the 1600 cell elements inside the grid canvas dynamically
function buildGridCanvasDOM(tilesList) {
  const canvas = DOM.gridCanvas;
  canvas.innerHTML = '';
  
  state.gridTiles = {};
  
  // Arrange tiles ordered by their mathematical coordinate index values
  tilesList.sort((a, b) => a.id - b.id);
  
  tilesList.forEach(tile => {
    state.gridTiles[tile.id] = tile;
    
    const div = document.createElement('div');
    div.className = 'grid-tile';
    div.id = `tile-${tile.id}`;
    div.dataset.tileId = tile.id;
    
    // Overlay player label
    const label = document.createElement('span');
    label.className = 'grid-tile-label';
    div.appendChild(label);
    
    canvas.appendChild(div);
    
    // Sync style mapping
    updateSingleTileDOM(tile.id, false);
  });
  
  // Coordinate interaction listeners
  canvas.addEventListener('click', (e) => {
    const tileElement = e.target.closest('.grid-tile');
    if (!tileElement) return;
    
    const tileId = parseInt(tileElement.dataset.tileId);
    selectTile(tileId);
    
    // Auto-capture instantly on click! No extra button clicking required.
    triggerCaptureCommand();
  });
}

// Perform focused DOM styling refreshes on a single grid tile
function updateSingleTileDOM(tileId, shouldAnimate) {
  const tile = state.gridTiles[tileId];
  const el = document.getElementById(`tile-${tileId}`);
  if (!el) return;
  
  const labelEl = el.querySelector('.grid-tile-label');
  
  if (tile.owner_id) {
    el.className = 'grid-tile claimed';
    el.style.backgroundColor = tile.owner_color;
    el.style.setProperty('--tile-aura-color', tile.owner_color);
    
    // Assign 2-letter uppercase initials on tile labels
    const initials = tile.owner_name ? tile.owner_name.substring(0, 2).toUpperCase() : 'OP';
    labelEl.innerText = initials;
    
    if (shouldAnimate) {
      el.classList.add('capture-fill');
      el.classList.add('tile-pulse');
      setTimeout(() => {
        el.classList.remove('capture-fill');
        el.classList.remove('tile-pulse');
      }, 500);
    }
  } else {
    el.className = 'grid-tile';
    el.style.backgroundColor = 'transparent';
    labelEl.innerText = '';
  }
  
  // Preserve selected border wrapper if targeted
  if (state.selectedTileId === tileId) {
    el.classList.add('selected');
  }
}

// Select cell coordinates
function selectTile(tileId) {
  // Deselect previous
  if (state.selectedTileId !== null) {
    const prev = document.getElementById(`tile-${state.selectedTileId}`);
    if (prev) prev.classList.remove('selected');
  }
  
  state.selectedTileId = tileId;
  const el = document.getElementById(`tile-${tileId}`);
  if (el) el.classList.add('selected');
  
  const tile = state.gridTiles[tileId];
  const coords = getTileCoordinatesString(tile.x, tile.y);
  
  // Update HUD values
  DOM.currentCoordsIndicator.innerText = `AXIS: ${coords}`;
  DOM.hudTileCoord.innerText = coords;
  
  if (tile.owner_id) {
    DOM.hudTileStatus.innerText = `TERRITORY SECURED BY ${tile.owner_name.toUpperCase()}`;
    DOM.hudTileStatus.style.color = tile.owner_color;
  } else {
    DOM.hudTileStatus.innerText = 'AWAITING CONQUEST';
    DOM.hudTileStatus.style.color = 'var(--text-secondary)';
  }
  
  // Enable capture CTA button if link is online
  const isOnline = socket && socket.readyState === WebSocket.OPEN;
  DOM.btnCaptureTile.disabled = !isOnline || state.cooldownActive;
}

// Ripples neighboring tiles when capturing
function triggerNeighborVibration(tileId) {
  const tile = state.gridTiles[tileId];
  const x = tile.x;
  const y = tile.y;
  const size = state.gridSize;
  
  // 4 cardinal adjacent tiles
  const neighbors = [
    { x: x - 1, y: y }, // Left
    { x: x + 1, y: y }, // Right
    { x: x, y: y - 1 }, // Top
    { x: x, y: y + 1 }  // Bottom
  ];
  
  neighbors.forEach(n => {
    if (n.x >= 0 && n.x < size && n.y >= 0 && n.y < size) {
      const nId = n.y * size + n.x;
      const nEl = document.getElementById(`tile-${nId}`);
      if (nEl) {
        nEl.classList.add('neighbor-react');
        setTimeout(() => nEl.classList.remove('neighbor-react'), 200);
      }
    }
  });
}

// --- Contiguous BFS Graph calculation for 30 Connected Tiles Victory ---
function getLargestConnectedTerritorySizes() {
  const size = state.gridSize || 40;
  const total = size * size;
  const visited = new Set();
  const maxConnected = {};
  
  // Initialize for all active players
  state.players.forEach(p => {
    maxConnected[p.id] = 0;
  });
  
  for (let i = 0; i < total; i++) {
    const tile = state.gridTiles[i];
    if (!tile || !tile.owner_id || visited.has(i)) continue;
    
    const ownerId = tile.owner_id;
    let componentSize = 0;
    const queue = [i];
    visited.add(i);
    
    while (queue.length > 0) {
      const currId = queue.shift();
      componentSize++;
      
      const cx = currId % size;
      const cy = Math.floor(currId / size);
      
      const neighbors = [];
      if (cy > 0) neighbors.push(currId - size);
      if (cy < size - 1) neighbors.push(currId + size);
      if (cx > 0) neighbors.push(currId - 1);
      if (cx < size - 1) neighbors.push(currId + 1);
      
      neighbors.forEach(nId => {
        const nTile = state.gridTiles[nId];
        if (nTile && nTile.owner_id === ownerId && !visited.has(nId)) {
          visited.add(nId);
          queue.push(nId);
        }
      });
    }
    
    maxConnected[ownerId] = Math.max(maxConnected[ownerId] || 0, componentSize);
  }
  
  return maxConnected;
}

function calculateTerritoryMetrics() {
  const maxConnectedSizes = getLargestConnectedTerritorySizes();
  state.players.forEach(p => {
    p.maxConnected = maxConnectedSizes[p.id] || 0;
  });
}

// Leaderboard list generation using tactical typewriter typography
function rebuildLeaderboard() {
  const container = DOM.leaderboardList;
  container.innerHTML = '';
  
  if (state.players.length === 0) {
    container.innerHTML = `<div class="leaderboard-empty">No matrix logs detected.</div>`;
    return;
  }
  
  // Calculate largest connected chain size metrics for all players
  calculateTerritoryMetrics();
  
  // Sort players by largest connected chain descending, with total score as a tie-breaker
  const sorted = [...state.players].sort((a, b) => {
    const diff = (b.maxConnected || 0) - (a.maxConnected || 0);
    if (diff !== 0) return diff;
    return b.score - a.score;
  });
  
  sorted.forEach((player, index) => {
    const isMe = player.id === state.playerId;
    const rankStr = (index + 1).toString().padStart(2, '0');
    
    const row = document.createElement('div');
    row.className = `leaderboard-row ${isMe ? 'current-player' : ''}`;
    
    row.innerHTML = `
      <div class="leaderboard-rank-name">
        <span class="leaderboard-rank">${rankStr}</span>
        <span class="leaderboard-name-badge">
          <span class="leaderboard-color-indicator" style="background-color: ${player.color}"></span>
          ${escapeHTML(player.name)} ${player.online_status === 'offline' ? '<span class="status-text">(AWAY)</span>' : ''}
        </span>
      </div>
      <span class="leaderboard-score" style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2;">
        <span style="font-weight: 700; font-size: 13px;">${player.maxConnected || 0} <span style="font-size: 8px; color: var(--text-secondary);">CHN</span></span>
        <span style="font-size: 9px; color: var(--text-secondary);">${player.score} <span style="font-size: 7px;">TOT</span></span>
      </span>
    `;
    
    container.appendChild(row);
  });
}

// Live stock ticker activity feed (sidebar right)
function rebuildTelemetryFeed() {
  const container = DOM.liveFeedTicker;
  container.innerHTML = '';
  
  // Display logs starting from most recent
  const sortedLogs = [...state.logs].reverse();
  
  sortedLogs.forEach(log => {
    const entry = document.createElement('div');
    entry.className = `ticker-entry ${log.type}`;
    
    const timeStr = new Date(log.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    entry.innerHTML = `
      <div class="ticker-meta">
        <span>LOG//${log.id.toUpperCase()}</span>
        <span>${timeStr}</span>
      </div>
      <div class="ticker-msg">${escapeHTML(log.msg)}</div>
    `;
    
    container.appendChild(entry);
  });
}

// Synchronize main application statistics dashboard
function syncGlobalHUDMetrics() {
  // Count conquered percentage
  const totalTiles = state.gridSize * state.gridSize;
  let conqueredCount = 0;
  
  Object.values(state.gridTiles).forEach(tile => {
    if (tile.owner_id) conqueredCount++;
  });
  
  const ratioPercent = Math.round((conqueredCount / totalTiles) * 100);
  DOM.conqueredRatio.innerText = `${ratioPercent}%`;
  
  // Count active players online
  let activeCount = 0;
  state.players.forEach(p => {
    if (p.online_status === 'online') activeCount++;
  });
  DOM.liveOperators.innerText = activeCount;
  
  // Recalculate contiguous metrics for all active players
  calculateTerritoryMetrics();
  
  // --- VICTORY CONDITION CHECKS ---
  let victor = null;
  
  // Connected Territory Victory: First player to build a CONNECTED territory of 30 tiles wins!
  state.players.forEach(p => {
    if (p.maxConnected >= 30) {
      victor = p;
    }
  });
  
  // Victory Option B: All 1,600 tiles captured (Majority contiguous chain size wins, with total score as tie-breaker!)
  if (conqueredCount === totalTiles && totalTiles > 0) {
    let maxConnectedChain = -1;
    let maxTotalScore = -1;
    state.players.forEach(p => {
      const chain = p.maxConnected || 0;
      if (chain > maxConnectedChain || (chain === maxConnectedChain && p.score > maxTotalScore)) {
        maxConnectedChain = chain;
        maxTotalScore = p.score;
        victor = p;
      }
    });
  }
  
  if (victor && !state.victoryDeclared) {
    declareVictory(victor);
  } else if (!victor) {
    // Reset victory declared flag if grid resets or scores drop below threshold
    state.victoryDeclared = false;
  }
}

// --- 9. PROFILE IDENTITY SETUP CONTROLLER ---
function initProfileConfig() {
  const grid = DOM.auraColorsGrid;
  grid.innerHTML = '';
  
  // Inject Earthy Color Selector Buttons dynamically
  AURA_COLORS.forEach(color => {
    const opt = document.createElement('div');
    opt.className = 'color-option';
    opt.style.color = color.hex;
    opt.dataset.colorHex = color.hex;
    opt.title = color.name;
    
    if (state.playerColor === color.hex) {
      opt.classList.add('selected');
    }
    
    opt.addEventListener('click', () => {
      // Unselect previous
      const selected = grid.querySelector('.color-option.selected');
      if (selected) selected.classList.remove('selected');
      
      opt.classList.add('selected');
      state.playerColor = color.hex;
      playSynthClick();
      updateProfilePreview();
    });
    
    grid.appendChild(opt);
  });
  
  // Watch Display Name Changes
  DOM.playerNameInput.addEventListener('input', (e) => {
    state.playerName = e.target.value.trim();
    updateProfilePreview();
  });
  
  // Identity submission logic
  DOM.btnUpdateProfile.addEventListener('click', () => {
    const inputVal = DOM.playerNameInput.value.trim();
    if (!inputVal) {
      showToast('Nickname cannot be blank.', 'warn');
      playSynthWarning();
      return;
    }
    
    state.playerName = inputVal;
    
    // Save to local storage
    localStorage.setItem('terratile_name', state.playerName);
    localStorage.setItem('terratile_color', state.playerColor);
    
    // Synchronize updates over WebSocket
    sendWSMessage({
      type: 'profile_update',
      name: state.playerName,
      color: state.playerColor
    });
    
    playSynthStamp();
    showToast('Identity telemetry synchronized.', 'success');
  });
  
  // Session reset handler
  if (DOM.btnResetIdentity) {
    DOM.btnResetIdentity.addEventListener('click', () => {
      localStorage.removeItem('terratile_player_id');
      localStorage.removeItem('terratile_name');
      localStorage.removeItem('terratile_color');
      playSynthWarning();
      showToast('Generating new session...', 'info');
      setTimeout(() => window.location.reload(), 600);
    });
  }
  
  updateProfilePreview();
}

function updateProfilePreview() {
  DOM.auraPreviewName.innerText = state.playerName || 'UNASSIGNED';
  DOM.auraPreviewDot.style.backgroundColor = state.playerColor;
}

// --- 10. TACTICAL LOCAL RATE COOLDOWN SYSTEM ---
function triggerLocalRateLimit(durationSec) {
  state.cooldownActive = true;
  DOM.btnCaptureTile.disabled = true;
  
  const span = DOM.btnCaptureTile.querySelector('span');
  if (span) span.innerText = 'SYSTEM COOLDOWN';
  
  // Toggle shaking alerts if cooldown activated
  const selTile = document.getElementById(`tile-${state.selectedTileId}`);
  if (selTile) {
    selTile.classList.add('cooldown-alert');
    setTimeout(() => selTile.classList.remove('cooldown-alert'), 300);
  }
  
  state.cooldownStart = Date.now();
  state.cooldownDuration = durationSec * 1000;
  
  clearInterval(state.cooldownTimer);
  
  state.cooldownTimer = setInterval(() => {
    const elapsed = Date.now() - state.cooldownStart;
    const remainingRatio = Math.max(0, 1 - (elapsed / state.cooldownDuration));
    
    DOM.btnCaptureTile.style.setProperty('--cooldown-percent', `${remainingRatio * 100}%`);
    
    if (elapsed >= state.cooldownDuration) {
      clearInterval(state.cooldownTimer);
      state.cooldownActive = false;
      DOM.btnCaptureTile.style.setProperty('--cooldown-percent', '0%');
      if (span) span.innerText = 'READY FOR CONQUEST';
      
      const isOnline = socket && socket.readyState === WebSocket.OPEN;
      if (isOnline && state.selectedTileId !== null) {
        DOM.btnCaptureTile.disabled = false;
      }
    }
  }, 16); // ~60fps cooldown progress tracking
}

// --- 11. CLICK COMMANDS & MICRO ACTIONS ---
function triggerCaptureCommand() {
  if (state.selectedTileId === null) return;
  if (state.cooldownActive) {
    playSynthWarning();
    showToast('Capture offline: Cooldown active.', 'warn');
    return;
  }
  
  // Submit claims packet over WebSocket pipeline
  sendWSMessage({
    type: 'claim',
    tile_id: state.selectedTileId
  });
}

DOM.btnCaptureTile.addEventListener('click', () => {
  triggerCaptureCommand();
});

// Toast notification helper
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  
  DOM.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Escape helper to prevent layout injection attacks
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// --- 12. INITIALIZATION CONTROLLERS ---
function initApp() {
  // Audio consent handler
  const consent = localStorage.getItem('terratile_acoustics');
  if (consent) {
    DOM.audioConsent.classList.add('hidden');
    if (consent === 'enabled') {
      initAudio();
    }
  }
  
  DOM.btnSoundOn.addEventListener('click', () => {
    localStorage.setItem('terratile_acoustics', 'enabled');
    DOM.audioConsent.classList.add('hidden');
    initAudio();
    playSynthClick();
    dismissHeroAndLaunch();
  });
  
  DOM.btnSoundOff.addEventListener('click', () => {
    localStorage.setItem('terratile_acoustics', 'disabled');
    DOM.audioConsent.classList.add('hidden');
    state.soundEnabled = false;
    dismissHeroAndLaunch();
  });

  DOM.btnEnterGrid.addEventListener('click', () => {
    playSynthClick();
    dismissHeroAndLaunch();
  });
  
  // Wire components
  initViewportEngine();
  initProfileConfig();

  // Victory Modal close button listener
  if (DOM.btnVictoryClose) {
    DOM.btnVictoryClose.addEventListener('click', () => {
      DOM.victoryModal.classList.remove('active');
      playSynthClick();
    });
  }

  // System Bridge Gateway
  if (DOM.wsBridgeInput) {
    DOM.wsBridgeInput.value = state.wsGatewayUrl;
    DOM.wsBridgeInput.placeholder = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
      ? 'ws://localhost:5174' 
      : 'wss://terratile-backend.onrender.com';
    
    DOM.btnSaveBridge.addEventListener('click', () => {
      let gatewayVal = DOM.wsBridgeInput.value.trim();
      
      // Auto-sanitize copy-pasted HTTP protocols to WebSocket protocols
      if (gatewayVal.startsWith('http://')) {
        gatewayVal = gatewayVal.replace('http://', 'ws://');
      } else if (gatewayVal.startsWith('https://')) {
        gatewayVal = gatewayVal.replace('https://', 'wss://');
      }
      
      state.wsGatewayUrl = gatewayVal;
      DOM.wsBridgeInput.value = gatewayVal; // Update input field to show the sanitized wss:// protocol
      
      if (gatewayVal) {
        localStorage.setItem('terratile_ws_gateway', gatewayVal);
        showToast('System bridge configured.', 'success');
      } else {
        localStorage.removeItem('terratile_ws_gateway');
        showToast('Bridge reset to dynamic local routing.', 'info');
      }
      
      playSynthStamp();
      connectWS();
    });
  }
  
  // Start background WS pipelines
  connectWS();
}

function dismissHeroAndLaunch() {
  DOM.heroOverlay.classList.add('dismissed');
  
  // Attempt to trigger AudioContext creation on first interaction
  if (state.soundEnabled) {
    initAudio();
  }
}

// Start everything when DOM completes loading
window.addEventListener('DOMContentLoaded', initApp);
