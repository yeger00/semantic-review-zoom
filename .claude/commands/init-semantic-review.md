# init-semantic-review

Bootstrap semantic PR review scripts for this project. This command analyzes the repository's languages and tooling, then generates project-specific analysis scripts that extract semantic structure from pull request diffs.

## Instructions

You are setting up the `semantic-pr-zoom` analysis infrastructure for this project. Follow these steps carefully:

### Step 1: Detect Languages and Tools

Scan the repository root and subdirectories to determine which languages are in use:

- **Go**: presence of `*.go` files, `go.mod`, `go.sum`
- **Python**: presence of `*.py` files, `pyproject.toml`, `setup.py`, `setup.cfg`, `requirements.txt`, `Pipfile`
- **JavaScript/TypeScript**: presence of `*.js`, `*.ts`, `*.jsx`, `*.tsx` files, `package.json`

Check which tools are available on the system:
```bash
which black 2>/dev/null && echo "black: yes" || echo "black: no"
which gofmt 2>/dev/null && echo "gofmt: yes" || echo "gofmt: no"
which go 2>/dev/null && echo "go: yes" || echo "go: no"
which python3 2>/dev/null && echo "python3: yes" || echo "python3: no"
which node 2>/dev/null && echo "node: yes" || echo "node: no"
```

Identify directory structure:
- Source root directories (where main source code lives, e.g., `src/`, `pkg/`, `lib/`, `cmd/`, top-level packages)
- Test directories (e.g., `test/`, `tests/`, `*_test.go`, `test_*.py`)
- Paths to ignore: `vendor/`, `node_modules/`, `dist/`, `.venv/`, `venv/`, `.git/`, `__pycache__/`, `*.pb.go`

### Step 2: Create Configuration File

Create `.semantic-pr-zoom.json` in the project root:

```json
{
  "version": "1.0",
  "languages": ["go", "python"],
  "source_dirs": ["pkg/", "cmd/", "src/"],
  "test_dirs": ["tests/", "test/"],
  "ignored_dirs": ["vendor/", "node_modules/", "dist/", ".venv/"],
  "ignored_patterns": ["*.pb.go", "*_generated.go"],
  "tools": {
    "python3": "/usr/bin/python3",
    "black": "/usr/local/bin/black",
    "gofmt": "/usr/local/go/bin/gofmt",
    "go": "/usr/local/go/bin/go"
  },
  "scripts_dir": "scripts/semantic-review"
}
```

Fill in actual detected values. Omit tools that are not found. Use actual paths from `which`.

### Step 3: Create Scripts Directory

```bash
mkdir -p scripts/semantic-review
```

### Step 4: Generate Language-Specific Analysis Scripts

Generate scripts tailored to this specific project's structure. Do NOT generate generic scripts — use the actual source dirs, package names, and tool paths from Step 1.

#### For Python projects — `scripts/semantic-review/analyze_python.py`

Generate a Python script that:
1. Accepts `--diff-file <path>` argument (unified diff output from `gh pr diff`)
2. Parses the diff to find changed `.py` files
3. For each changed file, uses Python's `ast` module to extract:
   - All function definitions (`ast.FunctionDef`, `ast.AsyncFunctionDef`): name, args, return annotation
   - All class definitions (`ast.ClassDef`): name, bases
   - All method definitions within classes
4. Detects formatting-only hunks: runs `black --check --diff` on each changed file (if black is available); marks hunks as `is_formatting_only: true` if the only differences match black's output
5. Outputs a JSON structure:
```json
{
  "language": "python",
  "files": [
    {
      "path": "auth/jwt.py",
      "package": "auth",
      "symbols": [
        {
          "name": "validate_token",
          "kind": "function",
          "signature_before": null,
          "signature_after": "def validate_token(token: str) -> Claims:"
        }
      ],
      "is_formatting_only": false
    }
  ]
}
```

The script must handle files that are added (no "before" state) and deleted (no "after" state) gracefully.

#### For Go projects — `scripts/semantic-review/analyze_go.sh`

Generate a shell script that:
1. Accepts `--diff-file <path>` argument
2. Extracts changed `.go` files from the diff
3. Calls the Go AST analyzer (see below) for each file
4. Detects formatting-only hunks using `gofmt -d`
5. Assembles and outputs JSON matching the same structure as analyze_python.py but for Go

#### For Go projects — `cmd/semantic-review-ast/main.go` (if Go is detected)

Generate a small standalone Go program that:
1. Accepts a file path as argument
2. Uses `go/ast` and `go/parser` packages to parse the file
3. Extracts:
   - Function declarations: name, receiver type (for methods), parameter types, return types
   - Struct definitions: name, fields (names + types)
   - Interface definitions: name, methods
4. Outputs JSON:
```json
{
  "path": "auth/jwt.go",
  "symbols": [
    {
      "name": "ValidateToken",
      "kind": "function",
      "signature": "func ValidateToken(token string) (*Claims, error)"
    }
  ]
}
```

#### For all projects — `scripts/semantic-review/build_layers.py`

Generate a Python script that orchestrates everything and produces the final semantic review JSON:

1. Accepts arguments:
   - `--diff-file <path>`: unified diff from `gh pr diff`
   - `--pr-json <path>`: JSON file from `gh pr view --json number,title,url,baseRefName,headRefName`
   - `--commits-json <path>`: JSON from `gh pr commits --json oid,messageHeadline`
   - `--output <path>`: output file (default: stdout)

2. Runs language analyzers based on `.semantic-pr-zoom.json` config:
   - Calls `analyze_python.py` for Python files
   - Calls `analyze_go.sh` for Go files

3. Aggregates results into three layers matching the schema at `https://github.com/semantic-pr-zoom/semantic-review.schema.json`:

   **Layer 1 (packages)**: Groups changed files by directory/package, computes aggregate change_pct, file count, insertions, deletions. For Python: package = directory. For Go: package = Go package name from file header.

   **Layer 2 (symbols)**: Collects all symbols across all analyzers; computes signature_before/after by comparing analyzer outputs for the base vs head versions (use git show for before-state if needed).

   **Layer 3 (diffs)**: Re-parses the unified diff; associates each file with its package from Layer 1; marks hunks as formatting-only based on analyzer output.

4. Wraps everything in the final JSON structure:
```json
{
  "version": "1.0",
  "generated_at": "<ISO8601>",
  "pr": { ... },
  "layers": [ ... ]
}
```

5. Validates output against the schema if `jsonschema` Python package is available

### Step 5: Make Scripts Executable

```bash
chmod +x scripts/semantic-review/analyze_python.py
chmod +x scripts/semantic-review/analyze_go.sh
chmod +x scripts/semantic-review/build_layers.py
```

For Go: build the AST analyzer:
```bash
cd cmd/semantic-review-ast && go build -o ../../scripts/semantic-review/ast-analyzer . && cd ../..
```

### Step 6: Validate and Report

1. Validate the `.semantic-pr-zoom.json` is valid JSON
2. Check all script files exist and are executable
3. Print a summary:

```
✅ semantic-pr-zoom initialized successfully!

Detected languages: Go, Python
Source directories: pkg/, cmd/
Ignored paths: vendor/, .venv/

Generated scripts:
  scripts/semantic-review/analyze_python.py
  scripts/semantic-review/analyze_go.sh
  scripts/semantic-review/build_layers.py

Available tools:
  python3: /usr/bin/python3
  black: /usr/local/bin/black (formatting detection enabled)
  gofmt: /usr/local/go/bin/gofmt (formatting detection enabled)
  go: /usr/local/go/bin/go

Config: .semantic-pr-zoom.json

Next step: run /create-semantic-review <PR-number> to generate a semantic review
```

If any tool is missing that would improve analysis, note it with a ⚠️ and suggest how to install it.
