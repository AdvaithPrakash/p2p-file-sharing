import React from 'react'

const FileTransferConfirmationModal = ({ 
  isOpen, 
  pendingTransfer, 
  onAccept, 
  onReject, 
  formatFileSize
}) => {
  if (!isOpen || !pendingTransfer) return null

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onReject()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey)
      return () => document.removeEventListener('keydown', handleEscKey)
    }
  }, [isOpen, onReject])

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300"
      onClick={(e) => {
        // Close modal when clicking outside
        if (e.target === e.currentTarget) {
          onReject()
        }
      }}
    >
      <div 
        className="rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 backdrop-blur-sm border transition-all duration-300 transform bg-white/10 border-white/20"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <div className="flex items-center mb-6">
          <div className="flex-shrink-0 p-3 rounded-xl bg-blue-500/20">
            <svg className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div className="ml-4">
            <h3 id="modal-title" className="text-2xl font-bold text-white">
              File Transfer Request
            </h3>
            <p className="text-sm font-mono text-gray-400">
              Incoming file from peer
            </p>
          </div>
        </div>
        
        <div id="modal-description" className="mb-8">
          <p className="text-lg mb-4 text-gray-300">
            Someone wants to send you a file:
          </p>
          <div className="rounded-xl p-4 border bg-white/5 border-white/10">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-purple-500/20">
                <svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg truncate text-white">
                  {pendingTransfer.fileName}
                </p>
                <p className="text-sm font-mono text-gray-400">
                  {formatFileSize(pendingTransfer.fileSize)}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-4">
          <button
            onClick={onReject}
            className="px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 text-gray-300 bg-gray-700/50 border border-gray-600 hover:bg-gray-600/50 hover:text-red-300"
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Reject</span>
            </div>
          </button>
          <button
            onClick={onAccept}
            className="px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-blue-500/25"
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Accept</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default FileTransferConfirmationModal