import express from 'express';
import cron from 'node-cron';
import config from './config/env.js';
import webhookRoutes from './routes/webhookRoutes.js';
import appointmentReminderService from './services/appointmentReminderService.js';

const app = express();
app.use(express.json());


// Manejar errores no capturados para evitar crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
  // No crashear el servidor, solo loggear el error
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
  // No crashear el servidor, solo loggear el error
});

app.use('/', webhookRoutes);

app.get('/', (req, res) => {
  res.send(`<pre>Nothing to see here.
Checkout README.md to start.</pre>`);
});

app.listen(config.PORT, () => {
  console.log(`Server is listening on port:  ${config.PORT}`);
  
  // Configurar scheduler para recordatorios de citas
  // Ejecutar cada hora a los 0 minutos (ej: 1:00, 2:00, 3:00, etc.)
  cron.schedule('0 * * * *', async () => {
    console.log('⏰ Ejecutando verificación de recordatorios de citas...');
    try {
      await appointmentReminderService.sendAppointmentReminders();
    } catch (error) {
      console.error('❌ Error en scheduler de recordatorios:', error.message || error);
    }
  }, {
    scheduled: true,
    timezone: "America/Bogota" // Zona horaria de Colombia
  });
  
  console.log('✅ Scheduler de recordatorios configurado (cada hora)');
  
  // Ejecutar una vez al iniciar el servidor (opcional, para testing)
  // Descomentar si quieres probar inmediatamente
  // appointmentReminderService.sendAppointmentReminders();
});