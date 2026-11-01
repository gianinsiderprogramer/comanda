# Comanda

**Un sábado a las 21 entran 8 mensajes de WhatsApp a la vez. Comanda los convierte en pedidos en unos 7 segundos.**

Para rotiserías que hoy anotan a mano lo que llega por WhatsApp o por teléfono: mensajes que se pierden, pedidos mal anotados y clientes que se van.

| | |
|---|---|
| **Probalo en 1 clic** | **[Abrir la demo](https://dwday-124838444.online/demo)** y tocá **Simular hora pico** |
| **Web del cliente** | https://dwday-124838444.online |
| **Tablero del local** | https://dwday-124838444.online/panel |
| **Informe** | [INFORME.md](INFORME.md) |

## Qué vas a ver en 1 minuto

1. **Hora pico:** 8 mensajes desordenados llegan juntos. La IA los procesa en vivo y el tablero se llena solo.
2. **Un mensaje real:** en el panel, pegá esto en la bandeja:

   > hola buenas!! me mandas 2 milas a la napo y media docena de empanadas, de pollo si hay sino de carne. ah y una coca grande. paso a buscar tipo 9 y media

   Entiende "milas a la napo", guarda "pollo, si no carne", detecta las 21:30 y prepara un solo mensaje que pregunta lo que falta: nombre y forma de pago.
3. **Pedido del cliente:** en la web, escribí, grabá un audio o tocá la carta. Después seguí el pedido hasta la entrega.

## Por qué es distinto a un chatbot

- **Trabaja con lo que ya existe:** el local sigue usando WhatsApp. Pega la conversación o sube el audio, y Comanda lo ordena.
- **Le dice a la cocina qué hacer:** el pizarrón **Qué cocinar ahora** suma todos los pedidos abiertos por producto y gusto.
- **Nunca adivina:** si falta un dato, el pedido queda en **A responder** con el mensaje listo para enviar. A cocina solo pasa lo completo.
- **Sigue funcionando sin IA:** si la API falla, el cliente termina el pedido desde la carta.

## Cómo usa la IA

1. **Escucha:** transcribe audios con `gpt-4o-mini-transcribe`.
2. **Interpreta:** extrae el pedido con Structured Outputs y JSON Schema. Los productos solo pueden ser los de la carta.
3. **Valida:** el código, no el modelo, calcula precios, promos, zona de envío y datos faltantes.
4. **Redacta:** genera un único mensaje de WhatsApp. El server comprueba que pregunte todo lo que falta y no mencione precios. Si no pasa, usa un mensaje armado.

Se probó con **26 casos reales** en `scripts/probar-ia.js`: correcciones a mitad del pedido, modismos, productos fuera de carta, sin TACC, zonas de envío e intentos de manipulación. Pasó 26 de 26 en tres corridas seguidas.

## Stack

Node.js, Express, HTML, JavaScript vanilla, Tailwind por CDN y el SDK oficial de OpenAI. Sin base de datos: los pedidos se guardan en JSON en disco. Deploy en Cloud Server de DonWeb con PM2, Nginx y HTTPS.

## Correrlo local

```bash
npm install
cp .env.example .env
npm start
```

Completá `OPENAI_API_KEY` en `.env`. La app queda en `http://localhost:3000`. Las pruebas de IA se corren con `node scripts/probar-ia.js`.
