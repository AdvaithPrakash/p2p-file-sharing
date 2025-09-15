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

    return () => {
      clearTimeout(timer)
      newSocket.close()
      // Cleanup WebRTC connections
      if (dataChannelRef.current) {
        dataChannelRef.current.close()
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
    }
  }, []) // Remove selectedPeer dependency to prevent infinite re-renders

  const handleWebRTCSignal = async (data) => {
    const { type, signal, from } = data
    
    // Validate data
    if (!data || !type || !signal || !from) {
      console.error('Invalid WebRTC signal data:', data)
      return
    }
    
    // Only process signals if we're in a room
    if (!roomCode) {
      return
    }
    
    if (!peerConnectionRef.current) {
      await initializePeerConnection()
    }

    try {
      if (type === 'offer') {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal))
        const answer = await peerConnectionRef.current.createAnswer()
        await peerConnectionRef.current.setLocalDescription(answer)
        
        socket.emit('webrtc-signal', {
          type: 'answer',
          signal: answer
        })
      } else if (type === 'answer') {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal))
      } else if (type === 'ice-candidate') {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal))
      }
    } catch (error) {
      console.error('Error handling WebRTC signal:', error)
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
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10, // Pre-gather more ICE candidates
      bundlePolicy: 'max-bundle', // Reduce number of ICE candidates
      rtcpMuxPolicy: 'require', // Reduce number of ICE candidates
      iceTransportPolicy: 'all' // Allow both STUN and TURN
    }

    peerConnectionRef.current = new RTCPeerConnection(configuration)

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate && roomCode) {
        socket.emit('webrtc-signal', {
          type: 'ice-candidate',
          signal: event.candidate
        })
      }
    }

    peerConnectionRef.current.ondatachannel = (event) => {
      const channel = event.channel
      dataChannelRef.current = channel
      setupDataChannel(channel)
    }

    peerConnectionRef.current.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnectionRef.current.connectionState)
      if (peerConnectionRef.current.connectionState === 'connected') {
        setConnectionStatus('p2p-connected')
      } else if (peerConnectionRef.current.connectionState === 'failed' || 
                 peerConnectionRef.current.connectionState === 'disconnected') {
        setConnectionStatus('connected')
        setTransferState('error')
      }
    }

    peerConnectionRef.current.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnectionRef.current.iceConnectionState)
      if (peerConnectionRef.current.iceConnectionState === 'failed') {
        setConnectionStatus('connected')
        setTransferState('error')
      }
    }
  }

  const setupDataChannel = (channel) => {
    channel.onopen = () => {
      console.log('Data channel opened')
      setConnectionStatus('p2p-connected')
    }

    channel.onmessage = (event) => {
      try {
        // Check if it's binary data (ArrayBuffer) or JSON
        if (event.data instanceof ArrayBuffer) {
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
          
          // Check if we have all chunks
          if (fileChunksRef.current && receivedChunksRef.current.length === fileChunksRef.current.totalChunks) {
            reconstructFile(fileChunksRef.current.fileName, fileChunksRef.current.fileType, fileChunksRef.current.totalChunks)
          }
        } else {
          // Handle JSON data (file info)
          const data = JSON.parse(event.data)
          
          if (data.type === 'file-info') {
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

  const initiateConnection = async () => {
    try {
      // Reset transfer state
      setTransferState('idle')
      setTransferProgress(0)
      
      // Clean up existing connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
      if (dataChannelRef.current) {
        dataChannelRef.current.close()
      }
      
      // Clear previous chunks
      receivedChunksRef.current = []
      fileChunksRef.current = []
      
      await initializePeerConnection()
      
      if (role === 'sender') {
        const dataChannel = peerConnectionRef.current.createDataChannel('fileTransfer')
        dataChannelRef.current = dataChannel
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

    try {
      const file = selectedFile
      
      // Adaptive chunk sizing based on file size
      let chunkSize, maxConcurrentChunks
      if (file.size < 10 * 1024 * 1024) { // < 10MB
        chunkSize = 32 * 1024 // 32KB chunks
        maxConcurrentChunks = 2
      } else if (file.size < 100 * 1024 * 1024) { // < 100MB
        chunkSize = 64 * 1024 // 64KB chunks
        maxConcurrentChunks = 4
      } else { // >= 100MB
        chunkSize = 128 * 1024 // 128KB chunks
        maxConcurrentChunks = 6
      }
      
      const totalChunks = Math.ceil(file.size / chunkSize)
      
      // Compress file if it's text-based and larger than 1MB
      const shouldCompress = file.size > 1024 * 1024 && (
        file.type.startsWith('text/') || 
        file.name.endsWith('.json') || 
        file.name.endsWith('.xml') || 
        file.name.endsWith('.csv') ||
        file.name.endsWith('.txt')
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

      // Parallel chunk processing
      let completedChunks = 0
      let sentChunks = 0
      const transferStartTime = Date.now()
      const chunkQueue = []
      
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
          
          // Compress chunk if needed
          let dataToSend = arrayBuffer
          if (shouldCompress) {
            try {
              const compressed = await compressData(arrayBuffer)
              if (compressed.length < arrayBuffer.byteLength) {
                dataToSend = compressed
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
          
          // Calculate and update transfer speed
          const elapsed = (Date.now() - transferStartTime) / 1000
          const transferred = (completedChunks * chunkSize) / (1024 * 1024) // MB
          const speed = transferred / elapsed
          setTransferSpeed(speed)
          
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
      
      // Process chunks with concurrency limit
      const processNextChunks = () => {
        const pendingChunks = chunkQueue.filter(chunk => chunk.status === 'pending')
        const processingChunks = chunkQueue.filter(chunk => chunk.status === 'processing')
        const availableSlots = maxConcurrentChunks - processingChunks.length
        
        for (let i = 0; i < Math.min(availableSlots, pendingChunks.length); i++) {
          processChunk(pendingChunks[i])
        }
      }
      
      // Start processing
      processNextChunks()
      
      // Continue processing as chunks complete
      const interval = setInterval(() => {
        processNextChunks()
        if (completedChunks === totalChunks) {
          clearInterval(interval)
        }
      }, 10) // Check every 10ms
      
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

  // Compression function using Web Compression API
  const compressData = async (data) => {
    const stream = new CompressionStream('gzip')
    const writer = stream.writable.getWriter()
    const reader = stream.readable.getReader()
    
    // Write data to compression stream
    writer.write(data)
    writer.close()
    
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
    setTransferState('idle')
    setTransferProgress(0)
    setConnectionStatus('connected')
    setSelectedFile(null)
    receivedChunksRef.current = []
    fileChunksRef.current = []
    
    if (dataChannelRef.current) {
      dataChannelRef.current.close()
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
    }
    dataChannelRef.current = null
    peerConnectionRef.current = null
  }

  // Initiate connection when receiver joins
  useEffect(() => {
    if (roomCode && role === 'sender' && connectionStatus === 'p2p-connected') {
      initiateConnection()
    }
  }, [roomCode, role, connectionStatus])

  // Set up WebRTC connection for receiver when they join
  useEffect(() => {
    if (roomCode && role === 'receiver' && connectionStatus === 'connected') {
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

