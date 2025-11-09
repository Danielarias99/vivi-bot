// Script de diagnóstico para verificar acceso a Google Calendar
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const calendar = google.calendar('v3');

async function testCalendarAccess() {
    try {
        console.log('🔍 Probando acceso a Google Calendar...\n');
        
        // Autenticar
        let authConfig;
        let clientEmail;
        
        // Intentar leer desde archivo local primero
        const credentialsPath = path.join(process.cwd(), 'src/credentials', 'credentials.json');
        
        if (fs.existsSync(credentialsPath)) {
            console.log('🔑 Usando credenciales del archivo local');
            const credentialsRaw = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            clientEmail = credentialsRaw.client_email;
            
            console.log('📧 Service Account Email:', clientEmail);
            console.log('');
            
            authConfig = {
                keyFile: credentialsPath,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/calendar'
                ]
            };
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
            console.log('🔑 Usando credenciales de variable de entorno');
            const credentialsRaw = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
            const credentials = {
                ...credentialsRaw,
                private_key: credentialsRaw.private_key.replace(/\\n/g, '\n')
            };
            clientEmail = credentials.client_email;
            
            console.log('📧 Service Account Email:', clientEmail);
            console.log('');
            
            authConfig = {
                credentials: credentials,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/calendar'
                ]
            };
        } else {
            console.log('❌ No se encontraron credenciales (ni archivo ni variable de entorno)');
            process.exit(1);
        }
        
        const auth = new google.auth.GoogleAuth(authConfig);
        const authClient = await auth.getClient();
        
        console.log('✅ Autenticación exitosa\n');
        
        // Listar calendarios accesibles
        console.log('📅 Listando calendarios accesibles:\n');
        
        try {
            const calendarList = await calendar.calendarList.list({
                auth: authClient
            });
            
            if (calendarList.data.items && calendarList.data.items.length > 0) {
                console.log(`✅ Se encontraron ${calendarList.data.items.length} calendario(s):\n`);
                
                calendarList.data.items.forEach((cal, index) => {
                    console.log(`${index + 1}. ${cal.summary}`);
                    console.log(`   ID: ${cal.id}`);
                    console.log(`   Acceso: ${cal.accessRole}`);
                    console.log('');
                });
                
                console.log('\n📝 INSTRUCCIONES:');
                console.log('1. Copia el ID del calendario que quieres usar (ejemplo: tu-email@gmail.com)');
                console.log('2. En Railway, agrega la variable de entorno:');
                console.log('   GOOGLE_CALENDAR_ID = [el ID que copiaste]');
                console.log('\n3. Si NO aparece ningún calendario aquí, necesitas:');
                console.log('   a) Ir a Google Calendar (calendar.google.com)');
                console.log('   b) Clic en ⚙️ del calendario → "Settings and sharing"');
                console.log('   c) En "Share with specific people", agregar el email:');
                console.log(`      ${clientEmail}`);
                console.log('   d) Dar permisos de "Make changes to events"');
                
            } else {
                console.log('⚠️ No se encontraron calendarios accesibles para este Service Account\n');
                console.log('📝 SOLUCIÓN:');
                console.log('1. Ve a Google Calendar (calendar.google.com) con la cuenta de la psicóloga');
                console.log('2. Haz clic en ⚙️ junto al calendario que quieres usar');
                console.log('3. Ve a "Settings and sharing"');
                console.log('4. En "Share with specific people", agrega este email:');
                console.log(`   ${clientEmail}`);
                console.log('5. Dale permisos de "Make changes to events"');
                console.log('6. Guarda y vuelve a ejecutar este script\n');
            }
        } catch (listError) {
            console.error('❌ Error listando calendarios:', listError.message);
            
            if (listError.code === 403) {
                console.log('\n⚠️ Error de permisos. El Service Account no tiene acceso a Calendar API.');
                console.log('Verifica que Calendar API esté habilitada en Google Cloud Console.');
            }
        }
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
    }
}

testCalendarAccess();

