const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
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

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../client/dist')));

// Room management
const rooms = new Map(); // Map roomCode to room data
const connectedClients = new Set();
const clientSockets = new Map(); // Map socket.id to socket for targeted messaging

// Generate a 6-digit room code
const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Room data structure
const createRoom = (socketId, isSender = true) => {
  const roomCode = generateRoomCode();
  const room = {
    code: roomCode,
    sender: isSender ? socketId : null,
    receiver: isSender ? null : socketId,
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
  rooms.set(roomCode, room);
  return room;
};

// Clean up old rooms (remove if inactive for 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > 600000) { // 10 minutes
      console.log(`⏰ Removing inactive room: ${code}`);
      rooms.delete(code);
    }
  }
}, 60000); // Check every minute

console.log(`🚀 Server started on port ${PORT}`);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`👤 Client connected: ${socket.id}`);
  connectedClients.add(socket.id);
  clientSockets.set(socket.id, socket);
  
  // Handle room creation (sender)
  socket.on('create-room', (data, callback) => {
    try {
      const room = createRoom(socket.id, true);
      console.log(`🏠 Room created: ${room.code} by ${socket.id}`);
      socket.join(room.code);
      socket.roomCode = room.code;
      socket.role = 'sender';
      room.lastActivity = Date.now();
      
      // Emit room created event
      socket.emit('room-created', { roomCode: room.code });
      
      // Call callback if provided
      if (typeof callback === 'function') {
        callback({ success: true, roomCode: room.code });
      }
    } catch (error) {
      console.error('Error creating room:', error);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to create room' });
      }
    }
  });
  
  // Handle room joining (receiver)
  socket.on('join-room', (data, callback) => {
    try {
      const { roomCode } = data;
      if (!roomCode || !rooms.has(roomCode)) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Room not found' });
        }
        return;
      }
      
      const room = rooms.get(roomCode);
      if (room.receiver) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Room is full' });
        }
        return;
      }
      
      room.receiver = socket.id;
      room.lastActivity = Date.now();
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.role = 'receiver';
      
      console.log(`🚪 User ${socket.id} joined room ${roomCode}`);
      
      // Emit room joined event
      socket.emit('room-joined', { roomCode });
      
      // Notify sender that receiver joined
      const senderSocket = clientSockets.get(room.sender);
      if (senderSocket) {
        senderSocket.emit('receiver-joined', { roomCode });
      }
      
      if (typeof callback === 'function') {
        callback({ success: true, roomCode });
      }
    } catch (error) {
      console.error('Error joining room:', error);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to join room' });
      }
    }
  });
  
  // Handle WebRTC signaling within rooms
  socket.on('webrtc-signal', (data) => {
    try {
      if (!data || !data.type || !socket.roomCode) {
        console.error('Invalid WebRTC signal data:', data);
        return;
      }
      
      // Send to all other clients in the same room
      socket.to(socket.roomCode).emit('webrtc-signal', {
        ...data,
        from: socket.id
      });
    } catch (error) {
      console.error('Error handling WebRTC signal:', error);
    }
  });
  
  // Handle file transfer request within rooms
  socket.on('file-transfer-request', (data) => {
    try {
      if (!data || !data.fileName || !data.fileSize || !socket.roomCode) {
        console.error('Invalid file transfer request:', data);
        return;
      }
      
      // Validate file size (500MB limit)
      const maxSize = 500 * 1024 * 1024;
      if (data.fileSize > maxSize) {
        console.error('File too large:', data.fileSize, 'bytes');
        socket.emit('file-transfer-error', { error: 'File too large (max 500MB)' });
        return;
      }
      
      // Validate file name
      if (data.fileName.length > 255) {
        console.error('File name too long:', data.fileName.length);
        socket.emit('file-transfer-error', { error: 'File name too long' });
        return;
      }
      
      console.log(`📁 File transfer request in room ${socket.roomCode}: ${data.fileName} (${data.fileSize} bytes)`);
      
      // Send to all other clients in the same room
      socket.to(socket.roomCode).emit('file-transfer-request', {
        ...data,
        from: socket.id
      });
      
      // Update room activity
      const room = rooms.get(socket.roomCode);
      if (room) {
        room.lastActivity = Date.now();
      }
    } catch (error) {
      console.error('Error handling file transfer request:', error);
      socket.emit('file-transfer-error', { error: 'Server error processing file transfer request' });
    }
  });
  
  // Handle file transfer response within rooms
  socket.on('file-transfer-response', (data) => {
    try {
      if (!data || typeof data.accepted !== 'boolean' || !socket.roomCode) {
        console.error('Invalid file transfer response:', data);
        return;
      }
      
      // Send to all other clients in the same room
      socket.to(socket.roomCode).emit('file-transfer-response', {
        ...data,
        from: socket.id
      });
      
      // Update room activity
      const room = rooms.get(socket.roomCode);
      if (room) {
        room.lastActivity = Date.now();
      }
    } catch (error) {
      console.error('Error handling file transfer response:', error);
    }
  });
  
  // Handle room leave
  socket.on('leave-room', () => {
    if (socket.roomCode) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        if (socket.role === 'sender') {
          room.sender = null;
          // Notify receiver that sender left
          socket.to(socket.roomCode).emit('sender-left');
        } else if (socket.role === 'receiver') {
          room.receiver = null;
          // Notify sender that receiver left
          socket.to(socket.roomCode).emit('receiver-left');
        }
        
        // If room is empty, remove it
        if (!room.sender && !room.receiver) {
          rooms.delete(socket.roomCode);
          console.log(`🗑️ Room ${socket.roomCode} removed (empty)`);
        }
      }
      
      socket.leave(socket.roomCode);
      socket.roomCode = null;
      socket.role = null;
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`👋 Client disconnected: ${socket.id}`);
    connectedClients.delete(socket.id);
    clientSockets.delete(socket.id);
    
    // Handle room cleanup on disconnect
    if (socket.roomCode) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        if (socket.role === 'sender') {
          room.sender = null;
          // Notify receiver that sender left
          socket.to(socket.roomCode).emit('sender-left');
        } else if (socket.role === 'receiver') {
          room.receiver = null;
          // Notify sender that receiver left
          socket.to(socket.roomCode).emit('receiver-left');
        }
        
        // If room is empty, remove it
        if (!room.sender && !room.receiver) {
          rooms.delete(socket.roomCode);
          console.log(`🗑️ Room ${socket.roomCode} removed (empty)`);
        }
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connectedClients: connectedClients.size,
    activeRooms: rooms.size
  });
});

// Serve test files
app.get('/test-file-transfer.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../test-file-transfer.html'));
});

app.get('/debug-test.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../debug-test.html'));
});

app.get('/simple-file-transfer.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../simple-file-transfer.html'));
});

app.get('/working-test.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../working-test.html'));
});

app.get('/bare-bones-test.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../bare-bones-test.html'));
});

// Serve React app for all other routes (for production)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../client/dist/index.html');
  const fs = require('fs');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send(`
      <html>
        <head><title>Build Error</title></head>
        <body>
          <h1>Build Error</h1>
          <p>Client build files not found. Please check the build process.</p>
          <p>Expected: ${indexPath}</p>
          <p>Current directory: ${__dirname}</p>
        </body>
      </html>
    `);
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`🏠 Room-based file sharing ready`);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit in production, log and continue
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production, log and continue
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
