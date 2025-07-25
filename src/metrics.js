const express = require('express');
const router = express.Router();
const { getSessionStats } = require('../middleware/session');

// System metrics
let systemMetrics = {
    startTime: Date.now(),
    requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byEndpoint: {}
    },
    deepgram: {
        requests: 0,
        totalDuration: 0,
        mockMode: true
    },
    tts: {
        requests: 0,
        totalCharacters: 0,
        developmentMode: true
    },
    websocket: {
        connections: 0,
        activeConnections: 0,
        messagesReceived: 0,
        messagesSent: 0
    }
};

// Middleware na tracking requestov
function trackRequest(endpoint) {
    return (req, res, next) => {
        systemMetrics.requests.total++;
        
        if (!systemMetrics.requests.byEndpoint[endpoint]) {
            systemMetrics.requests.byEndpoint[endpoint] = 0;
        }
        systemMetrics.requests.byEndpoint[endpoint]++;
        
        // Track response
        const originalSend = res.send;
        res.send = function(data) {
            if (res.statusCode >= 200 && res.statusCode < 400) {
                systemMetrics.requests.successful++;
            } else {
                systemMetrics.requests.failed++;
            }
            originalSend.call(this, data);
        };
        
        next();
    };
}

// GET /api/metrics
router.get('/', (req, res) => {
    const sessionStats = getSessionStats();
    const uptime = Date.now() - systemMetrics.startTime;
    
    const metrics = {
        system: {
            uptime: uptime,
            uptimeFormatted: formatUptime(uptime),
            startTime: new Date(systemMetrics.startTime).toISOString(),
            currentTime: new Date().toISOString(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        },
        requests: systemMetrics.requests,
        sessions: sessionStats,
        deepgram: systemMetrics.deepgram,
        tts: systemMetrics.tts,
        websocket: systemMetrics.websocket,
        memory: process.memoryUsage(),
        performance: {
            requestsPerSecond: systemMetrics.requests.total / (uptime / 1000),
            successRate: systemMetrics.requests.total > 0 
                ? (systemMetrics.requests.successful / systemMetrics.requests.total * 100).toFixed(2) + '%'
                : '0%',
            averageSessionDuration: sessionStats.totalSessions > 0
                ? Math.round((uptime / sessionStats.totalSessions) / 1000 / 60) + ' minutes'
                : '0 minutes'
        }
    };
    
    res.json(metrics);
});

// GET /api/metrics/health
router.get('/health', (req, res) => {
    const uptime = Date.now() - systemMetrics.startTime;
    const memoryUsage = process.memoryUsage();
    const sessionStats = getSessionStats();
    
    const health = {
        status: 'healthy',
        uptime: formatUptime(uptime),
        memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
            percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100) + '%'
        },
        sessions: {
            total: sessionStats.totalSessions,
            active: sessionStats.activeSessions
        },
        services: {
            deepgram: systemMetrics.deepgram.mockMode ? 'mock' : 'production',
            tts: systemMetrics.tts.developmentMode ? 'development' : 'production',
            websocket: 'operational'
        }
    };
    
    res.json(health);
});

// POST /api/metrics/track
router.post('/track', (req, res) => {
    const { service, action, data } = req.body;
    
    try {
        switch (service) {
            case 'deepgram':
                systemMetrics.deepgram.requests++;
                if (data && data.duration) {
                    systemMetrics.deepgram.totalDuration += data.duration;
                }
                break;
                
            case 'tts':
                systemMetrics.tts.requests++;
                if (data && data.characters) {
                    systemMetrics.tts.totalCharacters += data.characters;
                }
                break;
                
            case 'websocket':
                if (action === 'connect') {
                    systemMetrics.websocket.connections++;
                    systemMetrics.websocket.activeConnections++;
                } else if (action === 'disconnect') {
                    systemMetrics.websocket.activeConnections = Math.max(0, systemMetrics.websocket.activeConnections - 1);
                } else if (action === 'message_received') {
                    systemMetrics.websocket.messagesReceived++;
                } else if (action === 'message_sent') {
                    systemMetrics.websocket.messagesSent++;
                }
                break;
        }
        
        res.json({ success: true, message: 'Metrics tracked' });
        
    } catch (error) {
        console.error('❌ Metrics tracking error:', error);
        res.status(500).json({ error: 'Failed to track metrics' });
    }
});

// GET /api/metrics/reset
router.get('/reset', (req, res) => {
    // Reset metrics (keep start time)
    const startTime = systemMetrics.startTime;
    
    systemMetrics = {
        startTime: startTime,
        requests: {
            total: 0,
            successful: 0,
            failed: 0,
            byEndpoint: {}
        },
        deepgram: {
            requests: 0,
            totalDuration: 0,
            mockMode: true
        },
        tts: {
            requests: 0,
            totalCharacters: 0,
            developmentMode: true
        },
        websocket: {
            connections: 0,
            activeConnections: 0,
            messagesReceived: 0,
            messagesSent: 0
        }
    };
    
    res.json({ success: true, message: 'Metrics reset', timestamp: new Date().toISOString() });
});

// Helper funkcie
function formatUptime(uptime) {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

// Export pre použitie v iných moduloch
module.exports = router;
module.exports.trackRequest = trackRequest;
module.exports.systemMetrics = systemMetrics;
