const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { Bonjour } = require('bonjour-service');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const peerId = uuidv4();
const serviceName = `P2P-FileShare-${peerId.substring(0, 8)}`;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from client build (for production)
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// Store discovered peers
const discoveredPeers = new Map();
const connectedClients = new Set();
const clientSockets = new Map(); // Map socket.id to socket for targeted messaging

// mDNS Service Discovery
const bonjourInstance = new Bonjour();

// Publish our service
const service = bonjourInstance.publish({
  name: serviceName,
  type: 'p2pshare',
  port: PORT,
  txt: {
    peerId: peerId,
    version: '1.0.0'
  }
});

console.log(`🚀 Server started with Peer ID: ${peerId}`);
console.log(`📡 Broadcasting service: ${serviceName}`);

// Listen for other peers on the network
const browser = bonjourInstance.find({ type: 'p2pshare' }, (peer) => {
  if (peer.name !== serviceName) {
    console.log(`🔍 Discovered peer: ${peer.name} (${peer.host}:${peer.port})`);
    discoveredPeers.set(peer.name, {
      id: peer.txt?.peerId || peer.name,
      name: peer.name,
      host: peer.host,
      port: peer.port,
      lastSeen: Date.now()
    });
    
    // Notify all connected clients about the new peer
    io.emit('peer-discovered', {
      id: peer.txt?.peerId || peer.name,
      name: peer.name,
      host: peer.host,
      port: peer.port
    });
  }
});

// Also listen for service up events
browser.on('up', (peer) => {
  if (peer.name !== serviceName) {
    console.log(`🔍 Service up: ${peer.name} (${peer.host}:${peer.port})`);
    discoveredPeers.set(peer.name, {
      id: peer.txt?.peerId || peer.name,
      name: peer.name,
      host: peer.host,
      port: peer.port,
      lastSeen: Date.now()
    });
    
    // Notify all connected clients about the new peer
    io.emit('peer-discovered', {
      id: peer.txt?.peerId || peer.name,
      name: peer.name,
      host: peer.host,
      port: peer.port
    });
  }
});

// Clean up old peers (remove if not seen for 30 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [name, peer] of discoveredPeers.entries()) {
    if (now - peer.lastSeen > 30000) {
      console.log(`⏰ Removing stale peer: ${name}`);
      discoveredPeers.delete(name);
      io.emit('peer-lost', { name });
    }
  }
}, 10000);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`👤 Client connected: ${socket.id}`);
  connectedClients.add(socket.id);
  clientSockets.set(socket.id, socket);
  
  // Send current peer list to newly connected client
  socket.emit('peer-list', Array.from(discoveredPeers.values()));
  
  // Handle WebRTC signaling
  socket.on('webrtc-signal', (data) => {
    try {
      // Validate data structure
      if (!data || !data.type) {
        console.error('Invalid WebRTC signal data:', data)
        return
      }
      
      // If 'to' is specified, send to specific peer, otherwise broadcast
      if (data.to) {
        const targetSocket = clientSockets.get(data.to)
        if (targetSocket) {
          targetSocket.emit('webrtc-signal', {
            ...data,
            from: socket.id
          });
        } else {
          console.error(`Target peer ${data.to} not found`)
        }
      } else {
        // Fallback to broadcast for backward compatibility
        socket.broadcast.emit('webrtc-signal', {
          ...data,
          from: socket.id
        });
      }
    } catch (error) {
      console.error('Error handling WebRTC signal:', error)
    }
  });
  
  // Handle file transfer request
  socket.on('file-transfer-request', (data) => {
    try {
      if (!data || !data.fileName || !data.fileSize) {
        console.error('Invalid file transfer request:', data)
        return
      }
      
      console.log(`📁 File transfer request: ${data.fileName} (${data.fileSize} bytes)`);
      
      // If 'to' is specified, send to specific peer, otherwise broadcast
      if (data.to) {
        const targetSocket = clientSockets.get(data.to)
        if (targetSocket) {
          targetSocket.emit('file-transfer-request', {
            ...data,
            from: socket.id
          });
        } else {
          console.error(`Target peer ${data.to} not found for file transfer request`)
        }
      } else {
        socket.broadcast.emit('file-transfer-request', {
          ...data,
          from: socket.id
        });
      }
    } catch (error) {
      console.error('Error handling file transfer request:', error)
    }
  });
  
  // Handle file transfer response
  socket.on('file-transfer-response', (data) => {
    try {
      if (!data || typeof data.accepted !== 'boolean') {
        console.error('Invalid file transfer response:', data)
        return
      }
      
      // If 'to' is specified, send to specific peer, otherwise broadcast
      if (data.to) {
        const targetSocket = clientSockets.get(data.to)
        if (targetSocket) {
          targetSocket.emit('file-transfer-response', {
            ...data,
            from: socket.id
          });
        } else {
          console.error(`Target peer ${data.to} not found for file transfer response`)
        }
      } else {
        socket.broadcast.emit('file-transfer-response', {
          ...data,
          from: socket.id
        });
      }
    } catch (error) {
      console.error('Error handling file transfer response:', error)
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`👋 Client disconnected: ${socket.id}`);
    connectedClients.delete(socket.id);
    clientSockets.delete(socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    peerId: peerId,
    connectedClients: connectedClients.size,
    discoveredPeers: discoveredPeers.size
  });
});

// Serve React app for all other routes (for production)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

server.listen(PORT, () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`🔍 Looking for other peers on the network...`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  service.stop();
  browser.stop();
  bonjourInstance.destroy();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
