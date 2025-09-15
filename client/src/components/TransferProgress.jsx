import React from 'react'

const TransferProgress = ({ state, progress, speed, fileName, fileSize }) => {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStateColor = () => {
    switch (state) {
      case 'sending': 
        return 'text-blue-400'
      case 'receiving': 
        return 'text-green-400'
      case 'completed': 
        return 'text-green-400'
      case 'error': 
        return 'text-red-400'
      default: 
        return 'text-gray-400'
    }
  }

  const getStateIcon = () => {
    switch (state) {
      case 'sending': 
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )
      case 'receiving': 
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        )
      case 'completed': 
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      case 'error': 
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )
      default: 
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const getStateText = () => {
    switch (state) {
      case 'sending': return 'Sending file...'
      case 'receiving': return 'Receiving file...'
      case 'completed': return 'Transfer completed!'
      case 'error': return 'Transfer failed'
      default: return 'Ready to transfer'
    }
  }

  const getProgressBarColor = () => {
    switch (state) {
      case 'sending': 
        return 'from-blue-500 to-blue-400'
      case 'receiving': 
        return 'from-green-500 to-green-400'
      case 'completed': 
        return 'from-green-500 to-green-400'
      case 'error': 
        return 'from-red-500 to-red-400'
      default: 
        return 'from-gray-500 to-gray-400'
    }
  }

  if (state === 'idle') {
    return (
      <div className="rounded-2xl backdrop-blur-sm border transition-all duration-500 bg-white/5 border-white/10 shadow-2xl h-full flex flex-col">
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 rounded-xl bg-gray-500/20">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">
              Transfer Status
            </h2>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-gray-700/50">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-lg font-mono text-gray-400">
              No active transfer
            </p>
            <p className="text-sm mt-2 text-gray-500">
              Select a file and peer to start
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl backdrop-blur-sm border transition-all duration-500 bg-white/5 border-white/10 shadow-2xl h-full flex flex-col">
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center space-x-3 mb-6">
          <div className={`p-2 rounded-xl ${
            state === 'sending' 
              ? 'bg-blue-500/20'
              : state === 'receiving'
              ? 'bg-green-500/20'
              : state === 'completed'
              ? 'bg-green-500/20'
              : state === 'error'
              ? 'bg-red-500/20'
              : 'bg-gray-500/20'
          }`}>
            <svg className={`w-6 h-6 ${
              state === 'sending' 
                ? 'text-blue-400'
                : state === 'receiving'
                ? 'text-green-400'
                : state === 'completed'
                ? 'text-green-400'
                : state === 'error'
                ? 'text-red-400'
                : 'text-gray-400'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {state === 'sending' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              ) : state === 'receiving' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              ) : state === 'completed' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : state === 'error' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">
            Transfer Status
          </h2>
        </div>
        
        <div className="space-y-6 flex-1 flex flex-col">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-xl ${getStateColor().replace('text-', 'bg-').replace('-400', '-500/20')} animate-pulse`}>
              {getStateIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-lg ${getStateColor()}`}>
                {getStateText()}
              </p>
              {fileName && (
                <p className="text-sm font-mono truncate text-gray-300">
                  {fileName}
                </p>
              )}
            </div>
          </div>
          
          {fileSize && (
            <div className="text-sm font-mono px-3 py-2 rounded-lg bg-gray-700/50 text-gray-300">
              File size: {formatFileSize(fileSize)}
            </div>
          )}
          
          {(state === 'sending' || state === 'receiving') && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-300">
                  Progress
                </span>
                <span className={`text-lg font-bold font-mono ${getStateColor()}`}>
                  {Math.round(progress)}%
                </span>
              </div>
              
              <div className="w-full rounded-full overflow-hidden bg-gray-700/50">
                <div
                  className={`h-3 rounded-full bg-gradient-to-r ${getProgressBarColor()} transition-all duration-500 ease-out relative overflow-hidden`}
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                </div>
              </div>
              
              {speed > 0 && (
                <div className="text-sm font-mono px-3 py-2 rounded-lg bg-blue-500/10 text-blue-300">
                  Speed: {formatFileSize(speed)}/s
                </div>
              )}
            </div>
          )}
          
          {state === 'completed' && (
            <div className="rounded-xl p-4 border bg-green-500/10 border-green-400/30">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-full bg-green-500/20">
                  <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="font-medium text-green-100">
                  File has been successfully transferred!
                </p>
              </div>
            </div>
          )}
          
          {state === 'error' && (
            <div className="rounded-xl p-4 border bg-red-500/10 border-red-400/30">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-full bg-red-500/20">
                  <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="font-medium text-red-100">
                  Transfer failed. Please try again.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TransferProgress