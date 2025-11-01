<<<<<<< HEAD
# vivi-bot
=======
# Vivi Bot — Instrucciones de despliegue

Este repositorio contiene el bot "Vivi" para WhatsApp (Cloud API). Aquí están los pasos para ejecutar localmente y desplegar en Railway.

## Requisitos
- Node.js 18+ (recomendado)
- npm
- (Opcional) ngrok para exponer tu servidor local a Internet durante pruebas

## Variables de entorno
Copia `.env.example` a `.env` y completa los valores:

- WEBHOOK_VERIFY_TOKEN: token para verificar el webhook con Meta
- API_TOKEN: token de acceso de WhatsApp Cloud API (Bearer)
- BUSINESS_PHONE: ID / phone number id de tu WhatsApp Cloud (ej: 105...) o el identificador que requiera API
- API_VERSION: versión de la API (ej: v17.0)
- BASE_URL: https://graph.facebook.com
- PORT: 3000 por defecto

> Nota: Si usas AWS S3 privado para recursos multimedia, debes generar URLs firmadas (presigned URLs) para que WhatsApp pueda descargarlas.

## Scripts disponibles
- `npm start` — inicia con `nodemon` para desarrollo
- `npm run start:prod` — inicia con `node` (útil para entornos de producción, por ejemplo Railway)

## Ejecutar localmente
1. Instala dependencias:

```powershell
cd "C:\Users\danie\Videos\vivi bot\bot"
npm install
```

2. Configura `.env`

3. Inicia el servidor en modo desarrollo:

```powershell
npm start
```

ó en modo producción (igual que Railway):

```powershell
npm run start:prod
```

4. Verifica que se muestre en logs:

```
Server is listening on port: 3000
```

## Probar la opción 4 (Recursos de bienestar)
Tienes dos formas de probar el envío del PDF configurado:

A) Usando WhatsApp y la UI interactiva:
- Envía `4` desde el número del usuario a la cuenta de WhatsApp Cloud.
- Selecciona la opción de la lista que corresponda al documento.

B) Simulación local (curl) — ejemplo mínimo de payload para simular una respuesta interactiva con `list_reply`:

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "57321xxxxxxx",
            "id": "wamid.HBgM...",
            "type": "interactive",
            "interactive": { "type": "list_reply", "list_reply": { "id": "recurso_documento_guia" } }
          }],
          "contacts": [{ "profile": { "name": "Prueba" }, "wa_id": "57321xxxxxxx" }]
        }
      }]
    }]
  }'
```

El bot procesará el `list_reply` con `id: recurso_documento_guia` y luego intentará enviar el PDF cuya URL está en `src/config/wellbeingResources.js`.

## Deploy en Railway
1. Crea un nuevo proyecto en Railway y conecta este repositorio (o súbelo como un repo GitHub y enlázalo).
2. En la sección de variables de entorno de Railway, añade las mismas variables que aparecen en `.env.example`.
3. Define el comando de inicio:

```
npm run start:prod
```

Railway detectará el `package.json` y hará build. También puedes añadir un `Procfile` con `web: npm run start:prod` (incluido en este repo).

## Docker (opcional)
Se incluye un `Dockerfile` minimal para construir una imagen. Railway puede construir con Docker si lo prefieres.

## Recomendaciones y notas
- Asegúrate que `BASE_URL` apunte a `https://graph.facebook.com` y que `API_TOKEN` tenga permisos para enviar mensajes.
- Si los recursos en S3 no son públicos, genera URLs firmadas y colócalas en `src/config/wellbeingResources.js`.
- Antes de hacer deploy, prueba localmente el endpoint `/webhook` y que `messageHandler` funcione para las principales rutas de flujo.

Si quieres, puedo realizar el despliegue inicial en Railway (con tu acceso) o seguir guiándote paso a paso.
>>>>>>> ae6e300 (chore: initial commit — prepare repo for Railway deployment)
