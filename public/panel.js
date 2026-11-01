const EJEMPLOS = [
  `Marcos: hola buenas, tienen pollo hoy?
El Patio: Hola Marcos! Sí, recién salido
Marcos: dale mandame uno entero con papas
Marcos: ah y 2 flanes
Marcos: no perdón, un solo flan
El Patio: Perfecto, ¿a dónde te lo mando?
Marcos: Corrientes 850, Centro. Pago en efectivo. Mi cel es 3416667788`,
  `Sofi: hola! me guardás 6 empanadas de carne y una coca para esta noche?
Sofi: te escribo del 3419990011`,
];

const COLUMNAS = [
  { estado: 'pendiente', titulo: 'A responder', accion: 'Pasar a cocina', siguiente: 'nuevo' },
  { estado: 'nuevo', titulo: 'Nuevos', accion: 'Empezar a preparar', siguiente: 'preparacion' },
  { estado: 'preparacion', titulo: 'En preparación', accion: 'Marcar listo', siguiente: 'listo' },
  { estado: 'listo', titulo: 'Listos', accion: 'Marcar entregado', siguiente: 'entregado' },
  { estado: 'entregado', titulo: 'Entregados' },
];
const ESTADOS_EN_COCINA = ['nuevo', 'preparacion'];
const MINUTOS_ALERTA = 15;

const $ = (id) => document.getElementById(id);
const pesos = (n) => `$${n.toLocaleString('es-AR')}`;

let conocidos = null;
let ejemploActual = 0;

function minutosDesde(fecha) {
  return Math.floor((Date.now() - new Date(fecha)) / 60000);
}

function nodo(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function mensajeAviso(pedido) {
  return pedido.entrega_tipo === 'envio'
    ? `Hola ${pedido.cliente_nombre ?? ''}! Tu pedido #${pedido.id} ya salió para ${pedido.direccion ?? 'tu dirección'}.`
    : `Hola ${pedido.cliente_nombre ?? ''}! Tu pedido #${pedido.id} está listo para retirar.`;
}

function linkWhatsApp(pedido, mensaje) {
  const numero = (pedido.telefono ?? '').replace(/\D/g, '');
  const destino = numero ? `54${numero.replace(/^(54|0)/, '')}` : '';
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensaje)}`;
}

function botonWhatsApp(pedido, texto, mensaje) {
  const enlace = nodo('a', 'rounded-lg bg-green-700 text-white text-sm font-semibold px-3 py-2', texto);
  enlace.href = linkWhatsApp(pedido, mensaje);
  enlace.target = '_blank';
  enlace.rel = 'noopener';
  return enlace;
}

function formularioCompletar(pedido) {
  const formulario = nodo('form', 'flex gap-2');
  const entrada = nodo('input', 'flex-1 min-w-0 rounded-lg border border-stone-300 px-2 py-1 text-sm');
  entrada.dataset.completar = pedido.id;
  entrada.placeholder = 'Pegá lo que respondió';
  entrada.maxLength = 3000;
  entrada.setAttribute('aria-label', `Respuesta del cliente del pedido ${pedido.id}`);
  const boton = nodo('button', 'rounded-lg border border-stone-300 text-sm px-3 py-1', 'Sumar');

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!entrada.value.trim()) return;
    boton.disabled = true;
    boton.textContent = '...';
    const { error } = await enviar(`/api/pedidos/${pedido.id}/completar`, { texto: entrada.value });
    if (error) {
      mostrarMensaje(error, true);
      boton.disabled = false;
      boton.textContent = 'Sumar';
      return;
    }
    entrada.value = '';
    actualizar();
  });

  formulario.append(entrada, boton);
  return formulario;
}

function tarjeta(pedido, columna, esNuevo) {
  const minutos = minutosDesde(pedido.creado);
  const demorado = ['pendiente', 'nuevo'].includes(pedido.estado) && minutos >= MINUTOS_ALERTA;
  const elemento = nodo('article', `bg-white rounded-lg shadow-sm p-3 space-y-2 ${demorado ? 'ring-2 ring-red-600' : ''} ${esNuevo ? 'pedido-nuevo' : ''}`);

  const encabezado = nodo('div', 'flex justify-between items-baseline gap-2');
  encabezado.append(
    nodo('strong', 'text-lg', `#${pedido.id}`),
    nodo('span', demorado ? 'text-sm text-red-700 font-semibold' : 'text-sm text-stone-500', `hace ${minutos} min`),
  );

  const lista = nodo('ul', 'text-sm');
  for (const item of pedido.items) {
    const variante = item.variante ? ` (${item.variante})` : '';
    const nota = item.nota ? ` · ${item.nota}` : '';
    lista.append(nodo('li', '', `${item.cantidad} × ${item.nombre}${variante}${nota}`));
  }

  const entrega = pedido.entrega_tipo === 'retiro' ? 'Retira en el local' : (pedido.direccion ?? 'Sin dirección');
  const hora = pedido.hora ? ` · ${pedido.hora}` : '';
  const datos = nodo('p', 'text-sm text-stone-600', `${pedido.cliente_nombre ?? 'Sin nombre'} · ${entrega}${hora}`);
  const pago = nodo('p', 'text-sm font-semibold', `${pesos(pedido.total)} · ${pedido.medio_pago ?? 'pago a definir'}`);
  elemento.append(encabezado, lista, datos, pago);

  if (pedido.origen === 'whatsapp') elemento.append(nodo('span', 'inline-block text-xs bg-green-100 text-green-800 rounded px-2 py-0.5', 'Desde WhatsApp'));
  if (pedido.no_encontrados.length) elemento.append(nodo('p', 'text-sm text-amber-900', `No se sumó: ${pedido.no_encontrados.join(', ')}`));

  if (pedido.estado === 'pendiente') {
    elemento.append(
      nodo('p', 'text-sm rounded bg-amber-100 text-amber-900 px-2 py-1', `Sugerido: ${pedido.mensaje_sugerido}`),
      botonWhatsApp(pedido, 'Responder', pedido.mensaje_sugerido),
      formularioCompletar(pedido),
    );
  }

  const acciones = nodo('div', 'flex flex-wrap gap-2 pt-1');
  if (columna.siguiente) {
    const avanzar = nodo('button', pedido.estado === 'pendiente' ? 'flex-1 rounded-lg border border-stone-300 text-sm px-3 py-2' : 'flex-1 rounded-lg bg-orange-700 text-white text-sm font-semibold px-3 py-2', columna.accion);
    avanzar.type = 'button';
    avanzar.addEventListener('click', () => cambiarEstado(pedido.id, columna.siguiente));
    acciones.append(avanzar);
  }
  if (pedido.estado === 'listo') acciones.append(botonWhatsApp(pedido, 'Avisar', mensajeAviso(pedido)));
  elemento.append(acciones);
  return elemento;
}

function mostrarCocina(pedidos) {
  const totales = new Map();
  for (const pedido of pedidos.filter((p) => ESTADOS_EN_COCINA.includes(p.estado))) {
    for (const item of pedido.items) {
      const nombre = item.variante ? `${item.nombre} (${item.variante})` : item.nombre;
      totales.set(nombre, (totales.get(nombre) ?? 0) + item.cantidad);
    }
  }

  $('cocina').classList.toggle('hidden', totales.size === 0);
  $('lista-cocina').replaceChildren(...[...totales]
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, cantidad]) => {
      const elemento = nodo('li', 'rounded-lg bg-stone-800 px-3 py-2');
      elemento.append(nodo('strong', 'text-xl text-orange-400 mr-2', cantidad), nodo('span', 'text-sm', nombre));
      return elemento;
    }));
}

function mostrarTablero(pedidos) {
  const tablero = $('tablero');
  tablero.replaceChildren();

  for (const columna of COLUMNAS) {
    const delEstado = pedidos.filter((p) => p.estado === columna.estado);
    const seccion = nodo('section', 'bg-stone-200 rounded-xl p-3 space-y-3 min-h-40');
    seccion.append(nodo('h2', 'font-bold', `${columna.titulo} (${delEstado.length})`));
    if (!delEstado.length) seccion.append(nodo('p', 'text-sm text-stone-500', 'Nada por acá.'));
    for (const pedido of delEstado) {
      seccion.append(tarjeta(pedido, columna, conocidos !== null && !conocidos.has(pedido.id)));
    }
    tablero.append(seccion);
  }

  conocidos = new Set(pedidos.map((p) => p.id));
  const confirmados = pedidos.filter((p) => p.estado !== 'pendiente');
  const vendido = confirmados.reduce((suma, p) => suma + p.total, 0);
  const porResponder = pedidos.length - confirmados.length;
  $('resumen').textContent = pedidos.length
    ? `${confirmados.length} ${confirmados.length === 1 ? 'pedido' : 'pedidos'} · ${pesos(vendido)} · ${porResponder} por responder`
    : 'Sin pedidos todavía';
  mostrarCocina(pedidos);
}

// Mientras escriben una respuesta, el tablero no se redibuja para no borrar el texto.
function estaEscribiendo() {
  return [...document.querySelectorAll('[data-completar]')].some((entrada) => entrada.value || entrada === document.activeElement);
}

async function actualizar() {
  if (estaEscribiendo()) return;
  try {
    const respuesta = await fetch('/api/pedidos');
    if (respuesta.ok) mostrarTablero((await respuesta.json()).pedidos);
  } catch {
    // reintenta en el próximo ciclo
  }
}

async function enviar(url, cuerpo, metodo = 'POST') {
  try {
    const respuesta = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) return { error: datos.error || 'Algo salió mal. Probá de nuevo.' };
    return datos;
  } catch {
    return { error: 'No pudimos conectarnos. Probá de nuevo.' };
  }
}

async function cambiarEstado(id, estado) {
  await enviar(`/api/pedidos/${id}`, { estado }, 'PATCH');
  actualizar();
}

function mostrarMensaje(texto, esError = false) {
  const mensaje = $('mensaje-chat');
  mensaje.textContent = texto;
  mensaje.classList.toggle('hidden', !texto);
  mensaje.classList.toggle('text-red-700', esError);
  mensaje.classList.toggle('text-green-800', !esError);
}

async function cargarAudio(audio) {
  mostrarMensaje('Escuchando el audio...');
  try {
    const texto = await transcribirAudio(audio);
    $('conversacion').value = `Audio del cliente: ${texto}`;
    extraer(`Audio: "${texto}". `);
  } catch (error) {
    mostrarMensaje(error.message, true);
  }
}

async function extraer(prefijo = '') {
  const texto = $('conversacion').value.trim();
  if (!texto) return mostrarMensaje('Pegá una conversación primero.', true);

  mostrarMensaje('');
  $('extraer').disabled = true;
  $('extraer').textContent = 'Cargando...';

  const datos = await enviar('/api/pedidos/desde-chat', { texto });
  $('extraer').disabled = false;
  $('extraer').textContent = 'Cargar a la bandeja';

  if (datos.error) return mostrarMensaje(datos.error, true);
  $('conversacion').value = '';
  if (!datos.pedido) return mostrarMensaje(`${prefijo}No es un pedido. Respuesta sugerida: ${datos.respuesta}`);
  mostrarMensaje(prefijo + (datos.pedido.estado === 'nuevo'
    ? `Pedido #${datos.pedido.id} completo: ya está en cocina.`
    : `Pedido #${datos.pedido.id} cargado: falta responderle al cliente.`));
  actualizar();
}

$('extraer').addEventListener('click', () => extraer());
crearGrabador($('microfono'), {
  alTerminar: cargarAudio,
  alError: (mensaje) => mostrarMensaje(mensaje, true),
});
$('archivo-audio').addEventListener('change', (evento) => {
  const [archivo] = evento.target.files;
  if (archivo) cargarAudio(archivo);
  evento.target.value = '';
});
$('ejemplo').addEventListener('click', () => {
  $('conversacion').value = EJEMPLOS[ejemploActual++ % EJEMPLOS.length];
  extraer();
});

actualizar();
setInterval(actualizar, new URLSearchParams(location.search).has('demo') ? 1000 : 3000);
