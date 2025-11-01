import path from 'path';
import { google } from 'googleapis';

const sheets = google.sheets('v4');

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
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(process.cwd(), 'src/credentials', 'credentials.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        return await auth.getClient();
    } catch (error) {
        console.error('Error al autenticar con Google Sheets:', error?.message || error);
        throw error; // Re-lanzar para que sea manejado por el llamador
    }
};

const appendToSheet = async (data, rangeName = 'reservas') => {
    try {
        const authClient = await getAuth();
        const spreadsheetId = '1qt4Adt_muJZf1LXlXjqRUcs5hDf6Zac1wzGiwHeH_Ns'

        await addRowToSheet(authClient, spreadsheetId, rangeName, data);
        return 'Datos correctamente agregados'
    } catch (error) {
        // Manejar errores específicos de autenticación/configuración
        const errorMessage = error?.message || error?.error_description || 'Error desconocido';
        
        if (errorMessage.includes('Invalid JWT') || errorMessage.includes('invalid_grant')) {
            console.warn('⚠️ Google Sheets no está configurado correctamente. Las credenciales son inválidas o no están disponibles.');
            console.warn('El bot continuará funcionando normalmente sin guardar en Sheets.');
        } else {
            console.error('Error en appendToSheet:', errorMessage);
        }
        
        // No lanzar el error - devolver null para indicar que falló pero no crashear
        return null;
    }
}

const readSheet = async (rangeName = 'reservas') => {
    try {
        const authClient = await getAuth();
        const spreadsheetId = '1qt4Adt_muJZf1LXlXjqRUcs5hDf6Zac1wzGiwHeH_Ns';
        
        const response = await sheets.spreadsheets.values.get({
            auth: authClient,
            spreadsheetId,
            range: rangeName,
        });

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
        const authClient = await getAuth();
        const spreadsheetId = '1qt4Adt_muJZf1LXlXjqRUcs5hDf6Zac1wzGiwHeH_Ns';
        
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
        const authClient = await getAuth();
        const spreadsheetId = '1qt4Adt_muJZf1LXlXjqRUcs5hDf6Zac1wzGiwHeH_Ns';
        
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