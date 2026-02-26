import { useState } from 'react'
import FileInput from './components/FileInput'
import LayerNav from './components/LayerNav'
import PackageLayer from './components/layers/PackageLayer'
import SymbolLayer from './components/layers/SymbolLayer'
import DiffLayer from './components/layers/DiffLayer'
import { getPackageLayer, getSymbolLayer, getDiffLayer, type SemanticReview } from './lib/parser'

export default function App() {
  const [review, setReview] = useState<SemanticReview | null>(null)
  const [activeTab, setActiveTab] = useState('packages')

  function handleLoad(r: SemanticReview) {
    setReview(r)
    setActiveTab('packages')
  }

  function handleBack() {
    setReview(null)
  }

  if (!review) {
    return <FileInput onLoad={handleLoad} />
  }

  const packageLayer = getPackageLayer(review)
  const symbolLayer = getSymbolLayer(review)
  const diffLayer = getDiffLayer(review)

  const NAV_HEIGHT = 76

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
          onClick={handleBack}
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
          aria-label="Load another file"
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
            #{review.pr.number} {review.pr.title}
          </div>
          <div style={{ fontSize: 11, color: '#8b949e', marginTop: 1 }}>
            {review.pr.head} → {review.pr.base}
          </div>
        </div>
      </header>

      {/* Layer panel */}
      <main
        style={{ flex: 1, overflowY: 'auto', paddingBottom: NAV_HEIGHT }}
        role="tabpanel"
        aria-label={activeTab}
      >
        {activeTab === 'packages' && packageLayer && <PackageLayer layer={packageLayer} />}
        {activeTab === 'symbols' && symbolLayer && <SymbolLayer layer={symbolLayer} />}
        {activeTab === 'diffs' && diffLayer && <DiffLayer layer={diffLayer} />}
      </main>

      <LayerNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  )
}
