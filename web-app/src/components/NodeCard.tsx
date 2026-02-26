import { useState } from 'react'
import { isDiffMeta, isSymbolMeta, hasChildren, type ReviewNode, type NodeMeta, type Hunk } from '../lib/parser'

// ── Shared atoms ──────────────────────────────────────────────────────────────

const CHANGE_COLORS = {
  added:    { bg: '#1a4731', text: '#3fb950' },
  modified: { bg: '#2d2a1a', text: '#e3b341' },
  deleted:  { bg: '#4d1f1f', text: '#f85149' },
}

function ChangeBadge({ type }: { type: string | null }) {
  if (!type) return null
  const c = CHANGE_COLORS[type as keyof typeof CHANGE_COLORS] ?? { bg: '#21262d', text: '#8b949e' }
  return (
    <span style={{
      background: c.bg, color: c.text, borderRadius: 4,
      padding: '2px 7px', fontSize: 11, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
    }}>
      {type}
    </span>
  )
}

// ── Diff card (leaf) ──────────────────────────────────────────────────────────

function DiffLine({ type, content }: { type: string; content: string }) {
  const styles = {
    insert:  { bg: 'rgba(63,185,80,0.1)',  text: '#3fb950', prefix: '+' },
    delete:  { bg: 'rgba(248,81,73,0.1)',  text: '#f85149', prefix: '−' },
    context: { bg: 'transparent',          text: '#8b949e', prefix: ' ' },
  }
  const s = styles[type as keyof typeof styles] ?? styles.context
  return (
    <div style={{ background: s.bg, display: 'flex', minWidth: 'max-content' }}>
      <span style={{ color: s.text, padding: '0 8px', userSelect: 'none', opacity: 0.6, flexShrink: 0 }}>
        {s.prefix}
      </span>
      <span style={{ color: s.text, whiteSpace: 'pre' }}>{content}</span>
    </div>
  )
}

function HunkBlock({ hunk, defaultOpen }: { hunk: Hunk; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  if (hunk.is_formatting_only && !open) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#161b22', border: '1px solid #30363d', borderRadius: 6,
        padding: '7px 12px', marginBottom: 6,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ background: '#2d2a1a', color: '#e3b341', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>
            FORMATTING
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#8b949e' }}>{hunk.header}</span>
        </div>
        <button onClick={() => setOpen(true)} style={{
          background: 'none', border: '1px solid #30363d', color: '#8b949e',
          borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
        }}>Show</button>
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid #30363d', borderRadius: 6, marginBottom: 6, overflow: 'hidden' }}>
      <div style={{
        background: '#1c2128', padding: '4px 12px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#58a6ff' }}>{hunk.header}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {hunk.is_formatting_only && (
            <span style={{ background: '#2d2a1a', color: '#e3b341', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>
              FORMATTING
            </span>
          )}
          {hunk.is_formatting_only && open && (
            <button onClick={() => setOpen(false)} style={{
              background: 'none', border: 'none', color: '#8b949e', fontSize: 11, cursor: 'pointer', padding: 0,
            }}>Collapse</button>
          )}
        </div>
      </div>
      <div style={{ overflowX: 'auto', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}>
        {hunk.lines.map((l, i) => <DiffLine key={i} type={l.type} content={l.content} />)}
      </div>
    </div>
  )
}

function DiffCard({ node }: { node: ReviewNode }) {
  const meta = node.meta as { file?: string; hunks?: Hunk[] }
  const hunks = meta.hunks ?? []
  const insertions = hunks.reduce((a, h) => a + h.lines.filter(l => l.type === 'insert').length, 0)
  const deletions  = hunks.reduce((a, h) => a + h.lines.filter(l => l.type === 'delete').length, 0)

  return (
    <div style={{ border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{
        background: '#161b22', padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 13 }}>📄</span>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#58a6ff', flex: 1, wordBreak: 'break-all' }}>
          {meta.file ?? node.title}
        </span>
        <span style={{ color: '#3fb950', fontSize: 12 }}>+{insertions}</span>
        <span style={{ color: '#f85149', fontSize: 12 }}>−{deletions}</span>
        <ChangeBadge type={node.change_type} />
      </div>
      <div style={{ background: '#0d1117', padding: '10px 12px' }}>
        {hunks.length === 0
          ? <p style={{ color: '#8b949e', fontSize: 12 }}>No hunks.</p>
          : hunks.map((h, i) => (
              <HunkBlock key={i} hunk={h} defaultOpen={!h.is_formatting_only} />
            ))
        }
      </div>
    </div>
  )
}

// ── Symbol card ───────────────────────────────────────────────────────────────

const KIND_ICONS: Record<string, string> = {
  function: 'ƒ', method: 'm', class: 'C', struct: 'S', interface: 'I',
}

function SymbolCard({ node, canZoom, onZoom }: { node: ReviewNode; canZoom: boolean; onZoom: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const meta = node.meta as { kind?: string; file?: string; signature_before?: string | null; signature_after?: string | null }
  const hasSig = meta.signature_before !== null || meta.signature_after !== null
  const icon = KIND_ICONS[meta.kind ?? ''] ?? '◆'

  return (
    <div
      style={{
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: 8, padding: '13px 14px', marginBottom: 10,
        cursor: canZoom ? 'pointer' : 'default',
      }}
      onClick={canZoom ? onZoom : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: 5, background: '#21262d',
          fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#8b949e', flexShrink: 0,
        }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: '#e6edf3' }}>
              {node.title}
            </span>
            <ChangeBadge type={node.change_type} />
            {meta.file && (
              <span style={{ fontSize: 11, color: '#8b949e', fontFamily: 'monospace' }}>{meta.file}</span>
            )}
          </div>
          {node.summary && (
            <p style={{ color: '#8b949e', fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{node.summary}</p>
          )}
        </div>
        {canZoom
          ? <span style={{ color: '#8b949e', fontSize: 16, flexShrink: 0 }}>›</span>
          : hasSig && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
                style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: 13, cursor: 'pointer', padding: 0, flexShrink: 0 }}
              >{expanded ? '▲' : '▼'}</button>
            )
        }
      </div>
      {!canZoom && expanded && hasSig && (
        <div style={{
          background: '#0d1117', borderRadius: 6, padding: '10px 12px',
          marginTop: 10, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6, overflowX: 'auto',
        }}>
          {meta.signature_before && (
            <div style={{ color: '#f85149' }}>
              <span style={{ opacity: 0.5, userSelect: 'none' }}>− </span>{meta.signature_before}
            </div>
          )}
          {meta.signature_after && (
            <div style={{ color: '#3fb950' }}>
              <span style={{ opacity: 0.5, userSelect: 'none' }}>+ </span>{meta.signature_after}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Group card (packages, domains, services, …) ───────────────────────────────

function ChangeBar({ pct }: { pct: number }) {
  return (
    <div style={{ background: '#21262d', borderRadius: 4, height: 5, overflow: 'hidden', marginTop: 8 }}>
      <div style={{
        width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 4,
        background: pct > 66 ? '#f85149' : pct > 33 ? '#e3b341' : '#3fb950',
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

function GroupCard({ node, onZoom }: { node: ReviewNode; onZoom: () => void }) {
  const meta = node.meta as { files_changed?: number; insertions?: number; deletions?: number; change_pct?: number }

  return (
    <div
      onClick={onZoom}
      style={{
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: 8, padding: '14px', marginBottom: 10, cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 600, color: '#e6edf3', wordBreak: 'break-all' }}>
          {node.title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ChangeBadge type={node.change_type} />
          <span style={{ color: '#8b949e', fontSize: 16 }}>›</span>
        </div>
      </div>

      {meta.change_pct !== undefined && <ChangeBar pct={meta.change_pct} />}

      {node.summary && (
        <p style={{ color: '#8b949e', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{node.summary}</p>
      )}

      {(meta.files_changed !== undefined || meta.insertions !== undefined) && (
        <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 12, color: '#8b949e' }}>
          {meta.files_changed !== undefined && (
            <span>📄 {meta.files_changed} {meta.files_changed === 1 ? 'file' : 'files'}</span>
          )}
          {meta.insertions !== undefined && (
            <span style={{ color: '#3fb950' }}>+{meta.insertions}</span>
          )}
          {meta.deletions !== undefined && (
            <span style={{ color: '#f85149' }}>−{meta.deletions}</span>
          )}
          {meta.change_pct !== undefined && (
            <span style={{ marginLeft: 'auto' }}>{meta.change_pct}% changed</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

interface Props {
  node: ReviewNode
  allNodes: ReviewNode[]
  onZoom: (id: string) => void
}

export default function NodeCard({ node, allNodes, onZoom }: Props) {
  const can = hasChildren(allNodes, node.id)
  const meta = node.meta as NodeMeta

  if (isDiffMeta(meta)) {
    return <DiffCard node={node} />
  }

  if (isSymbolMeta(meta)) {
    return <SymbolCard node={node} canZoom={can} onZoom={() => onZoom(node.id)} />
  }

  return <GroupCard node={node} onZoom={() => onZoom(node.id)} />
}
