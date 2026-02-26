# create-semantic-review

Generate a semantic PR review and post it as a comment. Usage: `/create-semantic-review <PR-number-or-URL>`

## Instructions

You are generating a structured semantic review for a pull request and posting it as a GitHub PR comment. The comment will be consumed by the semantic-pr-zoom web app.

### Step 1: Parse Arguments

Extract the PR number or URL from `$ARGUMENTS`.
- If it's a URL like `https://github.com/owner/repo/pull/42`, extract the number `42`
- If it's just a number like `42`, use it directly
- If no argument is provided, ask: "Please provide a PR number or URL, e.g. /create-semantic-review 42"

### Step 2: Verify Setup

Check that `.semantic-pr-zoom.json` exists:
```bash
test -f .semantic-pr-zoom.json || echo "ERROR: Run /init-semantic-review first"
```

Check that the build_layers script exists:
```bash
test -f scripts/semantic-review/build_layers.sh || echo "ERROR: Run /init-semantic-review first"
```

If either check fails, stop and instruct the user to run `/init-semantic-review` first.

### Step 3: Fetch PR Metadata

```bash
gh pr view <PR> --json number,title,url,baseRefName,headRefName > /tmp/spz-pr.json
```

Show the PR title so the user knows which PR is being processed.

### Step 4: Fetch PR Diff

```bash
gh pr diff <PR> > /tmp/spz-diff.patch
```

Check that the diff is not empty. If empty, warn the user that the PR has no changes.

### Step 5: Fetch PR Commits

```bash
gh pr commits <PR> --json oid,messageHeadline > /tmp/spz-commits.json
```

### Step 6: Run Semantic Analysis

```bash
bash scripts/semantic-review/build_layers.sh \
  --diff-file /tmp/spz-diff.patch \
  --pr-json /tmp/spz-pr.json \
  --output /tmp/spz-review.json
```

If the script fails, show the error output to the user and stop.

Verify the output is valid JSON:
```bash
python3 -c "import json; json.load(open('/tmp/spz-review.json'))" && echo "JSON valid" || echo "JSON invalid"
```

### Step 7: Prepare Comment Payload

Read `/tmp/spz-review.json` and wrap it in the semantic-pr-zoom comment markers:

```
<!-- semantic-pr-zoom -->
```json
<contents of /tmp/spz-review.json>
```
<!-- /semantic-pr-zoom -->
```

Save to `/tmp/spz-payload.txt`.

The exact format must be preserved — the web app uses these markers to find and parse the comment.

### Step 8: Post or Update Comment

First check if a semantic-pr-zoom comment already exists on this PR:

```bash
gh pr comment list <PR> --json body,databaseId | python3 -c "
import json, sys
comments = json.load(sys.stdin)
for c in comments:
    if '<!-- semantic-pr-zoom -->' in c.get('body', ''):
        print(c['databaseId'])
        break
"
```

**If a comment ID was found** (update existing):
```bash
gh api repos/{owner}/{repo}/issues/comments/<comment-id> \
  -X PATCH \
  --field body=@/tmp/spz-payload.txt
```

To get owner/repo, parse from the PR URL in `/tmp/spz-pr.json`:
```bash
python3 -c "
import json, re
pr = json.load(open('/tmp/spz-pr.json'))
m = re.match(r'https://github.com/([^/]+)/([^/]+)/pull/', pr['url'])
if m: print(m.group(1), m.group(2))
"
```

**If no existing comment** (create new):
```bash
gh pr comment <PR> --body-file /tmp/spz-payload.txt
```

### Step 9: Print Confirmation

Show a success message:
```
✅ Semantic review posted!

PR: #42 — <title>
Comment: <URL of comment>

Layers generated:
  📦 Packages: <N> packages analyzed
  🔤 Symbols: <N> symbols found
  📄 Diffs: <N> files with hunks

View in the semantic-pr-zoom web app:
  https://<github-username>.github.io/semantic-pr-zoom/?pr=<PR-URL>
```

Parse the layer counts from `/tmp/spz-review.json` to fill in the numbers.

### Step 10: Cleanup

Remove temp files:
```bash
rm -f /tmp/spz-pr.json /tmp/spz-diff.patch /tmp/spz-commits.json /tmp/spz-review.json /tmp/spz-payload.txt
```

## Error Handling

- If `gh` CLI is not authenticated: `gh auth login` and retry
- If the PR number doesn't exist: show gh's error message
- If `build_layers.py` crashes: show full traceback, suggest running `/init-semantic-review` again
- If posting the comment fails: save the payload to `./semantic-review-<PR>.json` as a fallback and instruct the user to post it manually
