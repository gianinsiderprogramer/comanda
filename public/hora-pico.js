const MENSAJES = [
  {
    nombre: 'Caro',
    texto: 'holaa mandame 2 pollos enteros y 2 papas a Mitre 450, Centro, para las 21, pago con transfe. Soy Caro 3414001122',
    respaldo: { items: [{ producto_id: 'pollo_entero', cantidad: 2 }, { producto_id: 'papas', cantidad: 2 }], entrega_tipo: 'envio', direccion: 'Mitre 450', zona_id: 'centro', hora: '21:00', cliente_nombre: 'Caro', telefono: '3414001122', medio_pago: 'transferencia' },
  },
  {
    nombre: 'Nico',
    texto: 'buenas! una docena d empanadas mitad carne mitad jyq para retirar a las 21.30. nico 3415002233 efectivo',
    respaldo: { items: [{ producto_id: 'empanada', variante: 'carne', cantidad: 6 }, { producto_id: 'empanada', variante: 'jamón y queso', cantidad: 6 }], entrega_tipo: 'retiro', hora: '21:30', cliente_nombre: 'Nico', telefono: '3415002233', medio_pago: 'efectivo' },
  },
  {
    nombre: 'Flor',
    texto: '3 milanesas con papas porfa',
    respaldo: { items: [{ producto_id: 'milanesa_papas', cantidad: 3 }], cliente_nombre: 'Flor' },
    mensajeRespaldo: '¡Hola, Flor! Te anoto 3 milanesas con papas. ¿Las querés de carne o de pollo? ¿Con envío o pasás a retirar? ¿Para qué hora? ¿Cómo pagás: efectivo, transferencia o mercadopago?',
  },
  {
    nombre: 'Raúl',
    texto: 'Buenas noches. Quisiera un pastel de papa y una tarta de verdura. Paso a retirar a las 20:30. Raúl, 3416003344. Pago en efectivo.',
    respaldo: { items: [{ producto_id: 'pastel_papa', cantidad: 1 }, { producto_id: 'tarta', variante: 'verdura', cantidad: 1 }], entrega_tipo: 'retiro', hora: '20:30', cliente_nombre: 'Raúl', telefono: '3416003344', medio_pago: 'efectivo' },
  },
  {
    nombre: 'Ana',
    texto: 'hola, abren los lunes?',
  },
  {
    nombre: 'Lucho',
    texto: '2 muzzas y una fugazzeta, Oroño 1200 Pichincha, para las 22, lucho 3417004455, mp',
    respaldo: { items: [{ producto_id: 'pizza_muzza', cantidad: 2 }], entrega_tipo: 'envio', direccion: 'Oroño 1200', zona_id: 'pichincha', hora: '22:00', cliente_nombre: 'Lucho', telefono: '3417004455', medio_pago: 'mercadopago' },
  },
  {
    nombre: 'Maru',
    texto: 'me mandás un pollo? ah y ensalada. después te paso la dirección',
    respaldo: { items: [{ producto_id: 'pollo_entero', cantidad: 1 }, { producto_id: 'ensalada', cantidad: 1 }], entrega_tipo: 'envio', cliente_nombre: 'Maru' },
    mensajeRespaldo: '¡Hola, Maru! Te anoto un pollo entero y una ensalada con envío. ¿A qué dirección y en qué barrio? ¿Para qué hora? ¿Cómo pagás: efectivo, transferencia o mercadopago?',
  },
  {
    nombre: 'Beto',
    texto: '6 de carne. no perdon 12. y una coca a San Luis 900, centro, lo antes posible. beto 3418005566, efectivo',
    respaldo: { items: [{ producto_id: 'empanada', variante: 'carne', cantidad: 12 }, { producto_id: 'coca_15', cantidad: 1 }], entrega_tipo: 'envio', direccion: 'San Luis 900', zona_id: 'centro', hora: 'lo antes posible', cliente_nombre: 'Beto', telefono: '3418005566', medio_pago: 'efectivo' },
  },
];

const MENSAJES_EN_PARALELO = 3;
const MS_ENTRE_MENSAJES = 300;

const $ = (id) => document.getElementById(id);
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

async function pedir(url, opciones = {}) {
  const respuesta = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opciones });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(datos.error || 'Error');
  return datos;
}

function crearBurbuja(mensaje) {
  const elemento = document.createElement('li');
  elemento.className = 'rounded-xl bg-white text-stone-900 px-3 py-2 text-sm';
  const autor = document.createElement('strong');
  autor.textContent = mensaje.nombre;
  const texto = document.createElement('p');
  texto.textContent = mensaje.texto;
  const estado = document.createElement('p');
  estado.className = 'mt-1 text-xs font-bold text-stone-500';
  estado.textContent = 'La IA lo está leyendo...';
  elemento.append(autor, texto, estado);
  $('mensajes').append(elemento);
  $('mensajes').scrollTop = $('mensajes').scrollHeight;
  return estado;
}

function marcar(estado, texto, clase) {
  estado.textContent = texto;
  estado.className = `mt-1 text-xs font-bold ${clase}`;
}

function contarResultado(resumen, pedido, estado, sufijo = '') {
  if (pedido.estado === 'nuevo') {
    resumen.cocina++;
    marcar(estado, `Pedido #${pedido.id}: a cocina${sufijo}`, 'text-green-700');
  } else {
    resumen.responder++;
    marcar(estado, `Pedido #${pedido.id}: falta preguntarle algo${sufijo}`, 'text-orange-700');
  }
}

async function procesar(mensaje, resumen) {
  const estado = crearBurbuja(mensaje);
  try {
    const { pedido, respuesta, no_encontrados: sinStock } = await pedir('/api/pedidos/desde-chat', {
      method: 'POST',
      body: JSON.stringify({ texto: `${mensaje.nombre}: ${mensaje.texto}`, simulacion: true }),
    });
    if (pedido) {
      contarResultado(resumen, pedido, estado, sinStock.length ? ` · no sumó: ${sinStock.join(', ')}` : '');
    } else {
      resumen.consultas++;
      marcar(estado, `Consulta respondida: ${respuesta}`, 'text-stone-600');
    }
  } catch {
    await usarRespaldo(mensaje, estado, resumen);
  }
}

// Si la IA no responde en la demo, carga el resultado guardado y lo muestra como tal.
async function usarRespaldo(mensaje, estado, resumen) {
  if (!mensaje.respaldo) {
    resumen.consultas++;
    marcar(estado, 'Consulta en espera (IA no disponible)', 'text-stone-600');
    return;
  }
  try {
    const { pedido } = await pedir('/api/pedidos', {
      method: 'POST',
      body: JSON.stringify({ borrador: mensaje.respaldo, mensaje: mensaje.mensajeRespaldo, simulacion: true }),
    });
    resumen.respaldo = true;
    contarResultado(resumen, pedido, estado, ' (resultado guardado)');
  } catch {
    marcar(estado, 'No se pudo cargar', 'text-red-700');
  }
}

function mostrarResultado(datos) {
  $('resumen-pico').replaceChildren(...datos.map(([valor, etiqueta], indice) => {
    const grupo = document.createElement('div');
    grupo.className = 'dato-pico text-center';
    grupo.style.animationDelay = `${indice * 120}ms`;
    const numero = document.createElement('dd');
    numero.className = 'font-titulo text-3xl text-orange-400 leading-none';
    numero.textContent = valor;
    const texto = document.createElement('dt');
    texto.className = 'text-xs text-stone-300';
    texto.textContent = etiqueta;
    grupo.append(numero, texto);
    return grupo;
  }));
}

async function simular() {
  $('hora-pico').disabled = true;
  $('resumen-pico').replaceChildren();
  $('mensajes').replaceChildren();
  $('cliente').classList.add('hidden');
  $('mensajes').classList.remove('hidden');
  $('titulo-izquierda').textContent = 'WhatsApp, hora pico (simulación con mensajes de ejemplo)';

  await pedir('/api/pedidos/simulacion', { method: 'DELETE' }).catch(() => null);

  const resumen = { cocina: 0, responder: 0, consultas: 0, respaldo: false };
  const inicio = performance.now();
  const pendientes = [...MENSAJES];

  await Promise.all(Array.from({ length: MENSAJES_EN_PARALELO }, async (_, indice) => {
    await esperar(indice * MS_ENTRE_MENSAJES);
    while (pendientes.length) await procesar(pendientes.shift(), resumen);
  }));

  const segundos = ((performance.now() - inicio) / 1000).toFixed(1);
  mostrarResultado([
    [MENSAJES.length, 'mensajes'],
    [`${segundos} s`, resumen.respaldo ? 'con respaldo' : 'con IA'],
    [resumen.cocina, 'a cocina'],
    [resumen.responder, 'a responder'],
    [resumen.consultas, resumen.consultas === 1 ? 'consulta' : 'consultas'],
  ]);
  $('hora-pico').disabled = false;
  $('hora-pico').textContent = 'Repetir hora pico';
}

$('hora-pico').addEventListener('click', simular);
