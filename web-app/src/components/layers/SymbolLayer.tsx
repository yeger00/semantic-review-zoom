import { useState } from 'react'
import type { SymbolItem, Layer } from '../../lib/parser'

const KIND_ICONS: Record<string, string> = {
  function: 'ƒ',
  method: 'm',
  class: 'C',
  struct: 'S',
  interface: 'I',
}

const CHANGE_COLORS: Record<string, string> = {
  added: '#3fb950',
  modified: '#e3b341',
  deleted: '#f85149',
}

function SignatureDiff({ before, after }: { before: string | null; after: string | null }) {
  return (
    <div
      style={{
        background: '#0d1117',
        borderRadius: 6,
        padding: '10px 12px',
        marginTop: 10,
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 1.6,
        overflowX: 'auto',
      }}
    >
      {before && (
        <div style={{ color: '#f85149' }}>
          <span style={{ userSelect: 'none', opacity: 0.5 }}>− </span>
          {before}
        </div>
      )}
      {after && (
        <div style={{ color: '#3fb950' }}>
          <span style={{ userSelect: 'none', opacity: 0.5 }}>+ </span>
          {after}
        </div>
      )}
    </div>
  )
}

function SymbolItem_({ item }: { item: SymbolItem }) {
  const [expanded, setExpanded] = useState(false)
  const hasSig = item.signature_before !== null || item.signature_after !== null

  return (
    <div
      style={{
        borderBottom: '1px solid #21262d',
        padding: '12px 0',
      }}
    >
      <button
        onClick={() => hasSig && setExpanded((e) => !e)}
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: hasSig ? 'pointer' : 'default',
          textAlign: 'left',
          width: '100%',
          padding: 0,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}
        aria-expanded={expanded}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 4,
            background: '#21262d',
            fontFamily: 'monospace',
            fontSize: 11,
            fontWeight: 700,
            color: '#8b949e',
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          {KIND_ICONS[item.kind] ?? '?'}
        </span>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: '#e6edf3' }}>
              {item.name}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: CHANGE_COLORS[item.change_type] ?? '#8b949e',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {item.change_type}
            </span>
            {hasSig && (
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8b949e' }}>
                {expanded ? '▲' : '▼'}
              </span>
            )}
          </div>
          <p style={{ color: '#8b949e', fontSize: 12, marginTop: 3, lineHeight: 1.4 }}>{item.summary}</p>
        </div>
      </button>

      {expanded && hasSig && (
        <SignatureDiff before={item.signature_before} after={item.signature_after} />
      )}
    </div>
  )
}

function FileGroup({ file, items }: { file: string; items: SymbolItem[] }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 0',
          borderBottom: '1px solid #30363d',
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 13, color: '#8b949e' }}>📄</span>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#58a6ff', wordBreak: 'break-all' }}>
          {file}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8b949e' }}>
          {items.length} {items.length === 1 ? 'symbol' : 'symbols'}
        </span>
      </div>
      {items.map((item) => (
        <SymbolItem_ key={`${item.name}-${item.kind}`} item={item} />
      ))}
    </div>
  )
}

interface Props {
  layer: Layer<SymbolItem>
}

export default function SymbolLayer({ layer }: Props) {
  if (!layer || layer.items.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#8b949e' }}>
        No symbols found in this review.
      </div>
    )
  }

  // Group by file
  const byFile = new Map<string, SymbolItem[]>()
  for (const item of layer.items) {
    if (!byFile.has(item.file)) byFile.set(item.file, [])
    byFile.get(item.file)!.push(item)
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 16 }}>{layer.description}</p>
      {Array.from(byFile.entries()).map(([file, items]) => (
        <FileGroup key={file} file={file} items={items} />
      ))}
    </div>
  )
}
