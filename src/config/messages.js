
  const messages = {
    welcome: (name) => `👋 ¡Hola ${name}! Soy Vivi, asistente virtual del área de psicología de la Universidad del Valle.\nEstoy aquí para ayudarte a cuidar tu bienestar emocional 💙`,
    mainMenuText: 'Por favor, elige una opción:\n1️⃣ Agendar una cita\n2️⃣ Ver talleres disponibles\n3️⃣ Hablar con la IA sobre tus emociones\n4️⃣ Recursos de bienestar\n5️⃣ Cancelar o modificar una cita\n6️⃣ Contacto de emergencia\n7️⃣ Ubicación en tiempo real\n8️⃣ ❌ Ya no necesito nada',
    optOutConfirmed: 'Has sido dado de baja. No recibirás más mensajes. Escribe HOLA para reactivar.',
    crisisDetected: 'Percibo que podrías estar pasando por una situación de alto riesgo. Tu bienestar es lo más importante.',
    crisisResources: 'Si estás en peligro o piensas hacerte daño, por favor busca ayuda inmediata:\n- Línea Nacional 24/7: 106 (Colombia)\n- Línea 123 (emergencias)\n- Acude a urgencias más cercana.\n¿Deseas que un profesional te contacte? Responde SI para que gestionemos un apoyo prioritario.',
    emergencyProfessionalRequested: '✅ Entendido. He notificado al equipo profesional. Alguien se pondrá en contacto contigo a la brevedad.\n\nTu bienestar es importante. No estás solo/a. 💙',
    emergencyEncouragement: 'Entiendo tu situación. Es valiente que hayas buscado ayuda.\n\n💙 Recuerda que:\n- No estás solo/a, hay personas que se preocupan por ti\n- Los sentimientos difíciles son temporales, aunque ahora no lo parezca\n- Eres más fuerte de lo que crees\n- Pedir ayuda es una muestra de valentía, no de debilidad\n\nSi sientes que necesitas hablar con alguien en este momento, puedes contactar:\n- Línea 106 (24/7)\n- Línea 123 (emergencias)\n\nEstoy aquí para apoyarte. Si necesitas algo más, escribe "hola". 💙',
    appointment: {
      askType: '¿Qué tipo de cita deseas agendar?\n1. Presencial\n2. Virtual',
      askName: ' Ahora, escribe tu nombre completo:',
      askStudentCode: 'Gracias. Indica tu código estudiantil:',
      askCareer: '¿Cuál es tu programa o carrera?',
      askEmail: 'Por favor, ingresa tu correo institucional (@correounivalle.edu.co):',
      askDay: (dates) => {
        let message = '📅 ¿Qué día prefieres para tu cita?\n\n';
        
        // Separate dates by week
        const week1 = dates.filter(d => d.weekNumber === 1);
        const week2 = dates.filter(d => d.weekNumber === 2);
        
        let counter = 1;
        
        if (week1.length > 0) {
          message += '📆 ESTA SEMANA:\n';
          week1.forEach(date => {
            message += `${counter}️⃣ ${date.formatted}\n`;
            counter++;
          });
          message += '\n';
        }
        
        if (week2.length > 0) {
          message += '📆 PRÓXIMA SEMANA:\n';
          week2.forEach(date => {
            message += `${counter}️⃣ ${date.formatted}\n`;
            counter++;
          });
        }
        
        message += '\nResponde con el número (1-10)';
        return message;
      },
      askTime: (times, selectedDate) => {
        let message = `🕐 ¿Qué hora prefieres para ${selectedDate}?\n\n`;
        
        const morningTimes = times.filter(t => t.isMorning && t.available);
        const afternoonTimes = times.filter(t => !t.isMorning && t.available);
        
        let counter = 1;
        
        if (morningTimes.length > 0) {
          message += '🌅 MAÑANA (8:00 AM - 12:00 PM):\n';
          morningTimes.forEach(time => {
            message += `${counter}️⃣ ${time.timeFormatted}\n`;
            time.index = counter;
            counter++;
          });
          message += '\n';
        }
        
        if (afternoonTimes.length > 0) {
          message += '🌆 TARDE (2:00 PM - 5:00 PM):\n';
          afternoonTimes.forEach(time => {
            message += `${counter}️⃣ ${time.timeFormatted}\n`;
            time.index = counter;
            counter++;
          });
        }
        
        const busyTimes = times.filter(t => !t.available);
        if (busyTimes.length > 0) {
          message += '\n❌ No disponibles: ';
          message += busyTimes.map(t => t.timeFormatted).join(', ');
        }
        
        message += '\n\nResponde con el número de tu horario preferido';
        return message;
      },
      confirmAppointment: (data) => `✅ Por favor confirma tu cita:\n\n📍 Tipo: ${data.type}\n👤 Nombre: ${data.name}\n📚 Código: ${data.studentCode || 'N/A'}\n🎓 Carrera: ${data.career || 'N/A'}\n📅 Fecha: ${data.dateFormatted}\n🕐 Hora: ${data.timeFormatted}\n📧 Email: ${data.email}\n\n¿Confirmas esta cita?\n\n1️⃣ Sí, confirmar\n2️⃣ No, cancelar\n\nResponde con el número (1 o 2)`,
      summary: (data) => `✅ ¡Listo! Tu cita ha sido agendada exitosamente.\n\nTe enviaremos un recordatorio un día antes. ¡Nos vemos pronto!\n\n¡Hemos finalizado el chat! Gracias por usar el asistente Vivi! Si necesitas ayuda en otro momento, aquí estaré. ¡Cuídate mucho! 💙`,
      reminder: (data) => `🔔 Recordatorio de cita\n\nHola ${data.name}!\n\nTe recordamos que tienes una cita programada:\n\n📅 Día: ${data.day}\n🕐 Hora: ${data.time}\n📍 Tipo: ${data.type}\n\nPor favor, asegúrate de estar disponible a esta hora. Si necesitas cancelar o modificar tu cita, escribe "hola" y selecciona la opción 5.\n\n¡Nos vemos pronto! 💙`,
    },
    workshops: {
      list: 'Estos son los talleres emocionales disponibles esta semana:\n\n🧘‍♂️ Taller de manejo del estrés – martes 10:00 a.m. Campus Las Balsas, salón 223\n💬 Taller de comunicación asertiva – jueves 3:00 p.m. Campus Bolivar, salón 101. \n\n ¡Te esperamos!💙. \n\n Si necesitas hacer otra consulta, escribe "hola" para comenzar de nuevo.',
      askJoin: '¿Te gustaría participar en alguno de estos talleres? Responde SI o NO.',
      thanks: '¡Excelente! Estamos emocionados de tenerte con nosotros.',
      review: 'Te recordaremos un día antes del taller. Si deseas cancelar tu participación, escribe "hola" y selecciona la opción 5.',
      certificate: 'Al finalizar el taller, recibirás un certificado de participación. ¿Tienes alguna pregunta?',
      farewell: '¡Gracias por tu interés en los talleres! Si tienes otra consulta, solo escribe "hola" para comenzar de nuevo. ¡Cuídate mucho! 💙',
      endChatButton: [{ type: 'reply', reply: { id: 'end_chat', title: 'Finalizar chat' } }],
    },
    infoServices: 'Atención psicológica en Univalle: orientación inicial, acompañamiento breve, y remisiones cuando se requiere. Horario de atención: Lunes a Viernes 8:00 a 17:00. Para casos urgentes utiliza la opción 4.',
    contactProfessional: 'Puedo conectarte con el equipo de Bienestar Universitario. ¿Deseas que alguien te contacte? Responde SI para compartir tus datos de contacto.',
    wellbeingResources: 'Recursos de bienestar: \n- Respiración 4-7-8 (relajación)\n- Identifica y etiqueta tus emociones\n- Descanso breve: estiramientos y pausa consciente\n- Busca apoyo en tu red cercana\nSi prefieres, podemos agendar una cita (opción 2).',
    // >>> NUEVOS MENSAJES PARA LA OPCIÓN 4: SUB-MENÚ DE RECURSOS <<<
    resourceMenuText: 'Por favor, elige la categoría de recursos que deseas explorar:\n\n1️⃣ Audio (Relajación, Meditación)\n2️⃣ Video (Pausas activas, Ejercicios)\n3️⃣ Imagen (Infografías, Técnicas)\n4️⃣ Documento (Guías, Información)\n\nResponde con el número de la opción.',
    resourceSelectionPrompt: (type) => `Has seleccionado **${type}**.\n\nPor favor, elige el recurso que deseas ver, respondiendo con el número:\n`,
    // >>> FIN NUEVOS MENSAJES <<<
    // DENTRO DE const messages = { ... }

// ... (otros mensajes)

wellbeingResources: 'Recursos de bienestar: \n- Respiración 4-7-8 (relajación)\n- Identifica y etiqueta tus emociones\n- Descanso breve: estiramientos y pausa consciente\n- Busca apoyo en tu red cercana\nSi prefieres, podemos agendar una cita (opción 2).',

// 🚨 COMIENZO DE NUEVOS MENSAJES PARA FLUJO DE RECURSOS

resourceMenuText: 'Por favor, elige la categoría de recursos que deseas explorar:\n1️⃣ Audio (Relajación, Meditación)\n2️⃣ Video (Pausas activas, Ejercicios)\n3️⃣ Imagen (Infografías, Técnicas)\n4️⃣ Documento (Guías, Información)\n\nResponde con el número de la opción.',

resourceSelectionPrompt: (category) => `Has seleccionado la categoría: **${category}**.\n\nPor favor, elige el recurso que deseas ver, respondiendo con el número:\n`,

// ... (otros mensajes)
    briefOrientationIntro: 'Cuéntame brevemente qué te preocupa. Puedo darte una orientación inicial.',
    briefOrientationFollowup: 'Espero que esta orientación fuera de tu ayuda. ¿Necesitas hacer otra consulta?',
    
    aiFarewell: 'Entiendo. Me alegra haber podido ayudarte. 💙\n\nSi necesitas más apoyo en otro momento, escribe "hola" para comenzar de nuevo. ¡Cuídate mucho!',
    goodbye: 'Entendido. Gracias por contactarnos. Si necesitas algo más en el futuro, solo escribe "hola" y estaré aquí para ayudarte. ¡Cuídate mucho! 💙',
    notUnderstood: 'No entendí tu selección. Por favor, elige una opción del menú usando el número (1-8) o escribiendo el nombre de la opción.',
    emergencySelected: 'Entiendo. Te comparto información prioritaria de apoyo inmediato.',
    cancelModify: {
      askAction: '¿Qué deseas hacer?\n1️⃣ Cancelar mi cita\n2️⃣ Modificar mi cita',
      searching: '🔍 Buscando tu cita...',
      notFound: 'No encontré ninguna cita agendada con tu número de WhatsApp.\n\nSi necesitas ayuda, puedes escribir "hola" para volver al menú principal.',
      foundAppointment: (data) => `📋 Encontré tu cita:\n\n` +
        `📍 Tipo: ${data.type}\n` +
        `👤 Nombre: ${data.name}\n` +
        `📅 Día: ${data.day}\n` +
        `🕐 Hora: ${data.time}\n` +
        `📧 Email: ${data.email}\n\n` +
        `¿Esta es la cita que deseas ${data.action === 'cancel' ? 'cancelar' : 'modificar'}?\n\n` +
        `Responde SI para continuar o NO para cancelar.`,
      confirmCancel: '✅ Tu cita ha sido cancelada exitosamente.\n\n¡Gracias por avisarnos! Si necesitas algo más, escribe "hola" para comenzar de nuevo.',
      askModifyField: '¿Qué deseas modificar?\n1️⃣ Tipo de cita (presencial/virtual)\n2️⃣ Día y hora',
      askNewType: '¿Qué tipo de cita prefieres?\n1. Presencial\n2. Virtual',
      askNewDay: '¿Qué día prefieres para tu cita?\n\nPor favor indica el día de la semana (ejemplo: lunes, martes, etc.)\n\nSi no tienes preferencia, escribe "cualquier día".',
      askNewTime: 'Ahora, ¿qué horario prefieres?\n\nPor favor indica la hora (ejemplo: 10:30 a.m. o 14:00)\n\nSi no tienes preferencia, escribe "cualquier hora".',
      modifySuccess: '✅ Tu cita ha sido modificada exitosamente. Te enviaremos una confirmación con los nuevos datos por correo.\n\n¡Gracias! Si necesitas algo más, escribe "hola" para comenzar de nuevo.',
    },
  };

  export default messages;


