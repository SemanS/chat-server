const express = require('express');
const OpenAI = require('openai');
const { trackMetric } = require('./metrics');
const router = express.Router();

// Initialize OpenAI client (only if API key is available)
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'mock') {
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
}

// Chat configuration
const CHAT_CONFIG = {
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 500,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
    systemPrompt: process.env.OPENAI_SYSTEM_PROMPT || 
        'Si užitočný AI asistent. Odpovedaj v slovenčine, buď stručný a priateľský. Ak dostaneš otázku v inom jazyku, odpovedaj v tom istom jazyku.',
};

// Store conversation history (in production, use Redis or database)
const conversationHistory = new Map();

// Clean old conversations (simple cleanup)
setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    for (const [sessionId, session] of conversationHistory.entries()) {
        if (now - session.lastActivity > maxAge) {
            conversationHistory.delete(sessionId);
            console.log(`🧹 Cleaned old conversation: ${sessionId}`);
        }
    }
}, 5 * 60 * 1000); // Run every 5 minutes

// Get or create conversation session
function getConversationSession(sessionId) {
    if (!conversationHistory.has(sessionId)) {
        conversationHistory.set(sessionId, {
            messages: [
                {
                    role: 'system',
                    content: CHAT_CONFIG.systemPrompt
                }
            ],
            lastActivity: Date.now(),
            messageCount: 0
        });
    }
    
    const session = conversationHistory.get(sessionId);
    session.lastActivity = Date.now();
    return session;
}

// POST /api/chat - Chat with AI
router.post('/', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { message, sessionId = 'default' } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                error: 'Invalid message',
                message: 'Message parameter is required and must be a string'
            });
        }
        
        if (message.length > 2000) {
            return res.status(400).json({
                error: 'Message too long',
                message: 'Message must be less than 2000 characters'
            });
        }
        
        console.log(`💬 Chat request from session ${sessionId}: "${message}"`);
        
        // Check if we're in mock mode
        if (!openai) {
            console.log('🧪 Using mock OpenAI response');
            
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const mockResponses = [
                'Ďakujem za vašu správu! Toto je mock odpoveď, pretože OpenAI API kľúč nie je nastavený.',
                'Rozumiem vašej otázke. V mock režime nemôžem poskytnúť skutočnú AI odpoveď.',
                'Toto je simulovaná odpoveď. Pre skutočnú AI konverzáciu nastavte OPENAI_API_KEY.',
                'Mock režim je aktívny. Vaša správa bola prijatá, ale odpoveď je simulovaná.',
            ];
            
            const mockResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
            
            // Track metrics
            const duration = Date.now() - startTime;
            trackMetric('openai', 'chat', { duration, mock: true, messageLength: message.length });
            
            return res.json({
                response: mockResponse,
                sessionId: sessionId,
                model: 'mock',
                duration: duration,
                mock: true,
                timestamp: new Date().toISOString()
            });
        }
        
        // Get conversation session
        const session = getConversationSession(sessionId);
        
        // Add user message to conversation
        session.messages.push({
            role: 'user',
            content: message
        });
        session.messageCount++;
        
        // Limit conversation history (keep last 20 messages + system prompt)
        if (session.messages.length > 21) {
            session.messages = [
                session.messages[0], // Keep system prompt
                ...session.messages.slice(-20) // Keep last 20 messages
            ];
        }
        
        console.log(`🤖 Sending ${session.messages.length} messages to OpenAI (${CHAT_CONFIG.model})`);
        
        // Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: CHAT_CONFIG.model,
            messages: session.messages,
            max_tokens: CHAT_CONFIG.maxTokens,
            temperature: CHAT_CONFIG.temperature,
            stream: false
        });
        
        const aiResponse = completion.choices[0]?.message?.content || 'Prepáčte, nepodarilo sa mi vygenerovať odpoveď.';
        
        // Add AI response to conversation
        session.messages.push({
            role: 'assistant',
            content: aiResponse
        });
        
        console.log(`🤖 OpenAI response: "${aiResponse}"`);
        
        // Track metrics
        const duration = Date.now() - startTime;
        trackMetric('openai', 'chat', { 
            duration, 
            messageLength: message.length,
            responseLength: aiResponse.length,
            tokensUsed: completion.usage?.total_tokens || 0,
            model: CHAT_CONFIG.model,
            sessionId
        });
        
        res.json({
            response: aiResponse,
            sessionId: sessionId,
            model: CHAT_CONFIG.model,
            tokensUsed: completion.usage?.total_tokens || 0,
            duration: duration,
            messageCount: session.messageCount,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ OpenAI chat error:', error);
        
        const duration = Date.now() - startTime;
        trackMetric('openai', 'error', { duration, error: error.message });
        
        // Handle specific OpenAI errors
        let errorMessage = 'Chat request failed';
        let statusCode = 500;
        
        if (error.code === 'insufficient_quota') {
            errorMessage = 'OpenAI API quota exceeded';
            statusCode = 429;
        } else if (error.code === 'invalid_api_key') {
            errorMessage = 'Invalid OpenAI API key';
            statusCode = 401;
        } else if (error.code === 'model_not_found') {
            errorMessage = 'Requested model not available';
            statusCode = 400;
        }
        
        res.status(statusCode).json({
            error: errorMessage,
            message: error.message,
            code: error.code,
            duration: duration,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/chat/models - Available models
router.get('/models', (req, res) => {
    const availableModels = [
        {
            id: 'gpt-4',
            name: 'GPT-4',
            description: 'Most capable model, best for complex tasks',
            maxTokens: 8192,
            recommended: true
        },
        {
            id: 'gpt-4-turbo-preview',
            name: 'GPT-4 Turbo',
            description: 'Faster and cheaper than GPT-4',
            maxTokens: 128000,
            recommended: false
        },
        {
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            description: 'Fast and efficient for most tasks',
            maxTokens: 4096,
            recommended: false
        }
    ];

    res.json({
        models: availableModels,
        current: CHAT_CONFIG.model,
        timestamp: new Date().toISOString()
    });
});

// GET /api/chat/status - Service status
router.get('/status', (req, res) => {
    const isConfigured = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'mock';
    
    res.json({
        status: isConfigured ? 'operational' : 'mock',
        configured: isConfigured,
        apiKey: isConfigured ? 'configured' : 'missing',
        mockMode: !isConfigured,
        model: CHAT_CONFIG.model,
        activeConversations: conversationHistory.size,
        timestamp: new Date().toISOString()
    });
});

// DELETE /api/chat/session/:sessionId - Clear conversation history
router.delete('/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    if (conversationHistory.has(sessionId)) {
        conversationHistory.delete(sessionId);
        console.log(`🗑️ Cleared conversation session: ${sessionId}`);
        
        res.json({
            message: 'Conversation history cleared',
            sessionId: sessionId,
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(404).json({
            error: 'Session not found',
            sessionId: sessionId,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
