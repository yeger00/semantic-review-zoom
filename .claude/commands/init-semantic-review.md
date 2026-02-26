# init-semantic-review

Bootstrap semantic PR review scripts for this project. Generates project-specific bash scripts that extract semantic structure from pull request diffs using tools already installed on the system.

## Instructions

You are setting up the `semantic-pr-zoom` analysis infrastructure for this project. Follow these steps carefully.

### Step 1: Detect Languages and Tools

Scan the repository to determine what is in use:

**Languages** — look for these files:
```bash
find . -maxdepth 4 -not -path '*/\.*' -not -path '*/vendor/*' -not -path '*/node_modules/*' \
  \( -name "*.go" -o -name "go.mod" \
  -o -name "*.py" -o -name "pyproject.toml" -o -name "setup.py" -o -name "requirements.txt" \
  -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "package.json" \
  -o -name "*.rb" -o -name "Gemfile" \
  -o -name "*.rs" -o -name "Cargo.toml" \
  \) 2>/dev/null | head -40
```

**Available tools** — check exactly what is installed:
```bash
for tool in jq git gofmt black prettier eslint rustfmt rubocop node python3; do
  path=$(which "$tool" 2>/dev/null) && echo "$tool: $path" || echo "$tool: not found"
done
```

**Source structure** — find real source dirs (not vendor/test/generated):
```bash
find . -maxdepth 3 -type d \
  -not -path '*/\.*' \
  -not -path '*/vendor/*' \
  -not -path '*/node_modules/*' \
  -not -path '*/dist/*' \
  -not -path '*/__pycache__/*' \
  -not -path '*/.venv/*' \
  -not -path '*/venv/*' \
  2>/dev/null | head -30
```

Also identify ignored path patterns for this project (e.g. `*.pb.go`, `*_generated.*`, `mock_*`).

### Step 2: Create `.semantic-pr-zoom.json`

Create a config file in the project root using the actual values found above. Example structure:

```json
{
  "version": "1.0",
  "languages": ["go"],
  "source_dirs": ["pkg/", "cmd/", "internal/"],
  "ignored_dirs": ["vendor/", "dist/", ".venv/"],
  "ignored_patterns": ["*.pb.go", "*_generated.go"],
  "tools": {
    "git": "/usr/bin/git",
    "jq": "/usr/bin/jq",
    "gofmt": "/usr/local/go/bin/gofmt"
  },
  "scripts_dir": "scripts/semantic-review"
}
```

Only include tools that were actually found. Use the exact paths from `which`.

### Step 3: Create Scripts Directory

```bash
mkdir -p scripts/semantic-review
```

### Step 4: Generate `scripts/semantic-review/build_layers.sh`

This is the **only script** you need to generate. It is a self-contained bash script that:
1. Parses the unified diff to build all three layers
2. Uses `grep`/`awk`/`git` for symbol extraction — no compiled helpers, no extra scripts
3. Uses `jq` for JSON assembly if available, otherwise falls back to `python3 -c` or `node -e`

Write the script to match this project's actual languages and directory structure. The script is called as:
```bash
bash scripts/semantic-review/build_layers.sh \
  --diff-file /tmp/pr.patch \
  --pr-json /tmp/pr.json \
  --output /tmp/review.json
```

#### Structure of `build_layers.sh`

The script must implement these sections. Fill in the language-specific `grep` patterns and paths based on what you actually found in Step 1.

**Header and argument parsing:**
```bash
#!/usr/bin/env bash
set -euo pipefail

DIFF_FILE=""
PR_JSON=""
OUTPUT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --diff-file) DIFF_FILE="$2"; shift 2 ;;
    --pr-json)   PR_JSON="$2";   shift 2 ;;
    --output)    OUTPUT="$2";    shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

[[ -z "$DIFF_FILE" ]] && { echo "ERROR: --diff-file required" >&2; exit 1; }
[[ -z "$PR_JSON"   ]] && { echo "ERROR: --pr-json required"   >&2; exit 1; }
[[ -z "$OUTPUT"    ]] && OUTPUT="/dev/stdout"
```

**Diff parsing (language-agnostic, pure bash/awk):**

Extract changed files from unified diff using awk. For each changed file, collect:
- File path
- Number of insertions (`+` lines, excluding `+++` header)
- Number of deletions (`-` lines, excluding `---` header)
- Whether the file is new (added) or deleted
- The raw hunks (header + lines) for Layer 3

**Symbol extraction (bash + grep, language-specific):**

For each changed `.go` file, extract symbols from the current HEAD using grep:
```bash
# Go: functions and types
git show HEAD:"$file" 2>/dev/null | grep -n \
  -E "^func |^type [A-Z][A-Za-z]+ (struct|interface)" \
  | awk -F: '{print $1, $2}'
```

For each changed `.py` file:
```bash
# Python: top-level defs and classes
git show HEAD:"$file" 2>/dev/null | grep -n \
  -E "^(async )?def |^class " \
  | awk -F: '{print $1, $2}'
```

For each changed `.ts`/`.js`/`.tsx`/`.jsx` file:
```bash
# TS/JS: exported functions, classes, arrow functions
git show HEAD:"$file" 2>/dev/null | grep -n \
  -E "^export (default )?(async function|function|class|const [A-Za-z])" \
  | awk -F: '{print $1, $2}'
```

Only generate patterns for languages that are actually present in this project.

**Before-state signatures:**

For symbols in modified files (not new files), get the base-branch version:
```bash
BASE_REF=$(jq -r '.baseRefName' "$PR_JSON")
git show "origin/${BASE_REF}:${file}" 2>/dev/null | grep -n \
  -E "<same pattern as above>"
```

If `git show origin/${BASE_REF}:${file}` fails (e.g. new file), treat `signature_before` as `null`.

**Formatting-only hunk detection:**

If `gofmt` is available and the file is `.go`:
```bash
# A hunk is formatting-only if gofmt produces the same diff as the PR diff
GOFMT_DIFF=$(git show HEAD:"$file" 2>/dev/null | gofmt -d 2>/dev/null || true)
# Compare hunk content to gofmt output; if they match, mark is_formatting_only=true
```

If `black` is available and the file is `.py`:
```bash
BLACK_DIFF=$(git show HEAD:"$file" 2>/dev/null | black --check --diff - 2>/dev/null || true)
```

If neither is available, set `is_formatting_only: false` for all hunks.

**Package / module grouping:**

For Go: extract package name from file header:
```bash
git show HEAD:"$file" 2>/dev/null | grep "^package " | head -1 | awk '{print $2}'
```

For Python: use the directory name as package:
```bash
dirname "$file" | sed 's|^\./||'
```

For JS/TS: use the directory name, or read `"name"` from nearest `package.json`:
```bash
dir=$(dirname "$file")
pkg_json=$(find "$dir" -maxdepth 2 -name "package.json" 2>/dev/null | head -1)
[[ -n "$pkg_json" ]] && jq -r '.name // empty' "$pkg_json" 2>/dev/null || echo "$dir"
```

Only generate the language branches that are present in this project.

**JSON assembly:**

Assemble the final JSON using `jq` if available:
```bash
if command -v jq &>/dev/null; then
  jq -n \
    --argjson pr "$(cat "$PR_JSON")" \
    --argjson packages "$PACKAGES_JSON" \
    --argjson symbols "$SYMBOLS_JSON" \
    --argjson diffs "$DIFFS_JSON" \
    '{
      version: "1.0",
      generated_at: (now | todate),
      pr: {
        number: $pr.number,
        title: $pr.title,
        url: $pr.url,
        base: $pr.baseRefName,
        head: $pr.headRefName
      },
      layers: [
        { id: "packages", title: "Package / Module Overview",
          description: "High-level summary of which packages were affected.",
          items: $packages },
        { id: "symbols", title: "Classes / Functions / Structs",
          description: "Symbols added, modified, or deleted.",
          items: $symbols },
        { id: "diffs", title: "Line-level Diffs",
          description: "Raw unified diff organized by file.",
          items: $diffs }
      ]
    }' > "$OUTPUT"
else
  # Fallback: use python3 or node to serialize the assembled data as JSON
  # (build the data structure in bash variables, then print via python3/node)
  python3 -c "
import json, sys
data = { ... }  # assembled from bash variables passed via stdin or env
json.dump(data, sys.stdout, indent=2)
" > "$OUTPUT"
fi
```

Build `$PACKAGES_JSON`, `$SYMBOLS_JSON`, and `$DIFFS_JSON` as properly escaped JSON strings before calling `jq -n`. Use `jq -n '[...]'` to accumulate arrays incrementally, or build with a heredoc and `jq -s '.'`.

**Compute `change_pct`** per package:
```
change_pct = round(100 * (insertions + deletions) / max(insertions + deletions + unchanged_lines, 1))
```
Approximation is fine — use `insertions + deletions` across all files in the package.

### Step 5: Make Script Executable and Validate

```bash
chmod +x scripts/semantic-review/build_layers.sh

# Quick smoke test: verify it runs without args (should print usage error, not crash)
bash scripts/semantic-review/build_layers.sh 2>&1 | grep -i "required\|error\|usage" || true
```

### Step 6: Report

Print a summary:
```
✅ semantic-pr-zoom initialized!

Languages detected: Go
Source dirs:        pkg/, cmd/, internal/

Script: scripts/semantic-review/build_layers.sh
Config: .semantic-pr-zoom.json

Tools used for analysis:
  git:   /usr/bin/git  ✓
  jq:    /usr/bin/jq   ✓  (JSON assembly)
  gofmt: /usr/local/go/bin/gofmt  ✓  (formatting detection)

Not found (optional):
  black  — install with: pip install black

Next: run /create-semantic-review <PR-number>
```

**IMPORTANT:** Do not create `main.go`, `cmd/`, or any compiled binary. Do not create separate per-language scripts. The entire analysis lives in one bash script: `scripts/semantic-review/build_layers.sh`.
