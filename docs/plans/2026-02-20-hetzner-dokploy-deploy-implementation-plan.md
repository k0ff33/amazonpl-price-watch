# Hetzner Dokploy Deployment Scripts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add secure, repeatable scripts to provision one Hetzner VPS and bootstrap Dokploy with hardened defaults.

**Architecture:** A single `create-vps.sh` orchestration script validates inputs, reconciles firewall rules, renders cloud-init, and creates a server. A separate `check-security.sh` performs post-bootstrap verification over SSH. Cloud-init applies host hardening and installs Dokploy during first boot.

**Tech Stack:** Bash, Hetzner Cloud CLI (`hcloud`), `jq`, cloud-init, UFW, fail2ban, unattended-upgrades, Docker, Dokploy.

---

### Task 1: Add test harness for deployment scripts

**Files:**
- Create: `scripts/deploy/hetzner/tests/test-create-vps.sh`
- Create: `scripts/deploy/hetzner/tests/test-cloud-init-template.sh`

**Step 1: Write failing tests for required script behavior**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT="$ROOT_DIR/scripts/deploy/hetzner/create-vps.sh"

# Expect failure when mandatory env vars are missing.
if "$SCRIPT" --dry-run >/tmp/create-vps.out 2>/tmp/create-vps.err; then
  echo "expected failure without env vars"
  exit 1
fi

grep -q "HCLOUD_SERVER_NAME" /tmp/create-vps.err
```

**Step 2: Run tests to verify they fail**

Run: `bash scripts/deploy/hetzner/tests/test-create-vps.sh`
Expected: FAIL (script/files not present yet)

**Step 3: Add initial placeholder scripts/templates**

```bash
mkdir -p scripts/deploy/hetzner/tests
```

**Step 4: Re-run tests to confirm failure mode is now meaningful**

Run: `bash scripts/deploy/hetzner/tests/test-create-vps.sh`
Expected: FAIL because validation logic is not implemented yet

**Step 5: Commit**

```bash
git add scripts/deploy/hetzner/tests
git commit -m "test: add deployment script harness"
```

### Task 2: Implement `create-vps.sh` with secure defaults

**Files:**
- Create: `scripts/deploy/hetzner/create-vps.sh`
- Create: `scripts/deploy/hetzner/.env.example`
- Create: `scripts/deploy/hetzner/cloud-init.yaml.tmpl`
- Modify: `scripts/deploy/hetzner/tests/test-create-vps.sh`
- Modify: `scripts/deploy/hetzner/tests/test-cloud-init-template.sh`

**Step 1: Extend tests for dry-run rendering and firewall rule expectations**

```bash
grep -q "Rendered cloud-init" /tmp/create-vps.out
grep -q "22/tcp" /tmp/create-vps.out
grep -q "80/tcp" /tmp/create-vps.out
grep -q "443/tcp" /tmp/create-vps.out
```

**Step 2: Run tests to verify they fail (RED)**

Run: `bash scripts/deploy/hetzner/tests/test-create-vps.sh`
Expected: FAIL on missing output markers

**Step 3: Implement minimal `create-vps.sh` to pass tests**

```bash
# Features:
# - strict mode
# - env file loading
# - required var validation
# - --dry-run mode
# - cloud-init rendering to temp file
# - firewall creation/reconciliation helpers
# - server create command assembly
```

**Step 4: Re-run tests (GREEN)**

Run: `bash scripts/deploy/hetzner/tests/test-create-vps.sh && bash scripts/deploy/hetzner/tests/test-cloud-init-template.sh`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/deploy/hetzner/create-vps.sh scripts/deploy/hetzner/cloud-init.yaml.tmpl scripts/deploy/hetzner/.env.example scripts/deploy/hetzner/tests
git commit -m "feat: add secure hetzner dokploy provisioner"
```

### Task 3: Implement post-provision security verification script

**Files:**
- Create: `scripts/deploy/hetzner/check-security.sh`
- Create: `scripts/deploy/hetzner/tests/test-check-security.sh`

**Step 1: Write failing tests for command generation and required args**

```bash
# Expect argument validation failure when server IP missing.
if scripts/deploy/hetzner/check-security.sh >/tmp/check.out 2>/tmp/check.err; then
  echo "expected usage failure"
  exit 1
fi
```

**Step 2: Run tests to verify failure**

Run: `bash scripts/deploy/hetzner/tests/test-check-security.sh`
Expected: FAIL

**Step 3: Implement minimal verification checks**

```bash
# Check remotely:
# - sshd hardening flags
# - fail2ban active
# - unattended-upgrades enabled
# - ufw active
# - dokploy container running
```

**Step 4: Re-run tests**

Run: `bash scripts/deploy/hetzner/tests/test-check-security.sh`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/deploy/hetzner/check-security.sh scripts/deploy/hetzner/tests/test-check-security.sh
git commit -m "feat: add post-provision security checks"
```

### Task 4: Add runbook documentation and usage examples

**Files:**
- Create: `docs/deployment/hetzner-dokploy.md`
- Modify: `README.md`

**Step 1: Write failing doc presence check**

```bash
test -f docs/deployment/hetzner-dokploy.md
```

**Step 2: Run doc check (RED)**

Run: `test -f docs/deployment/hetzner-dokploy.md`
Expected: FAIL

**Step 3: Write docs with secure operational steps**

```markdown
Include:
- prerequisites
- env file setup
- dry-run and real run commands
- SSH tunnel instructions for Dokploy panel
- security verification command
- rollback/destroy notes
```

**Step 4: Re-run doc check (GREEN)**

Run: `test -f docs/deployment/hetzner-dokploy.md`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/deployment/hetzner-dokploy.md README.md
git commit -m "docs: add hetzner dokploy deployment runbook"
```

### Task 5: Final verification before completion

**Files:**
- Verify all modified files above

**Step 1: Run script syntax checks**

Run: `bash -n scripts/deploy/hetzner/create-vps.sh scripts/deploy/hetzner/check-security.sh scripts/deploy/hetzner/tests/test-create-vps.sh scripts/deploy/hetzner/tests/test-cloud-init-template.sh scripts/deploy/hetzner/tests/test-check-security.sh`
Expected: no output, exit 0

**Step 2: Run local tests**

Run: `bash scripts/deploy/hetzner/tests/test-create-vps.sh && bash scripts/deploy/hetzner/tests/test-cloud-init-template.sh && bash scripts/deploy/hetzner/tests/test-check-security.sh`
Expected: PASS

**Step 3: Check docs references**

Run: `rg "hetzner-dokploy|create-vps.sh|check-security.sh" README.md docs/deployment/hetzner-dokploy.md`
Expected: relevant references found

**Step 4: Review git diff and status**

Run: `git status --short && git diff --stat`
Expected: only intended deployment files changed

**Step 5: Commit final polish (if needed)**

```bash
git add -A
git commit -m "chore: finalize secure hetzner dokploy deploy scripts"
```
