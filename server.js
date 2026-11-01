import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile();
} catch {
  // Sin .env se usan las variables del entorno.
}

const { conversar, extraerDeConversacion, ErrorIA } = await import('./lib/ai.js');
const { negocio, normalizarBorrador, listarPedidos, buscarPedido, crearPedido, cambiarEstado } = await import('./lib/pedidos.js');

const LARGO_MENSAJE = 500;
const LARGO_CONVERSACION = 3000;
const MENSAJES_HISTORIAL = 12;
const LLAMADAS_POR_MINUTO = 20;

const app = express();
const raiz = path.dirname(fileURLToPath(import.meta.url));

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

app.post('/api/recalcular', (req, res) => res.json({ borrador: normalizarBorrador(req.body?.borrador) }));

app.get('/api/pedidos', (req, res) => res.json({ pedidos: listarPedidos() }));

app.post('/api/pedidos', (req, res) => {
  const borrador = normalizarBorrador(req.body?.borrador);
  const desdeLocal = req.body?.origen === 'whatsapp';

  if (!borrador.items.length) return res.status(400).json({ error: 'El pedido no tiene productos.' });
  if (!desdeLocal && !borrador.listo) return res.status(400).json({ error: 'Faltan datos para confirmar el pedido.' });

  res.status(201).json({ pedido: crearPedido(borrador, desdeLocal ? 'whatsapp' : 'web') });
});

app.post('/api/pedidos/desde-chat', limitarIA, async (req, res) => {
  const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : '';
  if (!texto) return res.status(400).json({ error: 'Pegá una conversación primero.' });

  try {
    res.json(await extraerDeConversacion(texto.slice(0, LARGO_CONVERSACION)));
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

const puerto = process.env.PORT || 3000;
app.listen(puerto, () => console.log(`Comanda en http://localhost:${puerto}`));
