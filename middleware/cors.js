const cors = require('cors');

// CORS konfigurácia pre Oracle Voice Chat Backend
const corsOptions = {
    origin: function (origin, callback) {
        // Povolené origins
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:8000',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8000',
            'https://oracle-voice-chat.pages.dev',
            'https://c61dff04.oracle-voice-chat.pages.dev',
            'https://486b3cdb.oracle-voice-chat.pages.dev',
            'https://voice-chat.vocabu.io',
            'https://chat.hotovo.ai',
            'https://voice-chat.hotovo.ai',
            // Cloudflare Pages preview URLs
            /^https:\/\/[a-z0-9-]+\.oracle-voice-chat\.pages\.dev$/,
            // Development
            /^http:\/\/localhost:\d+$/,
            /^http:\/\/127\.0\.0\.1:\d+$/
        ];
        
        // Povoliť requesty bez origin (napr. mobile apps, Postman)
        if (!origin) {
            return callback(null, true);
        }
        
        // Kontrola či origin je povolený
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (typeof allowedOrigin === 'string') {
                return allowedOrigin === origin;
            } else if (allowedOrigin instanceof RegExp) {
                return allowedOrigin.test(origin);
            }
            return false;
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`🚫 CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'X-Forwarded-For',
        'X-Real-IP'
    ],
    exposedHeaders: [
        'X-Total-Count',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset'
    ],
    maxAge: 86400 // 24 hours
};

// Export CORS middleware
module.exports = cors(corsOptions);

// Export pre testovanie
module.exports.corsOptions = corsOptions;
