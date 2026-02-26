import { useState, useEffect, useRef } from 'react'
import { searchRepos, listPRs, getSemanticComment, type Repo, type PR } from '../lib/github'
import { parseSemanticComment, type SemanticReview } from '../lib/parser'

interface Props {
  token: string
  onSelect: (review: SemanticReview, prTitle: string) => void
  onClearToken: () => void
}

export default function PRSelector({ token, onSelect, onClearToken }: Props) {
  const [query, setQuery] = useState('')
  const [repos, setRepos] = useState<Repo[]>([])
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null)
  const [prs, setPrs] = useState<PR[]>([])
  const [loading, setLoading] = useState(false)
  const [prLoading, setPrLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [commentError, setCommentError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setRepos([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const results = await searchRepos(token, query)
        setRepos(results)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, token])

  async function selectRepo(repo: Repo) {
    setSelectedRepo(repo)
    setRepos([])
    setQuery(repo.full_name)
    setPrLoading(true)
    setError(null)
    try {
      const results = await listPRs(token, repo.full_name)
      setPrs(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PRs')
    } finally {
      setPrLoading(false)
    }
  }

  async function selectPR(pr: PR) {
    if (!selectedRepo) return
    setCommentError(null)
    setPrLoading(true)
    try {
      const comment = await getSemanticComment(token, selectedRepo.full_name, pr.number)
      if (!comment) {
        setCommentError(`No semantic review found on PR #${pr.number}. Run /create-semantic-review ${pr.number} in the project.`)
        return
      }
      const review = parseSemanticComment(comment.body)
      if (!review) {
        setCommentError('Found a semantic-pr-zoom comment but could not parse the JSON. It may be malformed.')
        return
      }
      onSelect(review, pr.title)
    } catch (e) {
      setCommentError(e instanceof Error ? e.message : 'Failed to load review')
    } finally {
      setPrLoading(false)
    }
  }

  function resetRepo() {
    setSelectedRepo(null)
    setPrs([])
    setQuery('')
    setError(null)
    setCommentError(null)
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e6edf3' }}>🔍 Semantic PR Zoom</div>
          <div style={{ fontSize: 12, color: '#8b949e', marginTop: 2 }}>Select a PR to review</div>
        </div>
        <button
          onClick={onClearToken}
          style={{
            background: 'none',
            border: '1px solid #30363d',
            color: '#8b949e',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 12,
            cursor: 'pointer',
            minHeight: 36,
          }}
        >
          Sign out
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (selectedRepo) resetRepo()
          }}
          placeholder="Search repositories…"
          style={{
            width: '100%',
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 8,
            padding: '12px 14px',
            color: '#e6edf3',
            fontSize: 15,
            outline: 'none',
            minHeight: 44,
          }}
        />
        {loading && (
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#8b949e', fontSize: 12 }}>
            …
          </span>
        )}
      </div>

      {error && <p style={{ color: '#f85149', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {/* Repo dropdown */}
      {repos.length > 0 && !selectedRepo && (
        <div
          style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          {repos.map((repo) => (
            <button
              key={repo.full_name}
              onClick={() => selectRepo(repo)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid #21262d',
                padding: '12px 16px',
                textAlign: 'left',
                cursor: 'pointer',
                minHeight: 44,
                display: 'block',
              }}
            >
              <div style={{ fontWeight: 600, color: '#58a6ff', fontSize: 14 }}>{repo.full_name}</div>
              {repo.description && (
                <div style={{ color: '#8b949e', fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {repo.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* PR list */}
      {selectedRepo && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button
              onClick={resetRepo}
              style={{
                background: 'none',
                border: 'none',
                color: '#8b949e',
                cursor: 'pointer',
                fontSize: 16,
                padding: '4px 8px',
                minHeight: 36,
              }}
            >
              ←
            </button>
            <span style={{ color: '#8b949e', fontSize: 14 }}>Open PRs in <strong style={{ color: '#e6edf3' }}>{selectedRepo.full_name}</strong></span>
          </div>

          {prLoading && <p style={{ color: '#8b949e', fontSize: 14 }}>Loading…</p>}

          {commentError && (
            <div
              style={{
                background: '#1c1a14',
                border: '1px solid #e3b341',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 12,
                color: '#e3b341',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              ⚠️ {commentError}
            </div>
          )}

          {!prLoading && prs.length === 0 && !error && (
            <p style={{ color: '#8b949e', fontSize: 14 }}>No open pull requests.</p>
          )}

          <div>
            {prs.map((pr) => (
              <button
                key={pr.number}
                onClick={() => selectPR(pr)}
                style={{
                  width: '100%',
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: 8,
                  padding: '14px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  marginBottom: 10,
                  display: 'block',
                  minHeight: 44,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: '#8b949e', fontSize: 13, flexShrink: 0, marginTop: 1 }}>#{pr.number}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#e6edf3', fontSize: 14, lineHeight: 1.4 }}>{pr.title}</div>
                    <div style={{ color: '#8b949e', fontSize: 12, marginTop: 4 }}>
                      by {pr.user.login} · {pr.head.ref} → {pr.base.ref}
                      {pr.draft && (
                        <span style={{ marginLeft: 6, background: '#21262d', color: '#8b949e', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>
                          Draft
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
