import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const archivoPedidos = path.join(raiz, 'data', 'pedidos.json');

export const negocio = JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'negocio.json'), 'utf8'));
export const ESTADOS = ['pendiente', 'nuevo', 'preparacion', 'listo', 'entregado'];

const CANTIDAD_MAXIMA = 50;
const LARGO_MAXIMO_TEXTO = 200;

const productos = new Map(negocio.productos.map((p) => [p.id, p]));
const zonas = new Map(negocio.zonas.map((z) => [z.id, z]));

function texto(valor) {
  if (typeof valor !== 'string') return null;
  return valor.trim().slice(0, LARGO_MAXIMO_TEXTO) || null;
}

function buscarVariante(producto, valor) {
  const buscada = texto(valor)?.toLowerCase();
  return producto.variantes.find((v) => v.toLowerCase() === buscada) ?? null;
}

function normalizarItems(crudos, noEncontrados) {
  const items = new Map();

  for (const crudo of Array.isArray(crudos) ? crudos : []) {
    const producto = productos.get(crudo?.producto_id);
    if (!producto) continue;
    if (!producto.disponible) {
      noEncontrados.push(`${producto.nombre} (hoy no hay)`);
      continue;
    }

    const cantidad = Math.min(Math.max(Math.trunc(Number(crudo.cantidad)) || 1, 1), CANTIDAD_MAXIMA);
    const variante = buscarVariante(producto, crudo.variante);
    const clave = `${producto.id}|${variante ?? ''}`;
    const existente = items.get(clave);

    if (existente) {
      existente.cantidad = Math.min(existente.cantidad + cantidad, CANTIDAD_MAXIMA);
    } else {
      items.set(clave, {
        producto_id: producto.id,
        nombre: producto.nombre,
        variante,
        cantidad,
        nota: texto(crudo.nota),
        precio: producto.precio,
        requiere_variante: producto.variantes.length > 0 && !variante,
        variantes: producto.variantes,
      });
    }
  }

  return [...items.values()].map((item) => ({ ...item, subtotal: item.precio * item.cantidad }));
}

function calcularDescuento(items) {
  const { cantidad, precio } = negocio.promo_empanadas;
  const empanadas = items.filter((i) => i.producto_id === 'empanada').reduce((suma, i) => suma + i.cantidad, 0);
  const docenas = Math.floor(empanadas / cantidad);
  return docenas * (productos.get('empanada').precio * cantidad - precio);
}

function calcularFaltantes(b) {
  const faltantes = [];
  if (!b.items.length) faltantes.push('productos');
  for (const item of b.items) {
    if (item.requiere_variante) faltantes.push(`variante:${item.nombre}`);
  }
  if (!b.entrega_tipo) faltantes.push('entrega_tipo');
  if (b.entrega_tipo === 'envio') {
    if (!b.direccion) faltantes.push('direccion');
    if (!b.zona_id) faltantes.push('zona');
  }
  if (!b.cliente_nombre) faltantes.push('nombre');
  if (!b.telefono) faltantes.push('telefono');
  if (!b.medio_pago) faltantes.push('medio_pago');
  return faltantes;
}

// El borrador se recalcula siempre acá: precios, descuentos y total nunca salen del modelo ni del navegador.
export function normalizarBorrador(crudo = {}) {
  const no_encontrados = (Array.isArray(crudo.no_encontrados) ? crudo.no_encontrados : [])
    .map(texto)
    .filter(Boolean);

  const items = normalizarItems(crudo.items, no_encontrados);
  const entrega_tipo = ['envio', 'retiro'].includes(crudo.entrega_tipo) ? crudo.entrega_tipo : null;
  const zona = entrega_tipo === 'envio' ? zonas.get(crudo.zona_id) : null;

  const borrador = {
    items,
    no_encontrados: [...new Set(no_encontrados)],
    entrega_tipo,
    direccion: entrega_tipo === 'envio' ? texto(crudo.direccion) : null,
    zona_id: zona?.id ?? null,
    zona_nombre: zona?.nombre ?? null,
    hora: texto(crudo.hora),
    cliente_nombre: texto(crudo.cliente_nombre),
    telefono: texto(crudo.telefono),
    medio_pago: negocio.medios_pago.includes(crudo.medio_pago) ? crudo.medio_pago : null,
  };

  borrador.subtotal = items.reduce((suma, i) => suma + i.subtotal, 0);
  borrador.descuento = calcularDescuento(items);
  borrador.envio = zona?.costo ?? 0;
  borrador.total = borrador.subtotal - borrador.descuento + borrador.envio;
  borrador.faltantes = calcularFaltantes(borrador);
  borrador.listo = borrador.faltantes.length === 0;
  return borrador;
}

export function preguntaPorFaltante(faltante) {
  if (faltante?.startsWith('variante:')) return `${faltante.slice(9)}: ¿de qué gusto la querés?`;
  const preguntas = {
    productos: '¿Qué te gustaría pedir?',
    entrega_tipo: '¿Lo querés con envío o pasás a retirar?',
    direccion: '¿A qué dirección te lo mandamos?',
    zona: `¿En qué barrio estás? Llegamos a ${negocio.zonas.map((z) => z.nombre).join(', ')}.`,
    nombre: '¿A nombre de quién va el pedido?',
    telefono: '¿A qué número te avisamos cuando esté listo?',
    medio_pago: `¿Cómo pagás: ${negocio.medios_pago.join(', ')}?`,
  };
  return preguntas[faltante] ?? '¿Me confirmás los datos del pedido?';
}

function cargarPedidos() {
  try {
    return JSON.parse(fs.readFileSync(archivoPedidos, 'utf8'));
  } catch {
    return [];
  }
}

const pedidos = cargarPedidos();

function guardarPedidos() {
  const temporal = `${archivoPedidos}.tmp`;
  fs.writeFileSync(temporal, JSON.stringify(pedidos, null, 2));
  fs.renameSync(temporal, archivoPedidos);
}

export function listarPedidos() {
  return pedidos;
}

export function buscarPedido(id) {
  return pedidos.find((p) => p.id === Number(id));
}

export function crearPedido(borrador, origen, mensaje_sugerido = null) {
  const pedido = {
    ...borrador,
    id: pedidos.reduce((mayor, p) => Math.max(mayor, p.id), 100) + 1,
    origen,
    mensaje_sugerido,
    estado: borrador.listo ? 'nuevo' : 'pendiente',
    creado: new Date().toISOString(),
    actualizado: new Date().toISOString(),
  };
  pedidos.push(pedido);
  guardarPedidos();
  return pedido;
}

export function completarPedido(id, borrador, mensaje_sugerido) {
  const pedido = buscarPedido(id);
  if (!pedido) return null;
  Object.assign(pedido, borrador, {
    mensaje_sugerido,
    estado: borrador.listo ? 'nuevo' : 'pendiente',
    actualizado: new Date().toISOString(),
  });
  guardarPedidos();
  return pedido;
}

export function cambiarEstado(id, estado) {
  const pedido = buscarPedido(id);
  if (!pedido || !ESTADOS.includes(estado)) return null;
  pedido.estado = estado;
  pedido.actualizado = new Date().toISOString();
  guardarPedidos();
  return pedido;
}
