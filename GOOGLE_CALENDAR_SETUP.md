# 📅 Google Calendar API - Configuración

Este documento explica cómo configurar Google Calendar API para que el bot pueda:
- ✅ Crear citas automáticamente en el calendario de la psicóloga
- ✅ Verificar disponibilidad antes de confirmar citas
- ✅ Sugerir horarios alternativos cuando un horario está ocupado
- ✅ Actualizar o cancelar eventos cuando el usuario modifica/cancela su cita

---

## 📋 Paso 1: Habilitar Google Calendar API

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto existente (el mismo que usas para Google Sheets)
3. En el menú lateral, ve a **"APIs & Services"** → **"Enabled APIs and Services"**
4. Haz clic en **"+ ENABLE APIS AND SERVICES"**
5. Busca **"Google Calendar API"**
6. Haz clic en **"ENABLE"**

---

## 🔑 Paso 2: Verificar Permisos del Service Account

Tu Service Account ya tiene credenciales (las que usas para Sheets), pero necesita permisos adicionales:

1. Ve a **"IAM & Admin"** → **"Service Accounts"**
2. Encuentra tu Service Account (debería verse algo como: `nombre@proyecto.iam.gserviceaccount.com`)
3. **Copia el email del Service Account** (lo necesitarás en el siguiente paso)

---

## 📆 Paso 3: Compartir el Calendario con el Service Account

**IMPORTANTE:** Debes dar acceso al Service Account para que pueda crear eventos en el calendario de la psicóloga.

### Opción A: Usar el Calendario Principal (Primary)

1. Abre [Google Calendar](https://calendar.google.com/) con la cuenta de la psicóloga
2. En el lado izquierdo, haz clic en el ícono ⚙️ junto a tu calendario
3. Selecciona **"Settings and sharing"**
4. Scroll hacia abajo hasta **"Share with specific people or groups"**
5. Haz clic en **"+ Add people and groups"**
6. Pega el **email del Service Account** (ejemplo: `nombre@proyecto.iam.gserviceaccount.com`)
7. En el menú desplegable de permisos, selecciona: **"Make changes to events"**
8. Haz clic en **"Send"**

### Opción B: Crear un Calendario Específico para Citas

1. En Google Calendar, haz clic en **"+"** junto a **"Other calendars"**
2. Selecciona **"Create new calendar"**
3. Nombre: `Citas de Psicología Bot`
4. Haz clic en **"Create calendar"**
5. Una vez creado, haz clic en el ícono ⚙️ junto al nuevo calendario
6. Ve a **"Settings and sharing"**
7. Copia el **Calendar ID** (está en la sección "Integrate calendar", se ve como: `abcd1234@group.calendar.google.com`)
8. En **"Share with specific people"**, agrega el email del Service Account con permisos de **"Make changes to events"**

---

## 🌐 Paso 4: Configurar Variables de Entorno en Railway

Ya tienes configurada la variable `GOOGLE_APPLICATION_CREDENTIALS_JSON` con tus credenciales. Ahora necesitas agregar el Calendar ID:

### Si usas el Calendario Principal:
No necesitas agregar ninguna variable adicional. El bot usará `'primary'` por defecto.

### Si creaste un Calendario Específico:
1. Ve a tu proyecto en [Railway](https://railway.app/)
2. Selecciona tu servicio
3. Ve a la pestaña **"Variables"**
4. Haz clic en **"+ New Variable"**
5. Agrega:
   - **Name:** `GOOGLE_CALENDAR_ID`
   - **Value:** El Calendar ID que copiaste (ejemplo: `abcd1234@group.calendar.google.com`)
6. Haz clic en **"Add"**

---

## 🔄 Paso 5: Actualizar Google Sheets

Tu hoja de citas ahora necesita **11 columnas** (agregamos una para el Calendar Event ID):

### Nueva Estructura de la Hoja "citas":

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| WhatsApp | Tipo | Nombre | Código | Carrera | Email | Día | Hora | Timestamp | Fecha Calculada | **Event ID** |

### Pasos:
1. Abre tu Google Sheet
2. Ve a la hoja **"citas"**
3. En la columna **K** (la nueva columna 11), agrega el encabezado: `Event ID`

**Nota:** Las citas existentes tendrán `N/A` en la columna Event ID, lo cual está bien. Solo las nuevas citas tendrán el ID del evento de Calendar.

---

## ✅ Paso 6: Probar la Integración

1. **Despliega los cambios** en Railway:
   ```bash
   git add .
   git commit -m "feat: integrar Google Calendar API para gestión de citas"
   git push origin main
   ```

2. **Espera a que Railway actualice** (1-2 minutos)

3. **Prueba el flujo completo:**
   - Envía "hola" al bot
   - Selecciona "Agendar una cita"
   - Completa todos los datos
   - Al final, deberías ver:
     - ✅ Un nuevo evento en Google Calendar
     - ✅ Los datos en Google Sheets con el Event ID

4. **Prueba la verificación de disponibilidad:**
   - Intenta agendar una cita en el mismo horario que ya existe en Calendar
   - El bot debería decirte que está ocupado y sugerir alternativas

---

## 🔧 Troubleshooting

### Error: "Calendar API has not been used in project..."
- **Solución:** Asegúrate de haber habilitado la API en Google Cloud Console (Paso 1)

### Error: "The caller does not have permission"
- **Solución:** El Service Account no tiene acceso al calendario. Verifica el Paso 3.

### Los eventos se crean pero no aparecen en Calendar
- **Solución:** Verifica que estés mirando el calendario correcto (si creaste uno específico, asegúrate de tener el Calendar ID correcto en Railway)

### El bot dice "Horario disponible" pero en Calendar ya hay algo
- **Solución:** Puede ser un problema con la zona horaria. Verifica que la fecha/hora se esté parseando correctamente en los logs.

---

## 📊 Logs Importantes

Cuando el bot procesa una cita, deberías ver estos logs:

```
📅 Verificando disponibilidad para lunes a las 10:00
✅ Horario disponible: lunes 10:00
📅 Creando evento en Google Calendar...
✅ Evento creado en Calendar con ID: abc123xyz
📊 Intentando guardar cita en Google Sheets...
✅ Cita guardada en Google Sheets correctamente
```

Si ves errores, revisa:
- Las credenciales están correctas
- El Calendar ID es el correcto
- El Service Account tiene permisos

---

## 🎉 ¡Listo!

Ahora tu bot está completamente integrado con Google Calendar. Los usuarios recibirán:
- ✉️ Invitaciones por email automáticamente
- 🔔 Recordatorios 1 día antes y 1 hora antes
- 📅 La psicóloga verá todas las citas en su calendario

**¿Necesitas modificar los horarios de trabajo o la duración de las citas?**
Edita `src/services/googleCalendarService.js`:
- Línea 171: `workingHours` (horarios disponibles)
- Línea 172: `workingDays` (días laborables)
- Línea 283: Duración de la cita (actualmente 1 hora)

