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
  var dots = [];

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

  function loadCover(index) {
    if (index < 0 || index >= covers.length) return;
    var image = covers[index].getElementsByTagName("img")[0];
    if (image && !image.getAttribute("src") && image.getAttribute("data-src")) {
      image.setAttribute("src", image.getAttribute("data-src"));
    }
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
        dot.addEventListener("click", function () { goToSlide(dotIndex); }, false);
        dotsHost.appendChild(dot);
        dots.push(dot);
      }(index));
    }
  }

  function touchStart(event) {
    if (app.classList.contains("kiosk-active") || !event.touches || event.touches.length !== 1) return;
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
    } else if (direction === "vertical" && deltaY > 0) {
      event.preventDefault();
      app.style.setProperty("--pull-progress", Math.min(deltaY / 150, 1));
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
    if (direction === "vertical" && deltaY > 90 && Math.abs(deltaY) > Math.abs(deltaX)) {
      openKiosk("booking-panel");
    }
    direction = "";
    app.style.removeProperty("--pull-progress");
  }

  function resetInactivity() {
    if (!app.classList.contains("kiosk-active")) return;
    if (inactivityTimer) window.clearTimeout(inactivityTimer);
    inactivityTimer = window.setTimeout(function () {
      clearPersonalData();
      closeKiosk();
    }, 180000);
  }

  function openKiosk(panelId) {
    app.classList.add("kiosk-active");
    kiosk.setAttribute("aria-hidden", "false");
    showPanel(panelId || "booking-panel");
    resetInactivity();
    window.setTimeout(function () {
      var firstInput = document.getElementById("trial-name");
      if (panelId === "booking-panel" && firstInput) firstInput.focus();
    }, 520);
  }

  function closeKiosk() {
    app.classList.remove("kiosk-active");
    kiosk.setAttribute("aria-hidden", "true");
    if (inactivityTimer) window.clearTimeout(inactivityTimer);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function showPanel(panelId) {
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
  }

  function showSuccess() {
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

    if (name.length < 2) { showFormMessage("Escribe tu nombre completo."); return; }
    if (phone.length < 10) { showFormMessage("Escribe un teléfono válido de al menos 10 dígitos."); return; }
    if (!time || (schedules[discipline] || []).indexOf(time) === -1) { showFormMessage("Selecciona un horario disponible."); return; }

    showFormMessage("");
    button.disabled = true;
    button.textContent = "Enviando…";

    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/clase-prueba", true);
    xhr.timeout = 15000;
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      button.disabled = false;
      button.textContent = "Solicitar mi clase";
      var result = {};
      try { result = JSON.parse(xhr.responseText || "{}"); } catch (ignore) { result = {}; }
      if (xhr.status >= 200 && xhr.status < 300) {
        showSuccess();
      } else {
        showFormMessage(result.mensaje || "No se pudo enviar la solicitud. Inténtalo nuevamente.");
      }
    };
    xhr.onerror = function () {
      button.disabled = false;
      button.textContent = "Solicitar mi clase";
      showFormMessage("No hay conexión con el servidor. Revisa internet e inténtalo nuevamente.");
    };
    xhr.ontimeout = function () {
      button.disabled = false;
      button.textContent = "Solicitar mi clase";
      showFormMessage("El servidor tardó demasiado. Inténtalo nuevamente.");
    };
    xhr.send(JSON.stringify({
      nombre: name,
      telefono: phone,
      disciplina: discipline,
      horario: time,
      sede: "MMA",
      notas: notes,
      origen: "kiosco",
      website: website
    }));
  }

  buildDots();
  renderSlide(false);
  setViewportHeight();
  updateTimes();
  updateClock();
  window.setInterval(updateClock, 30000);

  window.addEventListener("resize", setViewportHeight, false);
  window.addEventListener("orientationchange", function () { window.setTimeout(setViewportHeight, 250); }, false);
  viewport.addEventListener("touchstart", touchStart, false);
  viewport.addEventListener("touchmove", touchMove, false);
  viewport.addEventListener("touchend", touchEnd, false);
  viewport.addEventListener("touchcancel", touchEnd, false);
  document.getElementById("open-kiosk").addEventListener("click", function () { openKiosk("booking-panel"); }, false);
  document.getElementById("close-kiosk").addEventListener("click", closeKiosk, false);
  document.getElementById("trial-discipline").addEventListener("change", updateTimes, false);
  document.getElementById("trial-phone").addEventListener("input", function () { this.value = this.value.replace(/[^\d +()\-]/g, ""); }, false);
  document.getElementById("trial-form").addEventListener("submit", submitTrial, false);
  document.getElementById("new-request").addEventListener("click", clearPersonalData, false);

  var bookingButtons = document.getElementsByClassName("js-open-booking");
  var menuButtons = document.getElementsByClassName("kiosk-menu-button");
  var index;
  for (index = 0; index < bookingButtons.length; index += 1) {
    bookingButtons[index].addEventListener("click", function () { openKiosk("booking-panel"); }, false);
  }
  for (index = 0; index < menuButtons.length; index += 1) {
    menuButtons[index].addEventListener("click", function () { showPanel(this.getAttribute("data-panel")); resetInactivity(); }, false);
  }
  kiosk.addEventListener("touchstart", resetInactivity, false);
  kiosk.addEventListener("click", resetInactivity, false);
  kiosk.addEventListener("input", resetInactivity, false);
  if (window.location.search.indexOf("kiosco=1") !== -1) {
    window.setTimeout(function () { openKiosk("booking-panel"); }, 80);
  }
}());
