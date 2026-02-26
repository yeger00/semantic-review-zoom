import { useState } from 'react'
import type { DiffItem, Hunk, Layer } from '../../lib/parser'

function DiffLine({ type, content }: { type: string; content: string }) {
  const colors: Record<string, { bg: string; text: string; prefix: string }> = {
    insert: { bg: 'rgba(63,185,80,0.1)', text: '#3fb950', prefix: '+' },
    delete: { bg: 'rgba(248,81,73,0.1)', text: '#f85149', prefix: '-' },
    context: { bg: 'transparent', text: '#8b949e', prefix: ' ' },
  }
  const c = colors[type] ?? colors.context

  return (
    <div
      style={{
        background: c.bg,
        display: 'flex',
        minWidth: 'max-content',
      }}
    >
      <span
        style={{
          color: c.text,
          padding: '0 8px',
          userSelect: 'none',
          flexShrink: 0,
          opacity: 0.7,
        }}
      >
        {c.prefix}
      </span>
      <span style={{ color: c.text, whiteSpace: 'pre' }}>{content}</span>
    </div>
  )
}

function HunkBlock({ hunk }: { hunk: Hunk }) {
  const [showFormatting, setShowFormatting] = useState(false)

  if (hunk.is_formatting_only && !showFormatting) {
    return (
      <div
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 6,
          padding: '8px 12px',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span
            style={{
              fontSize: 11,
              background: '#2d2a1a',
              color: '#e3b341',
              borderRadius: 4,
              padding: '2px 6px',
              fontWeight: 600,
            }}
          >
            FORMATTING ONLY
          </span>
          <span style={{ fontSize: 11, color: '#8b949e', marginLeft: 8 }}>{hunk.header}</span>
        </div>
        <button
          onClick={() => setShowFormatting(true)}
          style={{
            background: 'none',
            border: '1px solid #30363d',
            color: '#8b949e',
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Show
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 6,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: '#1c2128',
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#58a6ff' }}>{hunk.header}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {hunk.is_formatting_only && (
            <span
              style={{
                fontSize: 10,
                background: '#2d2a1a',
                color: '#e3b341',
                borderRadius: 4,
                padding: '1px 5px',
                fontWeight: 600,
              }}
            >
              FORMATTING
            </span>
          )}
          {showFormatting && (
            <button
              onClick={() => setShowFormatting(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#8b949e',
                fontSize: 11,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Collapse
            </button>
          )}
        </div>
      </div>
      <div style={{ overflowX: 'auto', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}>
        {hunk.lines.map((line, i) => (
          <DiffLine key={i} type={line.type} content={line.content} />
        ))}
      </div>
    </div>
  )
}

function FileAccordion({ item }: { item: DiffItem }) {
  const [open, setOpen] = useState(false)
  const insertions = item.hunks.reduce(
    (acc, h) => acc + h.lines.filter((l) => l.type === 'insert').length,
    0
  )
  const deletions = item.hunks.reduce(
    (acc, h) => acc + h.lines.filter((l) => l.type === 'delete').length,
    0
  )

  return (
    <div
      style={{
        border: '1px solid #30363d',
        borderRadius: 8,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          background: '#161b22',
          border: 'none',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          textAlign: 'left',
          minHeight: 44,
        }}
        aria-expanded={open}
      >
        <span style={{ fontSize: 13, flexShrink: 0 }}>📄</span>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#58a6ff',
            flex: 1,
            wordBreak: 'break-all',
            minWidth: 0,
          }}
        >
          {item.file}
        </span>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, fontSize: 12 }}>
          <span style={{ color: '#3fb950' }}>+{insertions}</span>
          <span style={{ color: '#f85149' }}>−{deletions}</span>
          <span style={{ color: '#8b949e' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: 12, background: '#0d1117' }}>
          {item.hunks.map((hunk, i) => (
            <HunkBlock key={i} hunk={hunk} />
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  layer: Layer<DiffItem>
}

export default function DiffLayer({ layer }: Props) {
  if (!layer || layer.items.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#8b949e' }}>
        No diffs found in this review.
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 16 }}>{layer.description}</p>
      {layer.items.map((item) => (
        <FileAccordion key={item.file} item={item} />
      ))}
    </div>
  )
}
