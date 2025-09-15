import React from 'react'

const ConnectionStatus = ({ status }) => {
  const getStatusInfo = () => {
    switch (status) {
      case 'connected':
        return {
          color: 'bg-green-400',
          text: 'Connected to server',
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ),
          bgColor: 'bg-green-500/10',
          textColor: 'text-green-100',
          borderColor: 'border-green-400/30'
        }
      case 'p2p-connected':
        return {
          color: 'bg-blue-400',
          text: 'P2P connection established',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          ),
          bgColor: 'bg-blue-500/10',
          textColor: 'text-blue-100',
          borderColor: 'border-blue-400/30'
        }
      case 'disconnected':
        return {
          color: 'bg-red-400',
          text: 'Disconnected from server',
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          ),
          bgColor: 'bg-red-500/10',
          textColor: 'text-red-100',
          borderColor: 'border-red-400/30'
        }
      default:
        return {
          color: 'bg-yellow-400',
          text: 'Connecting...',
          icon: (
            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
          bgColor: 'bg-yellow-500/10',
          textColor: 'text-yellow-100',
          borderColor: 'border-yellow-400/30'
        }
    }
  }

  const { color, text, icon, bgColor, textColor, borderColor } = getStatusInfo()

  return (
    <div className="mb-8">
      <div className="flex items-center space-x-4 rounded-2xl backdrop-blur-sm border p-4 transition-all duration-500 bg-white/5 border-white/10 shadow-2xl">
        <div className="flex items-center space-x-3">
          <div className={`w-4 h-4 rounded-full ${color} animate-pulse`}></div>
          <div className={`p-2 rounded-xl ${bgColor}`}>
            {icon}
          </div>
        </div>
        <div className="flex-1">
          <span className={`font-semibold text-lg ${textColor}`}>{text}</span>
          <div className="flex items-center space-x-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${color} animate-pulse`}></div>
            <span className="text-xs font-mono text-gray-400">
              {status === 'connected' ? 'Server connection active' : 
               status === 'p2p-connected' ? 'Direct peer connection' :
               status === 'disconnected' ? 'No server connection' : 'Establishing connection...'}
            </span>
          </div>
        </div>
        <div className="px-3 py-1 rounded-full text-xs font-mono bg-gray-700/50 text-gray-300">
          {status.toUpperCase()}
        </div>
      </div>
    </div>
  )
}

export default ConnectionStatus