import sendToWhatsApp from "../services/httpRequest/sendToWhatsApp.js";

class WhatsAppService {
  async sendMessage(to, body, messageId) {
    console.log(`📨 WhatsAppService.sendMessage - Para: ${to} | Mensaje: "${body.substring(0, 60)}..."`);
    const data = {
      messaging_product: 'whatsapp',
      to,
      text: { body },
    };

    await sendToWhatsApp(data);
    console.log(`✅ Mensaje enviado exitosamente a ${to}`);
  }

  async sendInteractiveButtons(to, bodyText, buttons) {
    const data = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons,
        },
      },
    };

    await sendToWhatsApp(data);
  }

  async sendInteractiveList(to, bodyText, rows) {
    const data = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: 'Ver opciones',
          sections: [
            {
              title: 'Opciones disponibles',
              rows: rows,
            },
          ],
        },
      },
    };

    await sendToWhatsApp(data);
  }

  async sendMediaMessage(to, type, mediaUrl, caption) {
    const mediaObject = {};

    switch (type) {
      case 'image':
        mediaObject.image = { link: mediaUrl, caption: caption };
        break;
      case 'audio':
        mediaObject.audio = { link: mediaUrl };
        break;
      case 'video':
        mediaObject.video = { link: mediaUrl, caption: caption };
        break;
      case 'document':
        mediaObject.document = { 
          link: mediaUrl, 
          caption: caption, 
          filename: 'Recursos_Bienestar_Univalle.pdf' 
        };
        break;
      default:
        throw new Error(`Not Supported Media Type: ${type}`);
    }

    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: type,
      ...mediaObject,
    };

    console.log(`📡 Enviando a WhatsApp API - Tipo: ${type}`);
    console.log(`📋 Payload:`, JSON.stringify(data, null, 2));

    const result = await sendToWhatsApp(data);
    
    console.log(`✅ Respuesta de WhatsApp API:`, JSON.stringify(result, null, 2));
    
    return result;
  }

  async markAsRead(messageId) {
    const data = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    await sendToWhatsApp(data);
  }

  async sendContactMessage(to, contact) {
    const data = {
      messaging_product: 'whatsapp',
      to,
      type: 'contacts',
      contacts: [contact],
    };

    await sendToWhatsApp(data);
  }

  async sendLocationMessage(to, latitude, longitude, name, address) {
    const data = {
      messaging_product: 'whatsapp',
      to,
      type: 'location',
      location: {
        latitude: latitude,
        longitude: longitude,
        name: name,
        address: address
      }
    };
    
    await sendToWhatsApp(data);
  }

  async sendTemplateMessage(to, templateName, languageCode, components) {
    const data = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode
        },
        components: components
      }
    };

    console.log(`📤 Enviando Template Message: ${templateName} a ${to}`);
    console.log(`📋 Components:`, JSON.stringify(components, null, 2));
    
    await sendToWhatsApp(data);
    console.log(`✅ Template enviado exitosamente`);
  }


}

export default new WhatsAppService();