const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

app.get('/health', (req, res) => {
    console.log('Health check requested');
    res.status(200).send('OK');
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Minimal server running on port ${PORT}`);
});
