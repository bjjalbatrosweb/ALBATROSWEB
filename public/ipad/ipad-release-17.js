(function () {
  "use strict";

  var app = document.getElementById("ipad-app");
  var viewport = document.getElementById("cover-viewport");
  var track = document.getElementById("cover-track");
  var covers = track.getElementsByClassName("cover");
  var dotsHost = document.getElementById("cover-dots");
  var caption = document.getElementById("cover-caption");
  var kiosk = document.getElementById("kiosk-view");
  var current = 0;
  var startX = 0;
  var startY = 0;
  var deltaX = 0;
  var deltaY = 0;
  var dragging = false;
  var direction = "";
  var inactivityTimer = null;
  var successTimer = null;
  var attendanceTimer = null;
  var carouselTimer = null;
  var carouselResumeTimer = null;
  var rfidPollTimer = null;
  var rfidPollActive = false;
  var rfidPollGeneration = 0;
  var rfidPriming = false;
  var rfidCursor = 0;
  var rfidLastEventId = "";
  var rfidPurpose = "attendance";
  var paymentStatusTimer = null;
  var paymentToken = "";
  var appointmentLookupType = "";
  var appointmentLookupValue = "";
  var offlineSyncActive = false;
  var offlineSyncTimer = null;
  var accountTimer = null;
  var accountCountdownTimer = null;
  var accountSeconds = 45;
  var displayToastTimer = null;
  var globalAttendanceTimer = null;
  var layoutToggleTimer = null;
  var layoutHintTimer = null;
  var burnInTimer = null;
  var burnInPhase = 0;
  var welcomeDisplayActive = false;
  var welcomeDisplayTimer = null;
  var welcomeDisplayBusy = false;
  var welcomePresentationQueue = [];
  var welcomeAuthAction = "exit";
  var welcomeWasOffline = window.navigator.onLine === false;
  var edgeExitActive = false;
  var edgeExitStartX = 0;
  var edgeExitStartY = 0;
  var edgeExitDeltaX = 0;
  var edgeExitDeltaY = 0;
  var dots = [];
  var diagnosticMode = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
    window.location.search.indexOf("diagnostico=1") !== -1;
  var diagnosticEventPending = diagnosticMode;
  var CAROUSEL_IDLE_MS = diagnosticMode ? 1200 : 60000;
  var CAROUSEL_SLIDE_MS = diagnosticMode ? 900 : 6500;
  var KIOSK_IDLE_MS = diagnosticMode ? 2400 : 60000;
  var RFID_AMBIENT_POLL_MS = 3500;
  var WELCOME_SETTINGS_KEY = "albatros-ipad-welcome-settings-v1";
  var WELCOME_HISTORY_KEY = "albatros-ipad-welcome-history-v1";
  var welcomeSettings = readWelcomeSettings();

  app.setAttribute("data-runtime-ready", "true");
  app.setAttribute("data-release", "17");

  var schedules = {
    "Jiu-Jitsu": [
      "Matutino · Lunes, miércoles y viernes · 9:00–10:00 a. m.",
      "Vespertino · Martes, jueves y sábado · 7:00–8:00 p. m."
    ],
    "Kick Boxing": [
      "Matutino · Lunes, miércoles y viernes · 7:00–8:00 a. m.",
      "Vespertino · Martes, jueves y sábado · 8:00–9:00 p. m."
    ],
    "MMA": [
      "Matutino · Lunes, miércoles y viernes · 8:00–9:00 a. m.",
      "Vespertino · Martes, jueves y sábado · 8:00–9:00 p. m.",
      "Vespertino · Martes, jueves y sábado · 9:00–10:00 p. m."
    ]
  };

  function setViewportHeight() {
    document.documentElement.style.setProperty("--ipad-height", window.innerHeight + "px");
  }

  var OFFLINE_TRIALS_KEY = "albatros-ipad-clases-pendientes-v1";
  var OFFLINE_TRIAL_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

  function readOfflineTrials() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(OFFLINE_TRIALS_KEY) || "[]");
      if (!parsed || Object.prototype.toString.call(parsed) !== "[object Array]") return [];
      var minimumDate = Date.now() - OFFLINE_TRIAL_MAX_AGE;
      var cleaned = parsed.filter(function (entry) {
        return entry && entry.payload && Number(entry.createdAt) >= minimumDate;
      }).slice(0, 12);
      if (cleaned.length !== parsed.length) writeOfflineTrials(cleaned);
      return cleaned;
    } catch {
      return [];
    }
  }

  function writeOfflineTrials(items) {
    try {
      if (items.length) window.localStorage.setItem(OFFLINE_TRIALS_KEY, JSON.stringify(items));
      else window.localStorage.removeItem(OFFLINE_TRIALS_KEY);
      return true;
    } catch {
      return false;
    }
  }

  function readWelcomeSettings() {
    var defaults = {
      duration: 5000,
      sound: false,
      showWeek: true,
      showClass: true,
      pin: "1908",
      maintenance: false,
      maintenanceMessage: "Estamos preparando el sistema para recibirte."
    };
    try {
      var saved = JSON.parse(window.localStorage.getItem(WELCOME_SETTINGS_KEY) || "{}");
      var duration = Number(saved.duration);
      if (duration !== 3000 && duration !== 5000 && duration !== 7000) duration = defaults.duration;
      return {
        duration: duration,
        sound: saved.sound === true,
        showWeek: saved.showWeek !== false,
        showClass: saved.showClass !== false,
        pin: /^\d{4}$/.test(String(saved.pin || "")) ? String(saved.pin) : defaults.pin,
        maintenance: saved.maintenance === true,
        maintenanceMessage: typeof saved.maintenanceMessage === "string" && saved.maintenanceMessage.replace(/^\s+|\s+$/g, "")
          ? saved.maintenanceMessage.replace(/^\s+|\s+$/g, "").slice(0, 100)
          : defaults.maintenanceMessage
      };
    } catch {
      return defaults;
    }
  }

  function writeWelcomeSettings() {
    try {
      window.localStorage.setItem(WELCOME_SETTINGS_KEY, JSON.stringify(welcomeSettings));
      return true;
    } catch {
      return false;
    }
  }

  function readWelcomeHistory() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(WELCOME_HISTORY_KEY) || "[]");
      return Object.prototype.toString.call(parsed) === "[object Array]" ? parsed.slice(0, 10) : [];
    } catch {
      return [];
    }
  }

  function writeWelcomeHistory(items) {
    try {
      if (items.length) window.localStorage.setItem(WELCOME_HISTORY_KEY, JSON.stringify(items.slice(0, 10)));
      else window.localStorage.removeItem(WELCOME_HISTORY_KEY);
    } catch {
      return;
    }
  }

  function eventState(result) {
    return result.permitido === false
      ? "rojo"
      : (result.estadoLed === "amarillo" || result.duplicado ? "amarillo" : "verde");
  }

  function rememberWelcomeEvent(result) {
    var id = String(result.eventoId || "");
    var history = readWelcomeHistory();
    var index;
    if (id) {
      for (index = 0; index < history.length; index += 1) {
        if (history[index] && history[index].id === id) return false;
      }
    }
    history.unshift({
      id: id || String(Date.now()) + "-" + String(Math.floor(Math.random() * 100000)),
      name: String(result.nombre || "Atleta").replace(/^\s+|\s+$/g, "").split(/\s+/)[0],
      method: String(result.metodo || "RFID").toUpperCase(),
      state: eventState(result),
      time: Date.now()
    });
    writeWelcomeHistory(history);
    return true;
  }

  function renderWelcomeHistory() {
    var host = document.getElementById("welcome-history-list");
    var history = readWelcomeHistory();
    var index;
    while (host.firstChild) host.removeChild(host.firstChild);
    if (!history.length) {
      var empty = document.createElement("p");
      empty.textContent = "Todavía no hay asistencias en este dispositivo.";
      host.appendChild(empty);
      return;
    }
    for (index = 0; index < history.length; index += 1) {
      var item = history[index];
      var row = document.createElement("article");
      var name = document.createElement("b");
      var detail = document.createElement("small");
      var time = document.createElement("time");
      row.className = "welcome-history-item";
      row.setAttribute("data-state", item.state || "verde");
      name.textContent = item.name || "Atleta";
      detail.textContent = (item.method === "CELULAR" ? "Celular" : (item.method === "PIN" ? "PIN" : "Lector")) +
        (item.state === "rojo" ? " · rechazado" : (item.state === "amarillo" ? " · aviso" : " · registrado"));
      time.textContent = new Date(Number(item.time) || Date.now()).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      row.appendChild(name);
      row.appendChild(detail);
      row.appendChild(time);
      host.appendChild(row);
    }
  }

  function applyWelcomeSettings() {
    var maintenance = document.getElementById("welcome-maintenance");
    document.getElementById("welcome-maintenance-message").textContent = welcomeSettings.maintenanceMessage;
    if (welcomeSettings.maintenance) {
      hideWelcomeDisplayEvent();
      maintenance.classList.add("is-visible");
      maintenance.setAttribute("aria-hidden", "false");
    } else {
      maintenance.classList.remove("is-visible");
      maintenance.setAttribute("aria-hidden", "true");
    }
  }

  function playWelcomeTone(state) {
    if (!welcomeSettings.sound) return;
    try {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      var context = new AudioContext();
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = state === "rojo" ? 220 : (state === "amarillo" ? 440 : 720);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
      window.setTimeout(function () { if (context.close) context.close(); }, 300);
    } catch {
      return;
    }
  }

  function updateWelcomeConnectionState() {
    var online = window.navigator.onLine !== false;
    var state = document.getElementById("welcome-connection-state");
    var label = state ? state.getElementsByTagName("b")[0] : null;
    if (!state || !label) return;
    state.className = "welcome-connection-state" + (online ? "" : " is-offline");
    label.textContent = online ? (welcomeWasOffline ? "Reconectado" : "En línea") : "Sin conexión";
    if (!online) welcomeWasOffline = true;
    else if (welcomeWasOffline) {
      window.setTimeout(function () {
        if (window.navigator.onLine !== false) {
          label.textContent = "En línea";
          welcomeWasOffline = false;
        }
      }, 2600);
    }
  }

  function updateNetworkStatus() {
    var online = window.navigator.onLine !== false;
    var pending = readOfflineTrials().length;
    var status = document.getElementById("network-status");
    var banner = document.getElementById("offline-banner");
    var hubStatus = document.getElementById("kiosk-hub-status");
    var label = document.getElementById("network-status-label");
    var queueLabel = document.getElementById("network-queue-label");
    var hubDetail = document.getElementById("kiosk-hub-status-detail");
    var bannerDetail = document.getElementById("offline-banner-detail");
    app.setAttribute("data-network", online ? "online" : "offline");
    if (status) status.className = "network-status" + (online ? "" : " is-offline") + (pending ? " has-pending" : "");
    if (hubStatus) hubStatus.className = "kiosk-hub-status" + (online ? "" : " is-offline");
    if (label) label.textContent = online ? (offlineSyncActive ? "Sincronizando" : "En línea") : "Sin conexión";
    if (queueLabel) queueLabel.textContent = pending ? pending + (pending === 1 ? " pendiente" : " pendientes") : "";
    if (hubDetail) hubDetail.textContent = online
      ? (pending
        ? (offlineSyncActive ? "Enviando " : "Pendiente de envío: ") + pending + (pending === 1 ? " solicitud" : " solicitudes")
        : "Sistema listo")
      : (pending ? pending + (pending === 1 ? " solicitud guardada" : " solicitudes guardadas") : "Funciones en vivo pausadas");
    bannerDetail.textContent = pending
      ? pending + (pending === 1
        ? " clase está guardada y se enviará automáticamente."
        : " clases están guardadas y se enviarán automáticamente.")
      : "Puedes agendar una clase; se enviará automáticamente al volver internet.";
    if (online) {
      banner.classList.remove("is-visible");
      banner.setAttribute("aria-hidden", "true");
    } else {
      banner.classList.add("is-visible");
      banner.setAttribute("aria-hidden", "false");
    }
    updateWelcomeConnectionState();
  }

  function queueTrialRequest(payload) {
    var queue = readOfflineTrials();
    var duplicateIndex = -1;
    var index;
    for (index = 0; index < queue.length; index += 1) {
      if (queue[index].payload.telefono === payload.telefono && queue[index].payload.horario === payload.horario) {
        duplicateIndex = index;
        break;
      }
    }
    var entry = {
      id: String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000000)),
      createdAt: Date.now(),
      payload: payload
    };
    if (duplicateIndex >= 0) queue[duplicateIndex] = entry;
    else queue.push(entry);
    if (queue.length > 12) queue = queue.slice(queue.length - 12);
    var saved = writeOfflineTrials(queue);
    updateNetworkStatus();
    return saved;
  }

  function syncOfflineTrials() {
    if (offlineSyncActive || window.navigator.onLine === false) {
      updateNetworkStatus();
      return;
    }
    var queue = readOfflineTrials();
    if (!queue.length) {
      updateNetworkStatus();
      return;
    }
    offlineSyncActive = true;
    updateNetworkStatus();

    function finish() {
      offlineSyncActive = false;
      updateNetworkStatus();
    }

    function sendNext() {
      if (window.navigator.onLine === false) { finish(); return; }
      queue = readOfflineTrials();
      if (!queue.length) { finish(); return; }
      var entry = queue[0];
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/clase-prueba", true);
      xhr.timeout = 15000;
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var result = {};
        try { result = JSON.parse(xhr.responseText || "{}"); } catch { result = {}; }
        var accepted = xhr.status >= 200 && xhr.status < 300;
        var alreadyReceived = xhr.status === 429 && /ya recibimos/i.test(String(result.mensaje || ""));
        var invalid = xhr.status >= 400 && xhr.status < 500 && xhr.status !== 429;
        if (accepted || alreadyReceived || invalid) {
          queue.shift();
          writeOfflineTrials(queue);
          updateNetworkStatus();
          window.setTimeout(sendNext, 250);
          return;
        }
        finish();
      };
      xhr.onerror = finish;
      xhr.ontimeout = finish;
      xhr.send(JSON.stringify(entry.payload));
    }

    sendNext();
  }

  function scheduleOfflineSync(delay) {
    if (offlineSyncTimer) window.clearTimeout(offlineSyncTimer);
    offlineSyncTimer = window.setTimeout(syncOfflineTrials, delay || 0);
  }

  function registerOfflineShell() {
    if (!("serviceWorker" in window.navigator) || window.location.protocol !== "https:") return;
    try {
      window.navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {});
    } catch {}
  }

  function isStandaloneMode() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function refreshDisplayMode() {
    if (isStandaloneMode()) app.classList.add("standalone-mode");
    else app.classList.remove("standalone-mode");
    if (fullscreenElement()) app.classList.add("display-mode-active");
    else app.classList.remove("display-mode-active");
  }

  function openDisplayGuide() {
    var guide = document.getElementById("display-guide");
    guide.classList.add("is-visible");
    guide.setAttribute("aria-hidden", "false");
  }

  function closeDisplayGuide() {
    var guide = document.getElementById("display-guide");
    guide.classList.remove("is-visible");
    guide.setAttribute("aria-hidden", "true");
  }

  function showDisplayToast(message) {
    var toast = document.getElementById("display-toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    if (displayToastTimer) window.clearTimeout(displayToastTimer);
    displayToastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 4200);
  }

  function enterDisplayMode() {
    if (isStandaloneMode()) {
      refreshDisplayMode();
      showDisplayToast("La app ya está funcionando sin las barras de Safari.");
      return;
    }

    var root = document.documentElement;
    var request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!request) {
      openDisplayGuide();
      return;
    }

    try {
      var result = request.call(root);
      if (result && typeof result.then === "function") {
        result.then(refreshDisplayMode, openDisplayGuide);
      } else {
        window.setTimeout(refreshDisplayMode, 100);
      }
    } catch {
      if (error) openDisplayGuide();
    }
  }

  function exitDisplayMode() {
    var exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (fullscreenElement() && exit) {
      try {
        var result = exit.call(document);
        if (result && typeof result.then === "function") {
          result.then(refreshDisplayMode, refreshDisplayMode);
        }
      } catch (error) {
        if (error) refreshDisplayMode();
      }
      return;
    }
    if (isStandaloneMode()) {
      showDisplayToast("En este iPad, usa el botón Inicio para minimizar la app.");
    }
  }

  function edgeExitStart(event) {
    if ((!fullscreenElement() && !isStandaloneMode()) || !event.touches || event.touches.length !== 1) return;
    if (event.touches[0].clientX > 24) return;
    edgeExitActive = true;
    edgeExitStartX = event.touches[0].clientX;
    edgeExitStartY = event.touches[0].clientY;
    edgeExitDeltaX = 0;
    edgeExitDeltaY = 0;
  }

  function edgeExitMove(event) {
    if (!edgeExitActive || !event.touches || event.touches.length !== 1) return;
    edgeExitDeltaX = event.touches[0].clientX - edgeExitStartX;
    edgeExitDeltaY = event.touches[0].clientY - edgeExitStartY;
    if (edgeExitDeltaX <= 8 || Math.abs(edgeExitDeltaY) > Math.abs(edgeExitDeltaX)) return;
    event.preventDefault();
    var progress = Math.min(edgeExitDeltaX / 180, 1);
    var hint = document.getElementById("display-exit-hint");
    hint.style.opacity = String(progress);
    hint.style.transform = "translate3d(" + (-100 + progress * 100) + "%,-50%,0)";
  }

  function edgeExitEnd() {
    if (!edgeExitActive) return;
    edgeExitActive = false;
    var hint = document.getElementById("display-exit-hint");
    hint.style.opacity = "0";
    hint.style.transform = "translate3d(-100%,-50%,0)";
    if (edgeExitDeltaX >= 180 && Math.abs(edgeExitDeltaY) < 90) exitDisplayMode();
  }

  function loadCover(index) {
    if (index < 0 || index >= covers.length) return;
    var image = covers[index].getElementsByTagName("img")[0];
    if (image && !image.getAttribute("src") && image.getAttribute("data-src")) {
      image.setAttribute("src", image.getAttribute("data-src"));
    }
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function stopCarousel() {
    if (carouselTimer) window.clearTimeout(carouselTimer);
    carouselTimer = null;
    app.classList.remove("screensaver-active");
  }

  function startCarousel() {
    stopCarousel();
    if (carouselResumeTimer) window.clearTimeout(carouselResumeTimer);
    carouselResumeTimer = null;
    if (app.classList.contains("kiosk-active") || document.hidden) return;
    app.classList.add("screensaver-active");

    function advanceCover() {
      if (app.classList.contains("kiosk-active") || document.hidden) {
        stopCarousel();
        return;
      }
      current = (current + 1) % covers.length;
      renderSlide(!reducedMotion());
      carouselTimer = window.setTimeout(advanceCover, CAROUSEL_SLIDE_MS);
    }

    advanceCover();
  }

  function scheduleCarouselAfterIdle() {
    stopCarousel();
    if (carouselResumeTimer) window.clearTimeout(carouselResumeTimer);
    carouselResumeTimer = window.setTimeout(function () {
      if (!app.classList.contains("kiosk-active")) startCarousel();
    }, CAROUSEL_IDLE_MS);
  }

  function pauseCarouselForInteraction() {
    scheduleCarouselAfterIdle();
  }

  function renderSlide(animate) {
    var index;
    track.style.transition = animate === false ? "none" : "";
    track.style.transform = "translate3d(" + (-current * 100) + "%,0,0)";
    for (index = 0; index < covers.length; index += 1) {
      if (index === current) covers[index].classList.add("is-active");
      else covers[index].classList.remove("is-active");
      if (dots[index]) {
        if (index === current) dots[index].classList.add("is-active");
        else dots[index].classList.remove("is-active");
        dots[index].setAttribute("aria-current", index === current ? "true" : "false");
      }
    }
    loadCover(current);
    loadCover(current - 1);
    loadCover(current + 1);
    caption.textContent = covers[current].getAttribute("data-label") + " · " + (current + 1) + " de " + covers.length;
  }

  function goToSlide(index) {
    current = Math.max(0, Math.min(covers.length - 1, index));
    renderSlide(true);
  }

  function buildDots() {
    var index;
    for (index = 0; index < covers.length; index += 1) {
      (function (dotIndex) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.textContent = covers[dotIndex].getAttribute("data-label");
        dot.setAttribute("aria-label", "Ver " + covers[dotIndex].getAttribute("data-label"));
        dot.addEventListener("click", function () {
          pauseCarouselForInteraction();
          goToSlide(dotIndex);
        }, false);
        dotsHost.appendChild(dot);
        dots.push(dot);
      }(index));
    }
  }

  function touchStart(event) {
    if (app.classList.contains("kiosk-active") || !event.touches || event.touches.length !== 1) return;
    pauseCarouselForInteraction();
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    deltaX = 0;
    deltaY = 0;
    dragging = true;
    direction = "";
    track.style.transition = "none";
  }

  function touchMove(event) {
    if (!dragging || !event.touches || event.touches.length !== 1) return;
    deltaX = event.touches[0].clientX - startX;
    deltaY = event.touches[0].clientY - startY;
    if (!direction && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      direction = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }
    if (direction === "horizontal") {
      event.preventDefault();
      var resistance = 1;
      if ((current === 0 && deltaX > 0) || (current === covers.length - 1 && deltaX < 0)) resistance = 0.28;
      track.style.transform = "translate3d(calc(" + (-current * 100) + "% + " + (deltaX * resistance) + "px),0,0)";
    } else if (direction === "vertical" && deltaY < 0) {
      event.preventDefault();
      app.style.setProperty("--pull-progress", Math.min(-deltaY / 150, 1));
    }
  }

  function touchEnd() {
    if (!dragging) return;
    dragging = false;
    track.style.transition = "";
    if (direction === "horizontal" && Math.abs(deltaX) > 55) {
      goToSlide(deltaX < 0 ? current + 1 : current - 1);
    } else {
      renderSlide(true);
    }
    if (direction === "vertical" && deltaY < -90 && Math.abs(deltaY) > Math.abs(deltaX)) {
      openKiosk();
    }
    direction = "";
    app.style.removeProperty("--pull-progress");
  }

  function resetInactivity() {
    if (!app.classList.contains("kiosk-active")) return;
    if (inactivityTimer) window.clearTimeout(inactivityTimer);
    if (welcomeDisplayActive) {
      inactivityTimer = null;
      return;
    }
    inactivityTimer = window.setTimeout(function () {
      clearPersonalData();
      closeKiosk();
    }, KIOSK_IDLE_MS);
  }

  function collapseLayoutToggle() {
    var layoutToggle = document.getElementById("kiosk-layout-toggle");
    if (layoutToggleTimer) window.clearTimeout(layoutToggleTimer);
    layoutToggleTimer = null;
    if (!layoutToggle) return;
    layoutToggle.classList.remove("is-expanded");
    layoutToggle.setAttribute("aria-expanded", "false");
  }

  function scheduleLayoutToggleCollapse() {
    if (layoutToggleTimer) window.clearTimeout(layoutToggleTimer);
    layoutToggleTimer = window.setTimeout(collapseLayoutToggle, 3400);
  }

  function showLayoutFirstHint() {
    var hint = document.getElementById("layout-first-hint");
    var alreadyShown = false;
    if (!hint) return;
    try {
      alreadyShown = window.localStorage.getItem("albatros-ipad-layout-hint-v1") === "1";
      if (!alreadyShown) window.localStorage.setItem("albatros-ipad-layout-hint-v1", "1");
    } catch {
      alreadyShown = false;
    }
    if (alreadyShown) return;
    hint.classList.add("is-visible");
    if (layoutHintTimer) window.clearTimeout(layoutHintTimer);
    layoutHintTimer = window.setTimeout(function () { hint.classList.remove("is-visible"); }, 4200);
  }

  function stopBurnInProtection() {
    if (burnInTimer) window.clearInterval(burnInTimer);
    burnInTimer = null;
    burnInPhase = 0;
    kiosk.removeAttribute("data-burn-in-shift");
  }

  function startBurnInProtection() {
    stopBurnInProtection();
    burnInTimer = window.setInterval(function () {
      if (!app.classList.contains("kiosk-active") || document.hidden) return;
      burnInPhase = (burnInPhase % 3) + 1;
      kiosk.setAttribute("data-burn-in-shift", String(burnInPhase));
    }, 180000);
  }

  function setKioskLayout(layout, clearHiddenData) {
    var normalized = layout === "list" ? "list" : "hub";
    var hub = document.getElementById("kiosk-hub");
    var list = document.getElementById("kiosk-list");
    var buttons = document.querySelectorAll("[data-kiosk-layout-button]");
    var index;
    kiosk.setAttribute("data-kiosk-layout", normalized);
    hub.setAttribute("aria-hidden", normalized === "hub" ? "false" : "true");
    list.setAttribute("aria-hidden", normalized === "list" ? "false" : "true");
    for (index = 0; index < buttons.length; index += 1) {
      var active = buttons[index].getAttribute("data-kiosk-layout-button") === normalized;
      if (active) buttons[index].classList.add("is-active");
      else buttons[index].classList.remove("is-active");
      buttons[index].setAttribute("aria-pressed", active ? "true" : "false");
    }
    collapseLayoutToggle();
    if (normalized === "hub" && clearHiddenData !== false) clearPersonalData();
    resetInactivity();
  }

  function openHubPanel(panelId) {
    setKioskLayout("list", false);
    showPanel(panelId || "booking-panel");
    resetInactivity();
  }

  function openKiosk(panelId) {
    stopCarousel();
    if (carouselResumeTimer) window.clearTimeout(carouselResumeTimer);
    app.classList.add("kiosk-active");
    kiosk.setAttribute("aria-hidden", "false");
    startBurnInProtection();
    if (panelId) openHubPanel(panelId);
    else {
      activatePanelMarkup("booking-panel");
      setKioskLayout("hub", true);
    }
    resetInactivity();
    window.setTimeout(showLayoutFirstHint, 720);
    window.setTimeout(function () {
      var firstInput = document.getElementById("trial-name");
      if (panelId === "booking-panel" && firstInput) firstInput.focus();
    }, 520);
  }

  function closeKiosk() {
    app.classList.remove("kiosk-active");
    kiosk.setAttribute("aria-hidden", "true");
    collapseLayoutToggle();
    stopBurnInProtection();
    if (inactivityTimer) window.clearTimeout(inactivityTimer);
    startAmbientRfidPolling();
    stopPaymentStatus();
    stopAccountSession();
    if (carouselResumeTimer) window.clearTimeout(carouselResumeTimer);
    carouselResumeTimer = window.setTimeout(startCarousel, CAROUSEL_IDLE_MS);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function activatePanelMarkup(panelId) {
    var buttons = document.getElementsByClassName("kiosk-menu-button");
    var panels = document.getElementsByClassName("kiosk-panel");
    var index;
    for (index = 0; index < buttons.length; index += 1) {
      if (buttons[index].getAttribute("data-panel") === panelId) buttons[index].classList.add("is-active");
      else buttons[index].classList.remove("is-active");
    }
    for (index = 0; index < panels.length; index += 1) {
      if (panels[index].id === panelId) panels[index].classList.add("is-active");
      else panels[index].classList.remove("is-active");
    }
  }

  function showPanel(panelId) {
    activatePanelMarkup(panelId);
    if (panelId !== "payment-panel") stopPaymentStatus();
    if (panelId !== "account-panel") stopAccountSession();
    if (panelId === "attendance-panel") resetAttendance();
    else if (panelId === "payment-panel") resetPayment();
    else if (panelId === "passes-panel") resetPasses();
    else if (panelId === "account-panel") resetAccount();
    else {
      startAmbientRfidPolling();
      stopPaymentStatus();
    }
  }

  function updateClock() {
    var now = new Date();
    var hours = String(now.getHours());
    var minutes = String(now.getMinutes());
    if (hours.length < 2) hours = "0" + hours;
    if (minutes.length < 2) minutes = "0" + minutes;
    document.getElementById("kiosk-clock").textContent = hours + ":" + minutes;
  }

  function updateTimes() {
    var discipline = document.getElementById("trial-discipline").value;
    var select = document.getElementById("trial-time");
    var options = schedules[discipline] || [];
    var index;
    select.innerHTML = "";
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecciona un horario";
    select.appendChild(placeholder);
    for (index = 0; index < options.length; index += 1) {
      var option = document.createElement("option");
      option.value = options[index];
      option.textContent = options[index];
      select.appendChild(option);
    }
  }

  function showFormMessage(message) {
    var element = document.getElementById("form-message");
    element.textContent = message || "";
    if (message) element.classList.add("is-visible");
    else element.classList.remove("is-visible");
  }

  function onlyDigits(value) {
    return value.replace(/\D/g, "").slice(0, 15);
  }

  function clearPersonalData() {
    var form = document.getElementById("trial-form");
    form.reset();
    updateTimes();
    showFormMessage("");
    form.style.display = "grid";
    document.getElementById("success-card").classList.remove("is-visible");
    document.getElementById("success-card").setAttribute("aria-hidden", "true");
    document.getElementById("trial-success-title").textContent = "Solicitud enviada";
    document.getElementById("trial-success-message").textContent = "Recibimos tus datos. Nos pondremos en contacto para confirmar tu clase.";
    resetAttendance(false);
    resetPayment(false);
    resetPasses();
    resetAccount();
    startAmbientRfidPolling();
  }

  function setPinMessage(message, success) {
    var element = document.getElementById("pin-message");
    element.textContent = message || "";
    if (success) element.classList.add("is-success");
    else element.classList.remove("is-success");
  }

  function stopRfidPolling() {
    rfidPollActive = false;
    rfidPollGeneration += 1;
    if (rfidPollTimer) window.clearTimeout(rfidPollTimer);
    rfidPollTimer = null;
  }

  function hideGlobalAttendanceWelcome() {
    var notice = document.getElementById("global-attendance-welcome");
    if (!notice) return;
    notice.classList.remove("is-visible");
    notice.setAttribute("aria-hidden", "true");
  }

  function hideWelcomeDisplayEvent() {
    var display = document.getElementById("welcome-display");
    var card = document.getElementById("welcome-display-event");
    if (welcomeDisplayTimer) window.clearTimeout(welcomeDisplayTimer);
    welcomeDisplayTimer = null;
    if (!display || !card) return;
    display.classList.remove("has-event");
    card.classList.remove("is-visible");
    card.setAttribute("aria-hidden", "true");
    welcomeDisplayBusy = false;
    if (welcomeDisplayActive && !welcomeSettings.maintenance && welcomePresentationQueue.length) {
      window.setTimeout(function () {
        if (welcomeDisplayActive && !welcomeDisplayBusy && welcomePresentationQueue.length) {
          showWelcomeDisplayEvent(welcomePresentationQueue.shift());
        }
      }, 260);
    }
  }

  function showWelcomeDisplayEvent(result) {
    var display = document.getElementById("welcome-display");
    var card = document.getElementById("welcome-display-event");
    if (!display || !card || welcomeSettings.maintenance) return;
    if (welcomeDisplayBusy) {
      welcomePresentationQueue.push(result);
      if (welcomePresentationQueue.length > 12) welcomePresentationQueue.shift();
      return;
    }
    welcomeDisplayBusy = true;
    var welcome = result.bienvenida || {};
    var activeClass = welcome.claseActiva || null;
    var firstName = String(result.nombre || "Atleta").replace(/^\s+|\s+$/g, "").split(/\s+/)[0];
    var state = eventState(result);
    var method = String(result.metodo || "RFID").toUpperCase();
    var methodLabel = method === "CELULAR"
      ? "REGISTRO DESDE CELULAR"
      : (method === "PIN" ? "REGISTRO CON PIN" : "REGISTRO CON LECTOR");
    card.setAttribute("data-state", state);
    card.getElementsByClassName("welcome-display-event-icon")[0].textContent =
      state === "rojo" ? "×" : (state === "amarillo" ? "!" : "✓");
    document.getElementById("welcome-display-method").textContent = methodLabel;
    document.getElementById("welcome-display-name").textContent = state === "rojo"
      ? "Acceso no autorizado"
      : (result.duplicado ? "¡Qué gusto verte, " + firstName + "!" : "¡Bienvenido, " + firstName + "!");
    document.getElementById("welcome-display-message").textContent =
      result.mensaje || (state === "rojo" ? "No fue posible registrar la entrada." : "Tu asistencia quedó registrada correctamente.");
    var weekElement = document.getElementById("welcome-display-week");
    var classElement = document.getElementById("welcome-display-class");
    weekElement.textContent = String(Number(welcome.asistenciasSemana) || 0) + " esta semana";
    weekElement.style.display = welcomeSettings.showWeek ? "" : "none";
    classElement.textContent = activeClass && activeClass.disciplina ? "Clase: " + activeClass.disciplina : "Entrada general";
    classElement.style.display = welcomeSettings.showClass ? "" : "none";
    display.classList.add("has-event");
    card.classList.add("is-visible");
    card.setAttribute("aria-hidden", "false");
    if (welcomeDisplayTimer) window.clearTimeout(welcomeDisplayTimer);
    playWelcomeTone(state);
    welcomeDisplayTimer = window.setTimeout(hideWelcomeDisplayEvent, welcomeSettings.duration);
  }

  function closeAttendanceMoreMenu() {
    var button = document.getElementById("attendance-more-button");
    var menu = document.getElementById("attendance-more-menu");
    if (!button || !menu) return;
    button.setAttribute("aria-expanded", "false");
    menu.classList.remove("is-visible");
    menu.setAttribute("aria-hidden", "true");
  }

  function enterWelcomeDisplay() {
    var display = document.getElementById("welcome-display");
    welcomeDisplayActive = true;
    closeAttendanceMoreMenu();
    hideGlobalAttendanceWelcome();
    welcomePresentationQueue = [];
    hideWelcomeDisplayEvent();
    if (inactivityTimer) window.clearTimeout(inactivityTimer);
    inactivityTimer = null;
    display.classList.add("is-active");
    display.setAttribute("aria-hidden", "false");
    applyWelcomeSettings();
    updateWelcomeConnectionState();
    startAmbientRfidPolling();
  }

  function hideWelcomeExitDialog() {
    var dialog = document.getElementById("welcome-exit-dialog");
    var input = document.getElementById("welcome-exit-pin");
    dialog.classList.remove("is-visible");
    dialog.setAttribute("aria-hidden", "true");
    input.value = "";
    document.getElementById("welcome-exit-error").textContent = "";
  }

  function requestWelcomeAuthorization(action) {
    var dialog = document.getElementById("welcome-exit-dialog");
    welcomeAuthAction = action === "admin" ? "admin" : "exit";
    document.getElementById("welcome-exit-title").textContent = welcomeAuthAction === "admin"
      ? "Ingresa el PIN para administrar"
      : "Ingresa el PIN para salir";
    dialog.classList.add("is-visible");
    dialog.setAttribute("aria-hidden", "false");
    window.setTimeout(function () { document.getElementById("welcome-exit-pin").focus(); }, 80);
  }

  function closeWelcomeAdmin() {
    var panel = document.getElementById("welcome-admin-panel");
    panel.classList.remove("is-visible");
    panel.setAttribute("aria-hidden", "true");
    document.getElementById("welcome-new-pin").value = "";
  }

  function openWelcomeAdmin() {
    document.getElementById("welcome-duration").value = String(welcomeSettings.duration);
    document.getElementById("welcome-sound").checked = welcomeSettings.sound;
    document.getElementById("welcome-show-week").checked = welcomeSettings.showWeek;
    document.getElementById("welcome-show-class").checked = welcomeSettings.showClass;
    document.getElementById("welcome-maintenance-toggle").checked = welcomeSettings.maintenance;
    document.getElementById("welcome-maintenance-input").value = welcomeSettings.maintenanceMessage;
    document.getElementById("welcome-new-pin").value = "";
    renderWelcomeHistory();
    var panel = document.getElementById("welcome-admin-panel");
    panel.classList.add("is-visible");
    panel.setAttribute("aria-hidden", "false");
  }

  function saveWelcomeSettings() {
    var nextPin = document.getElementById("welcome-new-pin").value.replace(/\D/g, "").slice(0, 4);
    var message = document.getElementById("welcome-maintenance-input").value.replace(/^\s+|\s+$/g, "").slice(0, 100);
    welcomeSettings.duration = Number(document.getElementById("welcome-duration").value) || 5000;
    welcomeSettings.sound = document.getElementById("welcome-sound").checked;
    welcomeSettings.showWeek = document.getElementById("welcome-show-week").checked;
    welcomeSettings.showClass = document.getElementById("welcome-show-class").checked;
    welcomeSettings.maintenance = document.getElementById("welcome-maintenance-toggle").checked;
    welcomeSettings.maintenanceMessage = message || "Estamos preparando el sistema para recibirte.";
    if (nextPin.length === 4) welcomeSettings.pin = nextPin;
    writeWelcomeSettings();
    applyWelcomeSettings();
    closeWelcomeAdmin();
  }

  function exitWelcomeDisplay() {
    var display = document.getElementById("welcome-display");
    welcomeDisplayActive = false;
    welcomePresentationQueue = [];
    hideWelcomeExitDialog();
    closeWelcomeAdmin();
    hideWelcomeDisplayEvent();
    display.classList.remove("is-active");
    display.setAttribute("aria-hidden", "true");
    resetInactivity();
  }

  function showGlobalAttendanceWelcome(result) {
    if (!rememberWelcomeEvent(result)) return;
    if (welcomeDisplayActive) {
      showWelcomeDisplayEvent(result);
      return;
    }
    var notice = document.getElementById("global-attendance-welcome");
    if (!notice) return;
    var welcome = result.bienvenida || {};
    var activeClass = welcome.claseActiva || null;
    var firstName = String(result.nombre || "Atleta").replace(/^\s+|\s+$/g, "").split(/\s+/)[0];
    document.getElementById("global-welcome-title").textContent = result.duplicado
      ? "¡Qué gusto verte, " + firstName + "!"
      : "¡Bienvenido, " + firstName + "!";
    document.getElementById("global-welcome-message").textContent =
      result.mensaje || "Tu entrada quedó registrada correctamente.";
    document.getElementById("global-welcome-week").textContent =
      String(Number(welcome.asistenciasSemana) || 0);
    document.getElementById("global-welcome-class").textContent =
      activeClass && activeClass.disciplina
        ? "Clase: " + activeClass.disciplina
        : "Entrada general";
    notice.classList.add("is-visible");
    notice.setAttribute("aria-hidden", "false");
    if (globalAttendanceTimer) window.clearTimeout(globalAttendanceTimer);
    globalAttendanceTimer = window.setTimeout(hideGlobalAttendanceWelcome, 7000);
  }

  function setTagListening(title, detail) {
    if (rfidPurpose === "payment") {
      document.getElementById("payment-reader-title").textContent = title;
      document.getElementById("payment-reader-detail").textContent = detail;
    } else {
      var status = document.getElementById("tag-listening");
      if (!status) return;
      status.getElementsByTagName("b")[0].textContent = title;
      status.getElementsByTagName("small")[0].textContent = detail;
    }
  }

  function scheduleRfidPoll(delay, generation) {
    if (!rfidPollActive || generation !== rfidPollGeneration) return;
    if (rfidPollTimer) window.clearTimeout(rfidPollTimer);
    rfidPollTimer = window.setTimeout(function () { pollRfidEvent(generation); }, delay);
  }

  function pollRfidEvent(generation) {
    if (!rfidPollActive || generation !== rfidPollGeneration) return;
    if (document.hidden) {
      scheduleRfidPoll(2500, generation);
      return;
    }
    if (window.navigator.onLine === false) {
      if (rfidPurpose !== "ambient") {
        setTagListening("Esperando conexión", "El lector sigue disponible; la pantalla se enlazará al volver internet.");
      }
      scheduleRfidPoll(5000, generation);
      return;
    }

    var xhr = new XMLHttpRequest();
    var finished = false;
    function finish(delay) {
      if (finished || generation !== rfidPollGeneration) return;
      finished = true;
      if (rfidPollActive) scheduleRfidPoll(delay, generation);
    }
    xhr.open(
      "GET",
      "/api/ipad/evento-rfid?after=" + encodeURIComponent(String(rfidCursor)) +
        (rfidLastEventId ? "&seen=" + encodeURIComponent(rfidLastEventId) : "") +
        (rfidPriming ? "&prime=1" : "") +
        (diagnosticMode ? (diagnosticEventPending ? "&demo=event" : "&demo=idle") : ""),
      true
    );
    xhr.timeout = 8000;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || finished || generation !== rfidPollGeneration) return;
      if (xhr.status === 204) {
        if (rfidPriming) {
          rfidCursor = Number(xhr.getResponseHeader("X-Kiosk-Time")) || Date.now();
          rfidPriming = false;
          finish(250);
        } else {
          finish(rfidPurpose === "ambient" ? RFID_AMBIENT_POLL_MS : 1800);
        }
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        var result = {};
        try { result = JSON.parse(xhr.responseText || "{}"); } catch (parseError) {
          result = parseError ? {} : result;
        }
        if (result.ok) {
          diagnosticEventPending = false;
          rfidCursor = Math.max(rfidCursor, Number(result.ocurridoEn) || Date.now());
          rfidLastEventId = String(result.eventoId || "");
          showGlobalAttendanceWelcome(result);
          if (rfidPurpose === "payment") {
            stopRfidPolling();
            createPayment("esp32", "", result.eventoId);
          } else if (rfidPurpose === "attendance") {
            stopRfidPolling();
            showAttendanceResult(result);
          } else {
            finish(Number(result.pendientes) > 0 ? 250 : RFID_AMBIENT_POLL_MS);
          }
          return;
        }
      }
      if (rfidPurpose !== "ambient") {
        setTagListening("Lector conectado", "Sigue las instrucciones y acerca tu tarjeta.");
      }
      finish(xhr.status === 429 ? 5000 : (rfidPurpose === "ambient" ? RFID_AMBIENT_POLL_MS : 2600));
    };
    xhr.onerror = function () {
      if (generation !== rfidPollGeneration) return;
      if (rfidPurpose !== "ambient") {
        setTagListening("Reconectando…", "El lector sigue funcionando; la pantalla volverá a enlazarse.");
      }
      finish(rfidPurpose === "ambient" ? 5000 : 3500);
    };
    xhr.ontimeout = function () {
      if (generation !== rfidPollGeneration) return;
      if (rfidPurpose !== "ambient") {
        setTagListening("Reconectando…", "El lector sigue funcionando; la pantalla volverá a enlazarse.");
      }
      finish(rfidPurpose === "ambient" ? 5000 : 3500);
    };
    xhr.send();
  }

  function startRfidPollingFor(purpose) {
    stopRfidPolling();
    rfidPurpose = purpose === "payment"
      ? "payment"
      : (purpose === "attendance" ? "attendance" : "ambient");
    rfidPollActive = true;
    rfidPriming = true;
    rfidCursor = 0;
    rfidLastEventId = "";
    if (rfidPurpose !== "ambient") {
      setTagListening("Esperando tu tarjeta", "La bienvenida aparecerá aquí automáticamente.");
    }
    pollRfidEvent(rfidPollGeneration);
  }

  function startAmbientRfidPolling() {
    if (document.hidden) return;
    startRfidPollingFor("ambient");
  }

  function startRfidPolling() {
    startRfidPollingFor("attendance");
  }

  function resetAttendance(restartAmbient) {
    rfidPurpose = "attendance";
    var methods = document.getElementById("attendance-methods");
    var tagMode = document.getElementById("tag-mode");
    var pinMode = document.getElementById("pin-mode");
    var form = document.getElementById("attendance-pin-form");
    var result = document.getElementById("attendance-success");
    var input = document.getElementById("attendance-pin");
    var button = document.getElementById("submit-attendance-pin");
    if (!methods) return;
    stopRfidPolling();
    methods.style.display = "grid";
    tagMode.classList.remove("is-active");
    tagMode.setAttribute("aria-hidden", "true");
    pinMode.classList.remove("is-active");
    pinMode.setAttribute("aria-hidden", "true");
    form.style.display = "block";
    result.classList.remove("is-visible");
    result.setAttribute("aria-hidden", "true");
    input.value = "";
    input.disabled = false;
    button.disabled = true;
    button.textContent = "Registrar asistencia";
    document.getElementById("attendance-result-title").textContent = "Asistencia registrada";
    document.getElementById("attendance-result-message").textContent = "";
    document.getElementById("welcome-week").textContent = "—";
    document.getElementById("welcome-class").textContent = "Sin clase activa";
    document.getElementById("welcome-class-detail").textContent = "Tu entrada general quedó registrada.";
    document.getElementById("welcome-achievement").textContent = "—";
    document.getElementById("welcome-achievement-detail").textContent = "";
    document.getElementById("welcome-progress").style.width = "0%";
    document.getElementById("welcome-total").textContent = "";
    setPinMessage("", false);
    setTagListening("Esperando tu tarjeta", "La bienvenida aparecerá aquí automáticamente.");
    if (attendanceTimer) window.clearTimeout(attendanceTimer);
    if (restartAmbient !== false) startAmbientRfidPolling();
  }

  function showAttendanceMode(mode) {
    var methods = document.getElementById("attendance-methods");
    var tagMode = document.getElementById("tag-mode");
    var pinMode = document.getElementById("pin-mode");
    methods.style.display = "none";
    tagMode.classList.remove("is-active");
    pinMode.classList.remove("is-active");
    tagMode.setAttribute("aria-hidden", "true");
    pinMode.setAttribute("aria-hidden", "true");
    if (mode === "tag") {
      tagMode.classList.add("is-active");
      tagMode.setAttribute("aria-hidden", "false");
      startRfidPolling();
    } else {
      startAmbientRfidPolling();
      pinMode.classList.add("is-active");
      pinMode.setAttribute("aria-hidden", "false");
      window.setTimeout(function () {
        document.getElementById("attendance-pin").focus();
      }, 120);
    }
  }

  function showAttendanceResult(result) {
    var form = document.getElementById("attendance-pin-form");
    var card = document.getElementById("attendance-success");
    var methods = document.getElementById("attendance-methods");
    var tagMode = document.getElementById("tag-mode");
    var pinMode = document.getElementById("pin-mode");
    var welcome = result.bienvenida || {};
    var activeClass = welcome.claseActiva || null;
    var achievement = welcome.siguienteLogro || {};
    var total = Number(welcome.totalAsistencias) || 0;
    var target = Number(achievement.meta) || 0;
    var progress = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
    var firstName = String(result.nombre || "Atleta").replace(/^\s+|\s+$/g, "").split(/\s+/)[0];
    document.getElementById("attendance-result-title").textContent = result.duplicado
      ? "¡Qué gusto verte, " + firstName + "!"
      : "¡Bienvenido, " + firstName + "!";
    document.getElementById("attendance-result-message").textContent =
      result.mensaje || "Tu registro quedó guardado correctamente.";
    document.getElementById("welcome-week").textContent = String(Number(welcome.asistenciasSemana) || 0);
    document.getElementById("welcome-class").textContent = activeClass && activeClass.disciplina
      ? activeClass.disciplina
      : "Sin clase activa";
    document.getElementById("welcome-class-detail").textContent = activeClass && activeClass.tema
      ? activeClass.tema
      : "Tu entrada general quedó registrada.";
    document.getElementById("welcome-achievement").textContent = achievement.nombre || "Sigue entrenando";
    document.getElementById("welcome-achievement-detail").textContent = achievement.completado
      ? "¡Completaste todos los hitos!"
      : (Number(achievement.faltan) || 0) + ((Number(achievement.faltan) || 0) === 1
        ? " asistencia para desbloquearlo"
        : " asistencias para desbloquearlo");
    document.getElementById("welcome-progress").style.width = progress + "%";
    document.getElementById("welcome-total").textContent = total === 1
      ? "1 asistencia acumulada"
      : total + " asistencias acumuladas";
    stopRfidPolling();
    methods.style.display = "none";
    tagMode.classList.remove("is-active");
    tagMode.setAttribute("aria-hidden", "true");
    pinMode.classList.remove("is-active");
    pinMode.setAttribute("aria-hidden", "true");
    form.style.display = "none";
    card.classList.add("is-visible");
    card.setAttribute("aria-hidden", "false");
    if (attendanceTimer) window.clearTimeout(attendanceTimer);
    attendanceTimer = window.setTimeout(resetAttendance, 15000);
    window.setTimeout(startAmbientRfidPolling, 1200);
  }

  function submitAttendancePin(event) {
    event.preventDefault();
    resetInactivity();
    var input = document.getElementById("attendance-pin");
    var button = document.getElementById("submit-attendance-pin");
    var pin = input.value.replace(/\D/g, "").slice(0, 4);
    if (pin.length !== 4) {
      setPinMessage("Ingresa los 4 dígitos de tu PIN.", false);
      return;
    }
    if (window.navigator.onLine === false) {
      input.value = "";
      button.disabled = true;
      setPinMessage("La asistencia con PIN requiere conexión. Tu PIN no se guardó en el dispositivo.", false);
      return;
    }

    input.disabled = true;
    button.disabled = true;
    button.textContent = "Registrando…";
    setPinMessage("", false);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/ipad/asistencia", true);
    xhr.timeout = 15000;
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var result = {};
      try { result = JSON.parse(xhr.responseText || "{}"); } catch (parseError) {
        result = { mensaje: parseError ? "Respuesta inválida del servidor." : "" };
      }
      if (xhr.status >= 200 && xhr.status < 300 && result.ok) {
        input.value = "";
        showAttendanceResult(result);
      } else {
        input.disabled = false;
        input.value = "";
        button.disabled = true;
        button.textContent = "Registrar asistencia";
        setPinMessage(result.mensaje || "No se pudo registrar. Inténtalo nuevamente.", false);
        input.focus();
      }
    };
    xhr.onerror = function () {
      input.disabled = false;
      input.value = "";
      button.disabled = true;
      button.textContent = "Registrar asistencia";
      setPinMessage("No hay conexión con el servidor. Revisa internet.", false);
    };
    xhr.ontimeout = function () {
      input.disabled = false;
      input.value = "";
      button.disabled = true;
      button.textContent = "Registrar asistencia";
      setPinMessage("El servidor tardó demasiado. Inténtalo nuevamente.", false);
    };
    xhr.send(JSON.stringify({ pin: pin }));
  }

  function requestJson(method, url, body, done) {
    if (window.navigator.onLine === false) {
      done(0, { mensaje: "Esta función requiere conexión. La pantalla se actualizará cuando vuelva internet." });
      return;
    }
    var xhr = new XMLHttpRequest();
    var finished = false;
    function complete(status, result) {
      if (finished) return;
      finished = true;
      done(status, result);
    }
    xhr.open(method, url, true);
    xhr.timeout = 15000;
    xhr.setRequestHeader("Accept", "application/json");
    if (body !== null) xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var result = {};
      try { result = JSON.parse(xhr.responseText || "{}"); } catch (error) {
        result = { mensaje: error ? "Respuesta inválida del servidor." : "" };
      }
      complete(xhr.status, result);
    };
    xhr.onerror = function () { complete(0, { mensaje: "No hay conexión con el servidor." }); };
    xhr.ontimeout = function () { complete(0, { mensaje: "El servidor tardó demasiado." }); };
    xhr.send(body === null ? null : JSON.stringify(body));
  }

  function stopPaymentStatus() {
    if (paymentStatusTimer) window.clearTimeout(paymentStatusTimer);
    paymentStatusTimer = null;
    paymentToken = "";
  }

  function setPaymentMessage(message, info) {
    var element = document.getElementById("payment-pin-message");
    element.textContent = message || "";
    if (info) element.classList.add("is-info");
    else element.classList.remove("is-info");
  }

  function resetPayment(restartAmbient) {
    stopRfidPolling();
    stopPaymentStatus();
    rfidPurpose = "payment";
    document.getElementById("payment-methods").style.display = "grid";
    document.getElementById("payment-pin-mode").classList.remove("is-active");
    document.getElementById("payment-pin-mode").setAttribute("aria-hidden", "true");
    document.getElementById("payment-reader-mode").classList.remove("is-active");
    document.getElementById("payment-reader-mode").setAttribute("aria-hidden", "true");
    document.getElementById("payment-result").classList.remove("is-visible");
    document.getElementById("payment-result").setAttribute("aria-hidden", "true");
    document.getElementById("payment-pin").value = "";
    document.getElementById("payment-pin").disabled = false;
    document.getElementById("submit-payment-pin").disabled = true;
    document.getElementById("submit-payment-pin").textContent = "Generar QR de confirmación";
    document.getElementById("payment-qr").removeAttribute("src");
    document.getElementById("payment-status").textContent = "Esperando confirmación…";
    setPaymentMessage("", false);
    setTagListening("Esperando tu tarjeta", "Acerca tu tag al lector y espera la luz verde.");
    if (restartAmbient !== false) startAmbientRfidPolling();
  }

  function showPaymentMode(mode) {
    resetPayment();
    document.getElementById("payment-methods").style.display = "none";
    if (mode === "esp32") {
      document.getElementById("payment-reader-mode").classList.add("is-active");
      document.getElementById("payment-reader-mode").setAttribute("aria-hidden", "false");
      startRfidPollingFor("payment");
    } else {
      document.getElementById("payment-pin-mode").classList.add("is-active");
      document.getElementById("payment-pin-mode").setAttribute("aria-hidden", "false");
      window.setTimeout(function () { document.getElementById("payment-pin").focus(); }, 100);
    }
  }

  function pollPaymentStatus(token) {
    if (!token || paymentToken !== token) return;
    requestJson("GET", "/api/ipad/pago?token=" + encodeURIComponent(token), null, function (status, result) {
      if (paymentToken !== token) return;
      if (status >= 200 && status < 300 && result.confirmada) {
        document.getElementById("payment-status").textContent = "✓ Solicitud confirmada. Ya puedes cerrar esta pantalla.";
        paymentToken = "";
        return;
      }
      paymentStatusTimer = window.setTimeout(function () { pollPaymentStatus(token); }, status === 429 ? 5000 : 2800);
    });
  }

  function showPaymentResult(result) {
    stopRfidPolling();
    document.getElementById("payment-methods").style.display = "none";
    document.getElementById("payment-pin-mode").classList.remove("is-active");
    document.getElementById("payment-reader-mode").classList.remove("is-active");
    document.getElementById("payment-result-name").textContent = result.alumno.nombre;
    document.getElementById("payment-result-detail").textContent =
      "Mensualidad " + result.periodo + " · $" + Number(result.alumno.monto).toFixed(2) + " MXN";
    document.getElementById("payment-qr").setAttribute("src", result.qrDataUrl);
    document.getElementById("payment-result").classList.add("is-visible");
    document.getElementById("payment-result").setAttribute("aria-hidden", "false");
    paymentToken = result.token;
    pollPaymentStatus(paymentToken);
    window.setTimeout(startAmbientRfidPolling, 1200);
  }

  function createPayment(method, pin, eventId) {
    var button = document.getElementById("submit-payment-pin");
    if (method === "pin") {
      button.disabled = true;
      button.textContent = "Preparando…";
      document.getElementById("payment-pin").disabled = true;
      setPaymentMessage("", false);
    } else {
      setTagListening("Tarjeta identificada", "Preparando tu QR de confirmación…");
    }
    requestJson("POST", "/api/ipad/pago", {
      metodo: method,
      pin: pin,
      eventoId: eventId || ""
    }, function (status, result) {
      if (status >= 200 && status < 300 && result.ok) {
        document.getElementById("payment-pin").value = "";
        showPaymentResult(result);
        return;
      }
      if (method === "pin") {
        document.getElementById("payment-pin").disabled = false;
        document.getElementById("payment-pin").value = "";
        button.disabled = true;
        button.textContent = "Generar QR de confirmación";
        setPaymentMessage(result.mensaje || "No se pudo preparar la solicitud.", false);
        document.getElementById("payment-pin").focus();
      } else {
        setTagListening("No se pudo validar", result.mensaje || "Acerca nuevamente tu tag.");
        window.setTimeout(function () { startRfidPollingFor("payment"); }, 1800);
      }
    });
  }

  function submitPaymentPin(event) {
    event.preventDefault();
    resetInactivity();
    var pin = document.getElementById("payment-pin").value.replace(/\D/g, "").slice(0, 4);
    if (pin.length !== 4) {
      setPaymentMessage("Ingresa los 4 dígitos de tu PIN.", false);
      return;
    }
    createPayment("pin", pin, "");
  }

  function setPassMessage(id, message, info) {
    var element = document.getElementById(id);
    element.textContent = message || "";
    if (info) element.classList.add("is-info");
    else element.classList.remove("is-info");
  }

  function resetPasses() {
    appointmentLookupType = "";
    appointmentLookupValue = "";
    document.getElementById("pass-methods").style.display = "grid";
    document.getElementById("pass-guest-mode").classList.remove("is-active");
    document.getElementById("pass-guest-mode").setAttribute("aria-hidden", "true");
    document.getElementById("pass-appointment-mode").classList.remove("is-active");
    document.getElementById("pass-appointment-mode").setAttribute("aria-hidden", "true");
    document.getElementById("pass-result").classList.remove("is-visible");
    document.getElementById("pass-result").setAttribute("aria-hidden", "true");
    document.getElementById("guest-pass-form").reset();
    document.getElementById("appointment-search-form").reset();
    document.getElementById("appointment-results").innerHTML = "";
    document.getElementById("pass-qr").removeAttribute("src");
    document.getElementById("submit-guest-pass").disabled = false;
    document.getElementById("submit-guest-pass").textContent = "Generar pase de 24 horas";
    document.getElementById("search-appointment").disabled = false;
    document.getElementById("search-appointment").textContent = "Buscar clase agendada";
    setPassMessage("guest-pass-message", "", false);
    setPassMessage("appointment-message", "", false);
  }

  function showPassMode(mode) {
    resetPasses();
    document.getElementById("pass-methods").style.display = "none";
    var id = mode === "appointment" ? "pass-appointment-mode" : "pass-guest-mode";
    document.getElementById(id).classList.add("is-active");
    document.getElementById(id).setAttribute("aria-hidden", "false");
  }

  function showPassResult(result, title) {
    document.getElementById("pass-methods").style.display = "none";
    document.getElementById("pass-guest-mode").classList.remove("is-active");
    document.getElementById("pass-appointment-mode").classList.remove("is-active");
    document.getElementById("pass-result-title").textContent = title || "Pase temporal generado";
    document.getElementById("pass-qr").setAttribute("src", result.pase.qrDataUrl);
    document.getElementById("pass-result").classList.add("is-visible");
    document.getElementById("pass-result").setAttribute("aria-hidden", "false");
  }

  function submitGuestPass(event) {
    event.preventDefault();
    resetInactivity();
    var pin = document.getElementById("guest-host-pin").value.replace(/\D/g, "").slice(0, 4);
    var name = document.getElementById("guest-name").value.replace(/^\s+|\s+$/g, "").slice(0, 80);
    var discipline = document.getElementById("guest-discipline").value;
    var button = document.getElementById("submit-guest-pass");
    if (pin.length !== 4) { setPassMessage("guest-pass-message", "Ingresa tu PIN de 4 dígitos.", false); return; }
    if (name.length < 2) { setPassMessage("guest-pass-message", "Escribe el nombre del invitado.", false); return; }
    button.disabled = true;
    button.textContent = "Generando…";
    setPassMessage("guest-pass-message", "", false);
    requestJson("POST", "/api/ipad/pases", {
      accion: "crear_invitado", pin: pin, nombreInvitado: name, disciplina: discipline
    }, function (status, result) {
      document.getElementById("guest-host-pin").value = "";
      if (status >= 200 && status < 300 && result.ok) { showPassResult(result, "Pase para " + name); return; }
      button.disabled = false;
      button.textContent = "Generar pase de 24 horas";
      setPassMessage("guest-pass-message", result.mensaje || "No se pudo generar el pase.", false);
    });
  }

  function generateAppointmentPass(appointmentId, button) {
    button.disabled = true;
    button.textContent = "Generando…";
    requestJson("POST", "/api/ipad/pases", {
      accion: "crear_desde_agenda",
      tipoBusqueda: appointmentLookupType,
      busqueda: appointmentLookupValue,
      citaId: appointmentId
    }, function (status, result) {
      if (status >= 200 && status < 300 && result.ok) { showPassResult(result, "Pase de clase de prueba"); return; }
      button.disabled = false;
      button.textContent = "Generar pase";
      setPassMessage("appointment-message", result.mensaje || "No se pudo generar el pase.", false);
    });
  }

  function renderAppointments(items) {
    var host = document.getElementById("appointment-results");
    host.innerHTML = "";
    if (!items.length) {
      setPassMessage("appointment-message", "No encontramos una cita vigente con esos datos.", false);
      return;
    }
    setPassMessage("appointment-message", "Selecciona la cita para generar su pase.", true);
    for (var index = 0; index < items.length; index += 1) {
      (function (item) {
        var card = document.createElement("div");
        var name = document.createElement("b");
        var detail = document.createElement("small");
        var button = document.createElement("button");
        card.className = "appointment-card";
        name.textContent = item.nombre;
        detail.textContent = item.disciplina + " · " + item.horario;
        button.type = "button";
        button.textContent = "Generar pase";
        button.addEventListener("click", function () { generateAppointmentPass(item.id, button); }, false);
        card.appendChild(name);
        card.appendChild(detail);
        card.appendChild(button);
        host.appendChild(card);
      }(items[index]));
    }
  }

  function searchAppointments(event) {
    event.preventDefault();
    resetInactivity();
    var raw = document.getElementById("appointment-query").value.replace(/^\s+|\s+$/g, "");
    var digits = onlyDigits(raw);
    var phoneLike = /^[\d\s()+\-]+$/.test(raw);
    appointmentLookupType = phoneLike ? "telefono" : "nombre";
    appointmentLookupValue = appointmentLookupType === "telefono" ? digits : raw.slice(0, 80);
    var button = document.getElementById("search-appointment");
    if (appointmentLookupType === "telefono" && appointmentLookupValue.length < 10) {
      setPassMessage("appointment-message", "Escribe los 10 dígitos del teléfono usado al agendar.", false);
      return;
    }
    if (appointmentLookupType === "nombre" && appointmentLookupValue.length < 4) {
      setPassMessage("appointment-message", "Escribe tu nombre completo tal como lo registraste.", false);
      return;
    }
    button.disabled = true;
    button.textContent = "Buscando…";
    document.getElementById("appointment-results").innerHTML = "";
    setPassMessage("appointment-message", "", false);
    requestJson("POST", "/api/ipad/pases", {
      accion: "buscar_agenda",
      tipoBusqueda: appointmentLookupType,
      busqueda: appointmentLookupValue
    }, function (status, result) {
      button.disabled = false;
      button.textContent = "Buscar clase agendada";
      if (status >= 200 && status < 300 && result.ok) { renderAppointments(result.citas || []); return; }
      setPassMessage("appointment-message", result.mensaje || "No se pudo buscar la cita.", false);
    });
  }

  function stopAccountSession() {
    if (accountTimer) window.clearTimeout(accountTimer);
    if (accountCountdownTimer) window.clearInterval(accountCountdownTimer);
    accountTimer = null;
    accountCountdownTimer = null;
    accountSeconds = 45;
  }

  function setAccountMessage(message, info) {
    var element = document.getElementById("account-message");
    element.textContent = message || "";
    if (info) element.classList.add("is-info");
    else element.classList.remove("is-info");
  }

  function resetAccount() {
    stopAccountSession();
    var form = document.getElementById("account-pin-form");
    var summary = document.getElementById("account-summary");
    var input = document.getElementById("account-pin");
    var button = document.getElementById("submit-account-pin");
    form.style.display = "grid";
    summary.classList.remove("is-visible");
    summary.setAttribute("aria-hidden", "true");
    input.value = "";
    input.disabled = false;
    button.disabled = true;
    button.textContent = "Ver mi cuenta";
    document.getElementById("account-countdown").textContent = "45";
    document.getElementById("account-name").textContent = "Hola, atleta";
    document.getElementById("account-discipline").textContent = "";
    document.getElementById("account-payment-status").textContent = "—";
    document.getElementById("account-payment-detail").textContent = "";
    document.getElementById("account-week").textContent = "—";
    document.getElementById("account-attendance-detail").textContent = "";
    document.getElementById("account-class").textContent = "—";
    document.getElementById("account-class-detail").textContent = "";
    document.getElementById("account-passes").textContent = "—";
    document.getElementById("account-pass-detail").textContent = "";
    setAccountMessage("", false);
  }

  function shortDate(value) {
    var parts = String(value || "").split("-");
    return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : "—";
  }

  function reservationDate(value) {
    var date = new Date(value || "");
    if (isNaN(date.getTime())) return "Horario por confirmar";
    return date.toLocaleString("es-MX", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  }

  function paymentLabel(status) {
    var labels = {
      exento: "Exento",
      pagado: "Pagado",
      solicitud_pendiente: "Por confirmar",
      vencido: "Vencido",
      pendiente: "Pendiente"
    };
    return labels[status] || "Pendiente";
  }

  function startAccountCountdown() {
    stopAccountSession();
    accountSeconds = 45;
    document.getElementById("account-countdown").textContent = String(accountSeconds);
    accountCountdownTimer = window.setInterval(function () {
      accountSeconds -= 1;
      document.getElementById("account-countdown").textContent = String(Math.max(0, accountSeconds));
      if (accountSeconds <= 0) resetAccount();
    }, 1000);
    accountTimer = window.setTimeout(resetAccount, 45000);
  }

  function showAccountSummary(result) {
    var payment = result.payment || {};
    var attendance = result.attendance || {};
    var passes = result.passes || {};
    var paymentCard = document.querySelector(".account-card-payment");
    document.getElementById("account-pin-form").style.display = "none";
    document.getElementById("account-name").textContent = "Hola, " + result.athlete.name;
    document.getElementById("account-discipline").textContent = result.athlete.discipline || "Atleta Albatros";
    document.getElementById("account-payment-status").textContent = paymentLabel(payment.status);
    document.getElementById("account-payment-detail").textContent = payment.status === "exento"
      ? "Perfil sin mensualidad"
      : "$" + Number(payment.amount || 0).toFixed(2) + " MXN · vence " + shortDate(payment.dueDate);
    paymentCard.classList.remove("is-warning");
    paymentCard.classList.remove("is-danger");
    if (payment.status === "pendiente" || payment.status === "solicitud_pendiente") paymentCard.classList.add("is-warning");
    if (payment.status === "vencido") paymentCard.classList.add("is-danger");
    document.getElementById("account-week").textContent = String(Number(attendance.week) || 0) + " asistencias";
    document.getElementById("account-attendance-detail").textContent =
      (Number(attendance.month) || 0) + " este mes · racha de " + (Number(attendance.streakWeeks) || 0) + " semanas";

    var classTitle = "Sin reserva";
    var classDetail = "Consulta el calendario para reservar.";
    if (result.activeClass) {
      classTitle = result.activeClass.discipline || "Clase activa";
      classDetail = result.activeClass.topic || "La clase ya está en curso.";
    } else if (result.nextReservation) {
      classTitle = result.nextReservation.name || result.nextReservation.discipline;
      classDetail = reservationDate(result.nextReservation.startsAt);
    }
    document.getElementById("account-class").textContent = classTitle;
    document.getElementById("account-class-detail").textContent = classDetail;
    document.getElementById("account-passes").textContent = String(Number(passes.active) || 0) + " vigentes";
    document.getElementById("account-pass-detail").textContent = passes.guests && passes.guests.length
      ? passes.guests.join(" · ")
      : "No tienes pases activos.";
    document.getElementById("account-summary").classList.add("is-visible");
    document.getElementById("account-summary").setAttribute("aria-hidden", "false");
    startAccountCountdown();
  }

  function submitAccountPin(event) {
    event.preventDefault();
    resetInactivity();
    var input = document.getElementById("account-pin");
    var button = document.getElementById("submit-account-pin");
    var pin = input.value.replace(/\D/g, "").slice(0, 4);
    if (pin.length !== 4) {
      setAccountMessage("Ingresa los 4 dígitos de tu PIN.", false);
      return;
    }
    input.disabled = true;
    button.disabled = true;
    button.textContent = "Consultando…";
    setAccountMessage("", false);
    requestJson("POST", "/api/ipad/mi-cuenta", { pin: pin }, function (status, result) {
      input.value = "";
      if (status >= 200 && status < 300 && result.ok) {
        showAccountSummary(result);
        return;
      }
      input.disabled = false;
      button.disabled = true;
      button.textContent = "Ver mi cuenta";
      setAccountMessage(result.mensaje || "No se pudo consultar tu cuenta.", false);
      input.focus();
    });
  }

  function showSuccess(queuedOffline) {
    document.getElementById("trial-success-title").textContent = queuedOffline
      ? "Solicitud guardada"
      : "Solicitud enviada";
    document.getElementById("trial-success-message").textContent = queuedOffline
      ? "No hay internet. Guardamos la solicitud en este iPad y la enviaremos automáticamente al recuperar la conexión."
      : "Recibimos tus datos. Nos pondremos en contacto para confirmar tu clase.";
    document.getElementById("trial-form").style.display = "none";
    document.getElementById("success-card").classList.add("is-visible");
    document.getElementById("success-card").setAttribute("aria-hidden", "false");
    if (successTimer) window.clearTimeout(successTimer);
    successTimer = window.setTimeout(clearPersonalData, 30000);
  }

  function submitTrial(event) {
    event.preventDefault();
    resetInactivity();
    var name = document.getElementById("trial-name").value.replace(/^\s+|\s+$/g, "").slice(0, 80);
    var rawPhone = document.getElementById("trial-phone").value;
    var phone = onlyDigits(rawPhone);
    var discipline = document.getElementById("trial-discipline").value;
    var time = document.getElementById("trial-time").value;
    var notes = document.getElementById("trial-notes").value.replace(/^\s+|\s+$/g, "").slice(0, 300);
    var website = document.getElementById("trial-website").value;
    var button = document.getElementById("submit-trial");
    var finished = false;

    if (name.length < 2) { showFormMessage("Escribe tu nombre completo."); return; }
    if (phone.length < 10) { showFormMessage("Escribe un teléfono válido de al menos 10 dígitos."); return; }
    if (!time || (schedules[discipline] || []).indexOf(time) === -1) { showFormMessage("Selecciona un horario disponible."); return; }

    showFormMessage("");
    var payload = {
      nombre: name,
      telefono: phone,
      disciplina: discipline,
      horario: time,
      sede: "MMA",
      notas: notes,
      origen: "kiosco",
      website: website
    };

    function saveForLater() {
      if (finished) return;
      finished = true;
      button.disabled = false;
      button.textContent = "Solicitar mi clase";
      if (queueTrialRequest(payload)) showSuccess(true);
      else showFormMessage("No pudimos guardar la solicitud en este iPad. Revisa el espacio disponible e inténtalo de nuevo.");
    }

    if (window.navigator.onLine === false) {
      saveForLater();
      return;
    }

    button.disabled = true;
    button.textContent = "Enviando…";

    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/clase-prueba", true);
    xhr.timeout = 15000;
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || finished) return;
      if (xhr.status === 0) return;
      finished = true;
      button.disabled = false;
      button.textContent = "Solicitar mi clase";
      var result = {};
      try { result = JSON.parse(xhr.responseText || "{}"); } catch (parseError) {
        result = { mensaje: parseError ? "Respuesta inválida del servidor." : "" };
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        showSuccess(false);
      } else {
        showFormMessage(result.mensaje || "No se pudo enviar la solicitud. Inténtalo nuevamente.");
      }
    };
    xhr.onerror = saveForLater;
    xhr.ontimeout = saveForLater;
    xhr.send(JSON.stringify(payload));
  }

  buildDots();
  renderSlide(false);
  setViewportHeight();
  refreshDisplayMode();
  updateTimes();
  updateClock();
  registerOfflineShell();
  updateNetworkStatus();
  scheduleOfflineSync(1200);
  scheduleCarouselAfterIdle();
  if (window.location.search.indexOf("kiosco=1") === -1) startAmbientRfidPolling();
  window.setInterval(updateClock, 30000);
  window.setInterval(refreshDisplayMode, 1500);
  window.setInterval(function () {
    if (window.navigator.onLine !== false && readOfflineTrials().length) scheduleOfflineSync(0);
  }, 60000);

  window.addEventListener("resize", setViewportHeight, false);
  window.addEventListener("orientationchange", function () { window.setTimeout(setViewportHeight, 250); }, false);
  window.addEventListener("online", function () { updateNetworkStatus(); scheduleOfflineSync(250); }, false);
  window.addEventListener("offline", updateNetworkStatus, false);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopCarousel();
    else if (!app.classList.contains("kiosk-active")) scheduleCarouselAfterIdle();
  }, false);
  document.addEventListener("fullscreenchange", refreshDisplayMode, false);
  document.addEventListener("webkitfullscreenchange", refreshDisplayMode, false);
  document.addEventListener("touchstart", edgeExitStart, false);
  document.addEventListener("touchmove", edgeExitMove, false);
  document.addEventListener("touchend", edgeExitEnd, false);
  document.addEventListener("touchcancel", edgeExitEnd, false);
  viewport.addEventListener("touchstart", touchStart, false);
  viewport.addEventListener("touchmove", touchMove, false);
  viewport.addEventListener("touchend", touchEnd, false);
  viewport.addEventListener("touchcancel", touchEnd, false);
  document.getElementById("home-view").addEventListener("mousedown", pauseCarouselForInteraction, false);
  document.getElementById("home-view").addEventListener("keydown", pauseCarouselForInteraction, false);
  document.getElementById("open-kiosk").addEventListener("click", function () { openKiosk(); }, false);
  document.getElementById("close-kiosk").addEventListener("click", closeKiosk, false);
  document.getElementById("trial-discipline").addEventListener("change", updateTimes, false);
  document.getElementById("trial-phone").addEventListener("input", function () { this.value = this.value.replace(/[^\d +()\-]/g, ""); }, false);
  document.getElementById("trial-form").addEventListener("submit", submitTrial, false);
  document.getElementById("new-request").addEventListener("click", clearPersonalData, false);
  document.getElementById("attendance-pin").addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 4);
    document.getElementById("submit-attendance-pin").disabled = this.value.length !== 4;
    setPinMessage("", false);
  }, false);
  document.getElementById("attendance-pin-form").addEventListener("submit", submitAttendancePin, false);
  document.getElementById("attendance-finish").addEventListener("click", resetAttendance, false);
  document.getElementById("payment-pin").addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 4);
    document.getElementById("submit-payment-pin").disabled = this.value.length !== 4;
    setPaymentMessage("", false);
  }, false);
  document.getElementById("payment-pin-form").addEventListener("submit", submitPaymentPin, false);
  document.getElementById("payment-finish").addEventListener("click", resetPayment, false);
  document.getElementById("guest-host-pin").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 4); }, false);
  document.getElementById("guest-pass-form").addEventListener("submit", submitGuestPass, false);
  document.getElementById("appointment-search-form").addEventListener("submit", searchAppointments, false);
  document.getElementById("pass-finish").addEventListener("click", resetPasses, false);
  document.getElementById("account-pin").addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 4);
    document.getElementById("submit-account-pin").disabled = this.value.length !== 4;
    setAccountMessage("", false);
  }, false);
  document.getElementById("account-pin-form").addEventListener("submit", submitAccountPin, false);
  document.getElementById("account-close").addEventListener("click", resetAccount, false);
  document.getElementById("close-display-guide").addEventListener("click", closeDisplayGuide, false);
  document.getElementById("understood-display-guide").addEventListener("click", closeDisplayGuide, false);
  document.getElementById("attendance-more-button").addEventListener("click", function (event) {
    var menu = document.getElementById("attendance-more-menu");
    var expanded = this.getAttribute("aria-expanded") === "true";
    event.stopPropagation();
    this.setAttribute("aria-expanded", expanded ? "false" : "true");
    if (expanded) menu.classList.remove("is-visible");
    else menu.classList.add("is-visible");
    menu.setAttribute("aria-hidden", expanded ? "true" : "false");
    resetInactivity();
  }, false);
  document.getElementById("attendance-more-menu").addEventListener("click", function (event) { event.stopPropagation(); }, false);
  document.getElementById("open-welcome-display").addEventListener("click", enterWelcomeDisplay, false);
  document.getElementById("open-welcome-admin").addEventListener("click", function () {
    enterWelcomeDisplay();
    requestWelcomeAuthorization("admin");
  }, false);
  document.getElementById("welcome-display-admin").addEventListener("click", function () {
    requestWelcomeAuthorization("admin");
  }, false);
  document.getElementById("welcome-display-exit").addEventListener("click", function () {
    requestWelcomeAuthorization("exit");
  }, false);
  document.getElementById("welcome-exit-cancel").addEventListener("click", hideWelcomeExitDialog, false);
  document.getElementById("welcome-exit-pin").addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 4);
    document.getElementById("welcome-exit-error").textContent = "";
  }, false);
  document.getElementById("welcome-exit-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var input = document.getElementById("welcome-exit-pin");
    if (input.value === welcomeSettings.pin) {
      hideWelcomeExitDialog();
      if (welcomeAuthAction === "admin") openWelcomeAdmin();
      else exitWelcomeDisplay();
      return;
    }
    input.value = "";
    document.getElementById("welcome-exit-error").textContent = "PIN incorrecto.";
    input.focus();
  }, false);
  document.getElementById("welcome-new-pin").addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 4);
  }, false);
  document.getElementById("welcome-admin-close").addEventListener("click", closeWelcomeAdmin, false);
  document.getElementById("welcome-settings-save").addEventListener("click", saveWelcomeSettings, false);
  document.getElementById("welcome-history-clear").addEventListener("click", function () {
    writeWelcomeHistory([]);
    renderWelcomeHistory();
  }, false);

  var bookingButtons = document.getElementsByClassName("js-open-booking");
  var menuButtons = document.getElementsByClassName("kiosk-menu-button");
  var hubButtons = document.querySelectorAll("[data-hub-panel]");
  var layoutButtons = document.querySelectorAll("[data-kiosk-layout-button]");
  var layoutToggle = document.getElementById("kiosk-layout-toggle");
  var attendanceMethods = document.getElementsByClassName("attendance-method");
  var attendanceBackButtons = document.getElementsByClassName("js-attendance-back");
  var paymentMethods = document.querySelectorAll("[data-payment-mode]");
  var paymentBackButtons = document.getElementsByClassName("js-payment-back");
  var passMethods = document.querySelectorAll("[data-pass-mode]");
  var passBackButtons = document.getElementsByClassName("js-pass-back");
  var accountActions = document.querySelectorAll("[data-account-action]");
  var displayModeButtons = document.getElementsByClassName("js-display-mode");
  var index;
  for (index = 0; index < bookingButtons.length; index += 1) {
    bookingButtons[index].addEventListener("click", function () { openKiosk("booking-panel"); }, false);
  }
  for (index = 0; index < menuButtons.length; index += 1) {
    menuButtons[index].addEventListener("click", function () { showPanel(this.getAttribute("data-panel")); resetInactivity(); }, false);
  }
  for (index = 0; index < hubButtons.length; index += 1) {
    hubButtons[index].addEventListener("click", function () { openHubPanel(this.getAttribute("data-hub-panel")); }, false);
  }
  for (index = 0; index < layoutButtons.length; index += 1) {
    layoutButtons[index].addEventListener("click", function () {
      var requested = this.getAttribute("data-kiosk-layout-button");
      var expanded = layoutToggle && layoutToggle.classList.contains("is-expanded");
      var current = kiosk.getAttribute("data-kiosk-layout");
      if (!expanded && requested === current) {
        layoutToggle.classList.add("is-expanded");
        layoutToggle.setAttribute("aria-expanded", "true");
        scheduleLayoutToggleCollapse();
        resetInactivity();
        return;
      }
      setKioskLayout(requested, true);
    }, false);
  }
  document.addEventListener("click", function (event) {
    if (!layoutToggle || layoutToggle.contains(event.target)) return;
    collapseLayoutToggle();
  }, false);
  document.addEventListener("click", function (event) {
    var more = document.getElementsByClassName("attendance-more")[0];
    if (more && more.contains(event.target)) return;
    closeAttendanceMoreMenu();
  }, false);
  for (index = 0; index < attendanceMethods.length; index += 1) {
    attendanceMethods[index].addEventListener("click", function () {
      showAttendanceMode(this.getAttribute("data-attendance-mode"));
      resetInactivity();
    }, false);
  }
  for (index = 0; index < attendanceBackButtons.length; index += 1) {
    attendanceBackButtons[index].addEventListener("click", resetAttendance, false);
  }
  for (index = 0; index < paymentMethods.length; index += 1) {
    paymentMethods[index].addEventListener("click", function () { showPaymentMode(this.getAttribute("data-payment-mode")); resetInactivity(); }, false);
  }
  for (index = 0; index < paymentBackButtons.length; index += 1) {
    paymentBackButtons[index].addEventListener("click", resetPayment, false);
  }
  for (index = 0; index < passMethods.length; index += 1) {
    passMethods[index].addEventListener("click", function () { showPassMode(this.getAttribute("data-pass-mode")); resetInactivity(); }, false);
  }
  for (index = 0; index < passBackButtons.length; index += 1) {
    passBackButtons[index].addEventListener("click", resetPasses, false);
  }
  for (index = 0; index < accountActions.length; index += 1) {
    accountActions[index].addEventListener("click", function () {
      var action = this.getAttribute("data-account-action");
      if (action === "payment") showPanel("payment-panel");
      else if (action === "pass") showPanel("passes-panel");
      else showPanel("attendance-panel");
      resetInactivity();
    }, false);
  }
  for (index = 0; index < displayModeButtons.length; index += 1) {
    displayModeButtons[index].addEventListener("click", enterDisplayMode, false);
  }
  kiosk.addEventListener("touchstart", resetInactivity, false);
  kiosk.addEventListener("click", resetInactivity, false);
  kiosk.addEventListener("input", resetInactivity, false);
  if (window.location.search.indexOf("kiosco=1") !== -1) {
    window.setTimeout(function () { openKiosk(); }, 80);
  }
}());
