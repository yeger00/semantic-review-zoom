import type { PackageItem, Layer } from '../../lib/parser'

const CHANGE_COLORS: Record<string, { bg: string; text: string }> = {
  added: { bg: '#1a4731', text: '#3fb950' },
  modified: { bg: '#2d2a1a', text: '#e3b341' },
  deleted: { bg: '#4d1f1f', text: '#f85149' },
}

function Badge({ type }: { type: string }) {
  const c = CHANGE_COLORS[type] ?? { bg: '#21262d', text: '#8b949e' }
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {type}
    </span>
  )
}

function ChangeBar({ pct }: { pct: number }) {
  return (
    <div style={{ background: '#21262d', borderRadius: 4, height: 6, overflow: 'hidden', marginTop: 8 }}>
      <div
        style={{
          width: `${Math.min(pct, 100)}%`,
          height: '100%',
          background: pct > 66 ? '#f85149' : pct > 33 ? '#e3b341' : '#3fb950',
          borderRadius: 4,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  )
}

function PackageCard({ item }: { item: PackageItem }) {
  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 8,
        padding: '16px',
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>{item.kind === 'module' ? '📦' : '📁'}</span>
          <span
            style={{
              fontWeight: 600,
              fontSize: 15,
              color: '#e6edf3',
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.name}
          </span>
        </div>
        <Badge type={item.change_type} />
      </div>

      <ChangeBar pct={item.change_pct} />

      <p style={{ color: '#8b949e', fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>{item.summary}</p>

      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 10,
          fontSize: 12,
          color: '#8b949e',
        }}
      >
        <span>📄 {item.files_changed} {item.files_changed === 1 ? 'file' : 'files'}</span>
        <span style={{ color: '#3fb950' }}>+{item.insertions}</span>
        <span style={{ color: '#f85149' }}>−{item.deletions}</span>
        <span style={{ color: '#8b949e', marginLeft: 'auto' }}>{item.change_pct}% changed</span>
      </div>
    </div>
  )
}

interface Props {
  layer: Layer<PackageItem>
}

export default function PackageLayer({ layer }: Props) {
  if (!layer || layer.items.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#8b949e' }}>
        No packages found in this review.
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 16 }}>{layer.description}</p>
      {layer.items.map((item) => (
        <PackageCard key={item.name} item={item} />
      ))}
    </div>
  )
}
