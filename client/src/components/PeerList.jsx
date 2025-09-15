import React from 'react'

const PeerList = ({ peers, onPeerSelect, selectedPeer }) => {
  return (
    <div className="rounded-2xl backdrop-blur-sm border transition-all duration-500 bg-white/5 border-white/10 shadow-2xl h-full flex flex-col">
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 rounded-xl bg-blue-500/20">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">
            Available Peers
          </h2>
          <div className="px-3 py-1 rounded-full text-sm font-mono bg-blue-500/20 text-blue-300">
            {peers.length}
          </div>
        </div>
        
        <div className="flex-1 flex flex-col">
          {peers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-gray-700/50">
                <svg className="w-8 h-8 text-gray-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <p className="text-lg font-mono text-gray-400">
                Looking for peers...
              </p>
              <p className="text-sm mt-2 text-gray-500">
                Make sure other devices are on the same network
              </p>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
            {peers.map((peer, index) => (
              <button
                key={peer.id}
                onClick={() => onPeerSelect(peer)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-300 transform hover:scale-105 hover:shadow-lg group ${
                  selectedPeer?.id === peer.id
                    ? 'bg-blue-500/20 border-blue-400/50 text-blue-100 shadow-blue-500/25'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                }`}
                style={{
                  animationDelay: `${index * 100}ms`,
                  animation: 'fadeInUp 0.6s ease-out forwards'
                }}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    selectedPeer?.id === peer.id
                      ? 'bg-blue-500/30'
                      : 'bg-gray-700/50 group-hover:bg-gray-600/50'
                  }`}>
                    <svg className={`w-6 h-6 ${
                      selectedPeer?.id === peer.id
                        ? 'text-blue-300'
                        : 'text-gray-400 group-hover:text-gray-300'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-lg truncate ${
                      selectedPeer?.id === peer.id
                        ? 'text-blue-100'
                        : 'text-white'
                    }`}>
                      {peer.name}
                    </div>
                    <div className={`text-sm font-mono ${
                      selectedPeer?.id === peer.id
                        ? 'text-blue-300'
                        : 'text-gray-400'
                    }`}>
                      {peer.host}:{peer.port}
                    </div>
                  </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs font-mono text-gray-400">
                              Available
                            </span>
                          </div>
                          {selectedPeer?.id === peer.id && (
                            <div className="flex items-center space-x-1">
                              <div className="p-1.5 rounded-full bg-blue-500/30">
                                <svg className="w-3 h-3 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <span className="text-xs font-mono text-blue-300">
                                Selected
                              </span>
                            </div>
                          )}
                        </div>
                </div>
              </button>
            ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PeerList