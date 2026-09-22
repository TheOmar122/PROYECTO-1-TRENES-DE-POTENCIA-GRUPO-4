/**
 * Analizador Interactivo del Mapa de Rendimiento (BSFC) y Dinámica Longitudinal
 * Volvo S40 / V40 2.0T | Trenes de Potencia
 */

// Bounding Box exacto identificado en Imagen1.png (resolución nativa: 372x292 px)
const BOUNDING_BOX = {
  naturalWidth: 372,
  naturalHeight: 292,
  xMin: 47,   // 1000 RPM
  xMax: 314,  // 6000 RPM
  yMin: 17,   // 18 bar / 180 kW (borde superior)
  yMax: 242   // 0 bar / 0 kW (borde inferior)
};

// Relaciones de transmisión según marcha (Volvo S40/V40 M5P/M5D)
const DEFAULT_GEAR_RATIOS = {
  "1": 3.07,
  "2": 1.77,
  "3": 1.19,
  "4": 0.87,
  "5": 0.70
};

// Estado global de la aplicación
const state = {
  hasValidPoint: false,
  nativeX: null,
  nativeY: null,
  rpm: 2800,
  pme: 12.0,
  torque: 191.0,
  power: 56.0,
  powerScale: 120.0,
  bsfc: 255.0,
  efficiency: 32.8,
  speedKmh: 115.9,
  speedMs: 32.2,
  currentGear: "5",
  currentRt: 0.70,
  finalDrive: 4.00,
  transmissionEfficiency: 0.90,
  tire: {
    sizeStr: "205/55R16",
    widthMm: 205,
    aspectRatio: 55,
    rimInch: 16,
    diameterMm: 631.9,
    diameterM: 0.6319,
    dynamicRadiusM: 0.3075,
    perimeterM: 1.9320
  },
  vehicle: {
    massKg: 1350,
    cd: 0.31,
    afM2: 2.08,
    fr: 0.013,
    slopePct: 0.0,
    airDensity: 1.20,
    fuelDensity: 0.745 // kg/L
  },
  dynamics: {
    ft: 1565,
    wheelTorque: 481.3,
    faero: 401,
    froll: 172,
    fslope: 0,
    fres: 574,
    accel: 0.73,
    vsp: 37.3,
    fuelLh: 19.17,
    fuelKgh: 14.28,
    fuelL100km: 16.53
  }
};

// Elementos DOM del Mapa y UI
const engineMapImg = document.getElementById('engineMapImg');
const mapStage = document.getElementById('mapStage');
const bboxGuide = document.getElementById('bboxGuide');
const clickMarker = document.getElementById('clickMarker');
const hoverTooltip = document.getElementById('hoverTooltip');
const toastAlert = document.getElementById('toastAlert');
const toggleGuideCheckbox = document.getElementById('toggleGuide');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');

// Entradas de Parámetros
const gearSelect = document.getElementById('gearSelect');
const inpRF = document.getElementById('inpRF');
const inpEtaT = document.getElementById('inpEtaT');
const inpCurrentRt = document.getElementById('inpCurrentRt');

const inpTireSize = document.getElementById('inpTireSize');
const dispTireD = document.getElementById('dispTireD');
const dispTireRdin = document.getElementById('dispTireRdin');
const dispTireP = document.getElementById('dispTireP');
const dispTireDims = document.getElementById('dispTireDims');

const inpMass = document.getElementById('inpMass');
const inpCd = document.getElementById('inpCd');
const inpAf = document.getElementById('inpAf');
const inpFr = document.getElementById('inpFr');
const inpSlope = document.getElementById('inpSlope');
const inpRho = document.getElementById('inpRho');

// Elementos de Salida
const valRpm = document.getElementById('valRpm');
const valTorque = document.getElementById('valTorque');
const valPme = document.getElementById('valPme');
const valPower = document.getElementById('valPower');
const valHp = document.getElementById('valHp');
const valPowerScale = document.getElementById('valPowerScale');
const valBsfc = document.getElementById('valBsfc');
const valEfficiency = document.getElementById('valEfficiency');
const efficiencyBar = document.getElementById('efficiencyBar');
const bsfcCard = document.getElementById('bsfcCard');
const opZoneBadge = document.getElementById('opZoneBadge');

const valFuelL = document.getElementById('valFuelL');
const valFuelKg = document.getElementById('valFuelKg');
const valFuel100km = document.getElementById('valFuel100km');

const valSpeed = document.getElementById('valSpeed');
const valSpeedMs = document.getElementById('valSpeedMs');
const valGearDisplay = document.getElementById('valGearDisplay');
const valTractionForce = document.getElementById('valTractionForce');
const valWheelTorque = document.getElementById('valWheelTorque');

const valFaero = document.getElementById('valFaero');
const valFroll = document.getElementById('valFroll');
const valFslope = document.getElementById('valFslope');
const valFresTotal = document.getElementById('valFresTotal');

const balanceCard = document.getElementById('balanceCard');
const balanceBadge = document.getElementById('balanceBadge');
const balanceText = document.getElementById('balanceText');
const dispFt = document.getElementById('dispFt');
const dispFres = document.getElementById('dispFres');
const valAccel = document.getElementById('valAccel');
const valVsp = document.getElementById('valVsp');
const valVspKwt = document.getElementById('valVspKwt');

// Modal Institucional y Temas
const themeSelect = document.getElementById('themeSelect');
const openEditModalBtn = document.getElementById('openEditModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const editModal = document.getElementById('editModal');
const metaForm = document.getElementById('metaForm');

const dispUni = document.getElementById('dispUni');
const dispFac = document.getElementById('dispFac');
const dispMat = document.getElementById('dispMat');
const dispDoc = document.getElementById('dispDoc');
const dispInt = document.getElementById('dispInt');
const dispTem = document.getElementById('dispTem');

const inpUni = document.getElementById('inpUni');
const inpFac = document.getElementById('inpFac');
const inpMat = document.getElementById('inpMat');
const inpDoc = document.getElementById('inpDoc');
const inpInt = document.getElementById('inpInt');
const inpTem = document.getElementById('inpTem');

let initialized = false;
function init() {
  if (initialized) return;
  initialized = true;

  initTheme();
  loadSavedMetadata();
  initEventListeners();
  parseTireSize(inpTireSize ? inpTireSize.value : "205/55R16");
  setupBoundingBoxOverlay();

  // Por defecto, cargar el punto de máxima eficiencia para guiar al usuario
  selectPreset('optimal');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/**
 * Gestión de Temas
 */
function initTheme() {
  const savedTheme = localStorage.getItem('engine_analyzer_theme') || 'theme-obsidian-gold';
  applyTheme(savedTheme);

  if (themeSelect) {
    themeSelect.value = savedTheme;
    themeSelect.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });
  }
}

function applyTheme(themeName) {
  document.body.className = themeName;
  if (themeSelect) themeSelect.value = themeName;
  try {
    localStorage.setItem('engine_analyzer_theme', themeName);
  } catch (e) {}
}

/**
 * Gestión de Pestañas de Parámetros
 */
window.switchParamTab = function(tabId) {
  document.querySelectorAll('.ptab-btn').forEach(btn => {
    const attr = btn.getAttribute('onclick') || '';
    btn.classList.toggle('active', attr.includes(tabId));
  });
  document.querySelectorAll('.ptab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId);
  });
};

/**
 * Gestión de Diagramas Técnicos
 */
window.switchDiagramTab = function(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const attr = btn.getAttribute('onclick') || '';
    btn.classList.toggle('active', attr.includes(tabId));
  });
  document.querySelectorAll('.diagram-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId);
  });
};

/**
 * Cálculo del Neumático a partir del código estándar (ej: 205/55R16)
 */
function parseTireSize(str) {
  const regex = /(\d{3})\/(\d{2})\s*[rR\-]?\s*(\d{2})/;
  const match = str.match(regex);

  if (match) {
    const width = parseFloat(match[1]);
    const aspect = parseFloat(match[2]);
    const rimInch = parseFloat(match[3]);

    const flangeHeightMm = width * (aspect / 100.0);
    const rimMm = rimInch * 25.4;
    const diameterMm = rimMm + (2.0 * flangeHeightMm);
    const diameterM = diameterMm / 1000.0;
    const staticRadiusM = diameterM / 2.0;

    // Radio dinámico con deflexión elástica del 2.66% (~0.9734) que reproduce el perímetro de 1.9320 m
    const dynamicRadiusM = staticRadiusM * 0.9734;
    const perimeterM = 2.0 * Math.PI * dynamicRadiusM;

    state.tire = {
      sizeStr: `${width}/${aspect}R${rimInch}`,
      widthMm: width,
      aspectRatio: aspect,
      rimInch: rimInch,
      diameterMm: diameterMm,
      diameterM: diameterM,
      dynamicRadiusM: dynamicRadiusM,
      perimeterM: perimeterM
    };

    if (dispTireD) dispTireD.textContent = `${diameterMm.toFixed(1)} mm (${diameterM.toFixed(3)} m)`;
    if (dispTireRdin) dispTireRdin.textContent = `${dynamicRadiusM.toFixed(4)} m (${(dynamicRadiusM * 1000).toFixed(1)} mm)`;
    if (dispTireP) dispTireP.textContent = `${perimeterM.toFixed(4)} m`;
    if (dispTireDims) dispTireDims.textContent = `${width} mm / ${flangeHeightMm.toFixed(1)} mm`;

    return true;
  } else {
    showToastAlert('⚠️ Formato de neumático no reconocido. Usa formato: 205/55R16');
    return false;
  }
}

window.updateTireCalculations = function() {
  if (inpTireSize && parseTireSize(inpTireSize.value)) {
    showToastAlert(`✅ Neumático calculado: ${state.tire.sizeStr} (rd = ${state.tire.dynamicRadiusM.toFixed(4)} m)`);
    updateCalculations();
  }
};

window.applyTirePreset = function(presetStr) {
  if (inpTireSize) {
    inpTireSize.value = presetStr;
    parseTireSize(presetStr);
    updateCalculations();
  }
};

/**
 * Configura los escuchadores de eventos
 */
function initEventListeners() {
  // Modal de edición institucional
  if (openEditModalBtn) openEditModalBtn.addEventListener('click', openModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeModal();
    });
  }
  if (metaForm) {
    metaForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveMetadata();
    });
  }

  // Cambio de marcha en el selector
  if (gearSelect) {
    gearSelect.addEventListener('change', (e) => {
      state.currentGear = e.target.value;
      const rt = DEFAULT_GEAR_RATIOS[state.currentGear] || 0.70;
      state.currentRt = rt;
      if (inpCurrentRt) inpCurrentRt.value = rt.toFixed(2);
      updateCalculations();
    });
  }

  // Inputs dinámicos de transmisión y vehículo
  const dynamicInputs = [inpRF, inpEtaT, inpCurrentRt, inpMass, inpCd, inpAf, inpFr, inpSlope, inpRho];
  dynamicInputs.forEach(input => {
    if (input) {
      input.addEventListener('input', () => {
        readDynamicParameters();
        updateCalculations();
      });
    }
  });

  // Clic e interacción en el mapa
  if (mapStage) {
    mapStage.addEventListener('click', handleMapClick);
    mapStage.addEventListener('mousemove', handleMapHover);
    mapStage.addEventListener('mouseleave', () => {
      if (hoverTooltip) hoverTooltip.style.display = 'none';
    });
  }

  // Toggle Bounding Box
  if (toggleGuideCheckbox && bboxGuide) {
    toggleGuideCheckbox.addEventListener('change', (e) => {
      bboxGuide.classList.toggle('hidden', !e.target.checked);
    });
  }

  window.addEventListener('resize', setupBoundingBoxOverlay);
}

/**
 * Lee los valores actuales de los inputs de vehículo y entorno
 */
function readDynamicParameters() {
  if (inpRF) state.finalDrive = parseFloat(inpRF.value) || 4.0;
  if (inpEtaT) state.transmissionEfficiency = parseFloat(inpEtaT.value) || 0.90;
  if (inpCurrentRt) state.currentRt = parseFloat(inpCurrentRt.value) || 0.70;

  if (inpMass) state.vehicle.massKg = parseFloat(inpMass.value) || 1350;
  if (inpCd) state.vehicle.cd = parseFloat(inpCd.value) || 0.31;
  if (inpAf) state.vehicle.afM2 = parseFloat(inpAf.value) || 2.08;
  if (inpFr) state.vehicle.fr = parseFloat(inpFr.value) || 0.013;
  if (inpSlope) state.vehicle.slopePct = parseFloat(inpSlope.value) || 0.0;
  if (inpRho) state.vehicle.airDensity = parseFloat(inpRho.value) || 1.20;
}

/**
 * Bounding Box Overlay
 */
function setupBoundingBoxOverlay() {
  if (!bboxGuide) return;
  const leftPct = (BOUNDING_BOX.xMin / BOUNDING_BOX.naturalWidth) * 100;
  const topPct = (BOUNDING_BOX.yMin / BOUNDING_BOX.naturalHeight) * 100;
  const widthPct = ((BOUNDING_BOX.xMax - BOUNDING_BOX.xMin) / BOUNDING_BOX.naturalWidth) * 100;
  const heightPct = ((BOUNDING_BOX.yMax - BOUNDING_BOX.yMin) / BOUNDING_BOX.naturalHeight) * 100;

  bboxGuide.style.left = `${leftPct}%`;
  bboxGuide.style.top = `${topPct}%`;
  bboxGuide.style.width = `${widthPct}%`;
  bboxGuide.style.height = `${heightPct}%`;
}

/**
 * Coordenadas nativas
 */
function getNativeCoordinates(event) {
  const rect = engineMapImg.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;

  const scaleX = BOUNDING_BOX.naturalWidth / rect.width;
  const scaleY = BOUNDING_BOX.naturalHeight / rect.height;

  return {
    x: clickX * scaleX,
    y: clickY * scaleY
  };
}

function isInsideBoundingBox(x, y) {
  return (
    x >= BOUNDING_BOX.xMin &&
    x <= BOUNDING_BOX.xMax &&
    y >= BOUNDING_BOX.yMin &&
    y <= BOUNDING_BOX.yMax
  );
}

/**
 * Manejador del clic en el mapa
 */
function handleMapClick(event) {
  const coords = getNativeCoordinates(event);
  const inside = isInsideBoundingBox(coords.x, coords.y);

  if (!inside) {
    showToastAlert('⚠️ Clic fuera de la cuadrícula útil (1000-6000 RPM, 0-18 bar). Clic ignorado.');
    if (statusDot) statusDot.className = 'status-dot warning';
    if (statusText) statusText.textContent = 'Clic fuera del área de medición';
    return;
  }

  processPoint(coords.x, coords.y);
}

/**
 * Procesa un punto válido del mapa
 */
function processPoint(natX, natY) {
  state.hasValidPoint = true;
  state.nativeX = natX;
  state.nativeY = natY;

  // 1. Interpolación Eje X (RPM: 1000 a 6000)
  const tx = (natX - BOUNDING_BOX.xMin) / (BOUNDING_BOX.xMax - BOUNDING_BOX.xMin);
  state.rpm = 1000 + tx * 5000;

  // 2. Interpolación Eje Y Izquierdo (PME: 0 a 18 bar)
  const ty = (BOUNDING_BOX.yMax - natY) / (BOUNDING_BOX.yMax - BOUNDING_BOX.yMin);
  state.pme = ty * 18;

  // 3. Torque del Motor 2.0L (T = Pme * Vd / 4pi con Vd = 0.002 m^3)
  state.torque = (state.pme * 1e5 * 0.002) / (4.0 * Math.PI);

  // 4. Potencia al freno efectiva del motor: P = T * omega
  state.power = (state.torque * state.rpm * 2.0 * Math.PI) / 60000.0; // kW
  state.powerScale = ty * 180; // Escala Y der WOT

  // 5. Posicionar marcador visual
  if (clickMarker) {
    const markerXPercent = (natX / BOUNDING_BOX.naturalWidth) * 100;
    const markerYPercent = (natY / BOUNDING_BOX.naturalHeight) * 100;
    clickMarker.style.left = `${markerXPercent}%`;
    clickMarker.style.top = `${markerYPercent}%`;
    clickMarker.style.display = 'block';
  }

  // 6. Actualizar cálculos dinámicos
  updateCalculations();

  if (statusDot) statusDot.className = 'status-dot active';
  if (statusText) statusText.textContent = `Punto activo: ${Math.round(state.rpm)} RPM, ${state.pme.toFixed(1)} bar, ${state.torque.toFixed(0)} N·m`;
}

/**
 * Tooltip en movimiento sobre el mapa
 */
function handleMapHover(event) {
  if (!mapStage || !hoverTooltip) return;
  const coords = getNativeCoordinates(event);
  const inside = isInsideBoundingBox(coords.x, coords.y);

  if (!inside) {
    hoverTooltip.style.display = 'none';
    mapStage.style.cursor = 'not-allowed';
    return;
  }

  mapStage.style.cursor = 'crosshair';
  const tx = (coords.x - BOUNDING_BOX.xMin) / (BOUNDING_BOX.xMax - BOUNDING_BOX.xMin);
  const hoverRpm = Math.round(1000 + tx * 5000);

  const ty = (BOUNDING_BOX.yMax - coords.y) / (BOUNDING_BOX.yMax - BOUNDING_BOX.yMin);
  const hoverPme = ty * 18;
  const hoverTorque = (hoverPme * 1e5 * 0.002) / (4.0 * Math.PI);
  const hoverPower = (hoverTorque * hoverRpm * 2.0 * Math.PI) / 60000.0;

  const rect = mapStage.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  hoverTooltip.style.left = `${mouseX}px`;
  hoverTooltip.style.top = `${mouseY}px`;
  hoverTooltip.innerHTML = `<strong>${hoverRpm} RPM</strong> | ${hoverPme.toFixed(1)} bar | ${hoverTorque.toFixed(0)} N·m | ${hoverPower.toFixed(1)} kW`;
  hoverTooltip.style.display = 'block';
}

/**
 * Modelado de Curvas de Nivel BSFC (g/kWh)
 */
function calculateBSFC(rpm, pme) {
  const pNodes = [0.0, 1.0, 1.8, 2.8, 3.6, 4.3, 5.0, 6.0, 7.5, 9.0, 11.0, 13.0, 15.0, 18.0];
  const bNodes = [950, 680, 525, 400, 360, 330, 310, 290, 270, 260, 255,  255,  265,  285];

  const clampedP = Math.max(0, Math.min(18, pme));
  let baseBsfc = 255;

  for (let i = 0; i < pNodes.length - 1; i++) {
    if (clampedP >= pNodes[i] && clampedP <= pNodes[i + 1]) {
      const t = (clampedP - pNodes[i]) / (pNodes[i + 1] - pNodes[i]);
      const tSmooth = t * t * (3.0 - 2.0 * t);
      baseBsfc = bNodes[i] + (bNodes[i + 1] - bNodes[i]) * tSmooth;
      break;
    }
  }

  const optRpmMin = 2500;
  const optRpmMax = 3100;
  let rpmPenalty = 0;

  if (rpm < optRpmMin) {
    const d = (optRpmMin - rpm) / 1000;
    rpmPenalty = 18.0 * Math.pow(d, 1.6);
  } else if (rpm > optRpmMax) {
    const d = (rpm - optRpmMax) / 1000;
    rpmPenalty = 16.0 * Math.pow(d, 1.5);
  }

  const pFactor = Math.max(0.35, Math.min(1.0, clampedP / 10.0));
  let totalBsfc = baseBsfc + (rpmPenalty * pFactor);

  if (rpm >= 2500 && rpm <= 3050 && pme >= 11.0 && pme <= 13.0) {
    totalBsfc = 255.0;
  }

  return Math.max(255.0, Math.min(999.0, totalBsfc));
}

/**
 * Límite WOT
 */
function getWotPressure(rpm) {
  if (rpm <= 1200) return 11.8;
  if (rpm <= 2000) return 11.8 + ((rpm - 1200) / 800) * (13.5 - 11.8);
  if (rpm <= 3000) return 13.5 + ((rpm - 2000) / 1000) * (14.8 - 13.5);
  if (rpm <= 3800) return 14.8 + ((rpm - 3000) / 800) * (15.2 - 14.8);
  if (rpm <= 4500) return 15.2 - ((rpm - 3800) / 700) * (15.2 - 15.0);
  if (rpm <= 5000) return 15.0 - ((rpm - 4500) / 500) * (15.0 - 14.5);
  return 14.5 - ((rpm - 5000) / 1000) * (14.5 - 12.0);
}

/**
 * CÁLCULO INTEGRAL Y DINÁMICA LONGITUDINAL COMPLETA
 */
function updateCalculations() {
  readDynamicParameters();

  const rpm = state.rpm;
  const pme = state.pme;
  const torque = state.torque;
  const power = state.power;

  const Rt = state.currentRt;
  const RF = state.finalDrive;
  const eta_t = state.transmissionEfficiency;
  const rd = state.tire.dynamicRadiusM;

  const mass = state.vehicle.massKg;
  const cd = state.vehicle.cd;
  const af = state.vehicle.afM2;
  const fr = state.vehicle.fr;
  const slopePct = state.vehicle.slopePct;
  const rho = state.vehicle.airDensity;
  const g = 9.81;

  // 1. BSFC y Eficiencia Térmica
  const bsfc = calculateBSFC(rpm, pme);
  const efficiency = (83.72 / bsfc) * 100;

  // 2. Velocidad del Vehículo: V = 2pi * rpm * rd / (60 * Rt * RF)
  const v_ms = (2.0 * Math.PI * rpm * rd) / (60.0 * Rt * RF);
  const v_kmh = v_ms * 3.6;

  // 3. Fuerza de Tracción en Ruedas: Ft = (T * Rt * RF * eta_t) / rd
  const wheelTorque = torque * Rt * RF * eta_t;
  const ft = wheelTorque / rd;

  // 4. Resistencias al Movimiento:
  // a) Resistencia Aerodinámica
  const faero = 0.5 * rho * cd * af * Math.pow(v_ms, 2);

  // b) Resistencia a la Rodadura y c) Resistencia por Pendiente
  const thetaRad = Math.atan(slopePct / 100.0);
  const froll = fr * mass * g * Math.cos(thetaRad);
  const fslope = mass * g * Math.sin(thetaRad);

  // Fuerza Resistente Total
  const fres = faero + froll + fslope;

  // 5. Aceleración Disponible: a = (Ft - Fres) / m
  const accel = (ft - fres) / mass;

  // 6. Potencia Específica Vehicular (VSP): VSP = (Ft * V) / m [W/kg] (kW/t)
  const vsp = (ft * v_ms) / mass;

  // 7. Consumo de Combustible:
  // Flujo horario: L/h
  const fuelKgh = (bsfc * power) / 1000.0;
  const fuelLh = fuelKgh / state.vehicle.fuelDensity;

  // Consumo vehicular específico: L/100 km
  const fuelL100km = (v_kmh > 0.5) ? (fuelLh / v_kmh) * 100.0 : 0;

  // Guardar en el estado
  state.bsfc = bsfc;
  state.efficiency = efficiency;
  state.speedKmh = v_kmh;
  state.speedMs = v_ms;
  state.dynamics = {
    ft,
    wheelTorque,
    faero,
    froll,
    fslope,
    fres,
    accel,
    vsp,
    fuelLh,
    fuelKgh,
    fuelL100km
  };

  // ================= RENDERIZADO EN LA UI =================
  // Motor
  if (valRpm) valRpm.textContent = Math.round(rpm);
  if (valTorque) valTorque.textContent = torque.toFixed(1);
  if (valPme) valPme.textContent = pme.toFixed(2);
  if (valPower) valPower.textContent = power.toFixed(1);
  if (valHp) valHp.textContent = (power * 1.35962).toFixed(1);
  if (valPowerScale) valPowerScale.textContent = state.powerScale.toFixed(1);

  // BSFC & Eficiencia
  if (valBsfc) valBsfc.textContent = bsfc.toFixed(1);
  if (valEfficiency) valEfficiency.textContent = `${efficiency.toFixed(1)}%`;
  if (efficiencyBar) {
    const effPct = Math.min(100, Math.max(0, (efficiency / 40.0) * 100));
    efficiencyBar.style.width = `${effPct}%`;
  }

  // Velocidad y Tracción
  if (valSpeed) valSpeed.textContent = v_kmh.toFixed(1);
  if (valSpeedMs) valSpeedMs.textContent = v_ms.toFixed(1);
  if (valGearDisplay) valGearDisplay.textContent = `${state.currentGear}ª (${Rt.toFixed(2)})`;
  if (valTractionForce) valTractionForce.textContent = Math.round(ft);
  if (valWheelTorque) valWheelTorque.textContent = wheelTorque.toFixed(1);

  // Resistencias
  if (valFaero) valFaero.textContent = `${Math.round(faero)} N`;
  if (valFroll) valFroll.textContent = `${Math.round(froll)} N`;
  if (valFslope) valFslope.textContent = `${Math.round(fslope)} N`;
  if (valFresTotal) valFresTotal.textContent = `${Math.round(fres)} N`;

  // Aceleración y VSP
  if (valAccel) {
    const sign = accel >= 0 ? '+' : '';
    valAccel.textContent = `${sign}${accel.toFixed(2)}`;
    valAccel.style.color = accel >= 0.05 ? 'var(--accent-emerald)' : (accel <= -0.05 ? 'var(--accent-rose)' : 'var(--accent-primary-light)');
  }
  if (valVsp) valVsp.textContent = vsp.toFixed(1);
  if (valVspKwt) valVspKwt.textContent = vsp.toFixed(1);

  // Consumos
  if (valFuelL) valFuelL.textContent = fuelLh.toFixed(2);
  if (valFuelKg) valFuelKg.textContent = fuelKgh.toFixed(2);
  if (valFuel100km) {
    valFuel100km.textContent = v_kmh > 0.5 ? fuelL100km.toFixed(2) : '--';
  }

  // Tarjeta de Balance Dinámico
  if (dispFt) dispFt.textContent = `${Math.round(ft)} N`;
  if (dispFres) dispFres.textContent = `${Math.round(fres)} N`;

  const deltaF = ft - fres;
  if (balanceCard && balanceBadge && balanceText) {
    if (accel > 0.05) {
      balanceCard.className = 'balance-dynamic-card state-accelerating';
      balanceBadge.className = 'balance-badge accel';
      balanceBadge.textContent = '🚀 El vehículo ACELERA';
      balanceText.innerHTML = `La fuerza de tracción (<strong>${Math.round(ft)} N</strong>) supera a la resistencia total (<strong>${Math.round(fres)} N</strong>). Superávit motriz neto: <strong style="color: #34d399;">+${Math.round(deltaF)} N</strong>. Aceleración disponible: <strong>+${accel.toFixed(2)} m/s²</strong>.`;
    } else if (accel < -0.05) {
      balanceCard.className = 'balance-dynamic-card state-decelerating';
      balanceBadge.className = 'balance-badge decel';
      balanceBadge.textContent = '🛑 El vehículo DESACELERA';
      balanceText.innerHTML = `La resistencia total (<strong>${Math.round(fres)} N</strong>) supera a la tracción disponible (<strong>${Math.round(ft)} N</strong>). Déficit motriz: <strong style="color: #fb7185;">${Math.round(deltaF)} N</strong>. Se requiere reducir marcha o aumentar la carga del motor para no perder velocidad.`;
    } else {
      balanceCard.className = 'balance-dynamic-card state-cruising';
      balanceBadge.className = 'balance-badge cruise';
      balanceBadge.textContent = '⚖️ MANTIENE aproximadamente la velocidad';
      balanceText.innerHTML = `Fuerza tractiva (<strong>${Math.round(ft)} N</strong>) y resistencia total (<strong>${Math.round(fres)} N</strong>) en equilibrio dinámico aproximado (ΔF ≈ 0 N). Régimen de crucero estable a <strong>${v_kmh.toFixed(1)} km/h</strong>.`;
    }
  }

  // Estilo de tarjeta BSFC
  if (bsfcCard) {
    if (bsfc <= 260) {
      bsfcCard.classList.add('sweet-spot');
    } else {
      bsfcCard.classList.remove('sweet-spot');
    }
  }

  // Distintivo de Zona Operativa
  if (opZoneBadge) {
    const wotLimit = getWotPressure(rpm);
    if (pme > wotLimit) {
      opZoneBadge.className = 'zone-badge zone-wot';
      opZoneBadge.textContent = 'Sobrecarga / Fuera de WOT';
    } else if (bsfc <= 256) {
      opZoneBadge.className = 'zone-badge zone-optimal';
      opZoneBadge.textContent = '🌟 Isla Óptima (255 g/kWh)';
    } else if (bsfc <= 290) {
      opZoneBadge.className = 'zone-badge zone-normal';
      opZoneBadge.textContent = 'Crucero / Alta Eficiencia';
    } else if (pme < 3.0) {
      opZoneBadge.className = 'zone-badge zone-lowload';
      opZoneBadge.textContent = 'Baja Carga / Fricción';
    } else {
      opZoneBadge.className = 'zone-badge zone-normal';
      opZoneBadge.textContent = 'Régimen Normal';
    }
  }
}

/**
 * Presets de Prueba
 */
window.selectPreset = function(preset) {
  switch (preset) {
    case 'optimal':
      if (gearSelect) gearSelect.value = "5";
      state.currentGear = "5";
      state.currentRt = DEFAULT_GEAR_RATIOS["5"];
      if (inpCurrentRt) inpCurrentRt.value = state.currentRt.toFixed(2);
      processPoint(143.12, 92.0); // 2800 RPM, 12 bar
      break;

    case 'highway':
      if (gearSelect) gearSelect.value = "5";
      state.currentGear = "5";
      state.currentRt = DEFAULT_GEAR_RATIOS["5"];
      if (inpCurrentRt) inpCurrentRt.value = state.currentRt.toFixed(2);
      processPoint(127.1, 167.0); // 2500 RPM, 6 bar
      break;

    case 'city':
      if (gearSelect) gearSelect.value = "3";
      state.currentGear = "3";
      state.currentRt = DEFAULT_GEAR_RATIOS["3"];
      if (inpCurrentRt) inpCurrentRt.value = state.currentRt.toFixed(2);
      processPoint(100.4, 198.25); // 2000 RPM, 3.5 bar
      break;

    case 'wot':
      if (gearSelect) gearSelect.value = "4";
      state.currentGear = "4";
      state.currentRt = DEFAULT_GEAR_RATIOS["4"];
      if (inpCurrentRt) inpCurrentRt.value = state.currentRt.toFixed(2);
      processPoint(207.2, 54.5); // 4000 RPM, 15 bar
      break;

    case 'contour525':
      if (gearSelect) gearSelect.value = "5";
      state.currentGear = "5";
      state.currentRt = DEFAULT_GEAR_RATIOS["5"];
      if (inpCurrentRt) inpCurrentRt.value = state.currentRt.toFixed(2);
      processPoint(233.9, 219.5); // 4500 RPM, 1.8 bar
      break;
  }
};

/**
 * Modal Institucional
 */
function loadSavedMetadata() {
  try {
    const saved = localStorage.getItem('engine_analyzer_meta');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.uni && dispUni) dispUni.textContent = data.uni;
      if (data.fac && dispFac) dispFac.textContent = data.fac;
      if (data.mat && dispMat) dispMat.textContent = data.mat;
      if (data.doc && dispDoc) dispDoc.textContent = data.doc;
      if (data.int && dispInt) dispInt.textContent = data.int;
      if (data.tem && dispTem) dispTem.textContent = data.tem;
    }
  } catch (e) {}
}

function saveMetadata() {
  const data = {
    uni: inpUni.value.trim() || (dispUni ? dispUni.textContent : ''),
    fac: inpFac.value.trim() || (dispFac ? dispFac.textContent : ''),
    mat: inpMat.value.trim() || (dispMat ? dispMat.textContent : ''),
    doc: inpDoc.value.trim() || (dispDoc ? dispDoc.textContent : ''),
    int: inpInt.value.trim() || (dispInt ? dispInt.textContent : ''),
    tem: inpTem.value.trim() || (dispTem ? dispTem.textContent : '')
  };

  if (dispUni) dispUni.textContent = data.uni;
  if (dispFac) dispFac.textContent = data.fac;
  if (dispMat) dispMat.textContent = data.mat;
  if (dispDoc) dispDoc.textContent = data.doc;
  if (dispInt) dispInt.textContent = data.int;
  if (dispTem) dispTem.textContent = data.tem;

  try {
    localStorage.setItem('engine_analyzer_meta', JSON.stringify(data));
  } catch (e) {}

  closeModal();
  showToastAlert('✅ Datos institucionales actualizados correctamente');
}

function openModal() {
  if (inpUni && dispUni) inpUni.value = dispUni.textContent;
  if (inpFac && dispFac) inpFac.value = dispFac.textContent;
  if (inpMat && dispMat) inpMat.value = dispMat.textContent;
  if (inpDoc && dispDoc) inpDoc.value = dispDoc.textContent;
  if (inpInt && dispInt) inpInt.value = dispInt.textContent;
  if (inpTem && dispTem) inpTem.value = dispTem.textContent;
  if (editModal) editModal.classList.add('open');
}

function closeModal() {
  if (editModal) editModal.classList.remove('open');
}

let toastTimeout;
function showToastAlert(msg) {
  if (!toastAlert) return;
  toastAlert.textContent = msg;
  toastAlert.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastAlert.classList.remove('show');
  }, 2800);
}

// Exportación para consola y pruebas automatizadas
window.engineAnalyzer = {
  BOUNDING_BOX,
  DEFAULT_GEAR_RATIOS,
  state,
  calculateBSFC,
  parseTireSize,
  updateCalculations,
  selectPreset,
  processPoint
};
