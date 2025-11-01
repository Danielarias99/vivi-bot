import whatsappService from './whatsappService.js';
import appendToSheet, { readSheet, updateRowInSheet, deleteRowInSheet } from './googleSheetsService.js';
import messages from '../config/messages.js';
import wellbeingResources from '../config/wellbeingResources.js';

class MessageHandler {
  async handleWorkshopFlow(to, message) {
    const state = this.workshopState[to];
    let response;
    switch (state.step) {
      case 'list': {
        const lower = message.toLowerCase().trim();
        if (lower === 'sí' || lower === 'si' || lower === 'yes') {
          state.step = 'thanks';
          response = messages.workshops.thanks + '\n' + messages.workshops.review;
        } else if (lower === 'no') {
          state.step = 'farewell';
          response = messages.workshops.farewell;
        } else {
          response = messages.workshops.askJoin;
        }
        break;
      }
      case 'thanks': {
        state.step = 'certificate';
        response = messages.workshops.certificate;
        break;
      }
      case 'certificate': {
        state.step = 'farewell';
        response = messages.workshops.farewell;
        break;
      }
      case 'farewell': {
        // Finaliza el flujo y muestra botón de finalizar chat
        delete this.workshopState[to];
        await whatsappService.sendInteractiveButtons(to, messages.workshops.endChatButton);
        response = null;
        break;
      }
      default:
        response = messages.workshops.askJoin;
    }
    if (response) await whatsappService.sendMessage(to, response);
  }

  constructor() {
    this.appointmentState = {};
    this.assistandState = {};
    this.cancelModifyState = {};
    this.emergencyResponseState = {};
    this.completedConversations = {}; // Almacenar conversaciones completadas
  }

  async handleIncomingMessage(message, senderInfo) {
    try {
      if (message?.type === 'text') {
        const rawText = message.text.body || '';
        const incomingMessage = rawText.toLowerCase().trim();
        

        // Opt-out inmediato
        if (this.isOptOut(incomingMessage)) {
          await whatsappService.sendMessage(message.from, messages.optOutConfirmed);
          await whatsappService.markAsRead(message.id);
          return;
        }

        // Detección de crisis
        if (this.isCrisis(incomingMessage)) {
          await whatsappService.sendMessage(message.from, messages.crisisDetected);
          await whatsappService.sendMessage(message.from, messages.crisisResources);
          this.emergencyResponseState[message.from] = { waiting: true };
          await whatsappService.markAsRead(message.id);
          return;
        }

        // Conversación con saludo: reinicia el flujo
        if (this.isGreeting(incomingMessage)) {
          // Reiniciar todos los estados del usuario y marcar conversación como activa
          delete this.appointmentState[message.from];
          if (this.workshopState) delete this.workshopState[message.from];
          delete this.assistandState[message.from];
          delete this.cancelModifyState[message.from];
          delete this.emergencyResponseState[message.from];
          delete this.completedConversations[message.from]; // Reiniciar flag de conversación completada
          // Enviar saludo y menú principal
          await this.sendWelcomeMessage(message.from, message.id, senderInfo);
          await this.sendWelcomeMenu(message.from);
        } else if (this.completedConversations[message.from]) {
          // Si la conversación está marcada como completada, ignorar todos los mensajes excepto "hola"
          return; // No procesar el mensaje
        } else if (this.emergencyResponseState[message.from]) {
          await this.handleEmergencyResponse(message.from, incomingMessage, senderInfo);
        } else if (this.appointmentState[message.from]) {
          await this.handleAppointmentFlow(message.from, rawText);
        } else if (this.workshopState && this.workshopState[message.from]) {
          await this.handleWorkshopFlow(message.from, rawText);
        } else if (this.assistandState[message.from]) {
          await this.handleAssistandFlow(message.from, rawText);
        } else if (this.cancelModifyState[message.from]) {
          await this.handleCancelModifyFlow(message.from, rawText);
        } else {
          // Si no hay estados activos, procesar la opción del menú
          await this.handleMenuOption(message.from, incomingMessage);
        }
        await whatsappService.markAsRead(message.id);
      } else if (message?.type === 'interactive') {
        const option = message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id;
        await this.handleMenuOption(message.from, option);
        await whatsappService.markAsRead(message.id);
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje:', error.message || error);
      // Intentar marcar como leído aún si hay error
      try {
        await whatsappService.markAsRead(message.id);
      } catch (markError) {
        console.error('Error marcando mensaje como leído:', markError.message || markError);
      }
      // No re-lanzar el error para evitar crashes
    }
  }

  isGreeting(message) {
    const greetings = ["hola", "hello", "hi", "buenos dias","buenas noches","buenas tardes"];
    return greetings.includes(message);
  }

  isOptOut(message) {
    const optOut = ["baja", "stop", "alto"];
    return optOut.includes(message);
  }

  isCrisis(message) {
    const crisisKeywords = [
      'suicidio','suicida','me quiero morir','quitarme la vida','dañarme','autolesion',
      'estoy en peligro','no quiero vivir','matarme','me voy a hacer daño'
    ];
    return crisisKeywords.some(k => message.includes(k));
  }

  getSenderName(senderInfo) {
    return senderInfo.profile?.name || senderInfo.wa_id;
  }

  async sendWelcomeMessage(to, messageId, senderInfo) {
    const name = this.getSenderName(senderInfo);
    await whatsappService.sendMessage(to, messages.welcome(name), messageId);
  }

  async sendWelcomeMenu(to) {
  // Solo se envía el menú principal
  await whatsappService.sendMessage(to, messages.mainMenuText);
  }

  async sendWellbeingResourcesMenu(to) {
    // Construir filas para la lista interactiva a partir de la configuración de recursos
    const rows = wellbeingResources.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
    }));

    // Enviar como lista interactiva para que el usuario elija un recurso
    await whatsappService.sendInteractiveList(to, messages.wellbeingResources, rows);
  }

  async handleWellbeingResource(to, resource) {
    // Validar que el recurso tenga URL configurada
    if (!resource.url || resource.url.trim().length === 0) {
      await whatsappService.sendMessage(
        to,
        `⚠️ El recurso "${resource.title}" aún no está disponible.\n\nEstamos trabajando en hacerlo disponible pronto. Si necesitas ayuda inmediata, puedes usar la opción 6 del menú (Contacto de emergencia).`
      );
      return;
    }

    try {
      // Enviar el recurso multimedia
      await whatsappService.sendMediaMessage(to, resource.type, resource.url, resource.title);
      
      // Mensaje de confirmación amigable según el tipo de recurso
      let followUpMessage = `✅ Te he enviado: **${resource.title}**\n\n`;
      
      switch (resource.type) {
        case 'audio':
          followUpMessage += '🎧 Puedes escuchar este audio cuando lo necesites para relajarte y reducir el estrés.';
          break;
        case 'video':
          followUpMessage += '🎬 Sigue los ejercicios en el video cuando sientas que necesitas una pausa activa.';
          break;
        case 'image':
          followUpMessage += '📸 Revisa esta infografía cuando quieras practicar técnicas de bienestar.';
          break;
        case 'document':
          followUpMessage += '📄 En este documento encontrarás información útil sobre recursos y servicios disponibles.';
          break;
        default:
          followUpMessage += 'Espero que este recurso te sea de ayuda para tu bienestar.';
      }
      
      followUpMessage += '\n\nSi necesitas más ayuda, escribe "hola" para volver al menú principal.';
      
      await whatsappService.sendMessage(to, followUpMessage);
    } catch (err) {
      console.error('Error enviando recurso multimedia:', err?.message || err);
      await whatsappService.sendMessage(
        to,
        '❌ Lo siento, hubo un problema al enviar el recurso. Por favor, intenta de nuevo más tarde o escribe "hola" para volver al menú principal.'
      );
    }
  }


  async handleMenuOption(to, option) {
    let response;
    const normalized = String(option).toLowerCase().trim();
    
    // Función helper para detectar palabras clave
    const matchesKeywords = (text, keywords) => {
      return keywords.some(keyword => text.includes(keyword));
    };

    // Opción 1: Agendar una cita
    if (normalized === '1' || 
        normalized === 'menu_1_agendar' ||
        matchesKeywords(normalized, ['agendar', 'cita', 'agendar una cita', 'agendar cita', 'reservar cita', 'solicitar cita'])) {
      this.appointmentState[to] = { step: 'type' };
      response = messages.appointment.askType;
      await whatsappService.sendMessage(to, response);
      return;
    }

    // Opción 2: Ver talleres disponibles
    if (normalized === '2' || 
        normalized === 'menu_2_talleres' ||
        matchesKeywords(normalized, ['talleres', 'ver talleres', 'talleres disponibles', 'taller', 'taller disponible'])) {
      // 1. Enviar la lista de talleres.
      response = messages.workshops.list;
      await whatsappService.sendMessage(to, response);
      
      // 2. Terminar la conversación: 
      //    Eliminamos el estado de taller por seguridad, aunque ya no se haya iniciado.
      if (this.workshopState) delete this.workshopState[to]; 
      //    Marcamos la conversación como completada.
      //    El handleIncomingMessage ignorará todos los mensajes siguientes hasta que el usuario envíe "hola".
      this.completedConversations[to] = true; 
      
      return;
    }

    // Opción 2 alternativa: Información
    if (normalized === 'menu_2_info' ||
        matchesKeywords(normalized, ['informacion', 'información', 'info', 'información de servicios', 'servicios'])) {
      response = messages.infoServices;
      await whatsappService.sendMessage(to, response);
      return;
    }

    // Opción 3: Hablar con un profesional / IA sobre emociones
    if (normalized === '3' || 
        normalized === 'menu_3_profesional' ||
        matchesKeywords(normalized, ['profesional', 'hablar con un profesional', 'hablar con profesional', 'contactar profesional', 
                                    'ia sobre emociones', 'inteligencia artificial', 'emociones', 'hablar sobre emociones', 'hablar de emociones',
                                    'ia', 'chat', 'conversar'])) {
      response = messages.contactProfessional;
      await whatsappService.sendMessage(to, response);
      await this.sendContact(to);
      return;
    }

    // Opción 4: Recursos de bienestar
    if (normalized === '4' || 
        normalized === 'menu_4_recursos' ||
        matchesKeywords(normalized, ['recursos', 'bienestar', 'recursos de bienestar', 'recurso', 'materiales', 'material'])) {
      // Enviar menú interactivo de recursos de bienestar (lista con opciones)
      await this.sendWellbeingResourcesMenu(to);
      return;
    }

    // Opción 5: Cancelar o modificar una cita
    if (normalized === '5' ||
        matchesKeywords(normalized, ['cancelar', 'modificar', 'cancelar cita', 'modificar cita', 'cancelar una cita', 'modificar una cita',
                                    'anular', 'cambiar cita', 'editar cita'])) {
      this.cancelModifyState[to] = { step: 'action' };
      response = messages.cancelModify.askAction;
      await whatsappService.sendMessage(to, response);
      return;
    }

    // Opción 6: Contacto de emergencia
    if (normalized === '6' ||
        matchesKeywords(normalized, ['emergencia', 'emergencias', 'contacto de emergencia', 'urgencia', 'urgencias', 'ayuda urgente',
                                    'ayuda inmediata', 'ayuda ahora'])) {
      response = messages.emergencySelected + '\n' + messages.crisisResources;
      await whatsappService.sendMessage(to, response);
      await this.sendContact(to);
      this.emergencyResponseState[to] = { waiting: true };
      return;
    }

    // Opción 7: Ubicación en tiempo real
    if (normalized === '7' ||
        matchesKeywords(normalized, ['ubicacion', 'ubicación', 'direccion', 'dirección', 'localizacion', 'localización', 
                                    'donde', 'dónde', 'donde estan', 'dónde están', 'mapa', 'coordenadas'])) {
      response = 'Te comparto nuestra ubicación:';
      await whatsappService.sendMessage(to, response);
      await this.sendLocation(to);
      return;
    }

    // Si no coincide con ninguna opción del menú principal, verificar si es un recurso de bienestar
    // Manejo de selección de recursos de bienestar desde el menú interactivo
    {
      // Primero buscar por id exacto
      let resource = wellbeingResources.find(r => r.id === option || r.id === normalized);
      
      // Si no se encuentra y es un número (1, 2, 3, 4), buscar por índice
      if (!resource && /^\d+$/.test(normalized)) {
        const index = parseInt(normalized) - 1; // Convertir a índice base 0
        if (index >= 0 && index < wellbeingResources.length) {
          resource = wellbeingResources[index];
        }
      }
      
      if (resource) {
        await this.handleWellbeingResource(to, resource);
        return;
      }
    }

    // fallback: mantener compatibilidad con opciones antiguas
    if (normalized.includes('emergencia')) {
      response = messages.emergencySelected + '\n' + messages.crisisResources;
      await whatsappService.sendMessage(to, response);
      await this.sendContact(to);
      this.emergencyResponseState[to] = { waiting: true };
      return;
    } else if (normalized.includes('orientacion') || normalized.includes('orientación')) {
      this.assistandState[to] = { step: 'question' };
      response = messages.briefOrientationIntro;
      await whatsappService.sendMessage(to, response);
      return;
    } else {
      // Si no se encontró ninguna opción válida, no enviar respuesta
      // La conversación ha terminado y solo se reinicia con "hola"
      return;
    }
  }


  async completeAppointment(to) {
    const appointment = this.appointmentState[to];
    delete this.appointmentState[to];

    const userData = [
      to,
      appointment.type,
      appointment.name,
      appointment.studentCode || 'N/A',
      appointment.career || 'N/A',
      appointment.phone || 'N/A',
      appointment.email,
      appointment.availability,
      new Date().toISOString()
    ];

    // TODO: Google Sheets - Desactivado temporalmente hasta configurarse
    // Cuando esté listo, descomentar esto:
    // setImmediate(async () => {
    //   try {
    //     await appendToSheet(userData, 'citas');
    //     console.log('✅ Cita guardada en Google Sheets');
    //   } catch (err) {
    //     console.warn('⚠️ Google Sheets no disponible, continuando sin guardar:', err?.message || 'Error desconocido');
    //   }
    // });

    // Marcar conversación como completada ANTES de enviar el mensaje
    this.completedConversations[to] = true;

      // Enviar resumen de cita (siempre se envía, incluso si falla Sheets)
      try {
        await whatsappService.sendMessage(to, messages.appointment.summary(appointment));
        // La conversación termina aquí. El usuario debe escribir "hola" para reiniciar.
      } catch (error) {
        console.error('❌ Error enviando mensajes de confirmación:', error?.message || error);
      }
  }

  async handleAppointmentFlow(to, message) {
    const state = this.appointmentState[to];
    if (!state) {
      return;
    }
    
    let response;

    switch (state.step) {
      case 'type': {
        const lower = message.toLowerCase().trim();
        if (lower === '1' || lower === 'Presencial') {
          state.type = 'Presencial';
          state.step = 'name';
          response = messages.appointment.askName;
        } else if (lower === '2' || lower === 'Virtual') {
          state.type = 'Virtual';
          state.step = 'name';
          response = messages.appointment.askName;
        } else {
          response = 'Por favor, responde con "1" para Presencial o "2" para Virtual.';
        }
        break;
      }
      case 'name': {
        const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/;
        if (!nameRegex.test(message.trim())) {
          response = 'Por favor, ingresa solo letras para tu nombre.';
        } else {
          state.name = message.trim();
          state.step = 'studentCode';
          response = messages.appointment.askStudentCode;
        }
        break;
      }
      case 'studentCode': {
        const code = message.replace(/\D/g, '');
        if (!/^[0-9]+$/.test(code) || code.length === 0) {
          response = 'Por favor, ingresa solo números para tu código estudiantil.';
        } else {
          state.studentCode = code;
          state.step = 'career';
          response = messages.appointment.askCareer;
          // Enviar inmediatamente y salir para evitar procesamiento duplicado
          await whatsappService.sendMessage(to, response);
          return;
        }
        break;
      }
      case 'career': {
        // Validar que el mensaje no esté vacío
        const career = message.trim();
        if (!career || career.length === 0) {
          response = 'Por favor, ingresa tu programa o carrera.';
        } else {
          state.career = career;
          state.step = 'phone';
          response = messages.appointment.askPhone;
        }
        break;
      }
      case 'phone': {
        const phone = message.replace(/\D/g, '');
        if (phone.length !== 10) {
          response = 'Por favor, ingresa un número de celular válido de 10 dígitos.';
        } else {
          state.phone = phone;
          state.step = 'email';
          response = messages.appointment.askEmail;
        }
        break;
      }
      case 'email': {
        const emailTrimmed = message.trim().toLowerCase();
        const emailRegex = /^[\w-.]+@correounivalle\.edu\.co$/;
        if (!emailRegex.test(emailTrimmed)) {
          response = 'Por favor, ingresa tu correo institucional válido (termina en @correounivalle.edu.co). Ejemplo: nombre.apellido@correounivalle.edu.co';
        } else {
          state.email = message.trim(); // guardar con formato original
          state.step = 'availability';
          response = messages.appointment.askAvailability;
        }
        break;
      }
      case 'availability':
        {
          const text = message.trim();
          const lower = text.toLowerCase();
          const dias = [
            'lunes','martes','miercoles','miércoles','jueves','viernes','sabado','sábado','domingo'
          ];
          const tieneDia = dias.some(d => lower.includes(d));
          // 24h HH:MM or 12h H:MM am/pm (with variations)
          // Mejorar regex para capturar horas como "8:30 am" o "08:30 AM"
          const re24h = /\b([01]?\d|2[0-3]):[0-5]\d\b/;
          const re12h = /\b(1[0-2]|0?[1-9]):[0-5]\d\s*(a\.?m\.?|p\.?m\.?|am|pm)\b/i;
          const tieneHora = re24h.test(lower) || re12h.test(lower);

          if (!tieneDia || !tieneHora) {
            response = 'Por favor indica un día de la semana y una hora válida. Ejemplos: "martes 10:30 a.m." o "viernes 14:00"';
            await whatsappService.sendMessage(to, response);
          } else {
            state.availability = text; // conservar tal cual lo escribió
            // completeAppointment ya envía los mensajes, no necesitamos response
            await this.completeAppointment(to);
            return; // Salir aquí para no enviar un mensaje adicional
          }
        }
        break;
    }
    if (response) {
      await whatsappService.sendMessage(to, response);
    }
  }

  async handleAssistandFlow(to, message) {
    const state = this.assistandState[to];
    let response;

    const menuMessage = messages.briefOrientationFollowup;
    const buttons = [
      { type: 'reply', reply: { id: 'menu_info', title: 'Ver servicios' } },
      { type: 'reply', reply: { id: 'menu_agendar', title: 'Agendar' } },
      { type: 'reply', reply: { id: 'menu_emergencia', title: 'Emergencia' } }
    ];

    if (state.step === 'question') {
      // Respuesta breve por defecto; aquí se puede integrar un motor de FAQ
      response = 'Gracias por compartirlo. Algunas recomendaciones iniciales: respira profundo, intenta identificar qué necesitas ahora y considera escribir tus pensamientos. Si lo deseas, puedes agendar una cita para un acompañamiento más profundo.'
    }

    delete this.assistandState[to];
    await whatsappService.sendMessage(to, response);
    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }

  async sendContact(to) {
    const contact = {
      addresses: [
        {
          street: "Ciudad Universitaria",
          city: "Cali",
          state: "Valle del Cauca",
          zip: "",
          country: "Colombia",
          country_code: "CO",
          type: "WORK"
        }
      ],
      emails: [
        {
          email: "bienestar@univalle.edu.co",
          type: "WORK"
        }
      ],
      name: {
        formatted_name: "Atención Psicológica Univalle",
        first_name: "Atención",
        last_name: "Psicológica",
        middle_name: "",
        suffix: "",
        prefix: ""
      },
      org: {
        company: "Universidad del Valle",
        department: "Bienestar Universitario",
        title: "Contacto"
      },
      phones: [
        {
          phone: "+57 3232898573",
          wa_id: "573232898573",
          type: "WORK"
        }
      ],
      urls: [
        {
          url: "https://www.univalle.edu.co",
          type: "WORK"
        }
      ]
    };

    await whatsappService.sendContactMessage(to, contact);
  }

  async handleEmergencyResponse(to, message, senderInfo) {
    const lower = message.toLowerCase().trim();
    
    // --- Caso: Respuesta Afirmativa (SI) ---
    if (lower === 'sí' || lower === 'si' || lower === 'yes' || lower === 's') {
      // Enviar notificación al número del psicólogo
      const psychologistPhone = '573147120410'; // Formato WhatsApp: código país + número
      const userName = this.getSenderName(senderInfo);
      const notificationMessage = `🚨 NOTIFICACIÓN DE EMERGENCIA\n\nUn usuario ha solicitado contacto prioritario con un profesional.\n\nUsuario: ${userName}\nNúmero: ${to}\n\nPor favor, contacta a esta persona lo antes posible.`;
      
      try {
        await whatsappService.sendMessage(psychologistPhone, notificationMessage);
        await whatsappService.sendMessage(to, messages.emergencyProfessionalRequested);
      } catch (error) {
        const errorCode = error?.response?.data?.error?.code;
        const errorMessage = error?.response?.data?.error?.message || error?.message;
        
        console.error('Error enviando notificación de emergencia:', errorMessage || error?.message || error);
        
        if (errorCode === 131030) {
          console.error(`⚠️ IMPORTANTE: El número ${psychologistPhone} necesita ser agregado a la lista de destinatarios permitidos en Meta Business Manager.`);
        }
        
        await whatsappService.sendMessage(to, messages.emergencyProfessionalRequested);
      }
      
      // >>> LÍNEA AÑADIDA/MOVIDA: Marca la conversación como finalizada.
      this.completedConversations[to] = true; 
      
      delete this.emergencyResponseState[to];
      
    // --- Caso: Respuesta Negativa (NO) ---
    } else if (lower === 'no' || lower === 'n') {
      await whatsappService.sendMessage(to, messages.emergencyEncouragement);
      
      // >>> LÍNEA AÑADIDA: Marca la conversación como finalizada.
      this.completedConversations[to] = true; 
      
      delete this.emergencyResponseState[to];
      
    } else {
      // Si no es SI ni NO, recordar la pregunta
      await whatsappService.sendMessage(to, 'Por favor, responde SI si deseas que un profesional te contacte, o NO si prefieres continuar por tu cuenta.');
    }
}

  async handleCancelModifyFlow(to, message) {
    const state = this.cancelModifyState[to];
    let response;

    switch (state.step) {
      case 'action': {
        const lower = message.toLowerCase().trim();
        if (lower === '1' || lower.includes('cancelar')) {
          state.action = 'cancel';
          state.step = 'email';
          response = messages.cancelModify.askEmail;
        } else if (lower === '2' || lower.includes('modificar')) {
          state.action = 'modify';
          state.step = 'email';
          response = messages.cancelModify.askEmail;
        } else {
          response = 'Por favor, responde con "1" para Cancelar o "2" para Modificar.';
        }
        break;
      }
      case 'email': {
        const emailTrimmed = message.trim().toLowerCase();
        const emailRegex = /^[\w-.]+@correounivalle\.edu\.co$/;
        if (!emailRegex.test(emailTrimmed)) {
          response = 'Por favor, ingresa tu correo institucional válido (termina en @correounivalle.edu.co).';
        } else {
          state.email = message.trim();
          state.step = 'name';
          response = messages.cancelModify.askName;
        }
        break;
      }
      case 'name': {
        const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/;
        if (!nameRegex.test(message.trim())) {
          response = 'Por favor, ingresa solo letras para tu nombre.';
        } else {
          state.name = message.trim();
          state.step = 'searching';
          response = messages.cancelModify.searching;
          // Buscar la cita de forma asíncrona
          await whatsappService.sendMessage(to, response);
          
          // TODO: Google Sheets - Desactivado temporalmente
          // Cuando esté configurado, descomentar esto:
          try {
            // const rows = await readSheet('citas');
            // Simular que no hay citas encontradas (Google Sheets no configurado)
            const rows = [];
            // Estructura esperada: [telefono, type, name, studentCode, career, phone, email, availability, timestamp]
            const matchingRows = rows.filter((row, index) => {
              if (index === 0) return false; // Saltar encabezado si existe
              const rowEmail = (row[6] || '').toLowerCase().trim();
              const rowName = (row[2] || '').toLowerCase().trim();
              return rowEmail === state.email.toLowerCase() && 
                     rowName === state.name.toLowerCase();
            });

            if (matchingRows.length === 0) {
              // Como Google Sheets está desactivado, siempre mostrará esto
              response = '⚠️ Google Sheets no está configurado aún. La funcionalidad de cancelar/modificar citas estará disponible cuando se configure.\n\nPor favor, escribe "hola" para volver al menú principal.';
              delete this.cancelModifyState[to];
            } else if (matchingRows.length === 1) {
              // Encontramos una sola cita
              const row = matchingRows[0];
              const rowIndex = rows.findIndex(r => r === row);
              // rowIndex es 0-based, pero necesitamos considerar si hay encabezado
              // Si la primera fila parece ser encabezado (no tiene email válido), empezamos desde 1
              const hasHeader = rows.length > 0 && (!rows[0][6] || !rows[0][6].includes('@'));
              const sheetRowIndex = hasHeader ? rowIndex : rowIndex; // Índice en el sheet (0-based para nuestra función)
              
              state.foundAppointment = {
                rowIndex: sheetRowIndex,
                type: row[1] || 'N/A',
                name: row[2] || 'N/A',
                studentCode: row[3] || 'N/A',
                career: row[4] || 'N/A',
                phone: row[5] || 'N/A',
                email: row[6] || 'N/A',
                availability: row[7] || 'N/A',
                timestamp: row[8] || 'N/A',
                fullRow: row
              };
              state.step = 'confirm';
              response = messages.cancelModify.foundAppointment(state.foundAppointment);
            } else {
              // Múltiples citas encontradas
              response = messages.cancelModify.multipleFound;
              // Por ahora, tomamos la primera
              const row = matchingRows[0];
              const rowIndex = rows.findIndex(r => r === row);
              const hasHeader = rows.length > 0 && (!rows[0][6] || !rows[0][6].includes('@'));
              const sheetRowIndex = hasHeader ? rowIndex : rowIndex;
              
              state.foundAppointment = {
                rowIndex: sheetRowIndex,
                type: row[1] || 'N/A',
                name: row[2] || 'N/A',
                email: row[6] || 'N/A',
                availability: row[7] || 'N/A',
                fullRow: row
              };
              state.step = 'confirm';
            }
          } catch (error) {
        response = '⚠️ Google Sheets no está configurado aún. La funcionalidad de cancelar/modificar citas estará disponible cuando se configure.\n\nPor favor, escribe "hola" para volver al menú principal.';
        delete this.cancelModifyState[to];
      }
          await whatsappService.sendMessage(to, response);
          return;
        }
        break;
      }
      case 'confirm': {
        const lower = message.toLowerCase().trim();
        if (lower === 'sí' || lower === 'si' || lower === 'yes') {
          if (state.action === 'cancel') {
            // Cancelar cita
            // TODO: Google Sheets - Desactivado temporalmente
            // Cuando esté configurado, descomentar esto:
            // try {
            //   const result = await deleteRowInSheet(state.foundAppointment.rowIndex, 'citas');
            //   response = messages.cancelModify.confirmCancel;
            //   await whatsappService.sendMessage(to, response);
            //   await whatsappService.sendInteractiveButtons(to, messages.cancelModify.endChatButton);
            //   delete this.cancelModifyState[to];
            //   return;
            // } catch (error) {
            //   console.error('Error cancelando cita:', error);
            //   response = 'Hubo un error al cancelar tu cita. Por favor intenta más tarde.';
            //   delete this.cancelModifyState[to];
            // }
            
            // Temporalmente: informar que Google Sheets no está configurado
            response = '⚠️ La funcionalidad de cancelar citas estará disponible cuando se configure Google Sheets.\n\nPor ahora, por favor contacta directamente al área de psicología para cancelar tu cita.\n\nEscribe "hola" para volver al menú principal.';
            await whatsappService.sendMessage(to, response);
            delete this.cancelModifyState[to];
            return;
          } else {
            // Modificar cita
            state.step = 'modifyField';
            response = messages.cancelModify.askModifyField;
          }
        } else if (lower === 'no') {
          response = 'No se realizaron cambios. Si necesitas ayuda, escribe "hola" para volver al menú.';
          delete this.cancelModifyState[to];
        } else {
          response = 'Por favor, responde SI para continuar o NO para cancelar.';
        }
        break;
      }
      case 'modifyField': {
        const lower = message.toLowerCase().trim();
        if (lower === '1' || lower.includes('tipo')) {
          state.modifyField = 'type';
          state.step = 'newType';
          response = messages.cancelModify.askNewType;
        } else if (lower === '2' || lower.includes('fecha') || lower.includes('hora')) {
          state.modifyField = 'availability';
          state.step = 'newAvailability';
          response = messages.cancelModify.askNewAvailability;
        } else if (lower === '3' || lower.includes('teléfono') || lower.includes('telefono')) {
          state.modifyField = 'phone';
          state.step = 'newPhone';
          response = messages.cancelModify.askNewPhone;
        } else {
          response = 'Por favor, elige 1, 2 o 3.';
        }
        break;
      }
      case 'newType': {
        const lower = message.toLowerCase().trim();
        if (lower === '1' || lower === 'presencial') {
          state.newValue = 'Presencial';
        } else if (lower === '2' || lower === 'virtual') {
          state.newValue = 'Virtual';
        } else {
          response = 'Por favor, responde con "1" para Presencial o "2" para Virtual.';
          await whatsappService.sendMessage(to, response);
          return;
        }
        await this.completeModification(to, state);
        return;
      }
      case 'newAvailability': {
        const text = message.trim();
        const lower = text.toLowerCase();
        const dias = ['lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado', 'domingo'];
        const tieneDia = dias.some(d => lower.includes(d));
        const re24h = /\b([01]?\d|2[0-3]):[0-5]\d\b/;
        const re12h = /\b(1[0-2]|0?[1-9]):[0-5]\d\s?(a\.?m\.?|p\.?m\.?|am|pm)\b/i;
        const tieneHora = re24h.test(lower) || re12h.test(lower);

        if (!tieneDia || !tieneHora) {
          response = 'Por favor indica un día de la semana y una hora válida. Ejemplos: "martes 10:30 a.m." o "viernes 14:00"';
        } else {
          state.newValue = text;
          await this.completeModification(to, state);
          return;
        }
        break;
      }
      case 'newPhone': {
        const phone = message.replace(/\D/g, '');
        if (phone.length !== 10) {
          response = 'Por favor, ingresa un número de celular válido de 10 dígitos.';
        } else {
          state.newValue = phone;
          await this.completeModification(to, state);
          return;
        }
        break;
      }
      default:
        response = messages.notUnderstood;
    }
    if (response) await whatsappService.sendMessage(to, response);
  }

  async completeModification(to, state) {
    // TODO: Google Sheets - Desactivado temporalmente
    // Cuando esté configurado, descomentar esto:
    // try {
    //   const appointment = state.foundAppointment;
    //   const fullRow = [...appointment.fullRow];
    //   
    //   // Actualizar el campo correspondiente
    //   if (state.modifyField === 'type') {
    //     fullRow[1] = state.newValue;
    //   } else if (state.modifyField === 'availability') {
    //     fullRow[7] = state.newValue;
    //   } else if (state.modifyField === 'phone') {
    //     fullRow[5] = state.newValue;
    //   }
    // 
    //   await updateRowInSheet(appointment.rowIndex, fullRow, 'citas');
    //   
    //   const response = messages.cancelModify.modifySuccess;
    //   await whatsappService.sendMessage(to, response);
    //   await whatsappService.sendInteractiveButtons(to, messages.cancelModify.endChatButton);
    //   delete this.cancelModifyState[to];
    // } catch (error) {
    //   console.error('Error modificando cita:', error);
    //   await whatsappService.sendMessage(to, 'Hubo un error al modificar tu cita. Por favor intenta más tarde.');
    //   delete this.cancelModifyState[to];
    // }
    
    // Temporalmente: informar que Google Sheets no está configurado
    const response = '⚠️ La funcionalidad de modificar citas estará disponible cuando se configure Google Sheets.\n\nPor ahora, por favor contacta directamente al área de psicología para modificar tu cita.\n\nEscribe "hola" para volver al menú principal.';
    await whatsappService.sendMessage(to, response);
    delete this.cancelModifyState[to];
  }

 async sendLocation(to) {
  const latitude = 4.3946;
  const longitude = -76.0715;
  const name = 'Universidad del Valle – Sede Zarzal';
  const address = 'Calle 14 Nº 7-134, Barrio Bolívar, Zarzal, Valle del Cauca';

  await whatsappService.sendLocationMessage(to, latitude, longitude, name, address);
}


}

export default new MessageHandler();