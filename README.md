# Comanda

**Pedidos por mensaje para rotiserías:** el cliente escribe como en WhatsApp, la IA lo convierte en un pedido sin errores y el local lo recibe en un tablero.

**URL del deploy:** https://vps-6571693-x.dattaweb.com

Hoy el dueño de una rotisería pierde ventas en la hora pico: los mensajes se pierden, los pedidos se anotan mal y los clientes se cansan de esperar.

## Cómo usarlo

1. Entrá a la home y tocá **Probar con un ejemplo**, o escribí tu pedido con tus palabras.
2. Revisá el ticket, ajustá cantidades y tocá **Confirmar pedido**.
3. Abrí `/panel`: el pedido entró al tablero. Avanzalo de estado y avisale al cliente por WhatsApp.

En `/panel` también podés pegar una conversación de WhatsApp o una nota de un llamado y la IA carga el pedido.

## Cómo usa la IA

- **Entiende lenguaje natural:** "6 de carne y una coca" se convierte en productos reales de la carta.
- **Repregunta en vez de adivinar:** si falta el gusto, la dirección o el medio de pago, pide un dato por vez.
- **Sabe qué pasó con el pedido:** toma cambios como "sacale la coca" y resuelve consultas de horarios, zonas o sin TACC con los datos del negocio.
- **Devuelve datos, no texto:** usa Structured Outputs con un JSON schema, y los productos solo pueden ser los de la carta.

**Por qué es confiable:** el modelo nunca define el precio. El servidor valida cada producto, gusto y zona contra `data/negocio.json`, calcula promos y total, y exige los datos completos antes de confirmar. Si la respuesta no pasa la validación, reintenta una vez. Si la IA falla, el usuario ve un mensaje claro y no pierde lo que escribió.

## Stack

Node.js, Express, HTML, JavaScript vanilla, Tailwind por CDN y el SDK oficial de OpenAI. Los pedidos se guardan en JSON en disco.

## Correrlo local

```bash
npm install
cp .env.example .env
npm start
```

Completá `OPENAI_API_KEY` y `OPENAI_MODEL` en `.env`. La app queda en `http://localhost:3000`.
