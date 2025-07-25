const { v4: uuidv4 } = require('uuid');

// In-memory session storage (pre produkciu použiť Redis)
const sessions = new Map();

// Session konfigurácia
const SESSION_CONFIG = {
    maxAge: 24 * 60 * 60 * 1000, // 24 hodín
    cleanupInterval: 60 * 60 * 1000, // Cleanup každú hodinu
    cookieName: 'oracle-voice-session'
};

// Cleanup expired sessions
setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.lastAccess > SESSION_CONFIG.maxAge) {
            sessions.delete(sessionId);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
}, SESSION_CONFIG.cleanupInterval);

// Session middleware
function sessionMiddleware(req, res, next) {
    // Získanie session ID z cookie alebo header
    let sessionId = req.headers['x-session-id'] || 
                   req.cookies?.[SESSION_CONFIG.cookieName] ||
                   req.query.sessionId;
    
    // Vytvorenie novej session ak neexistuje
    if (!sessionId || !sessions.has(sessionId)) {
        sessionId = uuidv4();
        
        // Vytvorenie novej session
        sessions.set(sessionId, {
            id: sessionId,
            createdAt: Date.now(),
            lastAccess: Date.now(),
            data: {},
            // Voice chat specific data
            conversationHistory: [],
            voiceSettings: {
                language: 'sk-SK',
                voice: 'default',
                speed: 1.0
            },
            metrics: {
                requestCount: 0,
                totalAudioDuration: 0,
                lastActivity: Date.now()
            }
        });
        
        console.log(`🆕 Created new session: ${sessionId}`);
    }
    
    // Získanie session
    const session = sessions.get(sessionId);
    
    // Aktualizácia last access
    session.lastAccess = Date.now();
    session.metrics.lastActivity = Date.now();
    session.metrics.requestCount++;
    
    // Pridanie session do request objektu
    req.session = session;
    req.sessionId = sessionId;
    
    // Nastavenie session ID do response headers
    res.setHeader('X-Session-ID', sessionId);
    
    // Nastavenie cookie (ak je podporované)
    if (res.cookie) {
        res.cookie(SESSION_CONFIG.cookieName, sessionId, {
            maxAge: SESSION_CONFIG.maxAge,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
    }
    
    // Helper funkcie pre session
    req.session.save = function() {
        sessions.set(sessionId, this);
    };
    
    req.session.destroy = function() {
        sessions.delete(sessionId);
    };
    
    req.session.addToHistory = function(type, content) {
        this.conversationHistory.push({
            type,
            content,
            timestamp: Date.now()
        });
        
        // Limit history to last 50 entries
        if (this.conversationHistory.length > 50) {
            this.conversationHistory = this.conversationHistory.slice(-50);
        }
        
        this.save();
    };
    
    req.session.updateVoiceSettings = function(settings) {
        this.voiceSettings = { ...this.voiceSettings, ...settings };
        this.save();
    };
    
    req.session.updateMetrics = function(metrics) {
        this.metrics = { ...this.metrics, ...metrics };
        this.save();
    };
    
    next();
}

// Export session stats
function getSessionStats() {
    const now = Date.now();
    const stats = {
        totalSessions: sessions.size,
        activeSessions: 0,
        oldestSession: null,
        newestSession: null,
        totalRequests: 0,
        totalAudioDuration: 0
    };
    
    let oldestTime = Infinity;
    let newestTime = 0;
    
    for (const session of sessions.values()) {
        // Active sessions (accessed in last 5 minutes)
        if (now - session.lastAccess < 5 * 60 * 1000) {
            stats.activeSessions++;
        }
        
        // Oldest/newest sessions
        if (session.createdAt < oldestTime) {
            oldestTime = session.createdAt;
            stats.oldestSession = new Date(session.createdAt).toISOString();
        }
        
        if (session.createdAt > newestTime) {
            newestTime = session.createdAt;
            stats.newestSession = new Date(session.createdAt).toISOString();
        }
        
        // Aggregate metrics
        stats.totalRequests += session.metrics.requestCount;
        stats.totalAudioDuration += session.metrics.totalAudioDuration || 0;
    }
    
    return stats;
}

// Export session by ID (pre debugging)
function getSession(sessionId) {
    return sessions.get(sessionId);
}

// Export all sessions (pre debugging)
function getAllSessions() {
    return Array.from(sessions.values());
}

module.exports = {
    sessionMiddleware,
    getSessionStats,
    getSession,
    getAllSessions,
    SESSION_CONFIG
};
