import NodeCard from './NodeCard'
import { getChildren, getNode, type ReviewNode, type LayerDef } from '../lib/parser'

interface Props {
  nodes: ReviewNode[]
  layers: LayerDef[]
  /** Stack of node IDs the user has zoomed into (empty = root level). */
  path: string[]
  onZoomIn: (nodeId: string) => void
  onZoomTo: (depth: number) => void
}

export default function ZoomView({ nodes, layers, path, onZoomIn, onZoomTo }: Props) {
  const currentParentId = path.length > 0 ? path[path.length - 1] : null
  const currentNodes = getChildren(nodes, currentParentId)

  // Determine current layer label
  const currentNode = currentParentId ? getNode(nodes, currentParentId) : null
  const currentLayerIdx = currentNode
    ? layers.findIndex((l) => l.id === currentNode.layer) + 1
    : 0
  const currentLayer = layers[currentLayerIdx]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Breadcrumb */}
      {path.length > 0 && (
        <div
          style={{
            background: '#161b22',
            borderBottom: '1px solid #21262d',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            overflowX: 'auto',
            flexShrink: 0,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <button
            onClick={() => onZoomTo(0)}
            style={{
              background: 'none', border: 'none', color: '#58a6ff',
              fontSize: 12, cursor: 'pointer', padding: '2px 4px',
              whiteSpace: 'nowrap', minHeight: 28,
            }}
          >
            Overview
          </button>
          {path.map((id, idx) => {
            const n = getNode(nodes, id)
            if (!n) return null
            const isLast = idx === path.length - 1
            return (
              <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#30363d', fontSize: 12 }}>›</span>
                <button
                  onClick={() => !isLast && onZoomTo(idx + 1)}
                  style={{
                    background: 'none', border: 'none',
                    color: isLast ? '#e6edf3' : '#58a6ff',
                    fontWeight: isLast ? 600 : 400,
                    fontSize: 12, cursor: isLast ? 'default' : 'pointer',
                    padding: '2px 4px', whiteSpace: 'nowrap',
                    maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis',
                    minHeight: 28,
                  }}
                >
                  {n.title}
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Layer label */}
      <div style={{ padding: '12px 16px 4px', flexShrink: 0 }}>
        {currentLayer && (
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>
              {currentLayer.title}
            </span>
            {currentLayer.description && (
              <p style={{ color: '#8b949e', fontSize: 12, marginTop: 2 }}>
                {currentLayer.description}
              </p>
            )}
          </div>
        )}
        {/* Zoom level indicator dots */}
        <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
          {layers.map((l, i) => (
            <div
              key={l.id}
              title={l.title}
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === currentLayerIdx ? '#58a6ff' : '#30363d',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Node list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 24px' }}>
        {currentNodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#8b949e', fontSize: 14 }}>
            No items at this level.
          </div>
        ) : (
          currentNodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              allNodes={nodes}
              onZoom={onZoomIn}
            />
          ))
        )}
      </div>
    </div>
  )
}
