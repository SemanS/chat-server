const express = require('express');
const app = express();

app.get('/health', (req, res) => {
    console.log('Health check requested');
    res.status(200).send('OK');
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
});
