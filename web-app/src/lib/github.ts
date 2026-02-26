const BASE = 'https://api.github.com'

function headers(token: string): HeadersInit {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
  }
}

async function get<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers(token) })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`GitHub API ${res.status}: ${msg}`)
  }
  return res.json() as Promise<T>
}

export interface Repo {
  full_name: string
  description: string | null
  private: boolean
  html_url: string
}

export interface PR {
  number: number
  title: string
  html_url: string
  base: { ref: string }
  head: { ref: string }
  state: string
  draft: boolean
  user: { login: string }
  created_at: string
}

export interface Comment {
  id: number
  body: string
  html_url: string
}

export async function searchRepos(token: string, query: string): Promise<Repo[]> {
  const data = await get<{ items: Repo[] }>(
    token,
    `/search/repositories?q=${encodeURIComponent(query)}&affiliation=owner,collaborator&per_page=20`
  )
  return data.items
}

export async function listPRs(token: string, fullName: string): Promise<PR[]> {
  return get<PR[]>(token, `/repos/${fullName}/pulls?state=open&per_page=50&sort=updated`)
}

export async function getSemanticComment(token: string, fullName: string, prNumber: number): Promise<Comment | null> {
  // PR comments (issue comments, not review comments)
  const comments = await get<Comment[]>(
    token,
    `/repos/${fullName}/issues/${prNumber}/comments?per_page=100`
  )
  return comments.find((c) => c.body.includes('<!-- semantic-pr-zoom -->')) ?? null
}
