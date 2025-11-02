
  const messages = {
    welcome: (name) => `👋 ¡Hola ${name}! Soy Vivi, asistente virtual del área de psicología de la Universidad del Valle.\nEstoy aquí para ayudarte a cuidar tu bienestar emocional 💙`,
    mainMenuText: 'Por favor, elige una opción:\n1️⃣ Agendar una cita\n2️⃣ Ver talleres disponibles\n3️⃣ Hablar con la IA sobre tus emociones\n4️⃣ Recursos de bienestar\n5️⃣ Cancelar o modificar una cita\n6️⃣ Contacto de emergencia\n7️⃣ Ubicación en tiempo real',
    optOutConfirmed: 'Has sido dado de baja. No recibirás más mensajes. Escribe HOLA para reactivar.',
    crisisDetected: 'Percibo que podrías estar pasando por una situación de alto riesgo. Tu bienestar es lo más importante.',
    crisisResources: 'Si estás en peligro o piensas hacerte daño, por favor busca ayuda inmediata:\n- Línea Nacional 24/7: 106 (Colombia)\n- Línea 123 (emergencias)\n- Acude a urgencias más cercana.\n¿Deseas que un profesional te contacte? Responde SI para que gestionemos un apoyo prioritario.',
    emergencyProfessionalRequested: '✅ Entendido. He notificado al equipo profesional. Alguien se pondrá en contacto contigo a la brevedad.\n\nTu bienestar es importante. No estás solo/a. 💙',
    emergencyEncouragement: 'Entiendo tu situación. Es valiente que hayas buscado ayuda.\n\n💙 Recuerda que:\n- No estás solo/a, hay personas que se preocupan por ti\n- Los sentimientos difíciles son temporales, aunque ahora no lo parezca\n- Eres más fuerte de lo que crees\n- Pedir ayuda es una muestra de valentía, no de debilidad\n\nSi sientes que necesitas hablar con alguien en este momento, puedes contactar:\n- Línea 106 (24/7)\n- Línea 123 (emergencias)\n\nEstoy aquí para apoyarte. Si necesitas algo más, escribe "hola". 💙',
    appointment: {
      askType: '¿Qué tipo de cita deseas agendar?\n1. Presencial\n2. Virtual',
      askPhone: 'Por favor, ingresa tu número de teléfono:',
      askName: ' Ahora, escribe tu nombre completo:',
      askStudentCode: 'Gracias. Indica tu código estudiantil:',
      askCareer: '¿Cuál es tu programa o carrera?',
      askEmail: 'Por favor, ingresa tu correo institucional (@correounivalle.edu.co):',
      askDay: 'Perfecto. ¿Qué día prefieres para tu cita?\n\nPor favor indica el día de la semana (ejemplo: lunes, martes, miércoles, etc.)\n\nSi no tienes preferencia, escribe "cualquier día".',
      askTime: 'Ahora, ¿qué horario prefieres?\n\nPor favor indica la hora (ejemplo: 10:30 a.m. o 14:00)\n\nSi no tienes preferencia, escribe "cualquier hora".',
      summary: (data) => `✅ Tu cita ha sido solicitada. Resumen:\nTipo: ${data.type}\nNombre: ${data.name}\nCódigo: ${data.studentCode || 'N/A'}\nCarrera: ${data.career || 'N/A'}\nTeléfono: ${data.phone || 'N/A'}\nCorreo: ${data.email}\nDía preferido: ${data.day}\nHora preferida: ${data.time}\nTe enviaremos confirmación y recordatorio un día antes.\n\n¡Hemos finalizado el chat !Gracias por usar el asistente Vivi! Si necesitas ayuda en otro momento, aquí estaré. ¡Cuídate mucho! 💙.`,
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
    briefOrientationFollowup: '¿Esta orientación fue de ayuda?',
    notUnderstood: 'No entendí tu selección. Por favor elige una opción del menú.',
    emergencySelected: 'Entiendo. Te comparto información prioritaria de apoyo inmediato.',
    cancelModify: {
      askAction: '¿Qué deseas hacer?\n1️⃣ Cancelar mi cita\n2️⃣ Modificar mi cita',
      askEmail: 'Por favor, ingresa tu correo institucional (@correounivalle.edu.co) para buscar tu cita:',
      askName: 'Ahora ingresa tu nombre completo (tal como lo registraste):',
      searching: 'Buscando tu cita...',
      notFound: 'No encontré ninguna cita con los datos proporcionados. Por favor verifica:\n- Tu correo institucional\n- Tu nombre completo\n\nSi necesitas ayuda, puedes escribir "hola" para volver al menú principal.',
      multipleFound: 'Encontré varias citas. Por favor, proporciona más información para identificar tu cita.',
      foundAppointment: (data) => `Encontré tu cita:\n\nTipo: ${data.type}\nNombre: ${data.name}\nFecha/Hora: ${data.availability}\nEmail: ${data.email}\n\n¿Esta es tu cita? Responde SI para continuar o NO para buscar otra.`,
      confirmCancel: '✅ Tu cita ha sido cancelada exitosamente. Te enviaremos una confirmación por correo.\n\n¡Gracias por avisarnos! Si necesitas algo más, escribe "hola" para comenzar de nuevo.',
      askModifyField: '¿Qué deseas modificar?\n1️⃣ Tipo de cita (presencial/virtual)\n2️⃣ Fecha y hora\n3️⃣ Teléfono',
      askNewType: '¿Qué tipo de cita prefieres?\n1. Presencial\n2. Virtual',
      askNewAvailability: 'Indica la nueva fecha y horario preferidos (ej: martes 10:30 a.m.):',
      askNewPhone: 'Ingresa tu nuevo número de teléfono (10 dígitos):',
      modifySuccess: '✅ Tu cita ha sido modificada exitosamente. Te enviaremos una confirmación con los nuevos datos por correo.\n\n¡Gracias! Si necesitas algo más, escribe "hola" para comenzar de nuevo.',
    },
  };

  export default messages;


