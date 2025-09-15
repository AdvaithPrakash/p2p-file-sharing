# P2P File Share

A full-stack peer-to-peer file sharing application that works over both the internet (via WebRTC signaling) and locally on LAN (via mDNS/Bonjour device auto-discovery). Built with React + Vite frontend and Node.js + Express backend.

## ✨ Features

- **🌐 WebRTC P2P Transfer** - Direct device-to-device file transfers using WebRTC DataChannels
- **🔍 mDNS Discovery** - Automatic peer discovery on local network using Bonjour/mDNS
- **📱 Modern UI** - Clean, responsive interface built with React and Tailwind CSS
- **⚡ Real-time Signaling** - Socket.IO for WebRTC offer/answer/ICE exchange
- **🔄 Progress Tracking** - Real-time transfer progress and speed monitoring
- **📁 File Management** - Support for any file type with automatic download

## 🏗️ Architecture

### Backend (`/server`)
- **Node.js + Express** - HTTP server and API endpoints
- **Socket.IO** - WebSocket signaling for WebRTC connections
- **Bonjour** - mDNS service discovery for local network peers
- **CORS** - Cross-origin resource sharing support

### Frontend (`/client`)
- **React + Vite** - Modern frontend framework with fast development
- **Socket.IO Client** - Real-time communication with backend
- **WebRTC** - Peer-to-peer data channels for file transfer
- **Tailwind CSS** - Utility-first CSS framework for styling

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Modern web browser with WebRTC support
- Devices on the same local network (for mDNS discovery)

### Installation

1. **Clone and setup the project**
   ```bash
   git clone <repository-url>
   cd p2p-file-share
   npm install
   ```

2. **Install backend dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

### Development

1. **Start both backend and frontend in development mode**
   ```bash
   npm run dev
   ```
   
   This will start:
   - Backend server on `http://localhost:3001`
   - Frontend dev server on `http://localhost:3000`

2. **Or run them separately**
   ```bash
   # Terminal 1 - Backend
   npm run server
   
   # Terminal 2 - Frontend
   npm run client
   ```

### Production

1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

## 🧪 Testing

### Local Network Testing

1. **Start the application on Device A**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in browser

2. **Start the application on Device B** (same network)
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in browser

3. **Verify peer discovery**
   - Both devices should appear in each other's peer list
   - Look for "P2P-FileShare-XXXXXXXX" entries

4. **Test file transfer**
   - Select a file on Device A
   - Click on Device B in the peer list
   - Click "Send File" button
   - Device B should receive a confirmation dialog
   - File will be downloaded automatically after acceptance

### Internet Testing

1. **Deploy the backend** to a cloud service (Heroku, Railway, etc.)
2. **Update the SERVER_URL** in `client/src/App.jsx`
3. **Deploy the frontend** to a static hosting service (Netlify, Vercel, etc.)
4. **Test between different networks** using the deployed URLs

## 📁 Project Structure

```
p2p-file-share/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── PeerList.jsx
│   │   │   ├── FileSelector.jsx
│   │   │   ├── TransferProgress.jsx
│   │   │   └── ConnectionStatus.jsx
│   │   ├── App.jsx         # Main application component
│   │   └── main.jsx        # React entry point
│   ├── index.html          # HTML template
│   ├── package.json        # Frontend dependencies
│   └── vite.config.js      # Vite configuration
├── server/                 # Node.js backend
│   ├── index.js            # Main server file
│   └── package.json        # Backend dependencies
├── package.json            # Root package.json
└── README.md              # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the server directory:

```env
PORT=3001
NODE_ENV=development
```

### WebRTC Configuration

The application uses Google's public STUN servers for NAT traversal. For production, consider using your own STUN/TURN servers:

```javascript
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
    // Add your TURN servers here for production
  ]
}
```

### mDNS Service Type

The application uses the service type `_p2pshare._tcp` for local discovery. This can be changed in `server/index.js`:

```javascript
const service = bonjour.publish({
  name: serviceName,
  type: 'p2pshare',  // Change this if needed
  port: PORT,
  // ...
})
```

## 🐛 Troubleshooting

### Common Issues

**Q: Peers not discovering each other**
- Ensure both devices are on the same Wi-Fi network
- Check firewall settings (ports 3000, 3001)
- Try refreshing the browser tabs
- Check browser console for mDNS errors

**Q: WebRTC connection fails**
- Some networks block WebRTC traffic
- Try using a VPN or different network
- Check if STUN servers are accessible
- Look for ICE connection errors in browser console

**Q: File transfer is slow**
- Large files are split into 16KB chunks
- Network speed affects transfer rate
- WebRTC is optimized for real-time, not bulk transfer
- Consider using a different approach for very large files

**Q: File transfer fails**
- Check browser console for errors
- Ensure both peers are connected
- Try resetting the transfer and starting over
- Verify file size is reasonable (< 100MB recommended)

### Debug Mode

Enable debug logging by opening browser console and looking for:
- Socket.IO connection status
- WebRTC connection state changes
- mDNS discovery events
- File transfer progress logs

## 🔒 Security Notes

- No authentication or user accounts required
- Files are transferred directly between peers (not stored on server)
- Server only handles signaling and peer discovery
- WebRTC connections are encrypted by default
- mDNS discovery is limited to local network

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🌟 Acknowledgments

- Built with modern web technologies
- Uses WebRTC for peer-to-peer communication
- Inspired by AirDrop's seamless file sharing
- mDNS discovery for local network detection

