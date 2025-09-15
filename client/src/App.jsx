import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import RoomManager from './components/RoomManager'
import FileSelector from './components/FileSelector'
import TransferProgress from './components/TransferProgress'
import ConnectionStatus from './components/ConnectionStatus'
import FileTransferConfirmationModal from './components/FileTransferConfirmationModal'

const SERVER_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3001'

function App() {
  const [socket, setSocket] = useState(null)
  const [roomCode, setRoomCode] = useState(null)
  const [role, setRole] = useState(null) // 'sender' or 'receiver'
  const [selectedFile, setSelectedFile] = useState(null)
  const [transferState, setTransferState] = useState('idle') // idle, sending, receiving, completed, error
  const [transferProgress, setTransferProgress] = useState(0)
  const [transferSpeed, setTransferSpeed] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [isLoaded, setIsLoaded] = useState(false)
  const [transferStats, setTransferStats] = useState({
    startTime: null,
    bytesTransferred: 0,
    totalBytes: 0,
    averageSpeed: 0,
    peakSpeed: 0
  })
  
  // File transfer confirmation modal state
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [pendingTransfer, setPendingTransfer] = useState(null) // { fileName, fileSize, from }
  
  // Always use glassmorphism design - no toggle needed
  
  const dataChannelRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const fileChunksRef = useRef([])
  const receivedChunksRef = useRef([])
  const transferStartTimeRef = useRef(null)
  const roomCodeRef = useRef(null)
  const transferIntervalRef = useRef(null)
  const connectionTimeoutRef = useRef(null)
  const retryCountRef = useRef(0)
  const maxRetries = 3

  useEffect(() => {
    // Set loaded state after a short delay to ensure CSS is loaded
    const timer = setTimeout(() => {
      setIsLoaded(true)
    }, 100)
    
    // Initialize socket connection
    const newSocket = io(SERVER_URL)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.log('Connected to signaling server')
      setConnectionStatus('connected')
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from signaling server')
      setConnectionStatus('disconnected')
    })

    newSocket.on('receiver-joined', (data) => {
      console.log('Receiver joined room:', data.roomCode)
      setConnectionStatus('p2p-connected')
      // Trigger WebRTC connection initiation for sender
      if (role === 'sender') {
        console.log('Receiver joined, initiating WebRTC connection...')
        initiateConnection()
      }
    })

    newSocket.on('sender-left', () => {
      console.log('Sender left the room')
      setConnectionStatus('connected')
      setTransferState('error')
      alert('Sender left the room')
    })

    newSocket.on('receiver-left', () => {
      console.log('Receiver left the room')
      setConnectionStatus('connected')
      setTransferState('error')
      alert('Receiver left the room')
    })

    newSocket.on('webrtc-signal', handleWebRTCSignal)
    newSocket.on('file-transfer-request', handleFileTransferRequest)
    newSocket.on('file-transfer-response', handleFileTransferResponse)
    newSocket.on('file-transfer-error', handleFileTransferError)

    return () => {
      clearTimeout(timer)
      newSocket.close()
      // Cleanup WebRTC connections
      cleanupWebRTCConnections()
      // Clear all intervals and timeouts
      if (transferIntervalRef.current) {
        clearInterval(transferIntervalRef.current)
        transferIntervalRef.current = null
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
        connectionTimeoutRef.current = null
      }
    }
  }, []) // Remove selectedPeer dependency to prevent infinite re-renders

  const handleWebRTCSignal = async (data) => {
    console.log('📡 WebRTC signal received:', data.type, 'from:', data.from, 'roomCode:', roomCodeRef.current)
    const { type, signal, from } = data
    
    // Validate data
    if (!data || !type || !signal || !from) {
      console.error('❌ Invalid WebRTC signal data:', data)
      return
    }
    
    // Only process signals if we're in a room
    if (!roomCodeRef.current) {
      console.log('⚠️ No room code, ignoring signal. Current roomCode:', roomCodeRef.current)
      return
    }
    
    console.log('🔄 Processing WebRTC signal in room:', roomCodeRef.current)
    
    if (!peerConnectionRef.current) {
      console.log('No peer connection, initializing...')
      await initializePeerConnection()
    }

    try {
      if (type === 'offer') {
        console.log('📥 Processing offer...')
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal))
        const answer = await peerConnectionRef.current.createAnswer()
        await peerConnectionRef.current.setLocalDescription(answer)
        
        console.log('📤 Sending answer...')
        socket.emit('webrtc-signal', {
          type: 'answer',
          signal: answer
        })
        console.log('✅ Answer sent successfully')
      } else if (type === 'answer') {
        console.log('📥 Processing answer...')
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal))
        console.log('✅ Answer processed successfully')
      } else if (type === 'ice-candidate') {
        console.log('🧊 Processing ICE candidate...', signal.candidate)
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal))
        console.log('✅ ICE candidate added successfully')
      } else {
        console.warn('⚠️ Unknown signal type:', type)
      }
    } catch (error) {
      console.error('❌ Error handling WebRTC signal:', error)
      console.error('Signal type:', type)
      console.error('Signal data:', signal)
      setTransferState('error')
    }
  }

  const handleFileTransferRequest = (data) => {
    const { fileName, fileSize, from } = data
    
    // Check if we're already in a transfer
    if (transferState !== 'idle') {
      socket.emit('file-transfer-response', {
        accepted: false
      })
      return
    }
    
    // Store the pending transfer and show confirmation modal
    setPendingTransfer({
      fileName,
      fileSize,
      from
    })
    setShowTransferModal(true)
  }

  const handleFileTransferResponse = (data) => {
    const { accepted } = data
    if (accepted) {
      setTransferState('sending')
      startFileTransfer()
    } else {
      setTransferState('error')
      alert('File transfer rejected by peer')
    }
  }

  const handleFileTransferError = (data) => {
    console.error('File transfer error:', data.error)
    setTransferState('error')
    alert(`File transfer error: ${data.error}`)
  }

  // Handle file transfer confirmation modal actions
  const handleAcceptTransfer = () => {
    if (pendingTransfer) {
      socket.emit('file-transfer-response', {
        accepted: true
      })
      setTransferState('receiving')
      setSelectedFile({ name: pendingTransfer.fileName, size: pendingTransfer.fileSize })
    }
    
    // Close modal and clear pending transfer
    setShowTransferModal(false)
    setPendingTransfer(null)
  }

  const handleRejectTransfer = () => {
    if (pendingTransfer) {
      socket.emit('file-transfer-response', {
        accepted: false
      })
    }
    
    // Close modal and clear pending transfer
    setShowTransferModal(false)
    setPendingTransfer(null)
  }

  const initializePeerConnection = async () => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Add TURN servers for better connectivity in restrictive networks
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    }

    peerConnectionRef.current = new RTCPeerConnection(configuration)

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate && roomCodeRef.current) {
        console.log('ICE candidate generated:', event.candidate.type, event.candidate.protocol)
        socket.emit('webrtc-signal', {
          type: 'ice-candidate',
          signal: event.candidate
        })
      } else if (event.candidate) {
        console.log('ICE candidate generated but no room code available')
      } else {
        console.log('ICE gathering completed')
      }
    }

    // Add ICE candidate error handling
    peerConnectionRef.current.onicecandidateerror = (event) => {
      console.error('ICE candidate error:', event)
      console.error('Error details:', {
        errorCode: event.errorCode,
        errorText: event.errorText,
        url: event.url
      })
    }

    // Add ICE gathering state change logging
    peerConnectionRef.current.onicegatheringstatechange = () => {
      console.log('ICE gathering state changed to:', peerConnectionRef.current.iceGatheringState)
    }

    peerConnectionRef.current.ondatachannel = (event) => {
      console.log('Data channel received:', event.channel.label)
      const channel = event.channel
      dataChannelRef.current = channel
      setupDataChannel(channel)
    }

    peerConnectionRef.current.onconnectionstatechange = () => {
      const state = peerConnectionRef.current.connectionState
      console.log('WebRTC connection state changed to:', state)
      
      if (state === 'connected') {
        console.log('✅ WebRTC connection established successfully')
        setConnectionStatus('p2p-connected')
      } else if (state === 'connecting') {
        console.log('🔄 WebRTC connection in progress...')
      } else if (state === 'failed') {
        console.error('❌ WebRTC connection failed - this often indicates network/firewall issues')
        console.error('Possible causes:')
        console.error('- Firewall blocking WebRTC traffic')
        console.error('- NAT traversal issues (try TURN servers)')
        console.error('- Network restrictions')
        
        // Retry logic
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++
          console.log(`🔄 Retrying connection (attempt ${retryCountRef.current}/${maxRetries})...`)
          
          setTimeout(() => {
            if (roomCode && role) {
              console.log('🔄 Attempting to reconnect...')
              initiateConnection()
            }
          }, 2000 * retryCountRef.current) // Exponential backoff
        } else {
          console.error('❌ Max retries reached, giving up')
          setConnectionStatus('connected')
          setTransferState('error')
          alert('Connection failed after multiple attempts. Please check your network and try again.')
        }
      } else if (state === 'disconnected') {
        console.log('⚠️ WebRTC connection disconnected')
        setConnectionStatus('connected')
        setTransferState('error')
      } else if (state === 'closed') {
        console.log('🔒 WebRTC connection closed')
        setConnectionStatus('connected')
      }
    }

    peerConnectionRef.current.oniceconnectionstatechange = () => {
      const iceState = peerConnectionRef.current.iceConnectionState
      console.log('ICE connection state changed to:', iceState)
      
      if (iceState === 'connected' || iceState === 'completed') {
        console.log('✅ ICE connection established')
      } else if (iceState === 'checking') {
        console.log('🔄 ICE connection checking...')
      } else if (iceState === 'failed') {
        console.error('❌ ICE connection failed - NAT traversal unsuccessful')
        console.error('This usually means:')
        console.error('- STUN servers are not accessible')
        console.error('- TURN servers are needed but not working')
        console.error('- Network firewall is blocking WebRTC')
        setConnectionStatus('connected')
        setTransferState('error')
      } else if (iceState === 'disconnected') {
        console.log('⚠️ ICE connection disconnected')
        setConnectionStatus('connected')
        setTransferState('error')
      } else if (iceState === 'closed') {
        console.log('🔒 ICE connection closed')
        setConnectionStatus('connected')
      }
    }
  }

  const setupDataChannel = (channel) => {
    console.log('Setting up data channel, current state:', channel.readyState)
    
    channel.onopen = () => {
      console.log('✅ Data channel opened successfully')
      setConnectionStatus('p2p-connected')
    }
    
    channel.onclose = () => {
      console.log('❌ Data channel closed')
      setConnectionStatus('connected')
    }
    
    channel.onerror = (error) => {
      console.error('❌ Data channel error:', error)
      setConnectionStatus('connected')
    }

    channel.onmessage = (event) => {
      console.log('Data channel message received:', event.data instanceof ArrayBuffer ? 'ArrayBuffer' : 'JSON', event.data)
      try {
        // Check if it's binary data (ArrayBuffer) or JSON
        if (event.data instanceof ArrayBuffer) {
          console.log('Received binary chunk, size:', event.data.byteLength)
          // Handle binary chunk data
          const uint8Array = new Uint8Array(event.data)
          
          // Store chunk data
          receivedChunksRef.current.push({
            data: uint8Array,
            chunkIndex: receivedChunksRef.current.length,
            totalChunks: fileChunksRef.current?.totalChunks || 0
          })
          
          const progress = (receivedChunksRef.current.length / (fileChunksRef.current?.totalChunks || 1)) * 100
          setTransferProgress(progress)
          
          console.log(`Received chunk ${receivedChunksRef.current.length}/${fileChunksRef.current?.totalChunks || 0}`)
          
          // Check if we have all chunks
          if (fileChunksRef.current && receivedChunksRef.current.length === fileChunksRef.current.totalChunks) {
            console.log('All chunks received, reconstructing file...')
            reconstructFile(fileChunksRef.current.fileName, fileChunksRef.current.fileType, fileChunksRef.current.totalChunks)
          }
        } else {
          console.log('Received JSON data:', event.data)
          // Handle JSON data (file info)
          const data = JSON.parse(event.data)
          
          if (data.type === 'file-info') {
            console.log('File info received:', data)
            // Store file info for reconstruction
            setSelectedFile({
              name: data.fileName,
              size: data.fileSize,
              type: data.fileType
            })
            // Clear previous chunks and store total chunks count
            receivedChunksRef.current = []
            fileChunksRef.current = {
              totalChunks: data.totalChunks,
              fileName: data.fileName,
              fileType: data.fileType
            }
          }
        }
      } catch (error) {
        console.error('Error parsing data channel message:', error)
      }
    }

    channel.onclose = () => {
      console.log('Data channel closed')
      setConnectionStatus('connected')
      if (transferState === 'sending' || transferState === 'receiving') {
        setTransferState('error')
      }
    }

    channel.onerror = (error) => {
      console.error('Data channel error:', error)
      setConnectionStatus('connected')
      setTransferState('error')
    }
  }

  // Room management functions
  const handleCreateRoom = async () => {
    if (!socket) return
    
    try {
      socket.emit('create-room', (response) => {
        if (response.success) {
          roomCodeRef.current = response.roomCode
          setRoomCode(response.roomCode)
          setRole('sender')
          console.log('Room created:', response.roomCode)
        } else {
          alert('Failed to create room: ' + response.error)
        }
      })
    } catch (error) {
      console.error('Error creating room:', error)
      alert('Failed to create room')
    }
  }

  const handleJoinRoom = async (code) => {
    if (!socket) return
    
    try {
      socket.emit('join-room', { roomCode: code }, (response) => {
        if (response.success) {
          roomCodeRef.current = response.roomCode
          setRoomCode(response.roomCode)
          setRole('receiver')
          console.log('Joined room:', response.roomCode)
        } else {
          alert('Failed to join room: ' + response.error)
        }
      })
    } catch (error) {
      console.error('Error joining room:', error)
      alert('Failed to join room')
    }
  }

  const handleLeaveRoom = () => {
    if (socket && roomCode) {
      socket.emit('leave-room')
    }
    roomCodeRef.current = null
    setRoomCode(null)
    setRole(null)
    setSelectedFile(null)
    setTransferState('idle')
    setTransferProgress(0)
    resetTransfer()
  }

  const handleRoleChange = (newRole) => {
    setRole(newRole)
  }

  // Comprehensive cleanup function
  const cleanupWebRTCConnections = () => {
    console.log('🧹 Cleaning up WebRTC connections...')
    
    // Clear intervals and timeouts
    if (transferIntervalRef.current) {
      clearInterval(transferIntervalRef.current)
      transferIntervalRef.current = null
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
      connectionTimeoutRef.current = null
    }
    
    // Close data channel
    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close()
      } catch (error) {
        console.warn('Error closing data channel:', error)
      }
      dataChannelRef.current = null
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close()
      } catch (error) {
        console.warn('Error closing peer connection:', error)
      }
      peerConnectionRef.current = null
    }
    
    // Clear chunk data
    receivedChunksRef.current = []
    fileChunksRef.current = []
    
    // Reset retry count
    retryCountRef.current = 0
  }

  // File validation function
  const validateFile = (file) => {
    const maxSize = 500 * 1024 * 1024 // 500MB limit
    const allowedTypes = [
      'image/', 'video/', 'audio/', 'text/', 'application/',
      'application/pdf', 'application/zip', 'application/x-rar-compressed'
    ]
    
    if (!file) {
      return { valid: false, error: 'No file selected' }
    }
    
    if (file.size > maxSize) {
      return { valid: false, error: 'File too large (max 500MB)' }
    }
    
    if (file.size === 0) {
      return { valid: false, error: 'File is empty' }
    }
    
    const isValidType = allowedTypes.some(type => file.type.startsWith(type)) || 
                       file.name.includes('.') // Allow files with extensions
    
    if (!isValidType) {
      return { valid: false, error: 'File type not supported' }
    }
    
    return { valid: true }
  }

  // Add connection diagnostics
  const logConnectionDiagnostics = () => {
    if (peerConnectionRef.current) {
      console.log('🔍 Connection Diagnostics:')
      console.log('- Connection State:', peerConnectionRef.current.connectionState)
      console.log('- ICE Connection State:', peerConnectionRef.current.connectionState)
      console.log('- ICE Gathering State:', peerConnectionRef.current.iceGatheringState)
      console.log('- Signaling State:', peerConnectionRef.current.signalingState)
      console.log('- Data Channel State:', dataChannelRef.current?.readyState || 'No data channel')
    }
  }

  const initiateConnection = async () => {
    try {
      console.log('🚀 Initiating WebRTC connection...')
      
      // Reset transfer state
      setTransferState('idle')
      setTransferProgress(0)
      
      // Clean up existing connection
      if (peerConnectionRef.current) {
        console.log('🧹 Cleaning up existing connection...')
        peerConnectionRef.current.close()
      }
      if (dataChannelRef.current) {
        dataChannelRef.current.close()
      }
      
      // Clear previous chunks
      receivedChunksRef.current = []
      fileChunksRef.current = []
      
      await initializePeerConnection()
      
      // Log initial diagnostics
      setTimeout(() => {
        logConnectionDiagnostics()
      }, 1000)
      
      if (role === 'sender') {
        console.log('Creating ultra-optimized data channel as sender...')
        const dataChannel = peerConnectionRef.current.createDataChannel('fileTransfer', {
          ordered: true // Ensure order for file reconstruction
        })
        dataChannelRef.current = dataChannel
        console.log('Ultra-optimized data channel created, state:', dataChannel.readyState)
        setupDataChannel(dataChannel)

        const offer = await peerConnectionRef.current.createOffer()
        await peerConnectionRef.current.setLocalDescription(offer)
        
        socket.emit('webrtc-signal', {
          type: 'offer',
          signal: offer
        })
      }
    } catch (error) {
      console.error('Error initiating connection:', error)
      setTransferState('error')
    }
  }

  const startFileTransfer = () => {
    if (!selectedFile || !dataChannelRef.current) {
      console.error('Cannot start transfer: missing file or data channel')
      setTransferState('error')
      return
    }

    // Validate file before transfer
    const validation = validateFile(selectedFile)
    if (!validation.valid) {
      console.error('File validation failed:', validation.error)
      alert(`File validation failed: ${validation.error}`)
      setTransferState('error')
      return
    }

    console.log('🚀 Starting ULTRA-FAST file transfer...')
    console.log(`📁 File: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`)

    // Check if data channel is open
    if (!dataChannelRef.current) {
      console.error('No data channel available')
      setTransferState('error')
      alert('No data channel available. Please check your connection.')
      return
    }
    
    if (dataChannelRef.current.readyState !== 'open') {
      console.log('Data channel not ready, current state:', dataChannelRef.current.readyState)
      setTransferState('error')
      alert('Data channel not ready. Please ensure both users are connected.')
      return
    }

    try {
      const file = selectedFile
      
      // Ultra-optimized chunk sizing for maximum speed
      let chunkSize, maxConcurrentChunks
      if (file.size < 1 * 1024 * 1024) { // < 1MB
        chunkSize = 128 * 1024 // 128KB chunks
        maxConcurrentChunks = 8
      } else if (file.size < 10 * 1024 * 1024) { // < 10MB
        chunkSize = 256 * 1024 // 256KB chunks
        maxConcurrentChunks = 12
      } else if (file.size < 100 * 1024 * 1024) { // < 100MB
        chunkSize = 512 * 1024 // 512KB chunks
        maxConcurrentChunks = 16
      } else if (file.size < 500 * 1024 * 1024) { // < 500MB
        chunkSize = 1024 * 1024 // 1MB chunks
        maxConcurrentChunks = 20
      } else { // >= 500MB
        chunkSize = 2048 * 1024 // 2MB chunks
        maxConcurrentChunks = 25
      }
      
      const totalChunks = Math.ceil(file.size / chunkSize)
      
      // Ultra-aggressive compression for maximum speed
      const shouldCompress = file.size > 100 * 1024 && ( // Lower threshold for compression
        file.type.startsWith('text/') || 
        file.name.endsWith('.json') || 
        file.name.endsWith('.xml') || 
        file.name.endsWith('.csv') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.js') ||
        file.name.endsWith('.jsx') ||
        file.name.endsWith('.ts') ||
        file.name.endsWith('.tsx') ||
        file.name.endsWith('.css') ||
        file.name.endsWith('.html') ||
        file.name.endsWith('.svg') ||
        file.name.endsWith('.log') ||
        file.name.endsWith('.sql') ||
        file.name.endsWith('.yaml') ||
        file.name.endsWith('.yml')
      )
      
      // Send file info first
      dataChannelRef.current.send(JSON.stringify({
        type: 'file-info',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        totalChunks: totalChunks,
        compressed: shouldCompress
      }))

      // Parallel chunk processing with dynamic adjustment
      let completedChunks = 0
      let sentChunks = 0
      const transferStartTime = Date.now()
      const chunkQueue = []
      let lastSpeedCheck = Date.now()
      let currentSpeed = 0
      let adaptiveConcurrency = maxConcurrentChunks
      
      // Initialize chunk queue
      for (let i = 0; i < totalChunks; i++) {
        chunkQueue.push({
          index: i,
          start: i * chunkSize,
          end: Math.min((i + 1) * chunkSize, file.size),
          status: 'pending' // pending, processing, sent
        })
      }
      
      const processChunk = async (chunkInfo) => {
        if (chunkInfo.status !== 'pending') return
        
        chunkInfo.status = 'processing'
        
        try {
          const chunk = file.slice(chunkInfo.start, chunkInfo.end)
          const arrayBuffer = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve(e.target.result)
            reader.onerror = reject
            reader.readAsArrayBuffer(chunk)
          })
          
          // Compress chunk if needed with optimal algorithm
          let dataToSend = arrayBuffer
          if (shouldCompress) {
            try {
              const algorithm = getOptimalCompression(file.name, file.type)
              const compressed = await compressData(arrayBuffer, algorithm)
              if (compressed.length < arrayBuffer.byteLength) {
                dataToSend = compressed
                console.log(`📦 Compressed chunk ${chunkInfo.index} with ${algorithm}: ${arrayBuffer.byteLength} → ${compressed.length} bytes`)
              }
            } catch (error) {
              console.warn('Compression failed, sending uncompressed:', error)
            }
          }
          
          // Send chunk
          dataChannelRef.current.send(dataToSend)
          
          chunkInfo.status = 'sent'
          sentChunks++
          completedChunks++
          
          // Update progress
          const progress = (completedChunks / totalChunks) * 100
          setTransferProgress(progress)
          
          // Calculate and update transfer speed with dynamic adjustment
          const now = Date.now()
          const elapsed = (now - transferStartTime) / 1000
          const transferred = (completedChunks * chunkSize) / (1024 * 1024) // MB
          const speed = transferred / elapsed
          currentSpeed = speed
          setTransferSpeed(speed)
          
          // Aggressive speed optimization - check every 500ms
          if (now - lastSpeedCheck > 500) {
            if (speed > 50) { // Ultra high speed - maximize concurrency
              adaptiveConcurrency = Math.min(maxConcurrentChunks + 5, 30)
            } else if (speed > 20) { // High speed - increase concurrency
              adaptiveConcurrency = Math.min(maxConcurrentChunks + 3, 25)
            } else if (speed > 5) { // Medium speed - maintain concurrency
              adaptiveConcurrency = maxConcurrentChunks
            } else if (speed < 1) { // Low speed - decrease concurrency
              adaptiveConcurrency = Math.max(4, maxConcurrentChunks - 2)
            } else {
              adaptiveConcurrency = maxConcurrentChunks
            }
            lastSpeedCheck = now
            console.log(`🚀 Ultra-optimized concurrency: ${adaptiveConcurrency} (speed: ${speed.toFixed(2)} MB/s)`)
          }
          
          // Update transfer stats
          setTransferStats(prev => {
            const newBytesTransferred = completedChunks * chunkSize
            const newAverageSpeed = newBytesTransferred / (elapsed * 1024 * 1024) // MB/s
            const newPeakSpeed = Math.max(prev.peakSpeed, speed)
            
            return {
              startTime: prev.startTime || transferStartTime,
              bytesTransferred: newBytesTransferred,
              totalBytes: file.size,
              averageSpeed: newAverageSpeed,
              peakSpeed: newPeakSpeed
            }
          })
          
          // Check if transfer is complete
          if (completedChunks === totalChunks) {
            const transferTime = (Date.now() - transferStartTime) / 1000
            const speedMBps = (file.size / (1024 * 1024)) / transferTime
            console.log(`Transfer completed in ${transferTime.toFixed(2)}s at ${speedMBps.toFixed(2)} MB/s`)
            setTransferState('completed')
          }
          
        } catch (error) {
          console.error('Error processing chunk:', error)
          setTransferState('error')
        }
      }
      
      // Process chunks with adaptive concurrency limit
      const processNextChunks = () => {
        const pendingChunks = chunkQueue.filter(chunk => chunk.status === 'pending')
        const processingChunks = chunkQueue.filter(chunk => chunk.status === 'processing')
        const availableSlots = adaptiveConcurrency - processingChunks.length
        
        for (let i = 0; i < Math.min(availableSlots, pendingChunks.length); i++) {
          processChunk(pendingChunks[i])
        }
      }
      
      // Start processing
      processNextChunks()
      
      // Ultra-fast processing with minimal intervals
      if (transferIntervalRef.current) {
        clearInterval(transferIntervalRef.current)
      }
      
      transferIntervalRef.current = setInterval(() => {
        processNextChunks()
        if (completedChunks === totalChunks) {
          if (transferIntervalRef.current) {
            clearInterval(transferIntervalRef.current)
            transferIntervalRef.current = null
          }
        }
      }, 1) // Check every 1ms for maximum responsiveness
      
    } catch (error) {
      console.error('Error starting file transfer:', error)
      setTransferState('error')
    }
  }

  const reconstructFile = (fileName, fileType, totalChunks) => {
    try {
      // Use stored file info if available, otherwise use parameters
      const fileInfo = fileChunksRef.current || {}
      const finalFileName = fileName || fileInfo.fileName || 'received-file'
      const finalFileType = fileType || fileInfo.fileType || 'application/octet-stream'
      const finalTotalChunks = totalChunks || fileInfo.totalChunks || receivedChunksRef.current.length
      
      // Sort chunks by index to ensure correct order
      const sortedChunks = receivedChunksRef.current
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map(chunkData => {
          // Handle both old base64 format and new ArrayBuffer format
          if (chunkData.data) {
            return chunkData.data // New format: direct Uint8Array
          } else if (chunkData.chunk) {
            // Old format: base64 string
            try {
              return Uint8Array.from(atob(chunkData.chunk), c => c.charCodeAt(0))
            } catch (error) {
              console.error('Error decoding chunk:', error)
              return new Uint8Array(0)
            }
          }
          return new Uint8Array(0)
        })
      
      // Verify we have all chunks
      if (sortedChunks.length !== finalTotalChunks) {
        console.error(`Missing chunks: expected ${finalTotalChunks}, got ${sortedChunks.length}`)
        setTransferState('error')
        return
      }
      
      // Calculate total size
      const totalSize = sortedChunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const fileData = new Uint8Array(totalSize)
      
      // Reconstruct file
      let offset = 0
      for (const chunk of sortedChunks) {
        fileData.set(chunk, offset)
        offset += chunk.length
      }
      
      // Create and download file
      const blob = new Blob([fileData], { type: finalFileType })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = finalFileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      setTransferState('completed')
    } catch (error) {
      console.error('Error reconstructing file:', error)
      setTransferState('error')
    }
  }

  // Enhanced compression function with multiple algorithms
  const compressData = async (data, algorithm = 'gzip') => {
    try {
      const stream = new CompressionStream(algorithm)
      const writer = stream.writable.getWriter()
      const reader = stream.readable.getReader()
      
      // Write data to compression stream
      await writer.write(data)
      await writer.close()
      
      // Read compressed data
      const chunks = []
      let done = false
      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) {
          chunks.push(value)
        }
      }
      
      // Combine chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const result = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }
      
      return result.buffer
    } catch (error) {
      console.warn(`Compression with ${algorithm} failed:`, error)
      return data // Return original data if compression fails
    }
  }

  // Smart compression selection based on file type
  const getOptimalCompression = (fileName, fileType) => {
    if (fileType.startsWith('text/') || fileName.endsWith('.json') || fileName.endsWith('.xml')) {
      return 'gzip' // Best for text
    } else if (fileName.endsWith('.svg') || fileName.endsWith('.html')) {
      return 'deflate' // Good for markup
    } else {
      return 'gzip' // Default
    }
  }

  // Decompression function
  const decompressData = async (compressedData) => {
    const stream = new DecompressionStream('gzip')
    const writer = stream.writable.getWriter()
    const reader = stream.readable.getReader()
    
    // Write compressed data to decompression stream
    writer.write(compressedData)
    writer.close()
    
    // Read decompressed data
    const chunks = []
    let done = false
    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        chunks.push(value)
      }
    }
    
    // Combine chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    
    return result.buffer
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const resetTransfer = () => {
    console.log('🔄 Resetting transfer...')
    setTransferState('idle')
    setTransferProgress(0)
    setConnectionStatus('connected')
    setSelectedFile(null)
    
    // Use comprehensive cleanup
    cleanupWebRTCConnections()
  }

  // Initiate connection when sender creates room
  useEffect(() => {
    if (roomCode && role === 'sender' && connectionStatus === 'connected') {
      console.log('Setting up WebRTC connection for sender...')
      initializePeerConnection()
    }
  }, [roomCode, role, connectionStatus])

  // Set up WebRTC connection for receiver when they join
  useEffect(() => {
    if (roomCode && role === 'receiver' && connectionStatus === 'connected') {
      console.log('Setting up WebRTC connection for receiver...')
      initializePeerConnection()
    }
  }, [roomCode, role, connectionStatus])

  // Show loading screen while CSS loads
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div 
            className="logo-container w-28 h-28 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-500/40 to-purple-500/40 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shadow-2xl"
            style={{
              display: 'flex !important',
              visibility: 'visible !important',
              opacity: '1 !important',
              zIndex: '999 !important',
              position: 'relative'
            }}
          >
            <div 
              className="w-10 h-10 border-2 border-blue-200/70 border-t-blue-200 rounded-full animate-spin"
              style={{
                display: 'block !important',
                visibility: 'visible !important',
                opacity: '1 !important'
              }}
            ></div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">P2P File Share</h1>
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.1) 2px, transparent 0)',
          backgroundSize: '50px 50px'
        }}></div>
      </div>
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Primary Logo */}
          <div 
            className="logo-container w-28 h-28 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-500/40 to-purple-500/40 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shadow-2xl hover:scale-105 transition-transform duration-300"
            style={{
              display: 'flex !important',
              visibility: 'visible !important',
              opacity: '1 !important',
              zIndex: '999 !important',
              position: 'relative'
            }}
          >
            <svg 
              className="w-14 h-14 text-blue-200 animate-pulse" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              style={{
                display: 'block !important',
                visibility: 'visible !important',
                opacity: '1 !important'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          
          <h1 
            className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
            style={{
              display: 'block !important',
              visibility: 'visible !important',
              opacity: '1 !important',
              zIndex: '999 !important',
              position: 'relative',
              fontSize: '3rem !important',
              fontWeight: '700 !important',
              background: 'linear-gradient(to right, rgb(96, 165, 250), rgb(168, 85, 247)) !important',
              WebkitBackgroundClip: 'text !important',
              WebkitTextFillColor: 'transparent !important',
              backgroundClip: 'text !important',
              color: 'transparent !important'
            }}
          >
            P2P File Share
          </h1>
          <p 
            className="text-lg font-mono text-gray-300"
            style={{
              display: 'block !important',
              visibility: 'visible !important',
              opacity: '1 !important',
              zIndex: '999 !important',
              position: 'relative',
              fontSize: '1.125rem !important',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace !important',
              color: 'rgb(209, 213, 219) !important'
            }}
          >
            Direct peer-to-peer file transfers
          </p>
        </div>
        
        <ConnectionStatus status={connectionStatus} />
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Left Column - Room Management and File Selection */}
          <div className="flex flex-col space-y-6">
            <div className="flex-1">
              <RoomManager 
                roomCode={roomCode}
                onRoomCreated={handleCreateRoom}
                onRoomJoined={handleJoinRoom}
                onRoomLeft={handleLeaveRoom}
                isConnected={connectionStatus === 'connected' || connectionStatus === 'p2p-connected'}
                role={role}
                onRoleChange={handleRoleChange}
              />
            </div>
            
            {roomCode && role === 'sender' && (
              <>
                <FileSelector 
                  onFileSelect={setSelectedFile}
                  selectedFile={selectedFile}
                  disabled={transferState !== 'idle'}
                />
                
                {selectedFile && transferState === 'idle' && (
                  <button
                    onClick={() => {
                      if (socket) {
                        socket.emit('file-transfer-request', {
                          fileName: selectedFile.name,
                          fileSize: selectedFile.size
                        })
                      } else {
                        console.error('Cannot send file: missing socket')
                        setTransferState('error')
                      }
                    }}
                    className="w-full py-4 px-6 rounded-2xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-blue-500/25"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>Send File</span>
                    </div>
                  </button>
                )}
              </>
            )}
          </div>
          
          {/* Right Column - Transfer Progress */}
          <div className="flex flex-col space-y-6">
            <div className="flex-1">
              <TransferProgress 
                state={transferState}
                progress={transferProgress}
                speed={transferSpeed}
                fileName={selectedFile?.name}
                fileSize={selectedFile?.size}
              />
            </div>
            
            {transferState !== 'idle' && (
              <button
                onClick={resetTransfer}
                className="w-full py-3 px-6 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-600/50 backdrop-blur-sm"
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Reset Transfer</span>
                </div>
              </button>
            )}
            
            {/* Debug button for troubleshooting */}
            <button
              onClick={logConnectionDiagnostics}
              className="w-full py-2 px-4 rounded-lg font-medium transition-all duration-300 bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 backdrop-blur-sm text-sm"
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Debug Connection</span>
              </div>
            </button>
          </div>
        </div>
        
        {/* File Transfer Confirmation Modal */}
        <FileTransferConfirmationModal
          isOpen={showTransferModal}
          pendingTransfer={pendingTransfer}
          onAccept={handleAcceptTransfer}
          onReject={handleRejectTransfer}
          formatFileSize={formatFileSize}
        />
      </div>
    </div>
  )
}

export default App

