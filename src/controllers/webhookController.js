import config from '../config/env.js';
import messageHandler from '../services/messageHandler.js';

class WebhookController {
  async handleIncoming(req, res) {
    // Responder inmediatamente a Meta para evitar timeout
    res.sendStatus(200);
    
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];
    const senderInfo = value?.contacts?.[0];

    if (!entry || !change || !value) {
      return;
    }

    if (message) {
      try {
        await messageHandler.handleIncomingMessage(message, senderInfo);
      } catch (error) {
        console.error('❌ Error procesando mensaje:', error.message || error);
      }
    }
  }

  verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Debug logs
    console.log('🔍 Verificación webhook recibida:');
    console.log('   Mode:', mode);
    console.log('   Token recibido:', token);
    console.log('   Token esperado:', config.WEBHOOK_VERIFY_TOKEN);
    console.log('   Challenge:', challenge);

    if (mode === 'subscribe' && token === config.WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      console.log('✅ Webhook verificado correctamente');
    } else {
      console.log('❌ Verificación fallida - Modo:', mode, '| Token coincide:', token === config.WEBHOOK_VERIFY_TOKEN);
      res.sendStatus(403);
    }
  }
}

export default new WebhookController();