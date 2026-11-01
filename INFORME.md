# Informe: Comanda

**Hackatón DonWeb Day Rosario 2026**

- **URL:** https://dwday-124838444.online
- **Demo:** https://dwday-124838444.online/demo
- **Repo:** https://github.com/gianinsiderprogramer/comanda

## Qué hice

Comanda es una solución web con IA para rotiserías que atienden pedidos a mano por WhatsApp o por teléfono. Resuelve los tres problemas de la consigna: mensajes que se pierden, pedidos mal anotados y clientes que esperan y se van.

El rubro elegido es una rotisería de Rosario. El negocio, la carta y los precios son de ejemplo y se editan en un solo archivo, `data/negocio.json`.

## Componentes

| Componente | Para quién | Qué hace |
|---|---|---|
| **Sitio de pedidos** (`/`) | Cliente | Pedido por chat, audio o carta. Ticket editable, confirmación y seguimiento del estado. |
| **Panel del local** (`/panel`) | Dueño y cocina | Tablero con estados, aviso por WhatsApp y alerta de pedidos demorados. |
| **Bandeja de WhatsApp** (en el panel) | Dueño | Convierte conversaciones pegadas y audios en pedidos, y sugiere la respuesta al cliente. |
| **Qué cocinar ahora** (en el panel) | Cocina | Suma los pedidos abiertos por producto y gusto. |
| **Demo y Hora pico** (`/demo`) | Jurado | Muestra cliente y local lado a lado. Simula 8 mensajes simultáneos. |

No incluye un CRM ni historial de clientes: se priorizó completar el flujo principal de punta a punta.

## Cómo funciona

1. **Entrada:** texto, conversación pegada o audio. Los audios se transcriben con `gpt-4o-mini-transcribe`.
2. **Interpretación:** `gpt-4o-mini` devuelve el pedido con Structured Outputs y JSON Schema, usando un prompt con la carta, las reglas del negocio y ejemplos.
3. **Validación:** el código verifica productos y gustos, y calcula precios, promos, envío y datos faltantes.
4. **Decisión:** un pedido completo pasa a cocina. Si falta algo, queda en **A responder** y el server rechaza moverlo a cocina.
5. **Respuesta:** la IA redacta un único mensaje que confirma lo entendido y pregunta lo que falta. El server lo valida, y si no cumple usa un mensaje armado.

## Por qué es confiable

- Se probó con 26 casos en `scripts/probar-ia.js`, y pasó 26 de 26 en tres corridas seguidas.
- Las pruebas con mensajes reales encontraron errores concretos, como sumar un pollo entero al responder "pollo" a una milanesa, y quedaron como casos fijos.
- Si la IA falla, el cliente puede terminar el pedido desde la carta.
- La API key queda solo en el servidor. Hay límite de tamaño, de tokens y de llamadas por visitante.

## Stack y deploy

Node.js, Express, HTML, JavaScript vanilla, Tailwind por CDN y OpenAI. Los pedidos se guardan en JSON en disco. Corre en un Cloud Server de DonWeb con PM2, Nginx, HTTPS y dominio propio.

## Límites actuales y próximos pasos

- **WhatsApp:** hoy se pega la conversación o se sube el audio. El siguiente paso es conectar la API oficial de WhatsApp Business.
- **Acceso al panel:** es abierto para la demo. En producción necesita login.
- **Carga de carta:** hoy se edita un archivo. El objetivo es cargarla desde una foto de la carta de papel.
- **Un solo negocio:** el modelo de datos se puede ampliar a varios locales.
