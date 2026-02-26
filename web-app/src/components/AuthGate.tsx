import { useState } from 'react'

const TOKEN_KEY = 'spz-token'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY)
}

interface Props {
  onAuth: (token: string) => void
}

export default function AuthGate({ onAuth }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const token = value.trim()
    if (!token) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `token ${token}` },
      })
      if (!res.ok) {
        setError('Invalid token — check your PAT and try again.')
        return
      }
      localStorage.setItem(TOKEN_KEY, token)
      onAuth(token)
    } catch {
      setError('Network error — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#0d1117',
      }}
    >
      <div style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#e6edf3',
              marginBottom: 8,
            }}
          >
            Semantic PR Zoom
          </h1>
          <p style={{ color: '#8b949e', fontSize: 14, lineHeight: 1.5 }}>
            Review pull requests semantically on mobile. Enter a GitHub Personal Access Token to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="pat"
            style={{ display: 'block', color: '#8b949e', fontSize: 12, fontWeight: 600, marginBottom: 8 }}
          >
            GITHUB PERSONAL ACCESS TOKEN
          </label>
          <input
            id="pat"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{
              width: '100%',
              background: '#161b22',
              border: `1px solid ${error ? '#f85149' : '#30363d'}`,
              borderRadius: 8,
              padding: '12px 14px',
              color: '#e6edf3',
              fontSize: 15,
              fontFamily: 'monospace',
              outline: 'none',
              marginBottom: 12,
            }}
          />

          {error && (
            <p style={{ color: '#f85149', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !value.trim()}
            style={{
              width: '100%',
              background: loading || !value.trim() ? '#21262d' : '#238636',
              color: loading || !value.trim() ? '#8b949e' : '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '13px',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
              minHeight: 44,
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Verifying…' : 'Continue'}
          </button>
        </form>

        <p style={{ color: '#8b949e', fontSize: 12, marginTop: 20, textAlign: 'center', lineHeight: 1.5 }}>
          Your token is stored only in your browser's localStorage and never sent anywhere except GitHub's API.{' '}
          <a
            href="https://github.com/settings/tokens/new?scopes=repo&description=semantic-pr-zoom"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#58a6ff' }}
          >
            Create a token →
          </a>
        </p>
      </div>
    </div>
  )
}
