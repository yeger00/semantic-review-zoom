import { useState } from 'react'
import FileInput from './components/FileInput'
import GraphView from './components/GraphView'
import { type SemanticReview } from './lib/parser'

export default function App() {
  const [review, setReview] = useState<SemanticReview | null>(null)
  const [path, setPath] = useState<string[]>([])

  function handleLoad(r: SemanticReview) {
    setReview(r)
    setPath([])
  }

  function handleBack() {
    setReview(null)
    setPath([])
  }

  function zoomIn(nodeId: string) {
    setPath(p => [...p, nodeId])
  }

  function zoomTo(depth: number) {
    setPath(p => p.slice(0, depth))
  }

  if (!review) {
    return <FileInput onLoad={handleLoad} />
  }

  const currentNode = path.length > 0
    ? review.nodes.find(n => n.id === path[path.length - 1])
    : null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: '#161b22', borderBottom: '1px solid #30363d',
        padding: '10px 16px', display: 'flex', alignItems: 'center',
        gap: 10, flexShrink: 0,
      }}>
        <button
          onClick={path.length > 0 ? () => zoomTo(path.length - 1) : handleBack}
          style={{
            background: 'none', border: 'none', color: '#8b949e',
            cursor: 'pointer', fontSize: 18, padding: '4px 8px',
            minHeight: 36, flexShrink: 0,
          }}
          aria-label={path.length > 0 ? 'Zoom out' : 'Load another file'}
        >
          ←
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: '#e6edf3',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {currentNode ? currentNode.title : `#${review.pr.number} ${review.pr.title}`}
          </div>
          <div style={{ fontSize: 11, color: '#8b949e', marginTop: 1 }}>
            {currentNode ? review.pr.title : `${review.pr.head} → ${review.pr.base}`}
          </div>
        </div>
      </header>

      {/* Graph */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <GraphView
          review={review}
          path={path}
          onZoomIn={zoomIn}
          onZoomTo={zoomTo}
        />
      </div>
    </div>
  )
}
