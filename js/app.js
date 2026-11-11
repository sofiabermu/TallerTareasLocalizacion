// nombres con los que se guardan los datos en localStorage
const CLAVE_TAREAS = 'tareasGrupo2';
const CLAVE_LUGARES = 'lugaresGrupo2';
const CLAVE_FILTRO = 'filtroLugarGrupo2';

// reglas propias de la app
const MAX_PENDIENTES = 8;
const MIN_CARACTERES = 3;
const MAX_CARACTERES = 60;
const RADIO_LUGAR = 200; // metros para considerar que el usuario está en un lugar

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

// lee los datos guardados si no hay o están dañados, devuelve una lista vacía
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

// rectangulo con esquinas redondeadas 
function rectRedondo(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
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

// distancia en metros entre dos coordenadas 
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
  elemento.className = tipo === 'ok' || tipo === 'info' ? `mensaje ${tipo}` : 'mensaje';
  campo.classList.toggle('invalido', tipo === 'error' && texto !== '');
}

function buscarLugar(id) {
  return lugares.find((l) => l.id === id) || null;
}

function distanciaALugar(lugar) {
  if (!lugar || !posicionActual) return null;
  return distanciaMetros(posicionActual.lat, posicionActual.lon, lugar.lat, lugar.lon);
}

// devuelve el lugar guardado más cercano dentro del radio, o null si no hay ninguno
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

// revisa las reglas de una tarea nueva
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

  // al volver a pendientes se revisan el limite y los duplicados
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
    nuevoEstado === 'completada' ? `"${tarea.texto}" pasó a completadas.` : `"${tarea.texto}" volvió a pendientes.`,
    'info'
  );
  render();
}

function agregarLugar(nombre, lat, lon) {
  lugares.push({ id: generarId(), nombre: nombre.trim(), lat, lon });
  guardarLugares();
  render();
  if (mapa) mapa.panTo([lat, lon]);
}

function eliminarLugar(id) {
  const lugar = buscarLugar(id);
  const asociadas = tareas.filter((t) => t.lugarId === id).length;
  const pregunta = asociadas
    ? `¿Eliminar "${lugar.nombre}"? Sus ${asociadas} tarea(s) quedarán sin lugar.`
    : `¿Eliminar "${lugar.nombre}"?`;
  if (!confirm(pregunta)) return;

  // las tareas del lugar no se borran solo quedan sin lugar
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
      ? `Completada ${tiempoTranscurrido(tarea.completadaEn)}`
      : `Creada ${tiempoTranscurrido(tarea.creada)}`;
  meta.appendChild(tiempo);

  const lugar = buscarLugar(tarea.lugarId);
  if (lugar) {
    const etiqueta = document.createElement('span');
    etiqueta.className = 'badge-lugar';
    etiqueta.textContent = lugar.nombre;
    meta.appendChild(etiqueta);

    const distancia = distanciaALugar(lugar);
    if (distancia !== null) {
      const dist = document.createElement('span');
      dist.textContent = `a ${formatearDistancia(distancia)}`;
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
    sinLugar.textContent = 'Sin lugar';
    meta.appendChild(sinLugar);
  }

  const btnEliminar = document.createElement('button');
  btnEliminar.className = 'btn-eliminar';
  btnEliminar.title = 'Eliminar tarea';
  btnEliminar.textContent = '×';
  btnEliminar.addEventListener('click', () => eliminarTarea(tarea.id));

  // al empezar a arrastrar se guarda cual tarea se está moviendo
  tarjeta.addEventListener('dragstart', (e) => {
    idArrastrado = tarea.id;
    e.dataTransfer.setData('text/plain', tarea.id);
    e.dataTransfer.effectAllowed = 'move';
    tarjeta.classList.add('dragging');
  });

  // alternativa al arrastre para que sirva en el celular
  tarjeta.addEventListener('dblclick', () => {
    moverTarea(tarea.id, tarea.estado === 'pendiente' ? 'completada' : 'pendiente');
  });

  tarjeta.addEventListener('dragend', () => {
    idArrastrado = null;
    tarjeta.classList.remove('dragging');
    columnas.forEach((c) => c.classList.remove('drag-over', 'bloqueada'));
  });

  activarArrastreTactil(tarjeta, tarea);

  const agarre = document.createElement('span');
  agarre.className = 'tarjeta-agarre';
  agarre.title = 'Arrastrar';
  agarre.setAttribute('aria-hidden', 'true');

  tarjeta.append(agarre, texto, meta, btnEliminar);
  return tarjeta;
}

function tareaVisible(tarea, actual) {
  if (!filtroLugar.checked) return true;
  // si no esta en ninguno de sus lugares no se muestra ninguna tarea
  if (!actual) return false;
  return tarea.lugarId === actual.id;
}

function renderTablero(actual) {
  Object.entries(listas).forEach(([estado, lista]) => {
    lista.innerHTML = '';
    const delEstado = tareas.filter((t) => t.estado === estado);
    const visibles = delEstado.filter((t) => tareaVisible(t, actual));

    if (estado === 'pendiente') {
      // las tareas del lugar donde esta el usuario salen primero
      visibles.sort((a, b) => esDelLugarActual(b) - esDelLugarActual(a));
    }

    if (visibles.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'vacio';
      if (delEstado.length > 0 && !actual) {
        vacio.textContent = 'No estás en ninguno de tus lugares';
      } else if (delEstado.length > 0) {
        vacio.textContent = 'Ninguna tarea de este lugar';
      } else {
        vacio.textContent = estado === 'pendiente' ? 'Nada pendiente por ahora' : 'Suelta aquí las tareas terminadas';
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
        ? `Estás en ${actual.nombre}. Tienes ${pendientesAqui} pendiente(s) aquí.`
        : `Estás en ${actual.nombre}. No tienes nada pendiente aquí.`;
  } else {
    avisoLugar.className = 'aviso-lugar';
    avisoLugar.textContent = 'No estás cerca de ninguno de tus lugares.';
  }
}

function renderSelectLugares() {
  const seleccionado = selectLugar.value;
  selectLugar.innerHTML = '';
  const sinLugar = document.createElement('option');
  sinLugar.value = '';
  sinLugar.textContent = 'Sin lugar';
  selectLugar.appendChild(sinLugar);

  lugares.forEach((lugar) => {
    const opcion = document.createElement('option');
    opcion.value = lugar.id;
    opcion.textContent = lugar.nombre;
    selectLugar.appendChild(opcion);
  });

  selectLugar.value = buscarLugar(seleccionado) ? seleccionado : '';
}

function renderListaLugares(actual) {
  listaLugares.innerHTML = '';
  if (lugares.length === 0) {
    const vacio = document.createElement('li');
    vacio.className = 'lugar-vacio';
    vacio.textContent = 'Todavía no hay lugares guardados.';
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

// actualiza toda la pantalla con los datos actuales
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
  renderMapa();
}

// pendientes no acepta mas tareas si ya llego al limite
function columnaBloqueada(estado, tarea) {
  return (
    estado === 'pendiente' &&
    Boolean(tarea) &&
    tarea.estado !== 'pendiente' &&
    contarPorEstado('pendiente') >= MAX_PENDIENTES
  );
}

// ---------- arrastre con el dedo (celular) ----------
// el arrastre normal (draggable) no funciona con pantallas tactiles, asi que
// se mantiene presionada la tarjeta un momento y luego se mueve con el dedo
const ESPERA_ARRASTRE = 250; // ms con el dedo quieto antes de empezar a arrastrar
const TOLERANCIA_DEDO = 10; // px que se puede mover el dedo sin cancelar (si no, es scroll)

function marcarColumnas(destino, tarea) {
  columnas.forEach((c) => {
    const esDestino = c === destino;
    const bloqueada = esDestino && columnaBloqueada(c.dataset.estado, tarea);
    c.classList.toggle('bloqueada', bloqueada);
    c.classList.toggle('drag-over', esDestino && !bloqueada);
  });
}

function activarArrastreTactil(tarjeta, tarea) {
  let temporizador = null;
  let fantasma = null; // copia de la tarjeta que sigue al dedo
  let destino = null;
  let inicioX = 0;
  let inicioY = 0;
  let desfaseX = 0;
  let desfaseY = 0;

  const moverFantasma = (x, y) => {
    fantasma.style.left = `${x - desfaseX}px`;
    fantasma.style.top = `${y - desfaseY}px`;
  };

  const empezar = () => {
    temporizador = null;
    const rect = tarjeta.getBoundingClientRect();
    desfaseX = inicioX - rect.left;
    desfaseY = inicioY - rect.top;
    fantasma = tarjeta.cloneNode(true);
    fantasma.classList.add('tarjeta-fantasma');
    fantasma.style.width = `${rect.width}px`;
    moverFantasma(inicioX, inicioY);
    document.body.appendChild(fantasma);
    tarjeta.classList.add('dragging');
    if (navigator.vibrate) navigator.vibrate(15);
  };

  const terminar = () => {
    clearTimeout(temporizador);
    temporizador = null;
    if (fantasma) fantasma.remove();
    fantasma = null;
    destino = null;
    tarjeta.classList.remove('dragging');
    marcarColumnas(null, tarea);
  };

  tarjeta.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1 || e.target.closest('.btn-eliminar')) return;
      inicioX = e.touches[0].clientX;
      inicioY = e.touches[0].clientY;
      temporizador = setTimeout(empezar, ESPERA_ARRASTRE);
    },
    { passive: true }
  );

  tarjeta.addEventListener(
    'touchmove',
    (e) => {
      const toque = e.touches[0];
      if (!fantasma) {
        // si mueve el dedo antes de tiempo quiere hacer scroll, no arrastrar
        if (Math.hypot(toque.clientX - inicioX, toque.clientY - inicioY) > TOLERANCIA_DEDO) terminar();
        return;
      }
      e.preventDefault(); // mientras arrastra la pagina no se desplaza
      moverFantasma(toque.clientX, toque.clientY);
      const debajo = document.elementFromPoint(toque.clientX, toque.clientY);
      destino = debajo ? debajo.closest('.columna') : null;
      marcarColumnas(destino, tarea);
    },
    { passive: false }
  );

  tarjeta.addEventListener('touchend', (e) => {
    if (!fantasma) {
      terminar();
      return;
    }
    e.preventDefault(); // evita que el toque cuente como clic
    const columnaFinal = destino;
    terminar();
    if (columnaFinal) moverTarea(tarea.id, columnaFinal.dataset.estado);
  });

  tarjeta.addEventListener('touchcancel', terminar);
  // que no salga el menu del navegador al mantener presionado
  tarjeta.addEventListener('contextmenu', (e) => {
    if (temporizador || fantasma) e.preventDefault();
  });
}

// cada columna recibe las tarjetas que se sueltan sobre ella
columnas.forEach((columna) => {
  const estado = columna.dataset.estado;

  columna.addEventListener('dragover', (e) => {
    e.preventDefault();
    const tarea = tareas.find((t) => t.id === idArrastrado);
    const bloqueada = columnaBloqueada(estado, tarea);
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

filtroLugar.addEventListener('change', () => {
  localStorage.setItem(CLAVE_FILTRO, filtroLugar.checked ? '1' : '0');
  render();
});

btnUsarUbicacion.addEventListener('click', () => {
  if (!posicionActual) {
    mostrarMensaje('Todavía no hay ubicación, escribe las coordenadas a mano.', 'error', mensajeLugar, inputLat);
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

// sigue la ubicación del usuario y actualiza la pantalla cada vez que cambia
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
  ubicacionTexto.textContent = `${texto} Puedes seguir usando la app igual.`;
}

// al abrir la app primero le preguntamos al usuario si quiere compartir su ubicación
const dialogoUbicacion = document.getElementById('dialogo-ubicacion');
const btnActivarUbicacion = document.getElementById('btn-activar-ubicacion');
let ubicacionIniciada = false;

function preguntarUbicacion() {
  if (typeof dialogoUbicacion.showModal === 'function') {
    dialogoUbicacion.showModal();
  } else if (confirm('¿Permites mostrar tu ubicación?')) {
    aceptarUbicacion();
  } else {
    rechazarUbicacion();
  }
}

function aceptarUbicacion() {
  if (dialogoUbicacion.open) dialogoUbicacion.close();
  btnActivarUbicacion.hidden = true;
  if (ubicacionIniciada) return;
  ubicacionIniciada = true;
  ubicacionTexto.textContent = 'Obteniendo ubicación...';
  iniciarGeolocalizacion();
}

function rechazarUbicacion() {
  if (dialogoUbicacion.open) dialogoUbicacion.close();
  ubicacionTexto.textContent = 'No compartiste tu ubicación.';
  btnActivarUbicacion.hidden = false;
}

document.getElementById('btn-ubicacion-si').addEventListener('click', aceptarUbicacion);
document.getElementById('btn-ubicacion-no').addEventListener('click', rechazarUbicacion);
btnActivarUbicacion.addEventListener('click', preguntarUbicacion);
// si cierra la ventana con Esc cuenta como "Ahora no"
dialogoUbicacion.addEventListener('cancel', (e) => {
  e.preventDefault();
  rechazarUbicacion();
});

function recortarTexto(texto, anchoMax) {
  if (ctx.measureText(texto).width <= anchoMax) return texto;
  let recortado = texto;
  while (recortado.length > 1 && ctx.measureText(`${recortado}…`).width > anchoMax) {
    recortado = recortado.slice(0, -1);
  }
  return `${recortado}…`;
}

// dibuja en el canvas el resumen de tareas
function dibujarCanvas(actual) {
  const W = canvas.clientWidth;
  const horizontal = W >= 520;
  const H = horizontal ? 200 : 368;
  const dpr = window.devicePixelRatio || 1;

  // para que no se vea borroso 
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

  // circulo de progreso 
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

  // barras pendientes / completadas
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
    rectRedondo(x0, yBarra, anchoBarras, altoBarra, altoBarra / 2);

    if (b.valor > 0) {
      ctx.fillStyle = color(b.relleno);
      rectRedondo(x0, yBarra, (b.valor / maxValor) * anchoBarras, altoBarra, altoBarra / 2);
    }
  });

  // cuadro de abajo: en que lugar estoy
  const yAviso = y0 + 140;
  const altoAviso = 38;
  ctx.fillStyle = actual ? color('--naranja') : '#ebeef0';
  rectRedondo(x0, yAviso, anchoBarras, altoAviso, 10);

  let textoAviso = 'Sin ubicación';
  if (actual) textoAviso = `${aqui} pendiente(s) en ${actual.nombre}`;
  else if (posicionActual) textoAviso = 'Fuera de tus lugares';

  ctx.textAlign = 'left';
  ctx.fillStyle = actual ? '#fff' : color('--gris');
  ctx.font = `600 13px ${fuente}`;
  ctx.fillText(recortarTexto(textoAviso, anchoBarras - 28), x0 + 14, yAviso + altoAviso / 2);
}

// ---------- mapa (Leaflet): lugares guardados, sus tareas y mi ubicación ----------

const CENTRO_INICIAL = [5.0689, -75.5174]; // Manizales, por si no hay ubicación ni lugares

let mapa = null;
let capaLugares = null;
let marcadorUsuario = null;
let circuloPrecision = null;
let usuarioCentrado = false;
let lugarAbierto = null; // id del lugar con el popup abierto, para no cerrarlo al redibujar
let redibujando = false;

function crearMapa() {
  const contenedor = document.getElementById('mapa');
  if (typeof L === 'undefined') {
    contenedor.textContent = 'No se pudo cargar el mapa. Revisa tu conexión a internet.';
    contenedor.classList.add('mapa-error');
    return;
  }

  mapa = L.map(contenedor).setView(CENTRO_INICIAL, 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapa);
  capaLugares = L.layerGroup().addTo(mapa);

  // clic en el mapa: copia las coordenadas al formulario de lugares
  mapa.on('click', (e) => {
    inputLat.value = e.latlng.lat.toFixed(6);
    inputLon.value = e.latlng.lng.toFixed(6);
    inputLugarNombre.focus({ preventScroll: true });
    mostrarMensaje('Coordenadas tomadas del mapa. Ponle nombre y guarda el lugar.', 'info', mensajeLugar, inputLugarNombre);
  });

  document.getElementById('btn-centrar-mapa').addEventListener('click', verTodo);
  window.addEventListener('resize', () => mapa.invalidateSize());

  if (lugares.length > 0) verTodo();
}

// ajusta el zoom para que se vean todos los lugares y el usuario
function verTodo() {
  if (!mapa) return;
  const puntos = lugares.map((l) => [l.lat, l.lon]);
  if (posicionActual) puntos.push([posicionActual.lat, posicionActual.lon]);

  if (puntos.length === 0) mapa.setView(CENTRO_INICIAL, 14);
  else if (puntos.length === 1) mapa.setView(puntos[0], 16);
  else mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 17 });
}

function colorVariable(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

// contenido del popup de un lugar: nombre, distancia y sus tareas
function crearPopupLugar(lugar, delLugar) {
  const caja = document.createElement('div');
  caja.className = 'popup-lugar';

  const titulo = document.createElement('strong');
  titulo.textContent = lugar.nombre;
  caja.appendChild(titulo);

  const distancia = distanciaALugar(lugar);
  if (distancia !== null) {
    const info = document.createElement('span');
    info.className = 'popup-distancia';
    info.textContent = distancia <= RADIO_LUGAR ? 'Estás aquí' : `A ${formatearDistancia(distancia)} de ti`;
    caja.appendChild(info);
  }

  if (delLugar.length === 0) {
    const vacio = document.createElement('p');
    vacio.textContent = 'Sin tareas en este lugar.';
    caja.appendChild(vacio);
    return caja;
  }

  const lista = document.createElement('ul');
  // primero las pendientes y luego las completadas
  [...delLugar]
    .sort((a, b) => (a.estado === 'pendiente' ? -1 : 1) - (b.estado === 'pendiente' ? -1 : 1))
    .forEach((t) => {
      const item = document.createElement('li');
      item.className = t.estado;
      item.textContent = t.texto;
      lista.appendChild(item);
    });
  caja.appendChild(lista);
  return caja;
}

function dibujarLugares() {
  redibujando = true;
  capaLugares.clearLayers();
  redibujando = false;

  lugares.forEach((lugar) => {
    const delLugar = tareas.filter((t) => t.lugarId === lugar.id);
    const pendientes = delLugar.filter((t) => t.estado === 'pendiente').length;

    // rojo si tiene pendientes, verde si no
    let color = colorVariable('--verde');
    if (pendientes > 0) color = colorVariable('--rojo');

    // el círculo es el radio en el que la app considera que estás en el lugar
    L.circle([lugar.lat, lugar.lon], {
      radius: RADIO_LUGAR,
      color,
      weight: 1,
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(capaLugares);

    const punto = L.circleMarker([lugar.lat, lugar.lon], {
      radius: 9,
      color: '#fff',
      weight: 2,
      fillColor: color,
      fillOpacity: 1,
    })
      .bindTooltip(`${lugar.nombre} (${pendientes})`, { permanent: true, direction: 'top', offset: [0, -8] })
      .bindPopup(crearPopupLugar(lugar, delLugar))
      .addTo(capaLugares);

    punto.on('popupopen', () => { lugarAbierto = lugar.id; });
    punto.on('popupclose', () => {
      if (!redibujando && lugarAbierto === lugar.id) lugarAbierto = null;
    });
    if (lugarAbierto === lugar.id) punto.openPopup();
  });
}

function dibujarUsuario() {
  if (!posicionActual) return;
  const punto = [posicionActual.lat, posicionActual.lon];

  if (!marcadorUsuario) {
    circuloPrecision = L.circle(punto, {
      radius: posicionActual.precision,
      color: colorVariable('--azul'),
      weight: 1,
      fillOpacity: 0.1,
      interactive: false,
    }).addTo(mapa);
    marcadorUsuario = L.circleMarker(punto, {
      radius: 8,
      color: '#fff',
      weight: 3,
      fillColor: colorVariable('--azul'),
      fillOpacity: 1,
    })
      .bindPopup('Estás aquí')
      .addTo(mapa);
  } else {
    marcadorUsuario.setLatLng(punto);
    circuloPrecision.setLatLng(punto).setRadius(posicionActual.precision);
  }

  // la primera vez que llega la ubicación se centra el mapa
  if (!usuarioCentrado) {
    usuarioCentrado = true;
    verTodo();
  }
}

// se llama desde render()
function renderMapa() {
  if (!mapa) return;
  dibujarLugares();
  dibujarUsuario();
}

filtroLugar.checked = localStorage.getItem(CLAVE_FILTRO) === '1';
crearMapa();
render();
preguntarUbicacion();
window.addEventListener('resize', () => dibujarCanvas(lugarActual()));
// cada minuto actualiza los textos de tiempo, como "hace 5 min"
setInterval(() => {
  if (!idArrastrado) render();
}, 60000);
