"""PR ownership guard; coordinated integrator changes use a codex/backend branch."""
import os
import subprocess
import sys


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


branch = os.environ.get('PR_HEAD_REF') or git('branch', '--show-current')
base = os.environ.get('PR_BASE_SHA') or 'origin/main'
if branch.startswith('codex/offline'):
    allowed = ('offline/', 'experiments/')
elif branch.startswith('codex/frontend'):
    allowed = ('frontend/',)
elif branch.startswith('codex/backend'):
    allowed = None  # Integrator owns backend/contracts/root; check explicit exceptions below.
elif branch == 'codex/shared-bootstrap':
    allowed = None  # One initial, coordinated cross-folder scaffold.
else:
    sys.exit('Use codex/offline-*, codex/frontend-* or codex/backend-* for assigned implementation PRs.')
changed = git('diff', '--name-only', f'{base}...HEAD').splitlines()
if allowed is not None:
    invalid = [path for path in changed if not path.startswith(allowed)]
else:
    invalid = [] if branch == 'codex/shared-bootstrap' else [path for path in changed if path.startswith(('frontend/', 'offline/', 'experiments/')) and path != 'frontend/src/api/contract.d.ts']
if invalid:
    sys.exit('Cross-owner edits must go through the assigned owner:\n' + '\n'.join(invalid))
print(f'Ownership passed for {branch}: {len(changed)} changed files.')
