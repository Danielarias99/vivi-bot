import whatsappService from './whatsappService.js';
import appendToSheet, { readSheet, updateRowInSheet, deleteRowInSheet } from './googleSheetsService.js';
import calendarService from './googleCalendarService.js';
import messages from '../config/messages.js';
import wellbeingResources from '../config/wellbeingResources.js';
import { preguntarAGemini } from './geminiService.js';
import appointmentReminderService from './appointmentReminderService.js';

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
    this.resourceState = {}; // 👈 ¡NUEVA LÍNEA!
    // 👈 ¡AÑADE ESTA LÍNEA PARA ELIMINAR EL ERROR!
    this.workshopState = {};
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
          // >>> LÍNEA AÑADIDA: Reiniciar el estado de recursos
          delete this.resourceState[message.from];
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
          // >>> NUEVA LÍNEA AÑADIDA: Manejar flujo de Recursos (Opción 4)
        } else if (this.resourceState && this.resourceState[message.from]) {
            await this.handleResourceFlow(message.from, rawText);
        } else if (this.cancelModifyState[message.from]) {
          await this.handleCancelModifyFlow(message.from, rawText);
        } else {
          // Si no hay estados activos, procesar la opción del menú
          await this.handleMenuOption(message.from, incomingMessage);
        }
        await whatsappService.markAsRead(message.id);
      } else if (message?.type === 'interactive') {
        const option = message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id;
        // Si hay un estado activo de asistente, procesar en ese flujo
        if (this.assistandState[message.from]) {
          await this.handleAssistandFlow(message.from, option);
        } else {
          await this.handleMenuOption(message.from, option);
        }
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
    // Validate resource URL is configured
    if (!resource.url || resource.url.trim().length === 0) {
      await whatsappService.sendMessage(
        to,
        `⚠️ El recurso "${resource.title}" aún no está disponible.\n\nEstamos trabajando en hacerlo disponible pronto. Si necesitas ayuda inmediata, puedes usar la opción 6 del menú (Contacto de emergencia).`
      );
      return;
    }

    try {
      console.log(`📤 Enviando recurso multimedia: ${resource.type} - ${resource.title}`);
      console.log(`🔗 URL: ${resource.url}`);
      
      // Send multimedia resource
      await whatsappService.sendMediaMessage(to, resource.type, resource.url, resource.title);
      
      console.log(`✅ Recurso multimedia enviado exitosamente`);
      
      // Friendly confirmation message based on resource type
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
      console.error('❌ Error enviando recurso multimedia:', err?.message || err);
      console.error('❌ Error completo:', JSON.stringify(err?.response?.data || err, null, 2));
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

    // Opción 3: Hablar con la IA sobre tus emociones
    if (normalized === '3' || 
        normalized === 'menu_3_profesional' ||
        matchesKeywords(normalized, ['ia sobre emociones', 'inteligencia artificial', 'emociones', 'hablar sobre emociones', 'hablar de emociones',
                                    'ia', 'chat', 'conversar', 'hablar con la ia'])) {
      // Iniciar el flujo de conversación con la IA
      this.assistandState[to] = { step: 'question' };
      response = messages.briefOrientationIntro;
      await whatsappService.sendMessage(to, response);
      return;
    }

    // DENTRO DE LA FUNCIÓN async handleMenuOption(to, option)



// Opción 4: Recursos de bienestar
if (normalized === '4' || 
    normalized === 'menu_4_recursos' ||
    matchesKeywords(normalized, ['recursos', 'bienestar', 'recursos de bienestar', 'recurso', 'materiales', 'material'])) {
    
    // AHORA: INICIAR EL NUEVO FLUJO DE SUB-MENÚ DE TEXTO
    this.resourceState[to] = { step: 'category_select' }; 
    // Usar el nuevo mensaje de texto con las opciones (1, 2, 3, 4)
    response = messages.resourceMenuText; 
    await whatsappService.sendMessage(to, response);
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
      
      // >>> ESTA LÍNEA ES LA CLAVE PARA DETENER LA CONVERSACIÓN
      this.completedConversations[to] = true; 
      
      return;
    }

    // Opción 8: Ya no necesito nada / Finalizar conversación
    if (normalized === '8' ||
        matchesKeywords(normalized, ['ya no necesito', 'no necesito nada', 'no necesito hacer consulta', 'finalizar', 
                                    'terminar', 'cerrar', 'salir', 'adiós', 'adios', 'hasta luego', 'chao'])) {
      // Limpiar todos los estados
      delete this.appointmentState[to];
      if (this.workshopState) delete this.workshopState[to];
      delete this.assistandState[to];
      delete this.cancelModifyState[to];
      delete this.emergencyResponseState[to];
      if (this.resourceState) delete this.resourceState[to];
      
      // Marcar conversación como completada
      this.completedConversations[to] = true;
      
      // Enviar mensaje de despedida
      response = messages.goodbye;
      await whatsappService.sendMessage(to, response);
      return;
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
      // Si no se encontró ninguna opción válida
      response = messages.notUnderstood + '\n\n' + messages.mainMenuText;
      await whatsappService.sendMessage(to, response);
      return;
    }
  }


  async completeAppointment(to) {
    const appointment = this.appointmentState[to];
    delete this.appointmentState[to];

    // Use the exact date and time from selection
    console.log(`📋 Datos de cita - selectedDate: ${appointment.selectedDate}, selectedTime: ${appointment.selectedTime}`);
    
    // selectedDate is in format: YYYY-MM-DD
    // selectedTime is in format: HH:MM (24-hour format from Calendar service)
    // Construct datetime string with Colombia timezone offset
    const dateTimeString = `${appointment.selectedDate}T${appointment.selectedTime}:00-05:00`; // Colombia is UTC-5
    console.log(`📅 Construyendo fecha con zona horaria Colombia: ${dateTimeString}`);
    
    const appointmentDateTime = new Date(dateTimeString);
    
    // Check if date is valid
    if (isNaN(appointmentDateTime.getTime())) {
      console.error(`❌ Fecha inválida creada: ${dateTimeString}`);
      console.error(`selectedDate: ${appointment.selectedDate}, selectedTime: ${appointment.selectedTime}`);
      
      // Fallback: send error message to user
      await whatsappService.sendMessage(to, 'Hubo un error al procesar tu cita. Por favor intenta de nuevo escribiendo "hola".');
      this.completedConversations[to] = true;
      return;
    }
    
    const appointmentDateStr = appointmentDateTime.toISOString();
    
    console.log(`✅ Cita confirmada para: ${appointment.selectedDateFormatted} a las ${appointment.selectedTimeFormatted}`);
    console.log(`📅 DateTime ISO: ${appointmentDateStr}`);
    console.log(`🌍 Hora local Colombia: ${appointmentDateTime.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);

    // 🆕 Create event in Google Calendar
    let calendarEventId = 'N/A';
    try {
      console.log('📅 Creando evento en Google Calendar...');
      calendarEventId = await calendarService.createCalendarEvent({
        name: appointment.name,
        email: appointment.email,
        type: appointment.type,
        day: appointment.selectedDateFormatted,
        time: appointment.selectedTimeFormatted,
        whatsapp: to,
        datetime: appointmentDateTime
      });
      
      if (calendarEventId) {
        console.log(`✅ Evento creado en Calendar con ID: ${calendarEventId}`);
      } else {
        console.warn('⚠️ No se pudo crear evento en Calendar (continuando flujo)');
      }
    } catch (calError) {
      console.error('❌ Error creando evento en Calendar:', calError?.message || calError);
      console.warn('⚠️ El bot continuará sin el evento en Calendar');
    }

    const userData = [
      to,                              // WhatsApp del usuario
      appointment.type,                // Presencial o Virtual
      appointment.name,                // Nombre completo
      appointment.studentCode || 'N/A', // Código estudiantil
      appointment.career || 'N/A',     // Carrera
      appointment.email,               // Email institucional
      appointment.selectedDateFormatted, // Día (formato legible)
      appointment.selectedTimeFormatted, // Hora (formato legible)
      new Date().toISOString(),        // Timestamp de registro
      appointmentDateStr,              // Fecha calculada de la cita
      calendarEventId || 'N/A'         // 🆕 Calendar Event ID
    ];

    // Google Sheets - Guardar cita en segundo plano
    console.log('📊 Intentando guardar cita en Google Sheets...');
    setImmediate(async () => {
      try {
        await appendToSheet(userData, 'citas');
        console.log('✅ Cita guardada en Google Sheets correctamente');
      } catch (err) {
        console.error('❌ Error guardando en Google Sheets:', err?.message || 'Error desconocido');
        console.warn('⚠️ El bot continuará funcionando normalmente sin guardar en Sheets');
      }
    });

    // Marcar conversación como completada ANTES de enviar el mensaje
    this.completedConversations[to] = true;

      // Enviar resumen de cita (siempre se envía, incluso si falla Sheets)
      try {
        const summaryData = {
          ...appointment,
          dateFormatted: appointment.selectedDateFormatted,
          timeFormatted: appointment.selectedTimeFormatted
        };
        await whatsappService.sendMessage(to, messages.appointment.summary(summaryData));
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
    
    console.log(`🔄 Procesando appointment flow - Paso: ${state.step} | Mensaje: "${message}"`);
    
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
          state.step = 'email';
          response = messages.appointment.askEmail;
        }
        break;
      }
      case 'email': {
        const emailTrimmed = message.trim().toLowerCase();
        // Fixed regex: escape the hyphen or put it at the end
        const emailRegex = /^[\w.\-]+@correounivalle\.edu\.co$/;
        
        console.log(`📧 Validando email: "${emailTrimmed}" | Match: ${emailRegex.test(emailTrimmed)}`);
        
        if (!emailRegex.test(emailTrimmed)) {
          response = 'Por favor, ingresa tu correo institucional válido (termina en @correounivalle.edu.co). Ejemplo: nombre.apellido@correounivalle.edu.co';
          console.log(`❌ Email inválido, enviando mensaje de error`);
        } else {
          state.email = message.trim(); // guardar con formato original
          state.step = 'day';
          this.appointmentState[to] = state; // Persistir estado explícitamente
          
          // Get available dates
          const availableDates = await calendarService.getAvailableDates();
          state.availableDates = availableDates;
          this.appointmentState[to] = state;
          
          response = messages.appointment.askDay(availableDates);
          console.log(`✅ Email válido, mostrando ${availableDates.length} fechas disponibles`);
        }
        break;
      }
      case 'day': {
        const text = message.trim();
        const selectedIndex = parseInt(text);
        
        if (isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > 10) {
          response = 'Por favor responde con un número del 1 al 10 para seleccionar la fecha.';
        } else if (!state.availableDates || !state.availableDates[selectedIndex - 1]) {
          response = 'Fecha no válida. Por favor elige un número del 1 al 10.';
        } else {
          const selectedDate = state.availableDates[selectedIndex - 1];
          state.selectedDate = selectedDate.dateStr;
          state.selectedDateFormatted = selectedDate.formatted;
          state.step = 'time';
          this.appointmentState[to] = state;
          
          // Get available times for selected date
          const availableTimes = await calendarService.getAvailableTimesForDate(selectedDate.dateStr);
          state.availableTimes = availableTimes;
          this.appointmentState[to] = state;
          
          response = messages.appointment.askTime(availableTimes, selectedDate.formatted);
          console.log(`✅ Fecha seleccionada: ${selectedDate.formatted}, mostrando horarios`);
        }
        break;
      }
      case 'time': {
        const text = message.trim();
        const selectedIndex = parseInt(text);
        
        if (isNaN(selectedIndex) || selectedIndex < 1) {
          response = 'Por favor responde con el número del horario que deseas.';
        } else {
          // Find the selected time (only available ones)
          const availableTimeSlots = state.availableTimes.filter(t => t.available);
          
          if (selectedIndex > availableTimeSlots.length) {
            response = 'Horario no válido. Por favor elige un número de la lista de horarios disponibles.';
          } else {
            const selectedTime = availableTimeSlots[selectedIndex - 1];
            
            // Ensure time is in HH:MM format (pad with zero if needed)
            let timeValue = selectedTime.time; // Should be like "9:00" or "14:00"
            const [hours, minutes] = timeValue.split(':');
            const paddedTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
            
            state.selectedTime = paddedTime; // Save as "09:00" or "14:00"
            state.selectedTimeFormatted = selectedTime.timeFormatted;
            state.step = 'confirm';
            this.appointmentState[to] = state;
            
            console.log(`✅ Guardando hora - time: ${state.selectedTime}, formatted: ${state.selectedTimeFormatted}`);
            
            // Show confirmation
            response = messages.appointment.confirmAppointment({
              type: state.type,
              name: state.name,
              studentCode: state.studentCode,
              career: state.career,
              dateFormatted: state.selectedDateFormatted,
              timeFormatted: state.selectedTimeFormatted,
              email: state.email
            });
            console.log(`✅ Hora seleccionada: ${selectedTime.timeFormatted}, solicitando confirmación`);
          }
        }
        break;
      }
      case 'confirm': {
        const text = message.trim();
        const lower = text.toLowerCase();
        
        // Accept both numbers and text
        if (text === '1' || lower === 'sí' || lower === 'si' || lower === 'yes') {
          // Confirmed - complete appointment
          console.log('✅ Usuario confirmó la cita');
          await this.completeAppointment(to);
          return;
        } else if (text === '2' || lower === 'no') {
          // Cancelled - restart flow
          delete this.appointmentState[to];
          response = 'Entendido. Tu cita no ha sido agendada.\n\nSi deseas agendar una nueva cita, escribe "hola" y selecciona la opción 1.';
          await whatsappService.sendMessage(to, response);
          this.completedConversations[to] = true;
          return;
        } else {
          response = 'Por favor responde con:\n1️⃣ para confirmar\n2️⃣ para cancelar';
        }
        break;
      }
    }
    if (response) {
      console.log(`📤 Enviando respuesta en appointment flow: "${response.substring(0, 50)}..."`);
      await whatsappService.sendMessage(to, response);
      console.log(`✅ Respuesta enviada exitosamente`);
    } else {
      console.log(`⚠️ No hay respuesta para enviar en este paso`);
    }
  }

  async handleAssistandFlow(to, message) {
    const state = this.assistandState[to];
    
    if (state.step === 'question') {
      // Usuario está compartiendo su situación emocional
      try {
        console.log('🤖 Iniciando consulta con Gemini para:', to);
        // Mostrar que estamos procesando
        await whatsappService.sendMessage(to, '💭 Pensando en cómo ayudarte...');
        
        // Consultar a Gemini
        let aiResponse;
        try {
          console.log('📤 Consultando Gemini con mensaje:', message.substring(0, 50) + '...');
          aiResponse = await preguntarAGemini(message);
          console.log('✅ Respuesta de Gemini recibida:', aiResponse ? 'Sí' : 'No');
          if (!aiResponse || aiResponse.trim() === '') {
            console.warn('⚠️ Respuesta vacía de Gemini');
            aiResponse = 'Lo siento, no pude generar una respuesta en este momento. Por favor, intenta reformular tu pregunta.';
          }
        } catch (geminiError) {
          console.error('❌ Error consultando Gemini:', geminiError.message || geminiError);
          console.error('Stack:', geminiError.stack);
          aiResponse = 'Lo siento, hubo un error al consultar la IA. Por favor, intenta de nuevo más tarde.';
        }
        
        // Enviar la respuesta de la IA
        console.log('📨 Enviando respuesta de IA al usuario');
        await whatsappService.sendMessage(to, aiResponse);
        
        // Crear botones interactivos: Sí y No
        try {
          console.log('🔘 Preparando botones interactivos');
          const buttons = [
            { type: 'reply', reply: { id: 'ai_continue_si', title: 'Sí' } },
            { type: 'reply', reply: { id: 'ai_continue_no', title: 'No' } }
          ];
          
          console.log('📤 Enviando botones con mensaje:', messages.briefOrientationFollowup);
          await whatsappService.sendInteractiveButtons(to, messages.briefOrientationFollowup, buttons);
          
          // Cambiar el estado para esperar respuesta Sí/No
          state.step = 'waiting_response';
          console.log('✅ Flujo completado exitosamente');
        } catch (buttonError) {
          console.error('❌ Error enviando botones interactivos:', buttonError.message || buttonError);
          console.error('Stack:', buttonError.stack);
          // Si falla enviar botones, enviar mensaje de texto como fallback
          await whatsappService.sendMessage(to, messages.briefOrientationFollowup + '\n\nResponde con "Sí" para continuar o "No" para terminar.');
          state.step = 'waiting_response';
        }
      } catch (error) {
        console.error('❌ Error general en handleAssistandFlow:', error.message || error);
        console.error('Stack completo:', error.stack);
        console.error('Error completo:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        try {
          await whatsappService.sendMessage(to, 'Lo siento, hubo un error al procesar tu consulta. Por favor, intenta de nuevo o escribe "hola" para volver al menú principal.');
        } catch (sendError) {
          console.error('❌ Error enviando mensaje de error:', sendError.message || sendError);
        }
        delete this.assistandState[to];
      }
    } else if (state.step === 'waiting_response') {
      // El usuario responde Sí o No
      const normalized = message.toLowerCase().trim();
      
      if (normalized === 'sí' || normalized === 'si' || normalized === 'yes' || normalized === 'ai_continue_si') {
        // Usuario quiere continuar
        state.step = 'question';
        await whatsappService.sendMessage(to, 'Perfecto. Cuéntame, ¿en qué más puedo ayudarte?');
      } else if (normalized === 'no' || normalized === 'ai_continue_no') {
        // Usuario no quiere continuar - terminar conversación
        await whatsappService.sendMessage(to, messages.aiFarewell);
        delete this.assistandState[to];
        this.completedConversations[to] = true; // Marcar conversación como completada
      } else {
        // Respuesta no reconocida, volver a preguntar
        const buttons = [
          { type: 'reply', reply: { id: 'ai_continue_si', title: 'Sí' } },
          { type: 'reply', reply: { id: 'ai_continue_no', title: 'No' } }
        ];
        await whatsappService.sendMessage(to, 'Por favor, responde con "Sí" o "No".');
        await whatsappService.sendInteractiveButtons(to, messages.briefOrientationFollowup, buttons);
      }
    }
  }
  // Colócala junto a otras funciones de flujo como handleAppointmentFlow.
  async handleResourceFlow(to, message) {
    const state = this.resourceState[to];
    const normalized = message.toLowerCase().trim();
    let response;

    // 1. Paso: Seleccionar Categoría (Audio, Video, Imagen, Documento)
    if (state.step === 'category_select') {
        let selectedCategory;
        const categoryMap = {
            '1': 'audio',
            '2': 'video',
            '3': 'image',
            '4': 'document',
        };

        selectedCategory = categoryMap[normalized];

        if (selectedCategory) {
            // Filtrar recursos por la categoría seleccionada
            const resources = wellbeingResources.filter(r => r.type === selectedCategory);

            if (resources.length === 0) {
                response = `Lo siento, no hay recursos de tipo **${selectedCategory}** disponibles en este momento. Por favor, elige otra opción del menú de categorías.`;
                await whatsappService.sendMessage(to, response);
                // Quedarse en el mismo estado para que el usuario elija de nuevo
                return;
            }

            // Crear el mensaje con la lista numerada de recursos
            let resourceList = '';
            resources.forEach((r, index) => {
                resourceList += `${index + 1} - ${r.title}\n`;
            });

            // Guardar los recursos filtrados en el estado y pedir selección
            state.step = 'resource_select';
            state.availableResources = resources;
            state.category = selectedCategory;

            // messages.resourceSelectionPrompt debe ser una función en messages.js
            response = messages.resourceSelectionPrompt(selectedCategory);
            response += resourceList;
            response += '\n\nResponde con el número del recurso que deseas.';
            
            await whatsappService.sendMessage(to, response);
            return;
        } else {
            // Si la respuesta no es 1, 2, 3 o 4
            response = 'Opción no válida. Por favor, elige 1, 2, 3 o 4 para seleccionar la categoría de recursos.';
        }

    // 2. Paso: Seleccionar Recurso Específico
    } else if (state.step === 'resource_select') {
        const index = parseInt(normalized) - 1; // Convertir a índice base 0
        const resources = state.availableResources;

        if (!isNaN(index) && index >= 0 && index < resources.length) {
            const selectedResource = resources[index];

            // ⚠️ Llamar a la función que envía el recurso y limpia el estado.
            await this.handleWellbeingResource(to, selectedResource);
            
            // La conversación finaliza después de enviar el recurso, según la lógica de Opción 4.
            // Limpiar el estado de recurso y marcar como completada.
            delete this.resourceState[to];
            this.completedConversations[to] = true;
            return;

        } else {
            // Número fuera de rango o texto no numérico
            response = `Opción no válida. Por favor, elige el número (1 al ${resources.length}) del recurso que quieres ver.`;
        }
    }
    
    // Si llegamos aquí, enviamos la respuesta de error y nos quedamos en el mismo estado
    if (response) {
        await whatsappService.sendMessage(to, response);
    }
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
      const psychologistPhone = '573232898573'; // Formato WhatsApp: código país + número
      const userName = this.getSenderName(senderInfo);
      
      try {
        // Get current date/time in Colombia timezone
        const now = new Date();
        const colombiaTime = new Intl.DateTimeFormat('es-CO', {
          timeZone: 'America/Bogota',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(now);

        // Send notification using approved template
        await whatsappService.sendTemplateMessage(
          psychologistPhone,
          'alerta_emergencia_psico', // Template name from Meta
          'es_CO', // Language code (Spanish - Colombia)
          [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: userName // {{1}} Estudiante: Daniel
                },
                {
                  type: 'text',
                  text: colombiaTime // {{2}} Fecha y hora: 20/11/2025
                },
                {
                  type: 'text',
                  text: to.replace('57', '') // {{3}} WhatsApp: 3116561249 (sin código país)
                }
              ]
            }
          ]
        );
        
        console.log(`🚨 Notificación de emergencia enviada vía template a ${psychologistPhone}`);
        await whatsappService.sendMessage(to, messages.emergencyProfessionalRequested);
        
      } catch (error) {
        const errorCode = error?.response?.data?.error?.code;
        const errorMessage = error?.response?.data?.error?.message || error?.message;
        
        console.error('❌ Error enviando template de emergencia:', errorMessage);
        console.error('Detalles del error:', JSON.stringify(error?.response?.data, null, 2));
        
        if (errorCode === 132000) {
          console.error(`⚠️ Template "alerta_emergencia_psico" no encontrada o no aprobada`);
        } else if (errorCode === 132015) {
          console.error(`⚠️ Parámetros de template incorrectos`);
        }
        
        // Aún así, informar al usuario que se intentó notificar
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
          state.step = 'searching';
          response = messages.cancelModify.searching;
          
          // Buscar la cita inmediatamente usando el WhatsApp
          await whatsappService.sendMessage(to, response);
          await this.searchAndProcessAppointment(to, state);
          return;
        } else if (lower === '2' || lower.includes('modificar')) {
          state.action = 'modify';
          state.step = 'searching';
          response = messages.cancelModify.searching;
          
          await whatsappService.sendMessage(to, response);
          await this.searchAndProcessAppointment(to, state);
          return;
        } else {
          response = 'Por favor, responde con "1" para Cancelar o "2" para Modificar.';
        }
        break;
      }
      case 'confirm': {
        const lower = message.toLowerCase().trim();
        if (lower === 'sí' || lower === 'si' || lower === 'yes') {
          if (state.action === 'cancel') {
            // Cancelar cita
            try {
              const { deleteRowInSheet } = await import('./googleSheetsService.js');
              console.log(`🗑️ Cancelando cita en fila ${state.foundAppointment.rowIndex}`);
              
              // 🆕 Eliminar evento de Calendar si existe
              const eventId = state.foundAppointment.fullRow[10]; // Columna K (index 10): Calendar Event ID
              if (eventId && eventId !== 'N/A') {
                console.log(`📅 Eliminando evento de Calendar: ${eventId}`);
                await calendarService.deleteCalendarEvent(eventId);
              }
              
              await deleteRowInSheet(state.foundAppointment.rowIndex, 'citas');
              
              response = messages.cancelModify.confirmCancel;
              await whatsappService.sendMessage(to, response);
              
              // Marcar conversación como completada
              this.completedConversations[to] = true;
              delete this.cancelModifyState[to];
              return;
            } catch (error) {
              console.error('❌ Error cancelando cita:', error);
              response = 'Hubo un error al cancelar tu cita. Por favor intenta más tarde.';
              delete this.cancelModifyState[to];
            }
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
        } else if (lower === '2' || lower.includes('día') || lower.includes('dia') || lower.includes('hora')) {
          state.modifyField = 'dayTime';
          state.step = 'newDay';
          response = messages.cancelModify.askNewDay;
        } else {
          response = 'Por favor, elige 1 o 2.';
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
      case 'newDay': {
        const text = message.trim();
        const lower = text.toLowerCase();
        const dias = ['lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes'];
        const tieneDia = dias.some(d => lower.includes(d));
        
        if (!tieneDia && lower !== 'cualquier dia' && lower !== 'cualquier día') {
          response = 'Por favor indica un día de la semana válido. Ejemplos: "lunes", "martes", etc..';
        } else {
          state.newDay = text;
          state.step = 'newTime';
          response = messages.cancelModify.askNewTime;
        }
        break;
      }
      case 'newTime': {
        const text = message.trim();
        const lower = text.toLowerCase();
        const re24h = /\b([01]?\d|2[0-3]):[0-5]\d\b/;
        const re12h = /\b(1[0-2]|0?[1-9]):[0-5]\d\s?(a\.?m\.?|p\.?m\.?|am|pm)\b/i;
        const tieneHora = re24h.test(lower) || re12h.test(lower) || 
                          lower === 'cualquier hora';

        if (!tieneHora) {
          response = 'Por favor indica una hora válida. Ejemplos: "10:30 a.m.", "14:00", "3:00 p.m."\n\nO escribe "cualquier hora".';
        } else {
          state.newTime = text;
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

  async searchAndProcessAppointment(to, state) {
    try {
      const { readSheet } = await import('./googleSheetsService.js');
      const rows = await readSheet('citas');
      
      console.log(`🔍 Buscando cita para WhatsApp: ${to}`);
      console.log(`📊 Total de filas en la hoja: ${rows.length}`);
      
      // Estructura actual: [WhatsApp, Tipo, Nombre, Código, Carrera, Email, Día, Hora, Timestamp]
      const matchingRows = rows.filter((row, index) => {
        if (index === 0) return false; // Saltar encabezado
        const rowWhatsApp = (row[0] || '').trim();
        return rowWhatsApp === to; // Buscar por WhatsApp del usuario
      });

      console.log(`✅ Citas encontradas: ${matchingRows.length}`);

      let response;
      if (matchingRows.length === 0) {
        response = messages.cancelModify.notFound;
        delete this.cancelModifyState[to];
      } else if (matchingRows.length === 1) {
        const row = matchingRows[0];
        const rowIndex = rows.findIndex(r => r === row);
        
        state.foundAppointment = {
          rowIndex: rowIndex,
          whatsapp: row[0] || 'N/A',
          type: row[1] || 'N/A',
          name: row[2] || 'N/A',
          studentCode: row[3] || 'N/A',
          career: row[4] || 'N/A',
          email: row[5] || 'N/A',
          day: row[6] || 'N/A',
          time: row[7] || 'N/A',
          timestamp: row[8] || 'N/A',
          fullRow: row,
          action: state.action // Importante: pasar la acción (cancel/modify) para el mensaje
        };
        state.step = 'confirm';
        response = messages.cancelModify.foundAppointment(state.foundAppointment);
        console.log(`📋 Cita encontrada en fila ${rowIndex}`);
      } else {
        // Múltiples citas - mostrar la más reciente
        const mostRecent = matchingRows[matchingRows.length - 1];
        const rowIndex = rows.findIndex(r => r === mostRecent);
        
        state.foundAppointment = {
          rowIndex: rowIndex,
          whatsapp: mostRecent[0] || 'N/A',
          type: mostRecent[1] || 'N/A',
          name: mostRecent[2] || 'N/A',
          studentCode: mostRecent[3] || 'N/A',
          career: mostRecent[4] || 'N/A',
          email: mostRecent[5] || 'N/A',
          day: mostRecent[6] || 'N/A',
          time: mostRecent[7] || 'N/A',
          timestamp: mostRecent[8] || 'N/A',
          fullRow: mostRecent,
          action: state.action
        };
        state.step = 'confirm';
        response = `📌 Encontré ${matchingRows.length} citas. Te muestro la más reciente:\n\n` + 
                   messages.cancelModify.foundAppointment(state.foundAppointment);
        console.log(`📋 Múltiples citas encontradas, mostrando la más reciente (fila ${rowIndex})`);
      }
      
      await whatsappService.sendMessage(to, response);
    } catch (error) {
      console.error('❌ Error buscando cita:', error);
      const response = '⚠️ Hubo un error al buscar tu cita. Por favor intenta más tarde o escribe "hola" para volver al menú.';
      await whatsappService.sendMessage(to, response);
      delete this.cancelModifyState[to];
    }
  }

  async completeModification(to, state) {
    try {
      const { updateRowInSheet } = await import('./googleSheetsService.js');
      const appointment = state.foundAppointment;
      
      console.log(`✏️ Modificando cita en fila ${appointment.rowIndex}`);
      console.log(`📝 Campo a modificar: ${state.modifyField}`);
      
      // Construir la fila actualizada
      let updatedRow = [...appointment.fullRow];
      
      // 🆕 Preparar datos para actualizar Calendar
      let calendarUpdates = {};
      
      if (state.modifyField === 'type') {
        updatedRow[1] = state.newValue; // Columna B: Tipo
        calendarUpdates.type = state.newValue;
        console.log(`🔄 Nuevo tipo: ${state.newValue}`);
      } else if (state.modifyField === 'dayTime') {
        updatedRow[6] = state.newDay;  // Columna G: Día
        updatedRow[7] = state.newTime; // Columna H: Hora
        calendarUpdates.day = state.newDay;
        calendarUpdates.time = state.newTime;
        console.log(`🔄 Nuevo día: ${state.newDay}, Nueva hora: ${state.newTime}`);
      }
      
      // 🆕 Actualizar evento en Calendar si existe
      const eventId = appointment.fullRow[10]; // Columna K (index 10): Calendar Event ID
      if (eventId && eventId !== 'N/A') {
        console.log(`📅 Actualizando evento en Calendar: ${eventId}`);
        await calendarService.updateCalendarEvent(eventId, calendarUpdates);
      }
      
      await updateRowInSheet(appointment.rowIndex, updatedRow, 'citas');
      
      const response = messages.cancelModify.modifySuccess;
      await whatsappService.sendMessage(to, response);
      
      // Marcar conversación como completada
      this.completedConversations[to] = true;
      delete this.cancelModifyState[to];
      
      console.log(`✅ Cita modificada exitosamente`);
    } catch (error) {
      console.error('❌ Error modificando cita:', error);
      const response = 'Hubo un error al modificar tu cita. Por favor intenta más tarde.';
      await whatsappService.sendMessage(to, response);
      delete this.cancelModifyState[to];
    }
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