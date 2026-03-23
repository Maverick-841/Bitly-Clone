const express = require('express');
const router = express.Router();
const urlController = require('../controllers/urlController');
const authMiddleware = require('../middleware/authMiddleware');

// User authentication required for these
router.post('/shorten', authMiddleware, urlController.shortenUrl);
router.get('/', authMiddleware, urlController.getUserUrls);
router.get('/stats/overview', authMiddleware, urlController.getDashboardStats);
router.get('/:id/analytics', authMiddleware, urlController.getAnalytics);
router.get('/:id/export', authMiddleware, urlController.exportAnalytics);
router.post('/:id/verify-password', urlController.verifyPassword);
router.delete('/:id', authMiddleware, urlController.deleteUrl);

module.exports = router;
