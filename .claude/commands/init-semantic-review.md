# init-semantic-review

Bootstrap semantic zoom review scripts for this project. Generates a project-specific `build_layers.sh` that produces a semantic review JSON where nodes form a zoom hierarchy — coarse overview at the top, fine-grained diffs at the bottom.

## Instructions

### Step 1: Detect Languages and Tools

Scan the repository:

```bash
# Languages
find . -maxdepth 4 \
  -not -path '*/\.*' -not -path '*/vendor/*' -not -path '*/node_modules/*' \
  \( -name "*.go" -o -name "go.mod" \
     -o -name "*.py" -o -name "pyproject.toml" -o -name "setup.py" -o -name "requirements.txt" \
     -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "package.json" \
     -o -name "*.rb" -o -name "Gemfile" \
     -o -name "*.rs" -o -name "Cargo.toml" \
  \) 2>/dev/null | head -40

# Tools
for tool in jq git gofmt black prettier eslint rustfmt; do
  path=$(which "$tool" 2>/dev/null) && echo "$tool: $path" || echo "$tool: not found"
done

# Directory structure (find real source dirs)
find . -maxdepth 3 -type d \
  -not -path '*/\.*' -not -path '*/vendor/*' \
  -not -path '*/node_modules/*' -not -path '*/dist/*' \
  -not -path '*/__pycache__/*' -not -path '*/.venv/*' \
  2>/dev/null | head -30
```

### Step 2: Decide on Layers

Based on what you find, choose an appropriate zoom hierarchy for this project. The layers go from coarsest to finest — the user starts at the top and zooms into finer detail.

**Choose layer depth based on project complexity:**

- **Simple project** (single language, flat structure):
  ```
  package → symbol → diff
  ```
- **Layered project** (clear domain boundaries, multiple packages):
  ```
  domain → package → symbol → diff
  ```
- **Monorepo / multi-service**:
  ```
  service → package → symbol → diff
  ```
- **Frontend / component-based**:
  ```
  feature-area → component → prop/export → diff
  ```

Use the project's own vocabulary — if it has "modules", call them modules; if it has "domains" or "services", use those names.

**The last layer is always a diff layer** (contains hunks + lines, no children).

### Step 3: Create `.semantic-pr-zoom.json`

```json
{
  "version": "2.0",
  "languages": ["go"],
  "layers": [
    { "id": "package", "title": "Packages", "description": "Top-level Go packages affected by this PR" },
    { "id": "symbol",  "title": "Symbols",  "description": "Functions, types, and methods changed" },
    { "id": "diff",    "title": "Diffs",    "description": "Line-level changes per symbol" }
  ],
  "source_dirs": ["pkg/", "cmd/", "internal/"],
  "ignored_dirs": ["vendor/", "dist/", ".venv/"],
  "ignored_patterns": ["*.pb.go", "*_generated.go"],
  "tools": {
    "git": "/usr/bin/git",
    "jq":  "/usr/bin/jq",
    "gofmt": "/usr/local/go/bin/gofmt"
  },
  "scripts_dir": "scripts/semantic-review"
}
```

Use the actual layers you decided on in Step 2. Only include tools that were found.

### Step 4: Generate `scripts/semantic-review/build_layers.sh`

Generate a single bash script that produces a v2 semantic review JSON — a flat list of `nodes` where each node has an `id`, `layer`, `parent` (ID of parent node or null), `title`, `summary`, `change_type`, and `meta`.

Call signature:
```bash
bash scripts/semantic-review/build_layers.sh \
  --diff-file /tmp/pr.patch \
  --pr-json   /tmp/pr.json \
  --output    /tmp/review.json
```

#### Script structure

**1. Argument parsing and setup:**
```bash
#!/usr/bin/env bash
set -euo pipefail
DIFF_FILE="" PR_JSON="" OUTPUT=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --diff-file) DIFF_FILE="$2"; shift 2 ;;
    --pr-json)   PR_JSON="$2";   shift 2 ;;
    --output)    OUTPUT="$2";    shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done
[[ -z "$DIFF_FILE" ]] && { echo "ERROR: --diff-file required" >&2; exit 1; }
[[ -z "$PR_JSON"   ]] && { echo "ERROR: --pr-json required"   >&2; exit 1; }
[[ -z "$OUTPUT"    ]] && OUTPUT="/dev/stdout"
```

**2. Enumerate ALL nodes at every layer — not just changed ones**

The graph visualization shows the full project structure. Changed nodes are large and coloured; unchanged nodes are small white dots that give spatial context. **Do not filter to only changed files.**

For each layer, enumerate everything:

- **Top layers (package/service/domain)**: list ALL packages or directories that exist in the source dirs, even if they have zero changes. Use `find` or `git ls-files` to discover them:
  ```bash
  # All Go packages (by directory with .go files)
  git ls-files '*.go' | xargs -I{} dirname {} | sort -u | grep -v vendor
  # All Python packages (directories with __init__.py or .py files)
  git ls-files '*.py' | xargs -I{} dirname {} | sort -u
  ```

- **Symbol layer**: list all top-level symbols in each changed file (grep current HEAD). For unchanged files, omit the symbol layer nodes (too many) — only emit symbol nodes for files that appear in the diff.

- **Diff layer**: only emit diff nodes for changed files (unchanged files have no hunks).

For unchanged nodes set: `"change_type": null`, `"insertions": 0`, `"deletions": 0` in meta.

**3. Parse diff with awk to extract per-file stats:**

Use awk to walk the unified diff and collect for each changed file:
- `file` — path (from `+++ b/` lines)
- `insertions` — count of `+` lines (not `+++`)
- `deletions` — count of `-` lines (not `---`)
- `is_new_file` — true if `--- /dev/null`
- `is_deleted` — true if `+++ /dev/null`
- Per-hunk data: header (`@@ ... @@`) and raw lines

**4. Group files into higher-level nodes (the layers above diff):**

For each layer above diff, group ALL files (changed + unchanged) using language-appropriate logic:

- **Go packages**: `grep "^package " "$file" | head -1 | awk '{print $2}'`, or use directory name
- **Python packages**: directory name of the file
- **JS/TS feature areas**: directory name or nearest `package.json` `"name"` field
- **Domain/service layers** (monorepo): top-level directory under `packages/`, `services/`, `apps/`, etc.

Aggregate stats per group from the diff data: sum insertions + deletions + files_changed. Groups with no changed files get insertions=0, deletions=0, files_changed=0 and change_type=null.

**5. Extract symbols using grep (language-specific patterns):**

For each changed file (using `git show HEAD:"$file"` for current content):

- **Go:**
  ```bash
  git show HEAD:"$file" 2>/dev/null | grep -n \
    -E "^func |^type [A-Z][A-Za-z0-9_]+ (struct|interface)" \
    | awk -F: '{print $1"\t"$2}'
  ```

- **Python:**
  ```bash
  git show HEAD:"$file" 2>/dev/null | grep -n \
    -E "^(async )?def |^class " \
    | awk -F: '{print $1"\t"$2}'
  ```

- **TypeScript/JavaScript:**
  ```bash
  git show HEAD:"$file" 2>/dev/null | grep -n \
    -E "^export (default )?(async function|function|class|const [A-Za-z])" \
    | awk -F: '{print $1"\t"$2}'
  ```

Only generate patterns for languages present in this project.

For the `signature_before` field, run the same grep on `git show "origin/${BASE_REF}:${file}"` (the base branch version). If that fails (new file), set `signature_before` to `null`.

**6. Formatting-only detection:**

If `gofmt` is available and the file is `.go`:
```bash
gofmt_diff=$(git show HEAD:"$file" 2>/dev/null | gofmt -d 2>/dev/null || true)
```
Compare to the actual hunk; if they match, set `is_formatting_only: true`.

If `black` is available and `.py`:
```bash
black_diff=$(git show HEAD:"$file" 2>/dev/null | black --check --diff - 2>/dev/null || true)
```

Otherwise default to `false`.

**7. Assemble nodes in layer order (coarsest first):**

Emit nodes using `jq` (or `python3 -c`/`node -e` if jq unavailable). Each node:

```json
{
  "id": "pkg-auth",
  "layer": "package",
  "parent": null,
  "title": "auth",
  "summary": "JWT validation and token refresh logic added",
  "change_type": "modified",
  "meta": { "files_changed": 3, "insertions": 120, "deletions": 30, "change_pct": 45 }
}
```

```json
{
  "id": "sym-auth-ValidateToken",
  "layer": "symbol",
  "parent": "pkg-auth",
  "title": "ValidateToken",
  "summary": "New function to validate JWT tokens",
  "change_type": "added",
  "meta": {
    "kind": "function",
    "file": "auth/jwt.go",
    "signature_before": null,
    "signature_after": "func ValidateToken(token string) (*Claims, error)"
  }
}
```

```json
{
  "id": "diff-auth-jwt-ValidateToken",
  "layer": "diff",
  "parent": "sym-auth-ValidateToken",
  "title": "auth/jwt.go",
  "summary": null,
  "change_type": "added",
  "meta": {
    "file": "auth/jwt.go",
    "hunks": [
      {
        "header": "@@ -10,0 +10,20 @@",
        "is_formatting_only": false,
        "lines": [
          { "type": "insert", "content": "func ValidateToken(token string) (*Claims, error) {" },
          { "type": "insert", "content": "\t// validate signature" }
        ]
      }
    ]
  }
}
```

**Node IDs** must be unique. Use a slug pattern: `{layer}-{sanitized-title}` with a counter suffix if needed.

**Parent assignment:** Files that belong to a package get that package's node ID as parent. Symbols get their file's diff node's parent (the symbol node). Diff nodes get the symbol node as parent. If there is no symbol-level layer (e.g., layers are just `package → diff`), diff nodes get the package node as parent.

**8. Wrap in final JSON:**

```json
{
  "version": "2.0",
  "generated_at": "<ISO8601 from date -u +%Y-%m-%dT%H:%M:%SZ>",
  "pr": {
    "number": <from pr.json>,
    "title":  <from pr.json>,
    "url":    <from pr.json>,
    "base":   <baseRefName from pr.json>,
    "head":   <headRefName from pr.json>
  },
  "layers": <copy from .semantic-pr-zoom.json>,
  "nodes":  <assembled array>
}
```

Use `jq -n --argjson` to assemble cleanly. Fall back to `python3 -c "import json,sys; ..."` if jq is absent.

### Step 5: Make Executable and Smoke Test

```bash
chmod +x scripts/semantic-review/build_layers.sh
bash scripts/semantic-review/build_layers.sh 2>&1 | grep -i "required\|error" || true
```

Create the output directory and add it to `.gitignore` if not already present:
```bash
mkdir -p .semantic-review-zoom
grep -qxF '.semantic-review-zoom/' .gitignore 2>/dev/null || echo '.semantic-review-zoom/' >> .gitignore
```

### Step 6: Report

```
✅ semantic-zoom-review initialized!

Layers (zoom hierarchy):
  1. Packages  — top-level Go packages
  2. Symbols   — functions, types, methods
  3. Diffs     — line-level changes

Script: scripts/semantic-review/build_layers.sh
Config: .semantic-pr-zoom.json

Tools:
  git:   /usr/bin/git   ✓
  jq:    /usr/bin/jq    ✓
  gofmt: /usr/local/go/bin/gofmt  ✓

Next: /create-semantic-review <PR-number>
```

**Do not create** `main.go`, compiled binaries, or separate per-language scripts.
