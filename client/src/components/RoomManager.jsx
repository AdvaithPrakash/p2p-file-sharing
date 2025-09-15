import React, { useState } from 'react'

const RoomManager = ({ 
  roomCode, 
  onRoomCreated, 
  onRoomJoined, 
  onRoomLeft, 
  isConnected,
  role,
  onRoleChange 
}) => {
  const [inputCode, setInputCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState('')

  const handleCreateRoom = async () => {
    if (isCreating) return
    
    setIsCreating(true)
    setError('')
    
    try {
      // This will be handled by the parent component
      onRoomCreated()
    } catch (err) {
      setError('Failed to create room')
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinRoom = async () => {
    if (isJoining || !inputCode.trim()) return
    
    setIsJoining(true)
    setError('')
    
    try {
      // This will be handled by the parent component
      onRoomJoined(inputCode.trim())
    } catch (err) {
      setError('Failed to join room')
    } finally {
      setIsJoining(false)
    }
  }

  const handleLeaveRoom = () => {
    onRoomLeft()
    setInputCode('')
    setError('')
  }

  const handleRoleChange = (newRole) => {
    onRoleChange(newRole)
  }

  if (roomCode) {
    return (
      <div className="rounded-2xl backdrop-blur-sm border transition-all duration-500 bg-white/5 border-white/10 shadow-2xl h-full flex flex-col">
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 rounded-xl bg-green-500/20">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">
              Room Connected
            </h2>
            <div className="px-3 py-1 rounded-full text-sm font-mono bg-green-500/20 text-green-300">
              {roomCode}
            </div>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-green-500/20">
              <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">
              {role === 'sender' ? 'You are the Sender' : 'You are the Receiver'}
            </h3>
            
            <p className="text-gray-300 mb-6">
              {role === 'sender' 
                ? 'Select a file and send it to the receiver' 
                : 'Waiting for the sender to share a file'
              }
            </p>
            
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-300">Connected</span>
              </div>
              <div className="text-gray-500">•</div>
              <div className="text-gray-300">
                Room: <span className="font-mono font-bold text-green-300">{roomCode}</span>
              </div>
            </div>
            
            <button
              onClick={handleLeaveRoom}
              className="mt-6 px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 backdrop-blur-sm"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Leave Room</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl backdrop-blur-sm border transition-all duration-500 bg-white/5 border-white/10 shadow-2xl h-full flex flex-col">
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 rounded-xl bg-blue-500/20">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">
            File Transfer Room
          </h2>
        </div>
        
        <div className="flex-1 flex flex-col">
          {/* Role Selection */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Choose your role:</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleRoleChange('sender')}
                className={`p-4 rounded-xl border transition-all duration-300 transform hover:scale-105 ${
                  role === 'sender'
                    ? 'bg-blue-500/20 border-blue-400/50 text-blue-100 shadow-blue-500/25'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span className="font-semibold">Send Files</span>
                  <span className="text-xs text-center">Create a room and share the code</span>
                </div>
              </button>
              
              <button
                onClick={() => handleRoleChange('receiver')}
                className={`p-4 rounded-xl border transition-all duration-300 transform hover:scale-105 ${
                  role === 'receiver'
                    ? 'bg-blue-500/20 border-blue-400/50 text-blue-100 shadow-blue-500/25'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="font-semibold">Receive Files</span>
                  <span className="text-xs text-center">Enter a room code to join</span>
                </div>
              </button>
            </div>
          </div>

          {/* Action based on role */}
          {role === 'sender' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-blue-500/20">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Ready to Send Files</h3>
              <p className="text-gray-300 mb-6">Create a room and share the code with the receiver</p>
              
              <button
                onClick={handleCreateRoom}
                disabled={!isConnected || isCreating}
                className="px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isCreating ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Creating Room...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Create Room</span>
                  </div>
                )}
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-purple-500/20">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Enter Room Code</h3>
              <p className="text-gray-300 mb-6">Get the 6-digit code from the sender</p>
              
              <div className="w-full max-w-sm space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setInputCode(value)
                      setError('')
                    }}
                    placeholder="Enter 6-digit code"
                    className="w-full px-4 py-3 text-center text-2xl font-mono bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300"
                    maxLength={6}
                  />
                </div>
                
                {error && (
                  <div className="text-red-400 text-sm text-center">
                    {error}
                  </div>
                )}
                
                <button
                  onClick={handleJoinRoom}
                  disabled={!isConnected || isJoining || inputCode.length !== 6}
                  className="w-full px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700 shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isJoining ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Joining Room...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      <span>Join Room</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RoomManager
