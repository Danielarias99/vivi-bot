import config from '../config/env.js';
import messageHandler from '../services/messageHandler.js';

class WebhookController {
  constructor() {
    // Set to track processed message IDs to prevent duplicates
    this.processedMessages = new Set();
  }

  async handleIncoming(req, res) {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];
    const senderInfo = value?.contacts?.[0];

    // Always respond 200 to WhatsApp to acknowledge receipt
    res.sendStatus(200);

    if (!entry || !change || !value) {
      return;
    }

    // Check if this message was already processed
    if (message) {
      const messageId = message.id;
      
      if (this.processedMessages.has(messageId)) {
        console.log(`⚠️ Mensaje duplicado detectado y omitido: ${messageId}`);
        return;
      }

      // Mark message as processed
      this.processedMessages.add(messageId);
      
      // Clean old message IDs (keep only last 1000)
      if (this.processedMessages.size > 1000) {
        const iterator = this.processedMessages.values();
        for (let i = 0; i < 100; i++) {
          const oldId = iterator.next().value;
          if (oldId) this.processedMessages.delete(oldId);
        }
      }

      // Process the message
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