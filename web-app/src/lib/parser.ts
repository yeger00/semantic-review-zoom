export interface PackageItem {
  name: string
  kind: 'package' | 'module'
  change_type: 'added' | 'modified' | 'deleted'
  change_pct: number
  summary: string
  files_changed: number
  insertions: number
  deletions: number
}

export interface SymbolItem {
  name: string
  kind: 'function' | 'struct' | 'class' | 'method' | 'interface'
  file: string
  change_type: 'added' | 'modified' | 'deleted'
  signature_before: string | null
  signature_after: string | null
  summary: string
}

export interface DiffLine {
  type: 'insert' | 'delete' | 'context'
  content: string
}

export interface Hunk {
  header: string
  is_formatting_only: boolean
  lines: DiffLine[]
}

export interface DiffItem {
  file: string
  package: string
  hunks: Hunk[]
}

export interface Layer<T> {
  id: 'packages' | 'symbols' | 'diffs'
  title: string
  description: string
  items: T[]
}

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
  layers: [Layer<PackageItem>, Layer<SymbolItem>, Layer<DiffItem>]
}

const START_MARKER = '<!-- semantic-pr-zoom -->'
const END_MARKER = '<!-- /semantic-pr-zoom -->'

export function parseSemanticComment(body: string): SemanticReview | null {
  const startIdx = body.indexOf(START_MARKER)
  const endIdx = body.indexOf(END_MARKER)
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null

  const between = body.slice(startIdx + START_MARKER.length, endIdx).trim()

  // Strip optional markdown code fence (```json ... ```)
  const fenced = between.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/m)
  const jsonStr = fenced ? fenced[1] : between

  try {
    return JSON.parse(jsonStr) as SemanticReview
  } catch {
    return null
  }
}

export function getPackageLayer(review: SemanticReview): Layer<PackageItem> {
  return review.layers.find((l) => l.id === 'packages') as Layer<PackageItem>
}

export function getSymbolLayer(review: SemanticReview): Layer<SymbolItem> {
  return review.layers.find((l) => l.id === 'symbols') as Layer<SymbolItem>
}

export function getDiffLayer(review: SemanticReview): Layer<DiffItem> {
  return review.layers.find((l) => l.id === 'diffs') as Layer<DiffItem>
}
