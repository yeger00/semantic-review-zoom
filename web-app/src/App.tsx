import { useState } from 'react'
import AuthGate, { getStoredToken, clearStoredToken } from './components/AuthGate'
import PRSelector from './components/PRSelector'
import LayerNav from './components/LayerNav'
import PackageLayer from './components/layers/PackageLayer'
import SymbolLayer from './components/layers/SymbolLayer'
import DiffLayer from './components/layers/DiffLayer'
import { getPackageLayer, getSymbolLayer, getDiffLayer, type SemanticReview } from './lib/parser'

type Screen = 'auth' | 'select' | 'review'

export default function App() {
  const [token, setToken] = useState<string | null>(getStoredToken)
  const [screen, setScreen] = useState<Screen>(token ? 'select' : 'auth')
  const [review, setReview] = useState<SemanticReview | null>(null)
  const [prTitle, setPrTitle] = useState('')
  const [activeTab, setActiveTab] = useState('packages')

  function handleAuth(t: string) {
    setToken(t)
    setScreen('select')
  }

  function handleClearToken() {
    clearStoredToken()
    setToken(null)
    setScreen('auth')
    setReview(null)
  }

  function handleSelectReview(r: SemanticReview, title: string) {
    setReview(r)
    setPrTitle(title)
    setActiveTab('packages')
    setScreen('review')
  }

  function handleBackToSelect() {
    setScreen('select')
    setReview(null)
  }

  if (screen === 'auth' || !token) {
    return <AuthGate onAuth={handleAuth} />
  }

  if (screen === 'select') {
    return (
      <PRSelector
        token={token}
        onSelect={handleSelectReview}
        onClearToken={handleClearToken}
      />
    )
  }

  // Review screen
  if (!review) return null

  const packageLayer = getPackageLayer(review)
  const symbolLayer = getSymbolLayer(review)
  const diffLayer = getDiffLayer(review)

  const NAV_HEIGHT = 76 // px — fixed bottom nav height

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        style={{
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleBackToSelect}
          style={{
            background: 'none',
            border: 'none',
            color: '#8b949e',
            cursor: 'pointer',
            fontSize: 18,
            padding: '4px 8px',
            minHeight: 36,
            flexShrink: 0,
          }}
          aria-label="Back to PR list"
        >
          ←
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#e6edf3',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            #{review.pr.number} {prTitle}
          </div>
          <div style={{ fontSize: 11, color: '#8b949e', marginTop: 1 }}>
            {review.pr.head} → {review.pr.base}
          </div>
        </div>
      </header>

      {/* Layer panel */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: NAV_HEIGHT,
        }}
        role="tabpanel"
        aria-label={activeTab}
      >
        {activeTab === 'packages' && packageLayer && (
          <PackageLayer layer={packageLayer} />
        )}
        {activeTab === 'symbols' && symbolLayer && (
          <SymbolLayer layer={symbolLayer} />
        )}
        {activeTab === 'diffs' && diffLayer && (
          <DiffLayer layer={diffLayer} />
        )}
      </main>

      <LayerNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  )
}
