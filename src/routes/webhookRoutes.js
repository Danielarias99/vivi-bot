import express from 'express';
import webhookController from '../controllers/webhookController.js';

const router = express.Router();

// Bind methods to preserve 'this' context
router.post('/webhook', webhookController.handleIncoming.bind(webhookController));
router.get('/webhook', webhookController.verifyWebhook.bind(webhookController));

export default router;