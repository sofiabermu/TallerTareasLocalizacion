const CLAVE_TAREAS = 'tareasGrupo2';
const CLAVE_LUGARES = 'lugaresGrupo2';
const MAX_PENDIENTES = 8;
const MIN_CARACTERES = 3;
const MAX_CARACTERES = 60;
const RADIO_LUGAR = 200;

let tareas = cargar(CLAVE_TAREAS);
let lugares = cargar(CLAVE_LUGARES);
let posicionActual = null;
let idArrastrado = null;

const form = document.getElementById('form-tarea');
const input = document.getElementById('input-tarea');
const selectLugar = document.getElementById('select-lugar');
const btnAgregar = document.getElementById('btn-agregar');
const mensaje = document.getElementById('mensaje');
const btnLimpiar = document.getElementById('btn-limpiar');
const ubicacionCaja = document.getElementById('ubicacion');
const ubicacionTexto = document.getElementById('ubicacion-texto');
const avisoLugar = document.getElementById('aviso-lugar');
const filtroLugar = document.getElementById('filtro-lugar');
const formLugar = document.getElementById('form-lugar');
const inputLugarNombre = document.getElementById('input-lugar-nombre');
const inputLat = document.getElementById('input-lat');
const inputLon = document.getElementById('input-lon');
const btnUsarUbicacion = document.getElementById('btn-usar-ubicacion');
const mensajeLugar = document.getElementById('mensaje-lugar');
const listaLugares = document.getElementById('lista-lugares');
const canvas = document.getElementById('grafico');
const ctx = canvas.getContext('2d');
const columnas = document.querySelectorAll('.columna');
const listas = {
  pendiente: document.getElementById('pendientes'),
  completada: document.getElementById('completadas'),
};

function cargar(clave) {
  try {
    const datos = JSON.parse(localStorage.getItem(clave));
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

function guardarTareas() {
  localStorage.setItem(CLAVE_TAREAS, JSON.stringify(tareas));
}

function guardarLugares() {
  localStorage.setItem(CLAVE_LUGARES, JSON.stringify(lugares));
}

function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function contarPorEstado(estado) {
  return tareas.filter((t) => t.estado === estado).length;
}

function normalizar(texto) {
  return texto.trim().replace(/\s+/g, ' ').toLowerCase();
}

function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatearDistancia(metros) {
  return metros < 1000 ? `${Math.round(metros)} m` : `${(metros / 1000).toFixed(1)} km`;
}

function tiempoTranscurrido(fecha) {
  const seg = Math.floor((Date.now() - fecha) / 1000);
  if (seg < 60) return 'hace unos segundos';
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}

function mostrarMensaje(texto, tipo = 'error', elemento = mensaje, campo = input) {
  elemento.textContent = texto;
  elemento.className = tipo === 'ok' ? 'mensaje ok' : 'mensaje';
  campo.classList.toggle('invalido', tipo === 'error' && texto !== '');
}

function buscarLugar(id) {
  return lugares.find((l) => l.id === id) || null;
}

function distanciaALugar(lugar) {
  if (!lugar || !posicionActual) return null;
  return distanciaMetros(posicionActual.lat, posicionActual.lon, lugar.lat, lugar.lon);
}

function lugarActual() {
  let masCercano = null;
  let menor = Infinity;
  lugares.forEach((lugar) => {
    const d = distanciaALugar(lugar);
    if (d !== null && d <= RADIO_LUGAR && d < menor) {
      menor = d;
      masCercano = lugar;
    }
  });
  return masCercano;
}

function esDelLugarActual(tarea) {
  const actual = lugarActual();
  return Boolean(actual && tarea.lugarId === actual.id);
}

function validarTarea(texto, lugarId) {
  const limpio = texto.trim();
  if (!limpio) return 'La tarea no puede estar vacía.';
  if (limpio.length < MIN_CARACTERES) return `La tarea debe tener al menos ${MIN_CARACTERES} caracteres.`;
  if (limpio.length > MAX_CARACTERES) return `La tarea no puede superar ${MAX_CARACTERES} caracteres.`;
  if (contarPorEstado('pendiente') >= MAX_PENDIENTES) {
    return `Límite alcanzado: máximo ${MAX_PENDIENTES} tareas pendientes. Completa alguna primero.`;
  }
  if (existeDuplicada(limpio, lugarId)) return 'Ya existe esa tarea pendiente para el mismo lugar.';
  return null;
}

function existeDuplicada(texto, lugarId, excluirId = null) {
  return tareas.some(
    (t) =>
      t.id !== excluirId &&
      t.estado === 'pendiente' &&
      (t.lugarId || null) === (lugarId || null) &&
      normalizar(t.texto) === normalizar(texto)
  );
}

function validarLugar(nombre, lat, lon) {
  const limpio = nombre.trim();
  if (limpio.length < 2) return 'El nombre del lugar debe tener al menos 2 caracteres.';
  if (limpio.length > 30) return 'El nombre del lugar no puede superar 30 caracteres.';
  if (lugares.some((l) => normalizar(l.nombre) === normalizar(limpio))) return 'Ya tienes un lugar con ese nombre.';
  if (Number.isNaN(lat) || lat < -90 || lat > 90) return 'La latitud debe estar entre -90 y 90.';
  if (Number.isNaN(lon) || lon < -180 || lon > 180) return 'La longitud debe estar entre -180 y 180.';
  return null;
}

function agregarTarea(texto, lugarId) {
  tareas.push({
    id: generarId(),
    texto: texto.trim().replace(/\s+/g, ' '),
    estado: 'pendiente',
    creada: Date.now(),
    completadaEn: null,
    lugarId: lugarId || null,
  });
  guardarTareas();
  render();
}

function eliminarTarea(id) {
  tareas = tareas.filter((t) => t.id !== id);
  guardarTareas();
  render();
}

function moverTarea(id, nuevoEstado) {
  const tarea = tareas.find((t) => t.id === id);
  if (!tarea || tarea.estado === nuevoEstado) return;

  if (nuevoEstado === 'pendiente') {
    if (contarPorEstado('pendiente') >= MAX_PENDIENTES) {
      mostrarMensaje(`No puedes tener más de ${MAX_PENDIENTES} tareas pendientes.`);
      return;
    }
    if (existeDuplicada(tarea.texto, tarea.lugarId, tarea.id)) {
      mostrarMensaje('Ya hay una tarea pendiente igual para ese lugar.');
      return;
    }
  }

  tarea.estado = nuevoEstado;
  tarea.completadaEn = nuevoEstado === 'completada' ? Date.now() : null;
  guardarTareas();
  mostrarMensaje(
    nuevoEstado === 'completada' ? `✔ "${tarea.texto}" completada.` : `↩ "${tarea.texto}" vuelve a pendientes.`,
    'ok'
  );
  render();
}

function agregarLugar(nombre, lat, lon) {
  lugares.push({ id: generarId(), nombre: nombre.trim(), lat, lon });
  guardarLugares();
  render();
}

function eliminarLugar(id) {
  const lugar = buscarLugar(id);
  const asociadas = tareas.filter((t) => t.lugarId === id).length;
  const pregunta = asociadas
    ? `¿Eliminar "${lugar.nombre}"? Sus ${asociadas} tarea(s) quedarán sin lugar.`
    : `¿Eliminar "${lugar.nombre}"?`;
  if (!confirm(pregunta)) return;

  lugares = lugares.filter((l) => l.id !== id);
  tareas.forEach((t) => {
    if (t.lugarId === id) t.lugarId = null;
  });
  guardarLugares();
  guardarTareas();
  render();
}

function crearTarjeta(tarea) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta';
  tarjeta.draggable = true;
  tarjeta.dataset.id = tarea.id;

  const texto = document.createElement('p');
  texto.className = 'tarjeta-texto';
  texto.textContent = tarea.texto;

  const meta = document.createElement('div');
  meta.className = 'tarjeta-meta';

  const tiempo = document.createElement('span');
  tiempo.textContent =
    tarea.estado === 'completada' && tarea.completadaEn
      ? `✔ Completada ${tiempoTranscurrido(tarea.completadaEn)}`
      : `🕒 Creada ${tiempoTranscurrido(tarea.creada)}`;
  meta.appendChild(tiempo);

  const lugar = buscarLugar(tarea.lugarId);
  if (lugar) {
    const etiqueta = document.createElement('span');
    etiqueta.className = 'badge-lugar';
    etiqueta.textContent = `🏷 ${lugar.nombre}`;
    meta.appendChild(etiqueta);

    const distancia = distanciaALugar(lugar);
    if (distancia !== null) {
      const dist = document.createElement('span');
      dist.textContent = `📏 ${formatearDistancia(distancia)}`;
      meta.appendChild(dist);
    }

    if (tarea.estado === 'pendiente' && esDelLugarActual(tarea)) {
      const badge = document.createElement('span');
      badge.className = 'badge-cerca';
      badge.textContent = 'Estás aquí';
      meta.appendChild(badge);
      tarjeta.classList.add('cerca');
    }
  } else {
    const sinLugar = document.createElement('span');
    sinLugar.textContent = 'Cualquier lugar';
    meta.appendChild(sinLugar);
  }

  const btnEliminar = document.createElement('button');
  btnEliminar.className = 'btn-eliminar';
  btnEliminar.title = 'Eliminar tarea';
  btnEliminar.textContent = '×';
  btnEliminar.addEventListener('click', () => eliminarTarea(tarea.id));

  tarjeta.addEventListener('dragstart', (e) => {
    idArrastrado = tarea.id;
    e.dataTransfer.setData('text/plain', tarea.id);
    e.dataTransfer.effectAllowed = 'move';
    tarjeta.classList.add('dragging');
  });

  tarjeta.addEventListener('dragend', () => {
    idArrastrado = null;
    tarjeta.classList.remove('dragging');
    columnas.forEach((c) => c.classList.remove('drag-over', 'bloqueada'));
  });

  const agarre = document.createElement('span');
  agarre.className = 'tarjeta-agarre';
  agarre.title = 'Arrastrar';
  agarre.setAttribute('aria-hidden', 'true');

  tarjeta.append(agarre, texto, meta, btnEliminar);
  return tarjeta;
}

function tareaVisible(tarea, actual) {
  if (!filtroLugar.checked || !actual) return true;
  return tarea.lugarId === actual.id;
}

function renderTablero(actual) {
  Object.entries(listas).forEach(([estado, lista]) => {
    lista.innerHTML = '';
    const delEstado = tareas.filter((t) => t.estado === estado);
    const visibles = delEstado.filter((t) => tareaVisible(t, actual));

    if (estado === 'pendiente') {
      visibles.sort((a, b) => esDelLugarActual(b) - esDelLugarActual(a));
    }

    if (visibles.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'vacio';
      if (delEstado.length > 0) {
        vacio.textContent = 'No hay tareas de este lugar aquí';
      } else {
        vacio.textContent = estado === 'pendiente' ? 'No hay tareas pendientes 🎉' : 'Arrastra aquí las tareas terminadas';
      }
      lista.appendChild(vacio);
    } else {
      visibles.forEach((t) => lista.appendChild(crearTarjeta(t)));
    }

    document.getElementById(`contador-${estado}`).textContent = delEstado.length;
  });
}

function renderAviso(actual) {
  if (!posicionActual) {
    avisoLugar.hidden = true;
    return;
  }
  avisoLugar.hidden = false;
  if (actual) {
    const pendientesAqui = tareas.filter((t) => t.estado === 'pendiente' && t.lugarId === actual.id).length;
    avisoLugar.className = 'aviso-lugar activo';
    avisoLugar.textContent =
      pendientesAqui > 0
        ? `📍 Estás en "${actual.nombre}": tienes ${pendientesAqui} tarea(s) pendiente(s) aquí.`
        : `📍 Estás en "${actual.nombre}": no tienes tareas pendientes en este lugar.`;
  } else {
    avisoLugar.className = 'aviso-lugar';
    avisoLugar.textContent = 'No estás en ninguno de tus lugares guardados.';
  }
}

function renderSelectLugares() {
  const seleccionado = selectLugar.value;
  selectLugar.innerHTML = '';
  const sinLugar = document.createElement('option');
  sinLugar.value = '';
  sinLugar.textContent = '🌐 Cualquier lugar';
  selectLugar.appendChild(sinLugar);

  lugares.forEach((lugar) => {
    const opcion = document.createElement('option');
    opcion.value = lugar.id;
    opcion.textContent = `🏷 ${lugar.nombre}`;
    selectLugar.appendChild(opcion);
  });

  selectLugar.value = buscarLugar(seleccionado) ? seleccionado : '';
}

function renderListaLugares(actual) {
  listaLugares.innerHTML = '';
  if (lugares.length === 0) {
    const vacio = document.createElement('li');
    vacio.className = 'lugar-vacio';
    vacio.textContent = 'Aún no tienes lugares. Agrega uno, por ejemplo "Supermercado".';
    listaLugares.appendChild(vacio);
    return;
  }

  lugares.forEach((lugar) => {
    const item = document.createElement('li');
    item.className = 'lugar-item';
    if (actual && actual.id === lugar.id) item.classList.add('actual');

    const nombre = document.createElement('strong');
    nombre.textContent = lugar.nombre;

    const info = document.createElement('span');
    const tareasLugar = tareas.filter((t) => t.lugarId === lugar.id && t.estado === 'pendiente').length;
    const distancia = distanciaALugar(lugar);
    info.textContent =
      `${tareasLugar} pendiente(s)` + (distancia !== null ? ` · a ${formatearDistancia(distancia)}` : '');

    const btn = document.createElement('button');
    btn.className = 'btn-eliminar';
    btn.title = 'Eliminar lugar';
    btn.textContent = '×';
    btn.addEventListener('click', () => eliminarLugar(lugar.id));

    item.append(nombre, info, btn);
    listaLugares.appendChild(item);
  });
}

function render() {
  const actual = lugarActual();
  renderSelectLugares();
  renderListaLugares(actual);
  renderAviso(actual);
  renderTablero(actual);

  btnAgregar.disabled = contarPorEstado('pendiente') >= MAX_PENDIENTES;
  btnAgregar.title = btnAgregar.disabled ? `Máximo ${MAX_PENDIENTES} pendientes` : '';
  btnLimpiar.hidden = contarPorEstado('completada') === 0;

  dibujarCanvas(actual);
}

columnas.forEach((columna) => {
  const estado = columna.dataset.estado;

  columna.addEventListener('dragover', (e) => {
    e.preventDefault();
    const tarea = tareas.find((t) => t.id === idArrastrado);
    const bloqueada =
      estado === 'pendiente' &&
      tarea &&
      tarea.estado !== 'pendiente' &&
      contarPorEstado('pendiente') >= MAX_PENDIENTES;
    e.dataTransfer.dropEffect = bloqueada ? 'none' : 'move';
    columna.classList.toggle('bloqueada', bloqueada);
    columna.classList.toggle('drag-over', !bloqueada);
  });

  columna.addEventListener('dragleave', (e) => {
    if (!columna.contains(e.relatedTarget)) {
      columna.classList.remove('drag-over', 'bloqueada');
    }
  });

  columna.addEventListener('drop', (e) => {
    e.preventDefault();
    columna.classList.remove('drag-over', 'bloqueada');
    moverTarea(e.dataTransfer.getData('text/plain'), estado);
  });
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const lugarId = selectLugar.value || null;
  const error = validarTarea(input.value, lugarId);
  if (error) {
    mostrarMensaje(error);
    return;
  }
  agregarTarea(input.value, lugarId);
  const lugar = buscarLugar(lugarId);
  mostrarMensaje(lugar ? `Tarea agregada para "${lugar.nombre}".` : 'Tarea agregada.', 'ok');
  input.value = '';
  input.focus();
});

input.addEventListener('input', () => {
  if (input.classList.contains('invalido')) mostrarMensaje('');
});

btnLimpiar.addEventListener('click', () => {
  const total = contarPorEstado('completada');
  if (total === 0) return;
  if (confirm(`¿Eliminar ${total} tarea(s) completada(s)?`)) {
    tareas = tareas.filter((t) => t.estado !== 'completada');
    guardarTareas();
    mostrarMensaje('Tareas completadas eliminadas.', 'ok');
    render();
  }
});

filtroLugar.addEventListener('change', render);

btnUsarUbicacion.addEventListener('click', () => {
  if (!posicionActual) {
    mostrarMensaje('Aún no tenemos tu ubicación. Escribe las coordenadas a mano.', 'error', mensajeLugar, inputLat);
    return;
  }
  inputLat.value = posicionActual.lat.toFixed(6);
  inputLon.value = posicionActual.lon.toFixed(6);
  mostrarMensaje('', 'ok', mensajeLugar, inputLat);
});

formLugar.addEventListener('submit', (e) => {
  e.preventDefault();
  const nombre = inputLugarNombre.value;
  const lat = parseFloat(inputLat.value);
  const lon = parseFloat(inputLon.value);
  const error = validarLugar(nombre, lat, lon);
  if (error) {
    mostrarMensaje(error, 'error', mensajeLugar, inputLugarNombre);
    return;
  }
  agregarLugar(nombre, lat, lon);
  mostrarMensaje(`Lugar "${nombre.trim()}" guardado.`, 'ok', mensajeLugar, inputLugarNombre);
  formLugar.reset();
});

function iniciarGeolocalizacion() {
  if (!('geolocation' in navigator)) {
    mostrarErrorUbicacion('Tu navegador no soporta geolocalización.');
    return;
  }

  navigator.geolocation.watchPosition(
    (pos) => {
      posicionActual = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        precision: pos.coords.accuracy,
      };
      ubicacionCaja.classList.remove('error');
      ubicacionTexto.textContent =
        `Lat: ${posicionActual.lat.toFixed(5)} · Lon: ${posicionActual.lon.toFixed(5)} ` +
        `(±${Math.round(posicionActual.precision)} m)`;
      if (!idArrastrado) render();
    },
    (err) => {
      const mensajes = {
        1: 'Permiso de ubicación denegado.',
        2: 'Ubicación no disponible.',
        3: 'Tiempo de espera agotado.',
      };
      mostrarErrorUbicacion(mensajes[err.code] || 'Error al obtener la ubicación.');
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
  );
}

function mostrarErrorUbicacion(texto) {
  ubicacionCaja.classList.add('error');
  ubicacionTexto.textContent = `${texto} La app sigue funcionando sin ubicación.`;
}

function recortarTexto(texto, anchoMax) {
  if (ctx.measureText(texto).width <= anchoMax) return texto;
  let recortado = texto;
  while (recortado.length > 1 && ctx.measureText(`${recortado}…`).width > anchoMax) {
    recortado = recortado.slice(0, -1);
  }
  return `${recortado}…`;
}

function dibujarCanvas(actual) {
  const W = canvas.clientWidth;
  const horizontal = W >= 520;
  const H = horizontal ? 200 : 368;
  const dpr = window.devicePixelRatio || 1;

  // El lienzo se dibuja a la resolución real de la pantalla para que se vea nítido.
  canvas.style.height = `${H}px`;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const variables = getComputedStyle(document.documentElement);
  const color = (nombre) => variables.getPropertyValue(nombre).trim();
  const fuente = getComputedStyle(document.body).fontFamily;

  const pendientes = contarPorEstado('pendiente');
  const completadas = contarPorEstado('completada');
  const total = pendientes + completadas;
  const progreso = total === 0 ? 0 : completadas / total;
  const aqui = actual
    ? tareas.filter((t) => t.estado === 'pendiente' && t.lugarId === actual.id).length
    : 0;

  // Anillo de progreso
  const cx = horizontal ? 96 : W / 2;
  const cy = horizontal ? 100 : 92;
  const radio = 72;
  const inicio = -Math.PI / 2;

  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color('--verde-claro');
  ctx.beginPath();
  ctx.arc(cx, cy, radio, 0, Math.PI * 2);
  ctx.stroke();

  if (progreso > 0) {
    ctx.strokeStyle = color('--verde');
    ctx.beginPath();
    ctx.arc(cx, cy, radio, inicio, inicio + Math.PI * 2 * progreso);
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color('--texto');
  ctx.font = `bold 28px ${fuente}`;
  ctx.fillText(`${Math.round(progreso * 100)}%`, cx, cy - 8);
  ctx.fillStyle = color('--gris');
  ctx.font = `12px ${fuente}`;
  ctx.fillText(`${total} ${total === 1 ? 'tarea' : 'tareas'} en total`, cx, cy + 18);

  // Barras por estado
  const x0 = horizontal ? 216 : 0;
  const y0 = horizontal ? 0 : 180;
  const anchoBarras = W - x0;
  const altoBarra = 14;
  const maxValor = Math.max(pendientes, completadas, 1);
  const barras = [
    { etiqueta: 'Pendientes', valor: pendientes, fondo: '--rojo-claro', relleno: '--rojo', y: y0 + 32 },
    { etiqueta: 'Completadas', valor: completadas, fondo: '--verde-claro', relleno: '--verde', y: y0 + 86 },
  ];

  barras.forEach((b) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = color('--texto');
    ctx.font = `600 14px ${fuente}`;
    ctx.fillText(b.etiqueta, x0, b.y);

    ctx.textAlign = 'right';
    ctx.fillStyle = color(b.relleno);
    ctx.font = `bold 16px ${fuente}`;
    ctx.fillText(b.valor, W, b.y);

    const yBarra = b.y + 12;
    ctx.fillStyle = color(b.fondo);
    ctx.beginPath();
    ctx.roundRect(x0, yBarra, anchoBarras, altoBarra, altoBarra / 2);
    ctx.fill();

    if (b.valor > 0) {
      ctx.fillStyle = color(b.relleno);
      ctx.beginPath();
      ctx.roundRect(x0, yBarra, (b.valor / maxValor) * anchoBarras, altoBarra, altoBarra / 2);
      ctx.fill();
    }
  });

  // Aviso del lugar, con el mismo aspecto que .aviso-lugar
  const yAviso = y0 + 140;
  const altoAviso = 38;
  ctx.fillStyle = actual ? '#f39c12' : '#ecf0f1';
  ctx.beginPath();
  ctx.roundRect(x0, yAviso, anchoBarras, altoAviso, 10);
  ctx.fill();

  let textoAviso = '📍 Sin ubicación disponible';
  if (actual) textoAviso = `📍 ${aqui} pendiente(s) en ${actual.nombre}`;
  else if (posicionActual) textoAviso = '📍 Fuera de tus lugares';

  ctx.textAlign = 'left';
  ctx.fillStyle = actual ? '#fff' : color('--gris');
  ctx.font = `600 13px ${fuente}`;
  ctx.fillText(recortarTexto(textoAviso, anchoBarras - 28), x0 + 14, yAviso + altoAviso / 2);
}

render();
iniciarGeolocalizacion();
window.addEventListener('resize', () => dibujarCanvas(lugarActual()));
setInterval(() => {
  if (!idArrastrado) render();
}, 60000);
