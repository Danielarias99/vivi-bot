# 📊 Configuración de Google Sheets para el Bot Vivi

## ✅ Cambios Aplicados

Se ha activado la integración con Google Sheets para guardar las citas agendadas automáticamente.

---

## 📋 Estructura de Datos

### Columnas que se guardan en Google Sheets:

| Columna | Campo | Descripción | Ejemplo |
|---------|-------|-------------|---------|
| **A** | WhatsApp | Número del usuario | 573123456789 |
| **B** | Tipo de Cita | Presencial o Virtual | Presencial |
| **C** | Nombre Completo | Nombre del estudiante | Juan Pérez |
| **D** | Código Estudiantil | Código de estudiante | 2012345 |
| **E** | Carrera | Programa académico | Ingeniería de Sistemas |
| **F** | Email | Correo institucional | juan.perez@correounivalle.edu.co |
| **G** | Día Preferido | Día de la semana elegido | martes |
| **H** | Hora Preferida | Horario elegido | 10:30 a.m. |
| **I** | Timestamp | Fecha de registro | 2025-11-02T14:30:00.000Z |

**Nota:** El número de teléfono del usuario ya se obtiene del campo WhatsApp (columna A), por lo que no se solicita por separado durante el flujo.

---

## 🔧 Pasos para Configurar Google Sheets

### 1️⃣ **Abre tu Google Sheet**
   - URL: https://docs.google.com/spreadsheets/d/1b52e3kbbhD5Gp1d88pEeIeRnVn0b6KKgAoArxBHVjkA/edit

### 2️⃣ **Crea una hoja llamada "citas"**
   - Haz clic en el botón **"+"** en la parte inferior
   - Nombra la hoja exactamente: **citas** (todo en minúsculas)
   - ⚠️ **IMPORTANTE:** El nombre debe ser exacto, sin espacios ni mayúsculas

### 3️⃣ **Agrega los encabezados en la primera fila:**

Copia y pega esto en las celdas de la primera fila:

```
A1: WhatsApp
B1: Tipo de Cita
C1: Nombre Completo
D1: Código Estudiantil
E1: Carrera
F1: Email
G1: Día Preferido (o "Dia")
H1: Hora Preferida (o "Hora")
I1: Fecha de Registro
J1: Fecha Calculada
```

### 4️⃣ **Formato Recomendado (Opcional)**
   - Fila 1: **Negrita** y con color de fondo
   - Columna A: Formato de texto
   - Columna D: Formato de número
   - Columna G: Formato de texto (día de la semana)
   - Columna H: Formato de texto (hora)
   - Columna I: Formato de fecha y hora

### 5️⃣ **Permisos de la Service Account**
   - Ve a la configuración del Sheet → **Compartir**
   - Comparte el documento con el email de tu service account
   - Email debe verse como: `nombre@proyecto-123456.iam.gserviceaccount.com`
   - Permisos: **Editor** (para que pueda escribir)

---

## 🧪 Cómo Probar

1. **Inicia el bot:**
   ```bash
   npm start
   ```

2. **Envía "hola" al bot en WhatsApp**

3. **Selecciona opción "1" (Agendar una cita)**

4. **Completa el flujo:**
   - Tipo: 1 (Presencial) o 2 (Virtual)
   - Nombre: Tu nombre completo
   - Código: Tu código estudiantil
   - Carrera: Tu programa
   - Teléfono: 10 dígitos
   - Email: correo@correounivalle.edu.co
   - Día: "martes" o "cualquier día"
   - Hora: "10:30 a.m." o "cualquier hora"

5. **Verifica en Google Sheets:**
   - Los datos deben aparecer en una nueva fila
   - Revisa la consola para ver los logs

---

## 📝 Logs que Verás en la Consola

### ✅ Si todo funciona:
```
📊 Intentando guardar cita en Google Sheets...
🔐 Autenticando con Google Sheets...
📝 Guardando datos en hoja: "citas"
📊 Datos a guardar: [Array con los datos]
✅ Datos agregados correctamente a Google Sheets
✅ Cita guardada en Google Sheets correctamente
```

### ❌ Si hay errores comunes:

**Error: La hoja "citas" no existe**
```
❌ Error: La hoja "citas" no existe en el documento de Google Sheets.
💡 Asegúrate de crear una hoja con ese nombre exacto.
```
→ **Solución:** Crea la hoja con el nombre exacto "citas"

**Error: Credenciales inválidas**
```
⚠️ Google Sheets no está configurado correctamente. Las credenciales son inválidas.
```
→ **Solución:** Verifica que `src/credentials/credentials.json` sea válido

**Error: Permisos insuficientes**
```
❌ Error: The caller does not have permission
```
→ **Solución:** Comparte el Sheet con el email de la service account

---

## 🔍 Verificar Configuración Actual

### Spreadsheet ID:
```
1b52e3kbbhD5Gp1d88pEeIeRnVn0b6KKgAoArxBHVjkA
```

### Archivo de credenciales:
```
src/credentials/credentials.json
```

### Nombre de la hoja:
```
citas
```

---

## 🛠️ Solución de Problemas

### Problema: Los datos no se guardan
1. Verifica que la hoja se llame exactamente "citas"
2. Revisa los logs en la consola
3. Asegúrate de que el Sheet esté compartido con la service account
4. Verifica que las credenciales estén en la ruta correcta

### Problema: Error de autenticación
1. Verifica que `credentials.json` esté bien formateado (JSON válido)
2. Asegúrate de que el proyecto de Google Cloud tenga la API de Sheets habilitada
3. Regenera las credenciales si es necesario

### Problema: Error de permisos
1. Comparte el Sheet con el email de la service account
2. Dale permisos de **Editor**
3. Espera 1-2 minutos y prueba de nuevo

---

## 📚 Recursos Adicionales

- [Documentación de Google Sheets API](https://developers.google.com/sheets/api)
- [Configurar Service Account](https://cloud.google.com/iam/docs/service-accounts)

---

## ✨ Notas Importantes

- El bot **NO crasheará** si Google Sheets falla - continuará funcionando y solo mostrará una advertencia
- Los datos se guardan **en segundo plano** (asíncrono) para no afectar la velocidad de respuesta
- Cada cita se agrega automáticamente al final de la hoja
- El timestamp está en formato ISO 8601 (UTC)

