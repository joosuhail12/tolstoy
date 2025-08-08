const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 8080;

// Enable CORS for all domains (needed for Stainless)
app.use(cors());

// Serve OpenAPI spec
app.get('/openapi.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'openapi.json'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint with info
app.get('/', (req, res) => {
  res.json({
    message: 'Tolstoy OpenAPI Spec Server',
    endpoints: {
      'openapi': '/openapi.json',
      'health': '/health'
    }
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`OpenAPI server running at http://0.0.0.0:${port}`);
  console.log(`OpenAPI spec available at: http://0.0.0.0:${port}/openapi.json`);
});