// ── Layer definitions ────────────────────────────────────────────────────────

export interface LayerDef {
  id: string
  title: string
  description?: string
}

// ── Node meta shapes ─────────────────────────────────────────────────────────
// meta is open (additionalProperties: true), but we recognise these shapes.

export interface DiffLine {
  type: 'insert' | 'delete' | 'context'
  content: string
}

export interface Hunk {
  header: string
  is_formatting_only: boolean
  lines: DiffLine[]
}

/** Node whose meta contains diff hunks — always a leaf. */
export interface DiffMeta {
  file?: string
  hunks: Hunk[]
  [key: string]: unknown
}

/** Node whose meta contains symbol signature info. */
export interface SymbolMeta {
  kind?: string
  file?: string
  signature_before?: string | null
  signature_after?: string | null
  [key: string]: unknown
}

/** Node whose meta contains aggregate stats (packages, domains, services…). */
export interface GroupMeta {
  files_changed?: number
  insertions?: number
  deletions?: number
  change_pct?: number
  [key: string]: unknown
}

export type NodeMeta = DiffMeta | SymbolMeta | GroupMeta | Record<string, unknown>

// ── Core node type ────────────────────────────────────────────────────────────

export interface ReviewNode {
  id: string
  layer: string
  parent: string | null
  title: string
  summary: string | null
  change_type: 'added' | 'modified' | 'deleted' | null
  meta: NodeMeta
}

// ── Top-level review ──────────────────────────────────────────────────────────

export interface SemanticReview {
  version: string
  generated_at: string
  pr: {
    number: number
    title: string
    url: string
    base: string
    head: string
  }
  /** Ordered from coarsest to finest; project-defined. */
  layers: LayerDef[]
  /** Flat list; form a tree via parent IDs. */
  nodes: ReviewNode[]
}

// ── Type guards ───────────────────────────────────────────────────────────────

export function isDiffMeta(meta: NodeMeta): meta is DiffMeta {
  return Array.isArray((meta as DiffMeta).hunks)
}

export function isSymbolMeta(meta: NodeMeta): meta is SymbolMeta {
  const m = meta as SymbolMeta
  return !isDiffMeta(meta) && (m.signature_after !== undefined || m.signature_before !== undefined)
}

// ── Tree helpers ──────────────────────────────────────────────────────────────

export function getChildren(nodes: ReviewNode[], parentId: string | null): ReviewNode[] {
  return nodes.filter((n) => n.parent === parentId)
}

export function hasChildren(nodes: ReviewNode[], nodeId: string): boolean {
  return nodes.some((n) => n.parent === nodeId)
}

export function getNode(nodes: ReviewNode[], id: string): ReviewNode | undefined {
  return nodes.find((n) => n.id === id)
}

/** Walk up from a node id to root, returning the ancestor chain (root first). */
export function getAncestors(nodes: ReviewNode[], id: string): ReviewNode[] {
  const map = new Map(nodes.map((n) => [n.id, n]))
  const path: ReviewNode[] = []
  let current = map.get(id)
  while (current) {
    path.unshift(current)
    current = current.parent ? map.get(current.parent) : undefined
  }
  return path
}

// ── Parser ────────────────────────────────────────────────────────────────────

const START_MARKER = '<!-- semantic-pr-zoom -->'
const END_MARKER = '<!-- /semantic-pr-zoom -->'

function tryParse(jsonStr: string): SemanticReview | null {
  try {
    const parsed = JSON.parse(jsonStr)
    if (parsed.version !== '2.0') return null
    return parsed as SemanticReview
  } catch {
    return null
  }
}

export function parseSemanticComment(body: string): SemanticReview | null {
  const trimmed = body.trim()

  // 1. Raw JSON (file is just the JSON object)
  if (trimmed.startsWith('{')) {
    return tryParse(trimmed)
  }

  // 2. Markdown file with <!-- semantic-pr-zoom --> markers
  const startIdx = body.indexOf(START_MARKER)
  const endIdx = body.indexOf(END_MARKER)
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const between = body.slice(startIdx + START_MARKER.length, endIdx).trim()
    // Strip optional markdown code fence (```json ... ```)
    const fenced = between.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/m)
    return tryParse(fenced ? fenced[1] : between)
  }

  return null
}
