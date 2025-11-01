import dotenv from 'dotenv';

dotenv.config();

const config = {
  WEBHOOK_VERIFY_TOKEN: process.env.WEBHOOK_VERIFY_TOKEN,
  API_TOKEN: process.env.API_TOKEN,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  API_VERSION: process.env.API_VERSION,
  PORT: process.env.PORT || 3000,
  BASE_URL: process.env.BASE_URL,
};

// Debug: Log the verify token on startup (only first few chars for security)
if (config.WEBHOOK_VERIFY_TOKEN) {
  console.log(`🔐 WEBHOOK_VERIFY_TOKEN cargado: ${config.WEBHOOK_VERIFY_TOKEN.substring(0, 3)}...`);
} else {
  console.warn('⚠️ WEBHOOK_VERIFY_TOKEN no está definido');
}

export default config;

// Simple validation on startup (logs only)
const missing = [];
if (!process.env.WEBHOOK_VERIFY_TOKEN) missing.push('WEBHOOK_VERIFY_TOKEN');
if (!process.env.API_TOKEN) missing.push('API_TOKEN');
if (!process.env.BUSINESS_PHONE) missing.push('BUSINESS_PHONE');
if (!process.env.API_VERSION) missing.push('API_VERSION');
if (!process.env.BASE_URL) missing.push('BASE_URL');

if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(`Faltan variables de entorno: ${missing.join(', ')}`);
}