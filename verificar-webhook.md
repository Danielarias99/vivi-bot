# Guía para Verificar el Webhook en Meta

## URL del Webhook Actual:
```
https://76f8cc9638b5.ngrok-free.app/webhook
```

## Pasos para Configurar en Meta:

1. **Ve a Meta for Developers:**
   - https://developers.facebook.com
   - Selecciona tu App
   - WhatsApp → Configuración

2. **Configurar Webhook:**
   - Busca la sección "Webhooks"
   - Haz clic en "Configurar webhooks" o "Editar"
   - **URL del callback:** `https://76f8cc9638b5.ngrok-free.app/webhook`
   - **Token de verificación:** Debe ser el mismo que `WEBHOOK_VERIFY_TOKEN` en tu archivo `.env`
   - Haz clic en "Verificar y guardar"

3. **Suscribirse a Eventos (CRÍTICO):**
   - DESPUÉS de verificar el webhook
   - Haz clic en "Suscribirse a campos"
   - Selecciona: **`messages`**
   - También puedes agregar: `message_status`, `message_deliveries`
   - Guarda los cambios

4. **Verificar que el número esté conectado:**
   - En WhatsApp → Configuración
   - Verifica que tu número de teléfono esté "Conectado"
   - Estado debe ser "Activo"

## Cómo Verificar que Funciona:

1. Envía "hola" al bot en WhatsApp
2. Revisa los logs en la terminal - deberías ver:
   ```
   📥 POST /webhook - [timestamp]
   🌐 POST /webhook recibido - [timestamp]
   === Webhook recibido ===
   ```

Si NO ves estos logs, significa que Meta no está enviando mensajes al webhook.

## Posibles Problemas:

- ❌ URL incorrecta en Meta
- ❌ Token de verificación no coincide
- ❌ Webhook no suscrito a "messages"
- ❌ Ngrok cambió la URL (revisa la URL actual)
- ❌ El número de WhatsApp no está conectado/activo

