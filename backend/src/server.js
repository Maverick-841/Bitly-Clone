const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const urlRoutes = require('./routes/urlRoutes');
const redirectService = require('./services/redirectService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost' }));
app.use(express.json());

// Global Rate Limiter
const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after a minute',
});
app.use(globalLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/urls', urlRoutes);

// Redirect Route (Catch-All for short lines that don't match APIs)
app.get('/:shortCode', redirectService.handleRedirect);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
