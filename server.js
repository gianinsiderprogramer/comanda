import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile();
} catch {
  // Sin .env se usan las variables del entorno.
}

const { conversar, extraerDeConversacion, transcribir, ErrorIA } = await import('./lib/ai.js');
const { negocio, normalizarBorrador, preguntaPorFaltante, listarPedidos, buscarPedido, crearPedido, completarPedido, cambiarEstado, borrarSimulacion } = await import('./lib/pedidos.js');

const LARGO_MENSAJE = 500;
const LARGO_CONVERSACION = 3000;
const MENSAJES_HISTORIAL = 12;
const LLAMADAS_POR_MINUTO = 20;
const MB_AUDIO = 5;

const app = express();
const raiz = path.dirname(fileURLToPath(import.meta.url));

// En producción Nginx hace de proxy: sin esto todos los visitantes comparten la misma IP.
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(raiz, 'public'), { extensions: ['html'] }));

// La key es compartida: cada visitante tiene un tope de llamadas a la IA.
const llamadas = new Map();
function limitarIA(req, res, next) {
  const ahora = Date.now();
  const recientes = (llamadas.get(req.ip) ?? []).filter((t) => ahora - t < 60000);
  if (recientes.length >= LLAMADAS_POR_MINUTO) {
    return res.status(429).json({ error: 'Vas muy rápido. Esperá un minuto y seguimos.' });
  }
  recientes.push(ahora);
  llamadas.set(req.ip, recientes);
  next();
}

function responderError(res, error) {
  if (error instanceof ErrorIA) return res.status(503).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: 'Algo salió mal. Probá de nuevo.' });
}

app.get('/api/negocio', (req, res) => res.json(negocio));

app.post('/api/conversar', limitarIA, async (req, res) => {
  const mensajes = Array.isArray(req.body?.mensajes) ? req.body.mensajes : [];
  const historial = mensajes
    .filter((m) => typeof m?.texto === 'string' && m.texto.trim())
    .slice(-MENSAJES_HISTORIAL)
    .map((m) => ({ rol: m.rol === 'bot' ? 'bot' : 'cliente', texto: m.texto.slice(0, LARGO_MENSAJE) }));

  if (!historial.length) return res.status(400).json({ error: 'Escribí tu pedido para empezar.' });

  try {
    res.json(await conversar(historial, normalizarBorrador(req.body.borrador)));
  } catch (error) {
    responderError(res, error);
  }
});

app.post('/api/recalcular', (req, res) => {
  const borrador = normalizarBorrador(req.body?.borrador);
  res.json({ borrador, pregunta: borrador.listo ? null : preguntaPorFaltante(borrador.faltantes[0]) });
});

app.get('/api/pedidos', (req, res) => res.json({ pedidos: listarPedidos() }));

app.post('/api/pedidos', (req, res) => {
  const borrador = normalizarBorrador(req.body?.borrador);
  const simulacion = req.body?.simulacion === true;
  if (!borrador.items.length) return res.status(400).json({ error: 'El pedido no tiene productos.' });
  if (!simulacion && !borrador.listo) return res.status(400).json({ error: 'Faltan datos para confirmar el pedido.' });
  res.status(201).json({ pedido: crearPedido(borrador, simulacion ? 'whatsapp' : 'web', req.body?.mensaje ?? null, simulacion) });
});

app.delete('/api/pedidos/simulacion', (req, res) => {
  borrarSimulacion();
  res.json({ ok: true });
});

app.post('/api/transcribir', limitarIA, express.raw({ type: 'audio/*', limit: `${MB_AUDIO}mb` }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'No recibimos ningún audio.' });

  try {
    const texto = await transcribir(req.body, req.get('Content-Type'));
    if (!texto) return res.status(422).json({ error: 'No se escuchó nada en el audio.' });
    res.json({ texto });
  } catch (error) {
    responderError(res, error);
  }
});

function leerConversacion(req) {
  const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : '';
  return texto.slice(0, LARGO_CONVERSACION);
}

app.post('/api/pedidos/desde-chat', limitarIA, async (req, res) => {
  const texto = leerConversacion(req);
  if (!texto) return res.status(400).json({ error: 'Pegá una conversación primero.' });

  try {
    const { borrador, intencion, respuesta } = await extraerDeConversacion(texto, normalizarBorrador());
    const simulacion = req.body?.simulacion === true;
    const pedido = intencion === 'pedido' && borrador.items.length ? crearPedido(borrador, 'whatsapp', respuesta, simulacion) : null;
    res.json({ pedido, respuesta, no_encontrados: borrador.no_encontrados });
  } catch (error) {
    responderError(res, error);
  }
});

app.post('/api/pedidos/:id/completar', limitarIA, async (req, res) => {
  const pedido = buscarPedido(req.params.id);
  const texto = leerConversacion(req);
  if (!pedido) return res.status(404).json({ error: 'No encontramos ese pedido.' });
  if (!texto) return res.status(400).json({ error: 'Pegá lo que respondió el cliente.' });

  try {
    const { borrador, respuesta } = await extraerDeConversacion(texto, normalizarBorrador(pedido));
    res.json({ pedido: completarPedido(pedido.id, borrador, respuesta) });
  } catch (error) {
    responderError(res, error);
  }
});

app.get('/api/pedidos/:id', (req, res) => {
  const pedido = buscarPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'No encontramos ese pedido.' });
  res.json({ pedido });
});

app.patch('/api/pedidos/:id', (req, res) => {
  const pedido = cambiarEstado(req.params.id, req.body?.estado);
  if (!pedido) return res.status(400).json({ error: 'No pudimos actualizar el pedido.' });
  res.json({ pedido });
});

app.use((error, req, res, next) => {
  if (error.status === 413) return res.status(413).json({ error: 'El audio es muy largo. Probá con uno más corto.' });
  console.error(error);
  res.status(error.status ?? 500).json({ error: 'Algo salió mal. Probá de nuevo.' });
});

const puerto = process.env.PORT || 3000;
app.listen(puerto, () => console.log(`Comanda en http://localhost:${puerto}`));
