(function () {
  "use strict";
  var catalog = [], cart = {}, filter = "todos", generation = 0, busy = false;
  var orderId = "", pending = null, loaded = false, trackingId = "", trackingTimer = null;
  function el(id) { return document.getElementById(id); }
  function money(value) { return "$" + Number(value).toFixed(2).replace(/\.00$/, ""); }
  function node(tag, text, className) {
    var item = document.createElement(tag);
    if (typeof text === "string") item.textContent = text;
    if (className) item.className = className;
    return item;
  }
  function message(text) { el("shop-message").textContent = text || ""; }
  function newId() {
    var bytes = new Uint8Array(16), result = "", i;
    window.crypto.getRandomValues(bytes);
    for (i = 0; i < bytes.length; i += 1) result += ("0" + bytes[i].toString(16)).slice(-2);
    return result;
  }
  function request(method, url, body, done) {
    var xhr = new XMLHttpRequest(), finished = false;
    function finish(status, data) { if (!finished) { finished = true; done(status, data); } }
    xhr.open(method, url, true); xhr.timeout = 15000;
    xhr.setRequestHeader("Accept", "application/json");
    if (body) xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var data = {};
      try { data = JSON.parse(xhr.responseText || "{}"); } catch (error) { data = { mensaje: error ? "Respuesta inválida del servidor." : "" }; }
      finish(xhr.status, data);
    };
    xhr.onerror = xhr.ontimeout = function () { finish(0, {}); };
    xhr.send(body ? JSON.stringify(body) : null);
  }
  function totals() {
    var count = 0, total = 0;
    catalog.forEach(function (product) { var q = cart[product.id] || 0; count += q; total += q * product.precio; });
    return { count: count, total: total };
  }
  function change(id, delta) {
    if (busy || pending) return;
    var product = catalog.filter(function (p) { return p.id === id; })[0];
    if (!product) return;
    var quantity = Math.max(0, (cart[id] || 0) + delta);
    if (quantity > Math.min(20, product.existencias)) return;
    if (delta > 0 && totals().count >= 50) { message("Puedes pedir hasta 50 unidades por pedido."); return; }
    cart[id] = quantity; orderId = ""; el("shop-receipt").textContent = "";
    render();
  }
  function render() {
    var grid = el("shop-grid"), lines = el("shop-cart-items"), summary = totals();
    grid.textContent = ""; lines.textContent = "";
    catalog.forEach(function (product) {
      var quantity = cart[product.id] || 0;
      var available = product.activo && product.existencias > 0;
      if (filter === "todos" || filter === product.grupo) {
        var card = node("article", undefined, "shop-product");
        var image = node("img"); image.src = product.imagen; image.alt = product.nombre + " " + product.detalle;
        image.width = 180; image.height = 150; image.referrerPolicy = "no-referrer";
        image.onerror = function () { this.onerror = null; this.src = "/icon-192.png"; };
        card.appendChild(image);
        card.appendChild(node("h3", product.nombre)); card.appendChild(node("p", product.detalle, "shop-detail"));
        card.appendChild(node("strong", money(product.precio), "shop-price"));
        card.appendChild(node("small", available ? product.existencias + " disponibles" : "Agotado", available ? "shop-stock" : "shop-soldout"));
        var controls = node("div", undefined, "shop-quantity");
        var minus = node("button", "−"), plus = node("button", "+");
        minus.type = plus.type = "button";
        minus.setAttribute("aria-label", "Quitar " + product.nombre + " " + product.detalle);
        plus.setAttribute("aria-label", "Agregar " + product.nombre + " " + product.detalle);
        minus.disabled = busy || !!pending || quantity === 0;
        plus.disabled = busy || !!pending || !available || quantity >= Math.min(20, product.existencias) || summary.count >= 50;
        minus.onclick = function () { change(product.id, -1); }; plus.onclick = function () { change(product.id, 1); };
        controls.appendChild(minus); controls.appendChild(node("span", String(quantity))); controls.appendChild(plus); card.appendChild(controls); grid.appendChild(card);
      }
      if (quantity) {
        var line = node("div", undefined, "shop-line");
        line.appendChild(node("span", quantity + " × " + product.nombre + " · " + product.detalle));
        line.appendChild(node("b", money(product.precio * quantity))); lines.appendChild(line);
      }
    });
    if (!summary.count) lines.appendChild(node("p", "Tu carrito está vacío. Elige algo del catálogo."));
    el("shop-count").textContent = String(summary.count); el("shop-total").textContent = money(summary.total);
    el("shop-short-total").textContent = money(summary.total);
    el("shop-submit").disabled = busy || !summary.count || (!pending && !/^\d{4}$/.test(el("shop-pin").value));
    el("shop-submit").textContent = busy ? "Enviando…" : pending ? "Comprobar y reintentar pedido" : "Enviar pedido a recepción";
    el("shop-clear").disabled = busy || !!pending; el("shop-refresh").disabled = busy || !!pending;
    el("shop-pin").disabled = busy || !!pending;
  }
  function load() {
    if (busy || pending) return;
    var current = generation;
    message("Cargando productos y existencias…");
    request("GET", "/api/compras?sede=MMA&canal=ipad", null, function (status, result) {
      if (current !== generation) return;
      if (status < 200 || status >= 300 || !Array.isArray(result.catalogo)) {
        message(result.mensaje || "No se pudo cargar la tienda. Revisa la conexión y toca Actualizar."); return;
      }
      catalog = result.catalogo; loaded = true;
      catalog.forEach(function (p) { cart[p.id] = p.activo ? Math.min(cart[p.id] || 0, p.existencias, 20) : 0; });
      message(catalog.length ? "Selecciona tus productos y confirma abajo." : "No hay productos disponibles."); render();
    });
  }
  function clear() {
    trackingId = ""; if (trackingTimer) window.clearTimeout(trackingTimer); trackingTimer = null;
    generation += 1; busy = false; pending = null; cart = {}; orderId = "";
    el("shop-pin").value = ""; el("shop-receipt").textContent = ""; message(""); render();
  }
  function trackOrder() {
    if (trackingTimer) window.clearTimeout(trackingTimer);
    if (!trackingId) return;
    if (document.hidden || window.navigator.onLine === false) { trackingTimer = window.setTimeout(trackOrder, 15000); return; }
    var id = trackingId, current = generation;
    request("GET", "/api/compras?sede=MMA&canal=ipad&compra=" + encodeURIComponent(id), null, function(status, result) {
      if (current !== generation || trackingId !== id) return;
      var order = result.compra;
      if (status >= 200 && status < 300 && order) {
        var labels = {pendiente_cobro:"Recibido · pendiente de cobro",preparando:"Preparando tu pedido",lista:"Listo para recoger en recepción",entregada:"Cobrado y entregado",cobrada:"Cobrado y entregado",cancelada:"Pedido cancelado"};
        el("shop-receipt").textContent = "Folio " + order.folio + " · " + (labels[order.estado] || "Recibido") + " · " + money(order.total);
        el("shop-receipt").setAttribute("data-state", order.estado);
        if (["entregada","cobrada","cancelada"].indexOf(order.estado) >= 0) return;
      }
      trackingTimer = window.setTimeout(trackOrder, status === 429 ? 20000 : 10000);
    });
  }

  function submit(event) {
    event.preventDefault();
    if (busy || !totals().count) return;
    if (window.navigator.onLine === false) { message("Necesitas conexión para enviar el pedido. No se ha enviado."); return; }
    if (!pending) {
      var pin = el("shop-pin").value;
      if (!/^\d{4}$/.test(pin)) { message("Ingresa los 4 dígitos de tu PIN."); return; }
      if (!orderId) orderId = newId();
      pending = { canal: "ipad", sede: "MMA", pin: pin, requestId: orderId, items: catalog.filter(function (p) { return cart[p.id] > 0; }).map(function (p) { return { productoId: p.id, cantidad: cart[p.id] }; }) };
    }
    var current = generation;
    busy = true; message("Enviando pedido…"); render();
    request("POST", "/api/compras", pending, function (status, result) {
      if (current !== generation) return;
      busy = false;
      if (status >= 200 && status < 300 && result.ok) {
        pending = null; cart = {}; orderId = ""; el("shop-pin").value = "";
        el("shop-receipt").textContent = "Pedido " + result.folio + " · " + money(result.total) + ". Paga y recoge en recepción.";
        trackingId = result.compraId || "";
        message("Pedido recibido. Todavía está pendiente de cobro."); render();
        trackOrder();
      } else if (status === 0 || status >= 500) {
        message("No pudimos confirmar la respuesta. Reintenta este mismo pedido para comprobarlo sin duplicarlo."); render();
      } else {
        pending = null; el("shop-pin").value = "";
        message(result.mensaje || "No se pudo enviar el pedido. Revisa tu PIN y las existencias."); render();
      }
    });
  }
  window.addEventListener("albatros:panel", function (event) {
    if (event.detail === "shop-panel") { clear(); load(); }
    else clear();
  }, false);
  window.addEventListener("albatros:clear", clear, false);
  el("shop-form").addEventListener("submit", submit, false);
  el("shop-pin").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 4); render(); }, false);
  el("shop-view-cart").addEventListener("click", function () { el("shop-cart-title").scrollIntoView(true); }, false);
  el("shop-refresh").addEventListener("click", load, false);
  el("shop-clear").addEventListener("click", function () { clear(); if (!loaded) load(); }, false);
  var filters = document.querySelectorAll("[data-shop-filter]");
  for (var i = 0; i < filters.length; i += 1) filters[i].addEventListener("click", function () {
    filter = this.getAttribute("data-shop-filter");
    for (var j = 0; j < filters.length; j += 1) filters[j].setAttribute("aria-pressed", filters[j] === this ? "true" : "false");
    render();
  }, false);
  render();
}());
