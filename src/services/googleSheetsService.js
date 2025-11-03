import path from 'path';
import { google } from 'googleapis';

const sheets = google.sheets('v4');

// ID único del documento de Google Sheets (unificado para todas las operaciones)
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '1b52e3kbbhD5Gp1d88pEeIeRnVn0b6KKgAoArxBHVjkA';

async function addRowToSheet(auth, spreadsheetId, rangeName, values) {
    const request = {
        spreadsheetId,
        range: rangeName,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
            values: [values],
        },
        auth,
    }

    try {
        const response = (await sheets.spreadsheets.values.append(request).data);
        return response;
    } catch (error) {
        console.error('Error agregando fila a Google Sheets:', error?.message || error);
        throw error; // Re-lanzar para manejo consistente
    }
}

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
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            };
        } else {
            // Local development: use credentials file
            console.log('📁 Using Google credentials from file');
            authConfig = {
                keyFile: path.join(process.cwd(), 'src/credentials', 'credentials.json'),
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            };
        }
        
        const auth = new google.auth.GoogleAuth(authConfig);
        return await auth.getClient();
    } catch (error) {
        console.error('Error al autenticar con Google Sheets:', error?.message || error);
        throw error; // Re-lanzar para que sea manejado por el llamador
    }
};

const appendToSheet = async (data, rangeName = 'reservas') => {
    try {
        console.log(`🔐 Autenticando con Google Sheets...`);
        const authClient = await getAuth();
        const spreadsheetId = SPREADSHEET_ID;
        
        console.log(`📝 Guardando datos en hoja: "${rangeName}"`);
        console.log(`📊 Datos a guardar:`, data);
        
        await addRowToSheet(authClient, spreadsheetId, rangeName, data);
        
        console.log(`✅ Datos agregados correctamente a Google Sheets`);
        return 'Datos correctamente agregados'
    } catch (error) {
        // Manejar errores específicos de autenticación/configuración
        const errorMessage = error?.message || error?.error_description || 'Error desconocido';
        
        if (errorMessage.includes('Invalid JWT') || errorMessage.includes('invalid_grant')) {
            console.warn('⚠️ Google Sheets no está configurado correctamente. Las credenciales son inválidas o no están disponibles.');
            console.warn('El bot continuará funcionando normalmente sin guardar en Sheets.');
        } else if (errorMessage.includes('Unable to parse range')) {
            console.error(`❌ Error: La hoja "${rangeName}" no existe en el documento de Google Sheets.`);
            console.error('💡 Asegúrate de crear una hoja con ese nombre exacto.');
        } else {
            console.error('❌ Error en appendToSheet:', errorMessage);
        }
        
        // No lanzar el error - devolver null para indicar que falló pero no crashear
        return null;
    }
}

const readSheet = async (rangeName = 'reservas') => {
    try {
        console.log(`📖 Leyendo datos de la hoja: "${rangeName}"`);
        const authClient = await getAuth();
        const spreadsheetId = SPREADSHEET_ID;
        
        const response = await sheets.spreadsheets.values.get({
            auth: authClient,
            spreadsheetId,
            range: rangeName,
        });

        console.log(`✅ Datos leídos correctamente: ${response.data.values?.length || 0} filas`);
        return response.data.values || [];
    } catch (error) {
        const errorMessage = error?.message || error?.error_description || 'Error desconocido';
        
        if (errorMessage.includes('Invalid JWT') || errorMessage.includes('invalid_grant')) {
            console.warn('⚠️ Google Sheets no está configurado. No se pueden leer datos.');
        } else {
            console.error('Error leyendo Google Sheets:', errorMessage);
        }
        
        // Devolver array vacío en lugar de crashear
        return [];
    }
};

const updateRowInSheet = async (rowIndex, data, rangeName = 'reservas') => {
    try {
        console.log(`✏️ Actualizando fila ${rowIndex} en hoja: "${rangeName}"`);
        const authClient = await getAuth();
        const spreadsheetId = SPREADSHEET_ID;
        
        // Convertir el índice a formato A1 (rowIndex + 1 porque Sheets es 1-indexed)
        const range = `${rangeName}!A${rowIndex + 1}:Z${rowIndex + 1}`;
        
        await sheets.spreadsheets.values.update({
            auth: authClient,
            spreadsheetId,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: [data]
            }
        });
        
        console.log(`✅ Fila actualizada correctamente`);
        return 'Fila actualizada correctamente';
    } catch (error) {
        const errorMessage = error?.message || error?.error_description || 'Error desconocido';
        
        if (errorMessage.includes('Invalid JWT') || errorMessage.includes('invalid_grant')) {
            console.warn('⚠️ Google Sheets no está configurado. No se puede actualizar.');
        } else {
            console.error('Error actualizando Google Sheets:', errorMessage);
        }
        
        // No lanzar el error - permitir que el flujo continúe
        return null;
    }
};

const deleteRowInSheet = async (rowIndex, rangeName = 'reservas') => {
    try {
        console.log(`🗑️ Eliminando fila ${rowIndex} de la hoja: "${rangeName}"`);
        const authClient = await getAuth();
        const spreadsheetId = SPREADSHEET_ID;
        
        // Obtener el sheetId de la hoja por nombre
        const spreadsheet = await sheets.spreadsheets.get({
            auth: authClient,
            spreadsheetId,
        });
        
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === rangeName);
        if (!sheet) {
            throw new Error(`No se encontró la hoja "${rangeName}"`);
        }
        
        const sheetId = sheet.properties.sheetId;
        
        // Para eliminar una fila, necesitamos usar batchUpdate
        // rowIndex es 0-based desde nuestro código, pero Sheets espera 0-based también
        await sheets.spreadsheets.batchUpdate({
            auth: authClient,
            spreadsheetId,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex,
                            endIndex: rowIndex + 1
                        }
                    }
                }]
            }
        });
        
        console.log(`✅ Fila eliminada correctamente`);
        return 'Fila eliminada correctamente';
    } catch (error) {
        const errorMessage = error?.message || error?.error_description || 'Error desconocido';
        
        if (errorMessage.includes('Invalid JWT') || errorMessage.includes('invalid_grant')) {
            console.warn('⚠️ Google Sheets no está configurado. No se puede eliminar.');
        } else {
            console.error('Error eliminando fila en Google Sheets:', errorMessage);
        }
        
        // No lanzar el error - permitir que el flujo continúe
        return null;
    }
};

export default appendToSheet;
export { readSheet, updateRowInSheet, deleteRowInSheet };