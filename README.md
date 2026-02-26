# Semantic PR Zoom

Review pull requests semantically on mobile. This tool lets you understand the *meaning* of a PR — which packages changed, which functions/classes were modified, and the raw diffs — in a mobile-friendly layered UI.

## How It Works

1. **Copy the Claude Code skills** into your project
2. Run `/init-semantic-review` → Claude generates project-specific analysis scripts
3. Run `/create-semantic-review 42` → Claude generates a structured JSON semantic review and posts it as a PR comment
4. Open the web app → select the PR → browse three analysis layers

## Quick Start

### 1. Add skills to your project

Copy the two command files into your project's `.claude/commands/` directory:

```bash
mkdir -p .claude/commands
cp path/to/semantic-pr-zoom/.claude/commands/init-semantic-review.md .claude/commands/
cp path/to/semantic-pr-zoom/.claude/commands/create-semantic-review.md .claude/commands/
```

Or clone just the files you need:

```bash
# From inside your project
curl -o .claude/commands/init-semantic-review.md \
  https://raw.githubusercontent.com/YOUR_USERNAME/semantic-pr-zoom/main/.claude/commands/init-semantic-review.md
curl -o .claude/commands/create-semantic-review.md \
  https://raw.githubusercontent.com/YOUR_USERNAME/semantic-pr-zoom/main/.claude/commands/create-semantic-review.md
```

### 2. Initialize your project

Open Claude Code in your project and run:

```
/init-semantic-review
```

Claude will:
- Detect your project's languages (Go, Python, JS/TS)
- Find available tooling (`gofmt`, `black`, etc.)
- Generate project-specific analysis scripts in `scripts/semantic-review/`
- Create `.semantic-pr-zoom.json` config

### 3. Generate a semantic review

```
/create-semantic-review 42
```

Replace `42` with your PR number. Claude will:
- Fetch PR metadata, diff, and commits via `gh`
- Run the analysis scripts
- Post a structured JSON comment to the PR

### 4. View in the web app

Open `https://YOUR_USERNAME.github.io/semantic-pr-zoom/` (or run locally — see below), enter your GitHub PAT, search for your repo, and select the PR.

## Web App

The web app lives in `web-app/` and is built with React + Vite.

### Local development

```bash
cd web-app
npm install
npm run dev
```

Then open `http://localhost:5173/semantic-pr-zoom/`.

### Deploy to GitHub Pages

```bash
cd web-app
npm install
npm run deploy
```

This builds the app and pushes to the `gh-pages` branch. Enable GitHub Pages in your repo settings pointing to the `gh-pages` branch.

## JSON Schema

Semantic reviews conform to `schema/semantic-review.schema.json`. The schema defines three layers:

| Layer | ID | Description |
|-------|----|-------------|
| Packages | `packages` | High-level view of which packages/modules changed |
| Symbols | `symbols` | Classes, functions, structs that were added/modified/deleted |
| Diffs | `diffs` | Line-level unified diffs, organized by file |

The JSON is embedded in a PR comment between these markers:

```
<!-- semantic-pr-zoom -->
```json
{ ... }
```
<!-- /semantic-pr-zoom -->
```

## Requirements

### For analysis (in your project)

- [GitHub CLI (`gh`)](https://cli.github.com/) — authenticated with `gh auth login`
- `python3` — for `build_layers.py` and Python analysis
- `go` — for Go AST analysis (if your project uses Go)
- Optional: `black` (Python formatting detection), `gofmt` (Go formatting detection)

### For the web app

- Node.js 18+
- A GitHub Personal Access Token with `repo` scope

## Architecture

```
semantic-pr-zoom/
├── .claude/
│   └── commands/
│       ├── init-semantic-review.md     # Bootstrap skill
│       └── create-semantic-review.md   # Orchestration skill
├── web-app/                            # React + Vite app
│   └── src/
│       ├── components/
│       │   ├── AuthGate.tsx            # PAT input
│       │   ├── PRSelector.tsx          # Repo + PR search
│       │   ├── LayerNav.tsx            # Bottom tab navigation
│       │   └── layers/
│       │       ├── PackageLayer.tsx    # Layer 1: packages
│       │       ├── SymbolLayer.tsx     # Layer 2: symbols
│       │       └── DiffLayer.tsx       # Layer 3: diffs
│       └── lib/
│           ├── github.ts               # GitHub API client
│           └── parser.ts               # Comment JSON parser
└── schema/
    └── semantic-review.schema.json     # JSON schema
```

## Security

- Your GitHub PAT is stored only in `localStorage` and is only sent to `api.github.com`
- No backend — everything is client-side
- Analysis scripts run locally in your project via Claude Code

## License

MIT
