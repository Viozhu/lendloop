#!/usr/bin/env bash
# Fails if the repository (tracked + not-ignored files) contains secrets.
#
#   1. Known secret formats (Clerk secret keys, private keys, AWS keys, ...).
#   2. Secret-looking assignments with a non-empty value outside .env files.
#   3. The literal values from local env files (.env.local, n8n/.env), so a
#      secret pasted into a workflow or doc is caught even if it "looks" harmless.
#   4. n8n workflow exports carrying credential data, pinned data or static data.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Files git would commit: tracked plus untracked-but-not-ignored. Skip lockfiles
# and generated code, which are noisy and never hand-edited.
# (A while-read loop rather than mapfile, so macOS's bash 3.2 works too.)
FILES=()
while IFS= read -r f; do
  [ -f "$f" ] && FILES+=("$f")
done < <(git ls-files --cached --others --exclude-standard | grep -vE '(^|/)(pnpm-lock\.yaml|_generated/)')

failures=0
report() {
  echo "✗ $1" >&2
  failures=$((failures + 1))
}

# 1. Known formats.
PATTERNS=(
  'sk_(live|test)_[A-Za-z0-9]{20,}'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'AKIA[0-9A-Z]{16}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  'gh[pousr]_[A-Za-z0-9]{30,}'
)
for pattern in "${PATTERNS[@]}"; do
  while IFS= read -r hit; do
    report "secret-like value: $hit"
  done < <(grep -nE -- "$pattern" "${FILES[@]}" 2>/dev/null | grep -v '^scripts/check-secrets.sh:' || true)
done

# 2. NAME_SECRET=value style assignments with a real value (env examples are empty).
while IFS= read -r hit; do
  report "hardcoded secret assignment: $hit"
done < <(
  grep -nE '(SECRET|PASSWORD|ENCRYPTION_KEY|API_KEY|TOKEN)[A-Z_]*[[:space:]]*[=:][[:space:]]*["'\'']?[A-Za-z0-9+/_.-]{16,}' \
    "${FILES[@]}" 2>/dev/null \
    | grep -vE '^(scripts/check-secrets\.sh|.*\.test\.ts):' \
    | grep -vE '\$\{|\$env|[^A-Za-z]env\.|process\.env|\{\{' \
    || true
)

# 3. Literal values from local env files.
for envfile in .env.local n8n/.env; do
  [ -f "$envfile" ] || continue
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[A-Z0-9_]+$ ]] || continue
    [[ "$key" =~ (SECRET|PASSWORD|KEY|TOKEN) ]] || continue
    [[ "$key" == NEXT_PUBLIC_* ]] && continue
    value="${value%\"}"; value="${value#\"}"
    [ "${#value}" -ge 12 ] || continue
    if grep -lF -- "$value" "${FILES[@]}" >/dev/null 2>&1; then
      report "value of $key from $envfile appears in: $(grep -lF -- "$value" "${FILES[@]}" | tr '\n' ' ')"
    fi
  done < "$envfile"
done

# 4. Workflow exports.
for wf in n8n/workflows/*.json; do
  [ -f "$wf" ] || continue
  node -e '
    const wf = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const problems = [];
    if (wf.pinData && Object.keys(wf.pinData).length) problems.push("pinData");
    if (wf.staticData) problems.push("staticData");
    if (wf.meta && wf.meta.instanceId) problems.push("meta.instanceId");
    for (const node of wf.nodes ?? []) {
      for (const cred of Object.values(node.credentials ?? {})) {
        if (cred && typeof cred === "object" && "data" in cred) problems.push(`credential data in ${node.name}`);
      }
      const params = JSON.stringify(node.parameters ?? {});
      if (/"(password|apiKey|secret|token)"\s*:\s*"[^"={]/i.test(params)) problems.push(`literal secret parameter in ${node.name}`);
    }
    if (problems.length) { console.log(problems.join(", ")); process.exit(1); }
  ' "$wf" >/tmp/check-secrets-wf.$$ 2>&1 || report "$wf: $(cat /tmp/check-secrets-wf.$$)"
  rm -f /tmp/check-secrets-wf.$$
done

if [ "$failures" -gt 0 ]; then
  echo "check-secrets: $failures problem(s) found" >&2
  exit 1
fi
echo "check-secrets: ok (${#FILES[@]} files scanned)"
