import { readSheet } from './googleSheetsService.js';
import whatsappService from './whatsappService.js';
import messages from '../config/messages.js';

/**
 * Convierte día de la semana y hora a fecha exacta
 * @param {string} day - Día de la semana (lunes, martes, etc.)
 * @param {string} time - Hora (ej: "10:30 a.m." o "14:00")
 * @returns {Date|null} - Fecha calculada o null si no se puede calcular
 */
function calculateAppointmentDate(day, time) {
  try {
    if (!day || !time) {
      console.warn('⚠️ Día o hora no proporcionados para calcular fecha');
      return null;
    }
    
    const now = new Date();
    // Normalizar día: quitar acentos y espacios, convertir a minúsculas
    const normalizedDay = day.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .trim();
    
    // Días de la semana con variaciones
    const dayNames = [
      { names: ['domingo', 'dom'], index: 0 },
      { names: ['lunes', 'lun'], index: 1 },
      { names: ['martes', 'mar'], index: 2 },
      { names: ['miercoles', 'miércoles', 'mier', 'mie'], index: 3 },
      { names: ['jueves', 'jue'], index: 4 },
      { names: ['viernes', 'vie'], index: 5 },
      { names: ['sabado', 'sábado', 'sab'], index: 6 }
    ];
    
    let dayIndex = -1;
    for (const dayInfo of dayNames) {
      if (dayInfo.names.some(name => normalizedDay.includes(name))) {
        dayIndex = dayInfo.index;
        break;
      }
    }
    
    if (dayIndex === -1) {
      console.warn(`⚠️ No se pudo determinar el día: "${day}"`);
      return null;
    }
    
    // Calcular cuántos días hasta el próximo día de la semana
    let daysUntil = dayIndex - now.getDay();
    if (daysUntil < 0) {
      daysUntil += 7; // Próxima semana
    }
    if (daysUntil === 0 && dayIndex === now.getDay()) {
      // Si es hoy, verificar si la hora ya pasó
      const appointmentTime = parseTime(time);
      if (appointmentTime && appointmentTime.hour * 60 + appointmentTime.minute < now.getHours() * 60 + now.getMinutes()) {
        daysUntil = 7; // Ya pasó hoy, siguiente semana
      }
    }
    
    // Calcular fecha
    const appointmentDate = new Date(now);
    appointmentDate.setDate(now.getDate() + daysUntil);
    
    // Parsear hora
    const timeParsed = parseTime(time);
    if (timeParsed) {
      appointmentDate.setHours(timeParsed.hour, timeParsed.minute, 0, 0);
    } else {
      // Si no se puede parsear la hora, usar 9:00 AM como default
      appointmentDate.setHours(9, 0, 0, 0);
    }
    
    return appointmentDate;
  } catch (error) {
    console.error('Error calculando fecha de cita:', error);
    return null;
  }
}

/**
 * Parsea una hora en formato texto a objeto con hour y minute
 * @param {string} timeStr - Hora en formato texto (ej: "10:30 a.m." o "14:00")
 * @returns {Object|null} - {hour, minute} o null
 */
function parseTime(timeStr) {
  try {
    const normalized = timeStr.toLowerCase().trim();
    
    // Formato 24 horas (14:00, 15:30)
    const match24 = normalized.match(/(\d{1,2}):(\d{2})/);
    if (match24) {
      return {
        hour: parseInt(match24[1]),
        minute: parseInt(match24[2])
      };
    }
    
    // Formato 12 horas (10:30 a.m., 2:00 p.m.)
    const match12 = normalized.match(/(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)/);
    if (match12) {
      let hour = parseInt(match12[1]);
      const minute = parseInt(match12[2]);
      const period = match12[3].toLowerCase();
      
      if (period.includes('p') && hour !== 12) {
        hour += 12;
      } else if (period.includes('a') && hour === 12) {
        hour = 0;
      }
      
      return { hour, minute };
    }
    
    // Solo número (ej: "10")
    const matchNumber = normalized.match(/^(\d{1,2})$/);
    if (matchNumber) {
      return {
        hour: parseInt(matchNumber[1]),
        minute: 0
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parseando hora:', error);
    return null;
  }
}

/**
 * Verifica si una cita necesita recordatorio (es mañana)
 * @param {Date} appointmentDate - Fecha de la cita
 * @returns {boolean}
 */
function needsReminder(appointmentDate) {
  if (!appointmentDate) return false;
  
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(tomorrow.getDate() + 1);
  
  // La cita es mañana si está entre mañana 00:00 y pasado mañana 00:00
  return appointmentDate >= tomorrow && appointmentDate < dayAfterTomorrow;
}

/**
 * Obtiene todas las citas pendientes de Google Sheets
 * @returns {Array} - Array de citas con sus datos
 */
async function getPendingAppointments() {
  try {
    const rows = await readSheet('citas');
    
    if (!rows || rows.length === 0) {
      return [];
    }
    
    // La primera fila son los encabezados
    const headers = rows[0];
    const appointments = [];
    
    // Buscar índices de columnas
    const whatsappIndex = headers.indexOf('WhatsApp');
    const typeIndex = headers.indexOf('Tipo de Cita');
    const nameIndex = headers.indexOf('Nombre Completo');
    // Buscar día con diferentes variaciones de nombre
    const dayIndex = headers.findIndex(h => 
      h && (h.toLowerCase().includes('día') || h.toLowerCase().includes('dia')) && 
      (h.toLowerCase().includes('preferido') || !h.toLowerCase().includes('registro'))
    );
    // Buscar hora con diferentes variaciones
    const timeIndex = headers.findIndex(h => 
      h && (h.toLowerCase().includes('hora') || h.toLowerCase().includes('time'))
    );
    const reminderSentIndex = headers.indexOf('Recordatorio Enviado');
    
    // Si no hay columna de recordatorio, asumir que no se ha enviado
    const hasReminderColumn = reminderSentIndex !== -1;
    
    // Procesar cada fila (saltando encabezados)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Verificar si ya se envió el recordatorio
      if (hasReminderColumn && row[reminderSentIndex] && row[reminderSentIndex].toLowerCase() === 'sí') {
        continue; // Ya se envió, saltar
      }
      
      // Extraer datos
      const whatsapp = row[whatsappIndex] || '';
      const type = row[typeIndex] || '';
      const name = row[nameIndex] || '';
      const day = row[dayIndex] || '';
      const time = row[timeIndex] || '';
      
      if (!whatsapp || !day || !time) {
        continue; // Datos incompletos, saltar
      }
      
      // Calcular fecha de la cita
      const appointmentDate = calculateAppointmentDate(day, time);
      
      if (needsReminder(appointmentDate)) {
        appointments.push({
          whatsapp,
          type,
          name,
          day,
          time,
          appointmentDate,
          rowIndex: i + 1 // +1 porque Google Sheets es 1-indexed
        });
      }
    }
    
    return appointments;
  } catch (error) {
    console.error('Error obteniendo citas pendientes:', error);
    return [];
  }
}

/**
 * Marca un recordatorio como enviado en Google Sheets
 * @param {number} rowIndex - Índice de la fila (1-indexed)
 */
async function markReminderSent(rowIndex) {
  try {
    const { google } = await import('googleapis');
    const sheets = google.sheets('v4');
    const path = await import('path');
    
    // Obtener auth
    let authClient;
    const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '1b52e3kbbhD5Gp1d88pEeIeRnVn0b6KKgAoArxBHVjkA';
    
    // Autenticación (copiado de googleSheetsService)
    const { GoogleAuth } = google.auth;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const credentialsRaw = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      const credentials = {
        ...credentialsRaw,
        private_key: credentialsRaw.private_key.replace(/\\n/g, '\n')
      };
      authClient = new GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
    } else {
      const credentialsPath = path.default.join(process.cwd(), 'src', 'credentials', 'credentials.json');
      authClient = new GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
    }
    
    const client = await authClient.getClient();
    
    // Leer encabezados para encontrar índice de columna
    const response = await sheets.spreadsheets.values.get({
      auth: client,
      spreadsheetId: SPREADSHEET_ID,
      range: 'citas!A1:Z1',
    });
    
    const headers = response.data.values?.[0] || [];
    let reminderColumnIndex = headers.indexOf('Recordatorio Enviado');
    
    if (reminderColumnIndex === -1) {
      // Si no existe la columna, agregarla
      const columnLetter = String.fromCharCode(65 + headers.length); // A=65, B=66, etc.
      await sheets.spreadsheets.values.update({
        auth: client,
        spreadsheetId: SPREADSHEET_ID,
        range: `citas!${columnLetter}1`,
        valueInputOption: 'RAW',
        resource: {
          values: [['Recordatorio Enviado']]
        }
      });
      
      reminderColumnIndex = headers.length;
      console.log(`📝 Columna "Recordatorio Enviado" agregada en columna ${columnLetter}`);
    }
    
    // Actualizar celda
    const columnLetter = String.fromCharCode(65 + reminderColumnIndex);
    await sheets.spreadsheets.values.update({
      auth: client,
      spreadsheetId: SPREADSHEET_ID,
      range: `citas!${columnLetter}${rowIndex}`,
      valueInputOption: 'RAW',
      resource: {
        values: [['Sí']]
      }
    });
    
    console.log(`✅ Recordatorio marcado como enviado para fila ${rowIndex}`);
  } catch (error) {
    console.error(`❌ Error marcando recordatorio como enviado:`, error.message || error);
    // No lanzar error para no interrumpir el proceso
  }
}

/**
 * Envía recordatorios de citas que son mañana
 */
async function sendAppointmentReminders() {
  try {
    console.log('🔔 Verificando recordatorios de citas...');
    
    const appointments = await getPendingAppointments();
    
    if (appointments.length === 0) {
      console.log('✅ No hay citas que requieran recordatorio');
      return;
    }
    
    console.log(`📋 Encontradas ${appointments.length} cita(s) que requieren recordatorio`);
    
    for (const appointment of appointments) {
      try {
        // Enviar recordatorio
        await whatsappService.sendMessage(
          appointment.whatsapp,
          messages.appointment.reminder({
            name: appointment.name,
            day: appointment.day,
            time: appointment.time,
            type: appointment.type
          })
        );
        
        console.log(`✅ Recordatorio enviado a ${appointment.name} (${appointment.whatsapp})`);
        
        // Marcar como enviado en Google Sheets
        await markReminderSent(appointment.rowIndex);
        
        // Esperar un poco entre mensajes para no exceder límites de rate
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Error enviando recordatorio a ${appointment.whatsapp}:`, error.message || error);
        // Continuar con la siguiente cita
      }
    }
    
    console.log('✅ Proceso de recordatorios completado');
  } catch (error) {
    console.error('❌ Error en sendAppointmentReminders:', error.message || error);
  }
}

export default {
  sendAppointmentReminders,
  calculateAppointmentDate,
  needsReminder
};

