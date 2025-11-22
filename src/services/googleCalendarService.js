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
        weekLater.setDate(weekLater.getDate() + 14); // Look ahead 2 weeks
        
        // Fetch all events in the next 2 weeks
        const response = await calendar.events.list({
            auth: authClient,
            calendarId: CALENDAR_ID,
            timeMin: now.toISOString(),
            timeMax: weekLater.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });
        
        const busyEvents = response.data.items || [];
        
        // Define working hours: 8-12 AM and 2-5 PM, Monday to Friday
        const morningHours = [8, 9, 10, 11]; // 8 AM to 11 AM (last slot starts at 11, ends at 12)
        const afternoonHours = [14, 15, 16]; // 2 PM to 4 PM (last slot starts at 4, ends at 5)
        const workingHours = [...morningHours, ...afternoonHours];
        const workingDays = [1, 2, 3, 4, 5]; // Monday to Friday only
        
        const availableSlots = [];
        
        for (let i = 0; i < 14; i++) {
            const checkDate = new Date(now);
            checkDate.setDate(checkDate.getDate() + i);
            
            const dayOfWeek = checkDate.getDay();
            if (!workingDays.includes(dayOfWeek)) continue; // Skip weekends
            
            for (const hour of workingHours) {
                const slotStart = new Date(checkDate);
                slotStart.setHours(hour, 0, 0, 0);
                
                const slotEnd = new Date(slotStart);
                slotEnd.setHours(hour + 1);
                
                // Skip past time slots
                if (slotStart <= now) continue;
                
                // Check if this slot conflicts with any busy event
                const hasConflict = busyEvents.some(event => {
                    const eventStart = new Date(event.start.dateTime || event.start.date);
                    const eventEnd = new Date(event.end.dateTime || event.end.date);
                    return (slotStart < eventEnd && slotEnd > eventStart);
                });
                
                if (!hasConflict) {
                    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
                    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                                       'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                    
                    const timeFormatted = hour < 12 
                        ? `${hour}:00 AM` 
                        : hour === 12 
                            ? '12:00 PM' 
                            : `${hour - 12}:00 PM`;
                    
                    availableSlots.push({
                        day: dayNames[dayOfWeek],
                        time: `${hour}:00`,
                        datetime: slotStart,
                        formatted: `${dayNames[dayOfWeek]} ${checkDate.getDate()} de ${monthNames[checkDate.getMonth()]} a las ${timeFormatted}`,
                        date: checkDate.toISOString().split('T')[0],
                        timeFormatted: timeFormatted
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
 * Get available dates (next 10 working days - 2 weeks)
 * @returns {Promise<Array<{date: Date, formatted: string, dayName: string}>>}
 */
export const getAvailableDates = async () => {
    try {
        console.log('📅 Obteniendo fechas disponibles...');
        
        const now = new Date();
        const availableDates = [];
        const workingDays = [1, 2, 3, 4, 5]; // Monday to Friday
        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                           'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        
        let daysChecked = 0;
        let daysFound = 0;
        
        // Determine starting point based on current time
        // If it's a working day AND there's still time to schedule today (before 5 PM), start from today
        // Otherwise, start from tomorrow
        const currentHour = now.getHours();
        const currentDay = now.getDay();
        const isWorkingDay = workingDays.includes(currentDay);
        const hasTimeToday = currentHour < 17; // Before 5 PM (last slot is 4-5 PM)
        
        // If it's a working day and there's still time to schedule today, start from 0
        // Otherwise, start from tomorrow (+1)
        const startOffset = (isWorkingDay && hasTimeToday) ? 0 : 1;
        
        console.log(`🕐 Hora actual: ${currentHour}:${now.getMinutes()}, Día: ${dayNames[currentDay]}`);
        console.log(`📅 Empezando búsqueda desde: ${startOffset === 0 ? 'HOY' : 'MAÑANA'}`);
        
        // Find next 10 working days (2 weeks)
        while (daysFound < 10 && daysChecked < 21) { // Check up to 3 weeks to ensure we get 10 working days
            const checkDate = new Date(now);
            checkDate.setDate(checkDate.getDate() + daysChecked + startOffset); // Use startOffset
            checkDate.setHours(0, 0, 0, 0);
            
            const dayOfWeek = checkDate.getDay();
            
            if (workingDays.includes(dayOfWeek)) {
                // If it's today, verify there are available time slots
                if (daysChecked === 0 && startOffset === 0) {
                    // Check if there are available times for today
                    const availableTimes = await getAvailableTimesForDate(checkDate.toISOString().split('T')[0]);
                    if (availableTimes.length === 0) {
                        console.log(`⏭️ Hoy no tiene horarios disponibles, saltando...`);
                        daysChecked++;
                        continue; // No available times today, skip
                    }
                }
                
                availableDates.push({
                    date: new Date(checkDate),
                    formatted: `${dayNames[dayOfWeek]} ${checkDate.getDate()} de ${monthNames[checkDate.getMonth()]}`,
                    dayName: dayNames[dayOfWeek],
                    dateStr: checkDate.toISOString().split('T')[0],
                    weekNumber: daysFound < 5 ? 1 : 2 // Track which week (1 or 2)
                });
                daysFound++;
            }
            
            daysChecked++;
        }
        
        console.log(`✅ Encontradas ${availableDates.length} fechas disponibles (2 semanas)`);
        return availableDates;
        
    } catch (error) {
        console.error('❌ Error obteniendo fechas disponibles:', error?.message || error);
        return [];
    }
};

/**
 * Get available time slots for a specific date
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Promise<Array<{time: string, timeFormatted: string, datetime: Date}>>}
 */
export const getAvailableTimesForDate = async (dateStr) => {
    try {
        console.log(`🕐 Obteniendo horarios disponibles para ${dateStr}...`);
        
        const authClient = await getAuth();
        const targetDate = new Date(dateStr + 'T00:00:00');
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        // Fetch events for that specific day
        const response = await calendar.events.list({
            auth: authClient,
            calendarId: CALENDAR_ID,
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });
        
        const busyEvents = response.data.items || [];
        console.log(`📋 Eventos ocupados en ${dateStr}: ${busyEvents.length}`);
        
        // Log each busy event for debugging
        if (busyEvents.length > 0) {
            console.log('🔍 Detalle de eventos ocupados:');
            busyEvents.forEach(event => {
                const eventStart = new Date(event.start.dateTime || event.start.date);
                const eventEnd = new Date(event.end.dateTime || event.end.date);
                console.log(`  - ${event.summary}: ${eventStart.toLocaleString('es-CO', { timeZone: 'America/Bogota' })} - ${eventEnd.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
            });
        }
        
        // Define working hours: 8-12 AM and 2-5 PM
        const morningHours = [8, 9, 10, 11];
        const afternoonHours = [14, 15, 16];
        const allHours = [...morningHours, ...afternoonHours];
        
        const availableTimes = [];
        const now = new Date();
        
        for (const hour of allHours) {
            // Parse the date correctly to avoid timezone issues
            const [year, month, day] = dateStr.split('-').map(Number);
            
            // Create dates in UTC, converting from Colombia time (UTC-5)
            const slotStart = new Date(Date.UTC(year, month - 1, day, hour + 5, 0, 0)); // +5 to convert Colombia time to UTC
            const slotEnd = new Date(Date.UTC(year, month - 1, day, hour + 6, 0, 0)); // +6 for end time
            
            console.log(`🕐 Verificando slot ${hour}:00 (${slotStart.toISOString()} - ${slotEnd.toISOString()})`);
            
            // Skip past time slots
            if (slotStart <= now) {
                console.log(`  ⏭️ Slot pasado, omitiendo`);
                continue;
            }
            
            // Check if this slot conflicts with any busy event
            const hasConflict = busyEvents.some(event => {
                const eventStart = new Date(event.start.dateTime || event.start.date);
                const eventEnd = new Date(event.end.dateTime || event.end.date);
                const conflicts = (slotStart < eventEnd && slotEnd > eventStart);
                
                if (conflicts) {
                    console.log(`  ❌ CONFLICTO detectado con: ${event.summary}`);
                    console.log(`     Evento: ${eventStart.toISOString()} - ${eventEnd.toISOString()}`);
                    console.log(`     Slot:   ${slotStart.toISOString()} - ${slotEnd.toISOString()}`);
                }
                
                return conflicts;
            });
            
            const timeFormatted = hour < 12 
                ? `${hour}:00 AM` 
                : hour === 12 
                    ? '12:00 PM' 
                    : `${hour - 12}:00 PM`;
            
            console.log(`  ✅ Slot ${hour}:00 => ${hasConflict ? 'OCUPADO' : 'DISPONIBLE'}`);
            
            availableTimes.push({
                time: `${hour}:00`,
                timeFormatted: timeFormatted,
                datetime: slotStart,
                available: !hasConflict,
                isMorning: hour < 12
            });
        }
        
        console.log(`✅ Encontrados ${availableTimes.filter(t => t.available).length}/${availableTimes.length} horarios disponibles`);
        return availableTimes;
        
    } catch (error) {
        console.error('❌ Error obteniendo horarios para fecha específica:', error?.message || error);
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
        const { name, email, type, day, time, whatsapp, datetime } = appointmentData;
        
        // Use the datetime if provided, otherwise try to parse
        let startDateTime;
        if (datetime) {
            startDateTime = new Date(datetime);
            console.log('✅ Usando datetime proporcionado:', startDateTime.toISOString());
        } else {
            startDateTime = parseAppointmentDateTime(day, time);
            if (!startDateTime) {
                console.warn('⚠️ No se pudo parsear la fecha, evento no creado');
                return null;
            }
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

/**
 * Get a specific calendar event by ID
 * @param {string} eventId - Google Calendar event ID
 * @returns {Object|null} - Event data or null if not found
 */
export const getCalendarEvent = async (eventId) => {
    try {
        console.log(`📅 Obteniendo evento de Calendar: ${eventId}`);
        const authClient = await getAuth();
        
        const response = await calendar.events.get({
            auth: authClient,
            calendarId: CALENDAR_ID,
            eventId: eventId,
        });
        
        console.log(`✅ Evento encontrado: ${response.data.summary}`);
        console.log(`   Inicio: ${response.data.start.dateTime}`);
        console.log(`   Fin: ${response.data.end.dateTime}`);
        
        return response.data;
    } catch (error) {
        if (error.code === 404) {
            console.warn(`⚠️ Evento no encontrado en Calendar: ${eventId}`);
        } else {
            console.error('❌ Error obteniendo evento de Calendar:', error?.message || error);
        }
        return null;
    }
};

export default {
    checkAvailability,
    getAvailableSlots,
    getAvailableDates,
    getAvailableTimesForDate,
    createCalendarEvent,
    deleteCalendarEvent,
    updateCalendarEvent,
    getCalendarEvent
};

