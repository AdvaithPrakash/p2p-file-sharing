import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import PeerList from './components/PeerList'
import FileSelector from './components/FileSelector'
import TransferProgress from './components/TransferProgress'
import ConnectionStatus from './components/ConnectionStatus'
import FileTransferConfirmationModal from './components/FileTransferConfirmationModal'

const SERVER_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3001'

function App() {
  const [socket, setSocket] = useState(null)
  const [peers, setPeers] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedPeer, setSelectedPeer] = useState(null)
  const [transferState, setTransferState] = useState('idle') // idle, sending, receiving, completed, error
  const [transferProgress, setTransferProgress] = useState(0)
  const [transferSpeed, setTransferSpeed] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [isLoaded, setIsLoaded] = useState(false)
  
  // File transfer confirmation modal state
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [pendingTransfer, setPendingTransfer] = useState(null) // { fileName, fileSize, from, peerName }
  
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

    newSocket.on('peer-list', (peerList) => {
      console.log('Received peer list:', peerList)
      setPeers(peerList)
    })

    newSocket.on('peer-discovered', (peer) => {
      console.log('New peer discovered:', peer)
      setPeers(prev => [...prev.filter(p => p.id !== peer.id), peer])
    })

    newSocket.on('peer-lost', ({ name }) => {
      console.log('Peer lost:', name)
      setPeers(prev => prev.filter(p => p.name !== name))
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
    
    // Only process signals from the selected peer
    if (selectedPeer && from !== selectedPeer.id) {
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
          signal: answer,
          to: from
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
        accepted: false,
        to: from
      })
      return
    }
    
    // Find the peer name for display
    const peer = peers.find(p => p.id === from)
    const peerName = peer ? peer.name : `Peer ${from.substring(0, 8)}`
    
    // Store the pending transfer and show confirmation modal
    setPendingTransfer({
      fileName,
      fileSize,
      from,
      peerName
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
        accepted: true,
        to: pendingTransfer.from
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
        accepted: false,
        to: pendingTransfer.from
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
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }

    peerConnectionRef.current = new RTCPeerConnection(configuration)

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate && selectedPeer?.id) {
        socket.emit('webrtc-signal', {
          type: 'ice-candidate',
          signal: event.candidate,
          to: selectedPeer.id
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
        const data = JSON.parse(event.data)
        
        if (data.type === 'file-chunk') {
          // Validate chunk data
          if (typeof data.chunkIndex !== 'number' || typeof data.totalChunks !== 'number' || !data.chunk) {
            console.error('Invalid chunk data:', data)
            return
          }
          
          // Store chunk with its index for proper ordering
          receivedChunksRef.current.push({
            chunk: data.chunk,
            chunkIndex: data.chunkIndex,
            totalChunks: data.totalChunks
          })
          
          const progress = (receivedChunksRef.current.length / data.totalChunks) * 100
          setTransferProgress(progress)
          
          // Check if we have all chunks
          if (receivedChunksRef.current.length === data.totalChunks) {
            reconstructFile(data.fileName, data.fileType, data.totalChunks)
          }
        } else if (data.type === 'file-info') {
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

  const initiateConnection = async (peer) => {
    try {
      // Reset transfer state
      setTransferState('idle')
      setTransferProgress(0)
      
      setSelectedPeer(peer)
      
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
      
      const dataChannel = peerConnectionRef.current.createDataChannel('fileTransfer')
      dataChannelRef.current = dataChannel
      setupDataChannel(dataChannel)

      const offer = await peerConnectionRef.current.createOffer()
      await peerConnectionRef.current.setLocalDescription(offer)
      
      socket.emit('webrtc-signal', {
        type: 'offer',
        signal: offer,
        to: peer.id
      })
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
      const chunkSize = 16 * 1024 // 16KB chunks
      const totalChunks = Math.ceil(file.size / chunkSize)
      
      // Send file info first
      dataChannelRef.current.send(JSON.stringify({
        type: 'file-info',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        totalChunks: totalChunks
      }))

      // Send file chunks
      let chunkIndex = 0
      const reader = new FileReader()
      
      reader.onerror = () => {
        console.error('Error reading file chunk')
        setTransferState('error')
      }
      
      const readNextChunk = () => {
        if (chunkIndex >= totalChunks) {
          setTransferState('completed')
          return
        }
        
        const start = chunkIndex * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)
        
        reader.onload = (e) => {
          try {
            const arrayBuffer = e.target.result
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
            
            dataChannelRef.current.send(JSON.stringify({
              type: 'file-chunk',
              chunk: base64,
              chunkIndex: chunkIndex,
              totalChunks: totalChunks
            }))
            
            chunkIndex++
            const progress = (chunkIndex / totalChunks) * 100
            setTransferProgress(progress)
            
            // Continue with next chunk
            if (chunkIndex < totalChunks) {
              readNextChunk()
            } else {
              setTransferState('completed')
            }
          } catch (error) {
            console.error('Error processing chunk:', error)
            setTransferState('error')
          }
        }
        
        reader.readAsArrayBuffer(chunk)
      }
      
      readNextChunk()
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
          try {
            return Uint8Array.from(atob(chunkData.chunk), c => c.charCodeAt(0))
          } catch (error) {
            console.error('Error decoding chunk:', error)
            return new Uint8Array(0)
          }
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
    setSelectedPeer(null)
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
          {/* Left Column - Peers and File Selection */}
          <div className="flex flex-col space-y-6">
            <div className="flex-1">
              <PeerList 
                peers={peers} 
                onPeerSelect={initiateConnection}
                selectedPeer={selectedPeer}
              />
            </div>
            
            <FileSelector 
              onFileSelect={setSelectedFile}
              selectedFile={selectedFile}
              disabled={!selectedPeer || transferState !== 'idle'}
            />
            
            {selectedFile && selectedPeer && transferState === 'idle' && (
              <button
                onClick={() => {
                  if (socket && selectedPeer.id) {
                    socket.emit('file-transfer-request', {
                      fileName: selectedFile.name,
                      fileSize: selectedFile.size,
                      to: selectedPeer.id
                    })
                  } else {
                    console.error('Cannot send file: missing socket or peer ID')
                    setTransferState('error')
                  }
                }}
                className="w-full py-4 px-6 rounded-2xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-blue-500/25"
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>Send File to {selectedPeer.name}</span>
                </div>
              </button>
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

