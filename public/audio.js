const SEGUNDOS_MAXIMOS_AUDIO = 60;

async function transcribirAudio(audio) {
  let respuesta;
  try {
    respuesta = await fetch('/api/transcribir', {
      method: 'POST',
      headers: { 'Content-Type': audio.type || 'audio/ogg' },
      body: audio,
    });
  } catch {
    throw new Error('No pudimos conectarnos. Probá de nuevo.');
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(datos.error || 'No pudimos escuchar el audio.');
  return datos.texto;
}

// Convierte un botón en grabador: primer toque graba, segundo toque envía.
function crearGrabador(boton, { alTerminar, alError }) {
  if (!window.MediaRecorder || !navigator.mediaDevices) {
    boton.classList.add('hidden');
    return;
  }

  const etiqueta = boton.getAttribute('aria-label');
  let grabador = null;
  let limite;

  function terminarEstado() {
    clearTimeout(limite);
    grabador = null;
    boton.classList.remove('grabando');
    boton.setAttribute('aria-label', etiqueta);
  }

  boton.addEventListener('click', async () => {
    if (grabador) {
      grabador.stop();
      return;
    }

    let flujo;
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alError('Necesitamos permiso para usar el micrófono.');
      return;
    }

    const partes = [];
    grabador = new MediaRecorder(flujo);
    grabador.addEventListener('dataavailable', (evento) => partes.push(evento.data));
    grabador.addEventListener('stop', () => {
      const tipo = grabador.mimeType;
      flujo.getTracks().forEach((pista) => pista.stop());
      terminarEstado();
      alTerminar(new Blob(partes, { type: tipo }));
    });
    grabador.start();
    boton.classList.add('grabando');
    boton.setAttribute('aria-label', 'Terminar y enviar el audio');
    limite = setTimeout(() => grabador?.stop(), SEGUNDOS_MAXIMOS_AUDIO * 1000);
  });
}
