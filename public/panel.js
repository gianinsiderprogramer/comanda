const CONVERSACION_EJEMPLO = `Marcos: hola buenas, tienen pollo hoy?
El Patio: Hola Marcos! Sí, recién salido
Marcos: dale mandame uno entero con papas
Marcos: ah y 2 flanes
Marcos: no perdón, un solo flan
El Patio: Perfecto, ¿a dónde te lo mando?
Marcos: Corrientes 850, Centro. Pago en efectivo. Mi cel es 3416667788`;

const COLUMNAS = [
  { estado: 'nuevo', titulo: 'Nuevos', accion: 'Empezar a preparar', siguiente: 'preparacion' },
  { estado: 'preparacion', titulo: 'En preparación', accion: 'Marcar listo', siguiente: 'listo' },
  { estado: 'listo', titulo: 'Listos', accion: 'Marcar entregado', siguiente: 'entregado' },
  { estado: 'entregado', titulo: 'Entregados' },
];
const MINUTOS_ALERTA = 15;

const $ = (id) => document.getElementById(id);
const pesos = (n) => `$${n.toLocaleString('es-AR')}`;

let conocidos = null;
let borradorChat = null;

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

function linkWhatsApp(pedido) {
  const numero = (pedido.telefono ?? '').replace(/\D/g, '');
  const destino = numero ? `54${numero.replace(/^(54|0)/, '')}` : '';
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensajeAviso(pedido))}`;
}

function tarjeta(pedido, columna, esNuevo) {
  const minutos = minutosDesde(pedido.creado);
  const demorado = pedido.estado === 'nuevo' && minutos >= MINUTOS_ALERTA;
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

  if (pedido.origen === 'whatsapp') elemento.append(nodo('span', 'inline-block text-xs bg-green-100 text-green-800 rounded px-2 py-0.5', 'Cargado desde WhatsApp'));
  if (pedido.faltantes.length) elemento.append(nodo('p', 'text-xs text-amber-800', 'Faltan datos: revisar con el cliente'));

  const acciones = nodo('div', 'flex flex-wrap gap-2 pt-1');
  if (columna.siguiente) {
    const avanzar = nodo('button', 'flex-1 rounded-lg bg-orange-700 text-white text-sm font-semibold px-3 py-2', columna.accion);
    avanzar.type = 'button';
    avanzar.addEventListener('click', () => cambiarEstado(pedido.id, columna.siguiente));
    acciones.append(avanzar);
  }
  if (pedido.estado === 'listo') {
    const avisar = nodo('a', 'rounded-lg bg-green-700 text-white text-sm font-semibold px-3 py-2', 'Avisar');
    avisar.href = linkWhatsApp(pedido);
    avisar.target = '_blank';
    avisar.rel = 'noopener';
    acciones.append(avisar);
  }
  elemento.append(acciones);
  return elemento;
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
  const vendido = pedidos.reduce((suma, p) => suma + p.total, 0);
  const abiertos = pedidos.filter((p) => p.estado !== 'entregado').length;
  $('resumen').textContent = pedidos.length
    ? `${pedidos.length} pedidos · ${pesos(vendido)} · ${abiertos} sin entregar`
    : 'Sin pedidos todavía';
}

async function actualizar() {
  try {
    const respuesta = await fetch('/api/pedidos');
    if (respuesta.ok) mostrarTablero((await respuesta.json()).pedidos);
  } catch {
    // reintenta en el próximo ciclo
  }
}

async function cambiarEstado(id, estado) {
  await fetch(`/api/pedidos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  }).catch(() => null);
  actualizar();
}

function mostrarError(mensaje) {
  $('error-chat').textContent = mensaje;
  $('error-chat').classList.toggle('hidden', !mensaje);
}

function mostrarResultado({ borrador, respuesta }) {
  borradorChat = borrador;
  const caja = $('resultado-chat');
  caja.replaceChildren();
  caja.classList.remove('hidden');

  const detalle = borrador.items.map((i) => `${i.cantidad} × ${i.nombre}${i.variante ? ` (${i.variante})` : ''}`).join(', ');
  caja.append(nodo('p', 'font-semibold', detalle || 'No encontramos productos en la conversación.'));
  if (borrador.items.length) caja.append(nodo('p', '', `Total: ${pesos(borrador.total)}`));
  if (borrador.no_encontrados.length) caja.append(nodo('p', 'text-amber-800', `No está en la carta: ${borrador.no_encontrados.join(', ')}`));
  caja.append(nodo('p', 'text-stone-600', `Respuesta sugerida: ${respuesta}`));

  if (borrador.items.length) {
    const cargar = nodo('button', 'rounded-lg bg-orange-700 text-white font-semibold px-4 py-2', borrador.listo ? 'Cargar pedido' : 'Cargar igual (faltan datos)');
    cargar.type = 'button';
    cargar.addEventListener('click', cargarPedido);
    caja.append(cargar);
  }
}

async function extraer() {
  const texto = $('conversacion').value.trim();
  if (!texto) return mostrarError('Pegá una conversación primero.');

  mostrarError('');
  $('resultado-chat').classList.add('hidden');
  $('extraer').disabled = true;
  $('extraer').textContent = 'Armando...';

  try {
    const respuesta = await fetch('/api/pedidos/desde-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error || 'Algo salió mal. Probá de nuevo.');
    mostrarResultado(datos);
  } catch (error) {
    mostrarError(error.message === 'Failed to fetch' ? 'No pudimos conectarnos. Probá de nuevo.' : error.message);
  } finally {
    $('extraer').disabled = false;
    $('extraer').textContent = 'Armar pedido';
  }
}

async function cargarPedido() {
  const respuesta = await fetch('/api/pedidos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ borrador: borradorChat, origen: 'whatsapp' }),
  }).catch(() => null);

  if (!respuesta?.ok) return mostrarError('No pudimos cargar el pedido. Probá de nuevo.');
  borradorChat = null;
  $('conversacion').value = '';
  $('resultado-chat').classList.add('hidden');
  actualizar();
}

$('extraer').addEventListener('click', extraer);
$('ejemplo').addEventListener('click', () => {
  $('conversacion').value = CONVERSACION_EJEMPLO;
  extraer();
});

actualizar();
setInterval(actualizar, 3000);
