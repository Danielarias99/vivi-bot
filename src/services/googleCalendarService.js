import path from 'path';
import { google } from 'googleapis';

const calendar = google.calendar('v3');

// ID of the psychologist's calendar (can be 'primary' or specific calendar ID)
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

/**
 * Get Google Auth client with Calendar and Sheets scopes
 * Reuses the same credentials as Sheets service
 */
const getAuth = async () => {
    try {
        let authConfig;
        
        // Check if running in Railway (or any cloud environment with env var)
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
            console.log('🔑 Using Google credentials from environment variable');
            const credentialsRaw = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
            // Fix the private_key: replace literal \n with actual newlines
            const credentials = {
                ...credentialsRaw,
                private_key: credentialsRaw.private_key.replace(/\\n/g, '\n')
            };
            console.log('✅ Private key parsed and newlines fixed');
            authConfig = {
                credentials: credentials,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/calendar'
                ]
            };
        } else {
            // Local development: use credentials file
            console.log('📁 Using Google credentials from file');
            authConfig = {
                keyFile: path.join(process.cwd(), 'src/credentials', 'credentials.json'),
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/calendar'
                ]
            };
        }
        
        const auth = new google.auth.GoogleAuth(authConfig);
        return await auth.getClient();
    } catch (error) {
        console.error('❌ Error al autenticar con Google:', error?.message || error);
        throw error;
    }
};

/**
 * Parse day and time strings to a Date object
 * @param {string} dayStr - e.g., "lunes", "martes", "2025-11-15"
 * @param {string} timeStr - e.g., "10:30 a.m.", "14:00"
 * @returns {Date|null}
 */
const parseAppointmentDateTime = (dayStr, timeStr) => {
    try {
        const now = new Date();
        const days = {
            'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3,
            'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6, 'domingo': 0
        };
        
        const dayLower = dayStr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const targetDay = days[dayLower];
        
        if (targetDay === undefined) {
            console.warn(`⚠️ Día no reconocido: ${dayStr}`);
            return null;
        }
        
        // Calculate next occurrence of that day
        const currentDay = now.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        
        const appointmentDate = new Date(now);
        appointmentDate.setDate(now.getDate() + daysToAdd);
        
        // Parse time
        const timeLower = timeStr.toLowerCase().replace(/\s/g, '');
        let hours, minutes;
        
        // 12-hour format with am/pm
        const match12h = timeLower.match(/(\d{1,2}):(\d{2})(am|pm|a\.m\.|p\.m\.)/);
        if (match12h) {
            hours = parseInt(match12h[1]);
            minutes = parseInt(match12h[2]);
            const meridian = match12h[3];
            if ((meridian.includes('pm') || meridian.includes('p.m.')) && hours !== 12) {
                hours += 12;
            }
            if ((meridian.includes('am') || meridian.includes('a.m.')) && hours === 12) {
                hours = 0;
            }
        } else {
            // 24-hour format
            const match24h = timeLower.match(/(\d{1,2}):(\d{2})/);
            if (match24h) {
                hours = parseInt(match24h[1]);
                minutes = parseInt(match24h[2]);
            } else {
                console.warn(`⚠️ Hora no reconocida: ${timeStr}`);
                return null;
            }
        }
        
        appointmentDate.setHours(hours, minutes, 0, 0);
        return appointmentDate;
    } catch (error) {
        console.error('❌ Error parseando fecha/hora:', error);
        return null;
    }
};

/**
 * Check if a time slot is available in the calendar
 * @param {string} dayStr - Day of the week
 * @param {string} timeStr - Time of day
 * @returns {Promise<{available: boolean, conflicts: Array}>}
 */
export const checkAvailability = async (dayStr, timeStr) => {
    try {
        console.log(`📅 Verificando disponibilidad para: ${dayStr} a las ${timeStr}`);
        
        const authClient = await getAuth();
        const startDateTime = parseAppointmentDateTime(dayStr, timeStr);
        
        if (!startDateTime) {
            console.warn('⚠️ No se pudo parsear la fecha/hora');
            return { available: true, conflicts: [] }; // Allow to continue if can't verify
        }
        
        // End time: 1 hour after start
        const endDateTime = new Date(startDateTime);
        endDateTime.setHours(endDateTime.getHours() + 1);
        
        console.log(`🔍 Buscando eventos entre ${startDateTime.toISOString()} y ${endDateTime.toISOString()}`);
        
        const response = await calendar.events.list({
            auth: authClient,
            calendarId: CALENDAR_ID,
            timeMin: startDateTime.toISOString(),
            timeMax: endDateTime.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });
        
        const events = response.data.items || [];
        
        if (events.length > 0) {
            console.log(`⚠️ Conflicto encontrado: ${events.length} evento(s) en ese horario`);
            return { available: false, conflicts: events };
        }
        
        console.log('✅ Horario disponible');
        return { available: true, conflicts: [] };
        
    } catch (error) {
        console.error('❌ Error verificando disponibilidad:', error?.message || error);
        // In case of error, allow to continue (don't block the flow)
        return { available: true, conflicts: [] };
    }
};

/**
 * Get available time slots for the next 7 days
 * @returns {Promise<Array<{day: string, time: string, datetime: Date}>>}
 */
export const getAvailableSlots = async () => {
    try {
        console.log('📅 Buscando horarios disponibles...');
        
        const authClient = await getAuth();
        const now = new Date();
        const weekLater = new Date(now);
        weekLater.setDate(weekLater.getDate() + 7);
        
        // Fetch all events in the next 7 days
        const response = await calendar.events.list({
            auth: authClient,
            calendarId: CALENDAR_ID,
            timeMin: now.toISOString(),
            timeMax: weekLater.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });
        
        const busyEvents = response.data.items || [];
        
        // Define working hours (9 AM - 5 PM, Monday to Friday)
        const workingHours = [9, 10, 11, 14, 15, 16]; // Skip 12-13 for lunch
        const workingDays = [1, 2, 3, 4, 5]; // Monday to Friday
        
        const availableSlots = [];
        
        for (let i = 0; i < 7; i++) {
            const checkDate = new Date(now);
            checkDate.setDate(checkDate.getDate() + i);
            
            const dayOfWeek = checkDate.getDay();
            if (!workingDays.includes(dayOfWeek)) continue;
            
            for (const hour of workingHours) {
                const slotStart = new Date(checkDate);
                slotStart.setHours(hour, 0, 0, 0);
                
                const slotEnd = new Date(slotStart);
                slotEnd.setHours(hour + 1);
                
                // Check if this slot conflicts with any busy event
                const hasConflict = busyEvents.some(event => {
                    const eventStart = new Date(event.start.dateTime || event.start.date);
                    const eventEnd = new Date(event.end.dateTime || event.end.date);
                    return (slotStart < eventEnd && slotEnd > eventStart);
                });
                
                if (!hasConflict && slotStart > now) {
                    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
                    availableSlots.push({
                        day: dayNames[dayOfWeek],
                        time: `${hour}:00`,
                        datetime: slotStart,
                        formatted: `${dayNames[dayOfWeek]} ${checkDate.getDate()}/${checkDate.getMonth() + 1} a las ${hour}:00`
                    });
                }
            }
        }
        
        console.log(`✅ Encontrados ${availableSlots.length} horarios disponibles`);
        return availableSlots.slice(0, 5); // Return first 5 available slots
        
    } catch (error) {
        console.error('❌ Error obteniendo horarios disponibles:', error?.message || error);
        return [];
    }
};

/**
 * Create an appointment event in Google Calendar
 * @param {Object} appointmentData - Appointment details
 * @returns {Promise<string|null>} Event ID or null
 */
export const createCalendarEvent = async (appointmentData) => {
    try {
        console.log('📅 Creando evento en Google Calendar...');
        
        const authClient = await getAuth();
        const { name, email, type, day, time, whatsapp } = appointmentData;
        
        const startDateTime = parseAppointmentDateTime(day, time);
        
        if (!startDateTime) {
            console.warn('⚠️ No se pudo parsear la fecha, evento no creado');
            return null;
        }
        
        const endDateTime = new Date(startDateTime);
        endDateTime.setHours(endDateTime.getHours() + 1);
        
        const event = {
            summary: `Cita de Psicología - ${name}`,
            description: `Tipo: ${type}\nNombre: ${name}\nCorreo: ${email}\nWhatsApp: ${whatsapp}\n\nAgendado vía Bot WhatsApp Vivi`,
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'America/Bogota',
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'America/Bogota',
            },
            // Removed attendees to avoid Domain-Wide Delegation requirement
            // attendees: [
            //     { email: email }
            // ],
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 }, // 1 day before
                    { method: 'popup', minutes: 60 }, // 1 hour before
                ],
            },
        };
        
        const response = await calendar.events.insert({
            auth: authClient,
            calendarId: CALENDAR_ID,
            resource: event,
            // Removed sendUpdates since we're not adding attendees
            // sendUpdates: 'all',
        });
        
        console.log(`✅ Evento creado en Calendar: ${response.data.id}`);
        console.log(`🔗 Link: ${response.data.htmlLink}`);
        
        return response.data.id;
        
    } catch (error) {
        console.error('❌ Error creando evento en Calendar:', error?.message || error);
        return null;
    }
};

/**
 * Delete an appointment event from Google Calendar
 * @param {string} eventId - Calendar event ID
 * @returns {Promise<boolean>}
 */
export const deleteCalendarEvent = async (eventId) => {
    try {
        if (!eventId || eventId === 'N/A') {
            console.log('⚠️ No hay Event ID para eliminar');
            return false;
        }
        
        console.log(`🗑️ Eliminando evento: ${eventId}`);
        
        const authClient = await getAuth();
        
        await calendar.events.delete({
            auth: authClient,
            calendarId: CALENDAR_ID,
            eventId: eventId,
            // Removed sendUpdates since we don't have attendees
            // sendUpdates: 'all',
        });
        
        console.log('✅ Evento eliminado exitosamente del Calendar');
        return true;
        
    } catch (error) {
        console.error('❌ Error eliminando evento:', error?.message || error);
        return false;
    }
};

/**
 * Update an appointment event in Google Calendar
 * @param {string} eventId - Calendar event ID
 * @param {Object} updates - Fields to update (day, time, type)
 * @returns {Promise<boolean>}
 */
export const updateCalendarEvent = async (eventId, updates) => {
    try {
        if (!eventId || eventId === 'N/A') {
            console.log('⚠️ No hay Event ID para actualizar');
            return false;
        }
        
        console.log(`📝 Actualizando evento: ${eventId}`);
        
        const authClient = await getAuth();
        
        // First, get the existing event
        const existingEvent = await calendar.events.get({
            auth: authClient,
            calendarId: CALENDAR_ID,
            eventId: eventId,
        });
        
        const event = existingEvent.data;
        
        // Update date/time if provided
        if (updates.day && updates.time) {
            const newStart = parseAppointmentDateTime(updates.day, updates.time);
            if (newStart) {
                event.start.dateTime = newStart.toISOString();
                const newEnd = new Date(newStart);
                newEnd.setHours(newEnd.getHours() + 1);
                event.end.dateTime = newEnd.toISOString();
            }
        }
        
        // Update type in description if provided
        if (updates.type) {
            event.description = event.description.replace(/Tipo: .*/, `Tipo: ${updates.type}`);
        }
        
        const response = await calendar.events.update({
            auth: authClient,
            calendarId: CALENDAR_ID,
            eventId: eventId,
            resource: event,
            // Removed sendUpdates since we don't have attendees
            // sendUpdates: 'all',
        });
        
        console.log('✅ Evento actualizado exitosamente en Calendar');
        return true;
        
    } catch (error) {
        console.error('❌ Error actualizando evento:', error?.message || error);
        return false;
    }
};

export default {
    checkAvailability,
    getAvailableSlots,
    createCalendarEvent,
    deleteCalendarEvent,
    updateCalendarEvent
};

