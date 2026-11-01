const MENSAJE_EJEMPLO = 'hola! mandame una docena de empanadas, 6 de carne y 6 de jamón y queso, un pollo entero y una coca. Es a Mendoza 1234, Centro, para las 21. Soy Laura, 3415551234, pago por transferencia';
const ETIQUETAS_ESTADO = {
  nuevo: 'Recibimos tu pedido',
  preparacion: 'Lo estamos preparando',
  listo: 'Tu pedido está listo',
  entregado: 'Pedido entregado. ¡Que lo disfrutes!',
};
const ETIQUETAS_FALTANTE = {
  productos: 'Productos',
  entrega_tipo: 'Envío o retiro',
  direccion: 'Dirección',
  zona: 'Barrio',
  nombre: 'Tu nombre',
  telefono: 'Teléfono',
  medio_pago: 'Medio de pago',
};

const $ = (id) => document.getElementById(id);
const pesos = (n) => `$${n.toLocaleString('es-AR')}`;

let mensajes = [];
let borrador = { items: [], faltantes: ['productos'], listo: false, total: 0, subtotal: 0, descuento: 0, envio: 0, no_encontrados: [] };
let esperando = false;
let negocio;
let seguimiento;

function agregarBurbuja(rol, texto) {
  const burbuja = document.createElement('div');
  burbuja.className = rol === 'cliente'
    ? 'ml-auto max-w-[85%] w-fit rounded-xl rounded-br-sm bg-orange-100 px-3 py-2'
    : 'max-w-[85%] w-fit rounded-xl rounded-bl-sm bg-stone-100 px-3 py-2';
  burbuja.textContent = texto;
  $('chat').append(burbuja);
  $('chat').scrollTop = $('chat').scrollHeight;
  return burbuja;
}

function mostrarEscribiendo() {
  const burbuja = agregarBurbuja('bot', '');
  burbuja.classList.add('escribiendo');
  burbuja.setAttribute('aria-label', 'Escribiendo');
  burbuja.innerHTML = '<span></span><span></span><span></span>';
  return burbuja;
}

function nombreItem(item) {
  return item.variante ? `${item.nombre} (${item.variante})` : item.nombre;
}

function etiquetaFaltante(faltante) {
  return faltante.startsWith('variante:') ? `Gusto de ${faltante.slice(9)}` : ETIQUETAS_FALTANTE[faltante];
}

function fila(etiqueta, valor, clase = '') {
  const elemento = document.createElement('div');
  elemento.className = `flex justify-between gap-3 ${clase}`;
  const izquierda = document.createElement('span');
  const derecha = document.createElement('span');
  izquierda.textContent = etiqueta;
  derecha.textContent = valor;
  elemento.append(izquierda, derecha);
  return elemento;
}

function botonCantidad(texto, etiqueta, accion) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.textContent = texto;
  boton.setAttribute('aria-label', etiqueta);
  boton.className = 'w-7 h-7 rounded-full border border-stone-300 leading-none hover:bg-stone-100';
  boton.addEventListener('click', accion);
  return boton;
}

async function cambiarCantidad(item, delta) {
  const items = borrador.items
    .map((i) => (i === item ? { ...i, cantidad: i.cantidad + delta } : i))
    .filter((i) => i.cantidad > 0);
  await recalcular({ ...borrador, items });
}

async function recalcular(nuevo) {
  try {
    const datos = await llamar('/api/recalcular', { borrador: nuevo });
    borrador = datos.borrador;
    mostrarTicket();
  } catch (error) {
    agregarBurbuja('bot', error.message);
  }
}

function mostrarTicket() {
  const ticket = $('ticket');
  ticket.replaceChildren();

  if (!borrador.items.length) {
    const vacio = document.createElement('p');
    vacio.className = 'text-stone-500';
    vacio.textContent = 'Todavía no agregaste nada. Contanos qué querés comer.';
    ticket.append(vacio);
  }

  const lista = document.createElement('ul');
  lista.className = 'space-y-2';
  for (const item of borrador.items) {
    const elemento = document.createElement('li');
    elemento.className = 'flex items-center gap-2';
    const nombre = document.createElement('span');
    nombre.className = 'flex-1 min-w-0';
    nombre.textContent = nombreItem(item);
    const cantidad = document.createElement('span');
    cantidad.className = 'w-5 text-center font-semibold';
    cantidad.textContent = item.cantidad;
    const precio = document.createElement('span');
    precio.className = 'w-20 text-right tabular-nums';
    precio.textContent = pesos(item.subtotal);
    elemento.append(
      nombre,
      botonCantidad('−', `Sacar uno de ${item.nombre}`, () => cambiarCantidad(item, -1)),
      cantidad,
      botonCantidad('+', `Agregar uno de ${item.nombre}`, () => cambiarCantidad(item, 1)),
      precio,
    );
    lista.append(elemento);
  }
  ticket.append(lista);

  if (borrador.no_encontrados.length) {
    const aviso = document.createElement('p');
    aviso.className = 'mt-3 rounded-lg bg-amber-100 text-amber-900 px-3 py-2 text-sm';
    aviso.textContent = `No agregamos: ${borrador.no_encontrados.join(', ')}`;
    ticket.append(aviso);
  }

  if (borrador.items.length) {
    const totales = document.createElement('div');
    totales.className = 'mt-3 pt-3 border-t space-y-1 tabular-nums';
    if (borrador.descuento) totales.append(fila('Promo docena', `−${pesos(borrador.descuento)}`, 'text-green-700'));
    if (borrador.entrega_tipo === 'envio' && borrador.envio) totales.append(fila(`Envío a ${borrador.zona_nombre}`, pesos(borrador.envio)));
    totales.append(fila('Total', pesos(borrador.total), 'font-bold text-lg'));
    ticket.append(totales);

    const datos = [
      borrador.entrega_tipo === 'retiro' ? 'Retira en el local' : borrador.direccion,
      borrador.hora && `Para las ${borrador.hora}`,
      borrador.cliente_nombre,
      borrador.telefono,
      borrador.medio_pago,
    ].filter(Boolean);
    if (datos.length) {
      const resumen = document.createElement('p');
      resumen.className = 'mt-3 text-sm text-stone-600';
      resumen.textContent = datos.join(' · ');
      ticket.append(resumen);
    }

    if (!borrador.listo) {
      const faltan = document.createElement('p');
      faltan.className = 'mt-3 text-sm text-stone-600';
      faltan.textContent = `Falta: ${borrador.faltantes.map(etiquetaFaltante).join(', ')}`;
      ticket.append(faltan);
    }

    const confirmar = document.createElement('button');
    confirmar.type = 'button';
    confirmar.disabled = !borrador.listo;
    confirmar.textContent = borrador.listo ? `Confirmar pedido · ${pesos(borrador.total)}` : 'Completá los datos para confirmar';
    confirmar.className = 'mt-3 w-full rounded-lg bg-orange-700 text-white font-semibold py-2 disabled:bg-stone-300 disabled:text-stone-600';
    confirmar.addEventListener('click', confirmarPedido);
    ticket.append(confirmar);
  }
}

async function llamar(url, cuerpo) {
  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error('No pudimos conectarnos. Revisá tu internet y probá de nuevo.');
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(datos.error || 'Algo salió mal. Probá de nuevo.');
  return datos;
}

async function enviarMensaje(texto) {
  const limpio = texto.trim();
  if (!limpio || esperando) return;

  esperando = true;
  $('enviar').disabled = true;
  $('sugerencia').classList.add('hidden');
  $('mensaje').value = '';
  mensajes.push({ rol: 'cliente', texto: limpio });
  agregarBurbuja('cliente', limpio);
  const escribiendo = mostrarEscribiendo();

  try {
    const datos = await llamar('/api/conversar', { mensajes, borrador });
    borrador = datos.borrador;
    mensajes.push({ rol: 'bot', texto: datos.respuesta });
    escribiendo.remove();
    agregarBurbuja('bot', datos.respuesta);
    mostrarTicket();
    if (borrador.listo) $('ticket').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    mensajes.pop();
    escribiendo.remove();
    agregarBurbuja('bot', error.message);
    $('mensaje').value = limpio;
  } finally {
    esperando = false;
    $('enviar').disabled = false;
    $('mensaje').focus();
  }
}

async function confirmarPedido() {
  try {
    const { pedido } = await llamar('/api/pedidos', { borrador });
    mostrarConfirmado(pedido);
  } catch (error) {
    agregarBurbuja('bot', error.message);
  }
}

function textoCompartir(pedido) {
  const detalle = pedido.items.map((i) => `${i.cantidad} x ${nombreItem(i)}`).join('\n');
  return `Pedido #${pedido.id} en ${negocio.nombre}\n${detalle}\nTotal: ${pesos(pedido.total)}`;
}

function mostrarConfirmado(pedido) {
  const minutos = negocio.demora_minutos[pedido.entrega_tipo];
  $('vista-pedido').classList.add('hidden');
  $('vista-confirmado').classList.remove('hidden');
  $('numero').textContent = `#${pedido.id}`;
  $('estado').textContent = ETIQUETAS_ESTADO[pedido.estado];
  $('demora').textContent = pedido.hora ? `Para las ${pedido.hora}` : `Demora estimada: ${minutos} minutos`;
  $('compartir').href = `https://wa.me/?text=${encodeURIComponent(textoCompartir(pedido))}`;

  clearInterval(seguimiento);
  seguimiento = setInterval(async () => {
    const respuesta = await fetch(`/api/pedidos/${pedido.id}`).catch(() => null);
    if (!respuesta?.ok) return;
    const datos = await respuesta.json();
    $('estado').textContent = ETIQUETAS_ESTADO[datos.pedido.estado];
    if (datos.pedido.estado === 'entregado') clearInterval(seguimiento);
  }, 4000);
}

function reiniciar() {
  clearInterval(seguimiento);
  mensajes = [];
  borrador = { items: [], faltantes: ['productos'], listo: false, total: 0, subtotal: 0, descuento: 0, envio: 0, no_encontrados: [] };
  $('chat').replaceChildren();
  $('sugerencia').classList.remove('hidden');
  $('vista-confirmado').classList.add('hidden');
  $('vista-pedido').classList.remove('hidden');
  saludar();
  mostrarTicket();
}

function saludar() {
  agregarBurbuja('bot', `¡Hola! Somos ${negocio.nombre}. ¿Qué te mandamos hoy?`);
}

function mostrarCarta() {
  const categorias = Map.groupBy(negocio.productos, (p) => p.categoria);
  for (const [categoria, productos] of categorias) {
    const titulo = document.createElement('h3');
    titulo.className = 'font-semibold text-orange-800';
    titulo.textContent = categoria;
    const lista = document.createElement('ul');
    for (const producto of productos) {
      const elemento = document.createElement('li');
      elemento.className = producto.disponible ? '' : 'text-stone-400 line-through';
      elemento.append(fila(producto.nombre, pesos(producto.precio)));
      lista.append(elemento);
    }
    $('carta').append(titulo, lista);
  }
}

$('formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  enviarMensaje($('mensaje').value);
});
$('ejemplo').addEventListener('click', () => enviarMensaje(MENSAJE_EJEMPLO));
$('nuevo').addEventListener('click', reiniciar);

fetch('/api/negocio')
  .then((r) => r.json())
  .then((datos) => {
    negocio = datos;
    $('negocio').textContent = datos.nombre;
    saludar();
    mostrarCarta();
    mostrarTicket();
  })
  .catch(() => agregarBurbuja('bot', 'No pudimos cargar la carta. Recargá la página.'));
