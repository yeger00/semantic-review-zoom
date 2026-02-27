import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { getChildren, getNode, hasChildren as nodeHasChildren, type SemanticReview } from '../lib/parser'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  reviewId: string
  title: string
  isChanged: boolean
  canZoom: boolean
  r: number
  fill: string
  isCenter: boolean
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: string | SimNode
  target: string | SimNode
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CENTER_ID = '__center__'

function nodeColor(changeType: string | null, insertions: number, deletions: number): string {
  if (!changeType) return '#e6edf3'                   // unchanged → white
  if (changeType === 'added') return '#3fb950'         // added → green
  if (changeType === 'deleted') return '#f85149'       // deleted → red
  const total = insertions + deletions
  if (total === 0) return '#e3b341'                    // modified, no stats → yellow
  return d3.interpolateRgb('#f85149', '#3fb950')(insertions / total)
}

function nodeRadius(insertions: number, deletions: number, isChanged: boolean): number {
  if (!isChanged) return 7
  const total = insertions + deletions
  if (total === 0) return 22
  return Math.max(20, Math.min(70, 18 + Math.sqrt(total) * 2.5))
}

function textColor(fill: string): string {
  try {
    const c = d3.color(fill)!.rgb()
    return (c.r * 299 + c.g * 587 + c.b * 114) / 1000 > 140 ? '#0d1117' : '#e6edf3'
  } catch { return '#e6edf3' }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  review: SemanticReview
  path: string[]
  onZoomIn: (nodeId: string) => void
  onZoomTo: (depth: number) => void
}

export default function GraphView({ review, path, onZoomIn, onZoomTo }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const onZoomInRef = useRef(onZoomIn)
  useEffect(() => { onZoomInRef.current = onZoomIn }, [onZoomIn])

  const { nodes, layers, pr } = review
  const currentParentId = path.length > 0 ? path[path.length - 1] : null
  const currentNodes = getChildren(nodes, currentParentId)
  const levelKey = path.join('/')

  const currentLayerIdx = currentParentId
    ? layers.findIndex(l => l.id === getNode(nodes, currentParentId)?.layer) + 1
    : 0
  const currentLayer = layers[currentLayerIdx]

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || currentNodes.length === 0) return

    const w = svgEl.clientWidth || 360
    const h = svgEl.clientHeight || 500

    const root = d3.select<SVGSVGElement, unknown>(svgEl)
    root.selectAll('*').remove()

    const container = root.append('g')

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 6])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        container.attr('transform', event.transform.toString())
      })
    root.call(zoomBehavior).on('dblclick.zoom', null)

    // ── Center node ────────────────────────────────────────────────────────
    const parentReviewNode = currentParentId ? getNode(nodes, currentParentId) : null
    const centerLabel = parentReviewNode?.title ?? `PR #${pr.number}`

    const centerNode: SimNode = {
      reviewId: CENTER_ID, title: centerLabel,
      isChanged: false, canZoom: false,
      r: parentReviewNode ? 20 : 26, fill: '#21262d', isCenter: true,
      x: w / 2, y: h / 2, fx: w / 2, fy: h / 2,
    }

    // ── Child sim nodes ────────────────────────────────────────────────────
    const childSimNodes: SimNode[] = currentNodes.map(n => {
      const meta = n.meta as Record<string, unknown>
      const ins = (meta.insertions as number) ?? 0
      const del = (meta.deletions as number) ?? 0
      const isChanged = !!n.change_type
      return {
        reviewId: n.id, title: n.title,
        isChanged, canZoom: nodeHasChildren(nodes, n.id),
        r: nodeRadius(ins, del, isChanged),
        fill: nodeColor(n.change_type, ins, del),
        isCenter: false,
        x: w / 2 + (Math.random() - 0.5) * 80,
        y: h / 2 + (Math.random() - 0.5) * 80,
      }
    })

    const simNodes: SimNode[] = [centerNode, ...childSimNodes]
    const links: SimLink[] = childSimNodes.map(n => ({ source: CENTER_ID, target: n.reviewId }))

    // ── Simulation ─────────────────────────────────────────────────────────
    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links)
        .id(d => d.reviewId)
        .distance((l: SimLink) => (l.target as SimNode).r + 75)
        .strength(0.4))
      .force('charge', d3.forceManyBody<SimNode>().strength((d: SimNode) => -d.r * 6))
      .force('collide', d3.forceCollide<SimNode>().radius((d: SimNode) => d.r + 14).strength(0.85))

    // ── Links ──────────────────────────────────────────────────────────────
    const linkSel = container.append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', '#30363d')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1)

    // ── Node groups ────────────────────────────────────────────────────────
    const nodeG = container.selectAll<SVGGElement, SimNode>('.node')
      .data(simNodes, (d: SimNode) => d.reviewId)
      .join('g')
      .attr('class', 'node')
      .style('cursor', (d: SimNode) => d.canZoom ? 'pointer' : 'default')

    // Outer dashed ring for zoomable nodes
    nodeG.filter((d: SimNode) => d.canZoom)
      .append('circle')
      .attr('r', (d: SimNode) => d.r + 7)
      .attr('fill', 'none')
      .attr('stroke', (d: SimNode) => d.fill)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4)
      .attr('stroke-dasharray', '4 3')

    // Main circle
    nodeG.append('circle')
      .attr('r', (d: SimNode) => d.r)
      .attr('fill', (d: SimNode) => d.fill)
      .attr('fill-opacity', (d: SimNode) => d.isCenter ? 0.6 : d.isChanged ? 0.88 : 0.3)
      .attr('stroke', (d: SimNode) => d.isCenter ? '#58a6ff' : d.fill)
      .attr('stroke-width', (d: SimNode) => d.isCenter ? 1.5 : 1)
      .attr('stroke-opacity', 0.6)

    // Labels
    nodeG.filter((d: SimNode) => d.isCenter || (d.isChanged && d.r >= 16))
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', 'ui-monospace, "SF Mono", monospace')
      .attr('pointer-events', 'none')
      .each(function(this: SVGTextElement, d: SimNode) {
        const el = d3.select<SVGTextElement, SimNode>(this)
        const maxChars = Math.max(4, Math.floor(d.r / 4.5))
        const label = d.title.length > maxChars ? d.title.slice(0, maxChars - 1) + '…' : d.title
        const fontSize = d.isCenter ? 11 : Math.max(9, Math.min(13, d.r * 0.38))
        el.attr('fill', d.isCenter ? '#8b949e' : textColor(d.fill))
          .attr('font-size', fontSize)
          .attr('font-weight', d.isCenter ? '400' : '600')
          .text(label)
      })

    // Click to zoom
    nodeG.on('click', (_event: MouseEvent, d: SimNode) => {
      if (d.canZoom) onZoomInRef.current(d.reviewId)
    })

    // Drag
    const drag = d3.drag<SVGGElement, SimNode>()
      .on('start', (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x; d.fy = d.y
      })
      .on('drag', (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode) => {
        d.fx = event.x; d.fy = event.y
      })
      .on('end', (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode) => {
        if (!event.active) simulation.alphaTarget(0)
        if (!d.isCenter) { d.fx = null; d.fy = null }
      })
    nodeG.call(drag)

    // Tick
    simulation.on('tick', () => {
      linkSel
        .attr('x1', (d: SimLink) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d: SimLink) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d: SimLink) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d: SimLink) => (d.target as SimNode).y ?? 0)
      nodeG.attr('transform', (d: SimNode) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Fade in
    nodeG.attr('opacity', 0).transition().duration(350).attr('opacity', 1)
    linkSel.attr('opacity', 0).transition().duration(350).attr('opacity', 1)

    return () => { simulation.stop() }
  }, [levelKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Legend ────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0d1117' }}>

      {/* Breadcrumb */}
      {path.length > 0 && (
        <div style={{
          background: '#161b22', borderBottom: '1px solid #21262d',
          padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 4,
          overflowX: 'auto', flexShrink: 0,
        }}>
          <button onClick={() => onZoomTo(0)} style={crumbBtn}>Overview</button>
          {path.map((id, idx) => {
            const n = getNode(nodes, id)
            if (!n) return null
            const isLast = idx === path.length - 1
            return (
              <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#30363d', fontSize: 12 }}>›</span>
                <button
                  onClick={() => !isLast && onZoomTo(idx + 1)}
                  style={{ ...crumbBtn, color: isLast ? '#e6edf3' : '#58a6ff', fontWeight: isLast ? 700 : 400 }}
                >{n.title}</button>
              </span>
            )
          })}
        </div>
      )}

      {/* Layer label + depth dots */}
      <div style={{
        padding: '8px 14px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: '#8b949e' }}>
          {currentLayer?.title ?? 'Overview'}
          <span style={{ marginLeft: 6, color: '#30363d' }}>({currentNodes.length})</span>
        </span>
        <div style={{ display: 'flex', gap: 5 }}>
          {layers.map((l, i) => (
            <div key={l.id} title={l.title} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i === currentLayerIdx ? '#58a6ff' : '#30363d',
            }} />
          ))}
        </div>
      </div>

      {/* Graph */}
      {currentNodes.length === 0
        ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e', fontSize: 14 }}>
            No nodes at this level.
          </div>
        : <svg ref={svgRef} style={{ flex: 1, display: 'block', width: '100%', touchAction: 'none' }} />
      }

      {/* Legend */}
      <div style={{
        padding: '8px 14px', borderTop: '1px solid #21262d', flexShrink: 0,
        display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
      }}>
        {[
          { color: '#3fb950', label: 'Additions' },
          { color: '#f85149', label: 'Deletions' },
          { color: '#e6edf3', label: 'Unchanged' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, opacity: 0.85 }} />
            <span style={{ fontSize: 11, color: '#8b949e' }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11, color: '#30363d', marginLeft: 'auto' }}>tap to zoom · drag to move</span>
      </div>
    </div>
  )
}

const crumbBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#58a6ff',
  fontSize: 12, cursor: 'pointer', padding: '2px 4px',
  whiteSpace: 'nowrap', minHeight: 28,
}
