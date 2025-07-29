const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Store webhook payloads per session
let payloads = {};

// Middleware to parse JSON and urlencoded bodies
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Webhook endpoint with session id
app.all('/webhook/:id', (req, res) => {
  const sessionId = req.params.id;
  const payload = {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query, // This captures GET parameters
    timestamp: new Date().toISOString(),
  };

  if (!payloads[sessionId]) payloads[sessionId] = [];
  payloads[sessionId].push(payload);

  io.to(sessionId).emit('webhook', payload);
  res.json({ status: 'received', payload });
});

// Endpoint to reset payloads for a session
app.post('/reset/:id', (req, res) => {
  const sessionId = req.params.id;
  payloads[sessionId] = [];
  res.json({ status: 'reset', sessionId });
});

// Socket.IO connection with session id
io.on('connection', (socket) => {
  const sessionId = socket.handshake.query.sessionId;
  if (sessionId) {
    socket.join(sessionId);
    // Send all previous payloads for this session
    socket.emit('init', payloads[sessionId] || []);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});