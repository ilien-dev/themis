"""Run DeepSWE tasks with the host's logged-in Claude Code (no OAuth token needed) and grade the
committed patch in DeepSWE's isolated verifier container through Pier's oracle agent.

usage: python hostrun.py <variant-dir> <label> <task> [<task> ...]
  variant-dir  plugin directory passed with --plugin-dir ("none" for no plugin)
Outputs go to host-runs/<label>/<task>-<n>/ (stream.jsonl, model.patch, reward.json, meta.json).
"""
import json, os, re, shutil, subprocess, sys, tempfile, time, tomllib
from pathlib import Path

HERE = Path(__file__).resolve().parent
TASKS = HERE / 'repo' / 'tasks'
CACHE = HERE / 'host-cache'
OUT = HERE / 'host-runs'
PIER = HERE / '.venv' / 'Scripts' / 'pier'
GIT_ID = ['-c', 'user.name=Dev', '-c', 'user.email=dev@example.com']


def sh(cmd, cwd=None, check=True, timeout=None, env=None):
    r = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), capture_output=True, text=True,
                       encoding='utf-8', errors='replace', timeout=timeout, env=env)
    if check and r.returncode != 0:
        raise RuntimeError(f'{cmd} failed ({r.returncode}): {r.stderr[-800:]}')
    return r


def pristine(task):
    """Clone at the base commit with no future history, deps installed (cached per task)."""
    meta = tomllib.loads((TASKS / task / 'task.toml').read_text(encoding='utf-8'))['metadata']
    dest = CACHE / task
    if (dest / '.ready').exists():
        return dest, meta
    shutil.rmtree(dest, ignore_errors=True)
    sh(['git', '-c', 'core.autocrlf=input', 'clone', '-q', meta['repository_url'], str(dest)])
    head = sh('git remote show origin', cwd=dest).stdout
    default = re.search(r'HEAD branch: (\S+)', head).group(1)
    base = meta['base_commit_hash']
    sh(['git', 'checkout', '-q', '-B', default, base], cwd=dest)
    sh('git remote remove origin', cwd=dest)
    for b in sh("git for-each-ref --format=%(refname:short) refs/heads", cwd=dest).stdout.split():
        if b != default:
            sh(['git', 'branch', '-q', '-D', b], cwd=dest, check=False)
    for t in sh('git tag', cwd=dest).stdout.split():
        if sh(['git', 'merge-base', '--is-ancestor', t, 'HEAD'], cwd=dest, check=False).returncode != 0:
            sh(['git', 'tag', '-d', t], cwd=dest, check=False)
    sh('git reflog expire --expire=now --all', cwd=dest)
    sh('git gc -q --prune=now', cwd=dest)
    sh('git config core.autocrlf input', cwd=dest)
    sh('git config core.hooksPath NUL', cwd=dest)
    (dest / '.ready').write_text(default)
    return dest, meta


def install(work):
    if (work / 'package-lock.json').exists():
        sh('npm ci --include=dev --no-audit --no-fund --ignore-scripts', cwd=work, check=False, timeout=1200)
    elif (work / 'package.json').exists():
        sh('npm install --include=dev --no-audit --no-fund --ignore-scripts', cwd=work, check=False, timeout=1200)
    if (work / 'Cargo.toml').exists():
        sh('cargo fetch', cwd=work, check=False, timeout=1800)


def run_agent(work, instruction, variant, log):
    cmd = ['claude', '-p', '--model', 'claude-opus-5-5', '--effort', 'medium',
           '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
           '--setting-sources', 'project,local', '--permission-mode', 'dontAsk',
           '--allowedTools', 'Read Edit Write Glob Grep Bash PowerShell Agent Skill',
           '--disallowedTools', 'WebFetch WebSearch', '--max-turns', '200']
    if variant != 'none':
        cmd += ['--plugin-dir', str(Path(variant).resolve())]
    env = {k: v for k, v in os.environ.items() if k != 'CLAUDE_CODE_EFFORT_LEVEL'}
    env.update({'GIT_AUTHOR_NAME': 'Dev', 'GIT_AUTHOR_EMAIL': 'dev@example.com',
                'GIT_COMMITTER_NAME': 'Dev', 'GIT_COMMITTER_EMAIL': 'dev@example.com'})
    with open(log, 'w', encoding='utf-8') as f:
        # the prompt goes through stdin: task texts can start with '-' and be parsed as options
        p = subprocess.run(cmd, cwd=work, input=instruction.encode('utf-8'), stdout=f, stderr=subprocess.STDOUT, env=env, timeout=5400)
    return p.returncode


def grade(task, patch, dest):
    """Grade the patch with DeepSWE's verifier: an oracle whose 'solution' is the agent's patch."""
    tmp = Path(tempfile.mkdtemp(prefix='dsw-grade-'))
    tcopy = tmp / task
    shutil.copytree(TASKS / task, tcopy)
    (tcopy / 'solution' / 'solution.patch').write_bytes(patch)
    env = dict(os.environ, PYTHONUTF8='1', PYTHONIOENCODING='utf-8',
               THEMIS_EXTRA_CA=str(HERE / 'extra-ca.crt') if (HERE / 'extra-ca.crt').exists() else '')
    sh([str(PIER), 'run', '-p', str(tcopy), '--agent', 'oracle', '--env', 'docker', '-o', str(tmp / 'jobs')],
       check=False, timeout=3600, env=env)
    rw = list((tmp / 'jobs').glob('*/*/verifier/reward.json'))
    reward = json.loads(rw[0].read_text()) if rw else {'reward': None, 'error': 'no reward'}
    ctrf = list((tmp / 'jobs').glob('*/*/verifier/ctrf.json'))
    if ctrf:
        tests = json.loads(ctrf[0].read_text(encoding='utf-8'))['results']['tests']
        reward['failed'] = [t['name'][:160] for t in tests if t.get('status') != 'passed'][:40]
    (dest / 'reward.json').write_text(json.dumps(reward))
    shutil.rmtree(tmp, ignore_errors=True)
    return reward


def main():
    variant, label, tasks = sys.argv[1], sys.argv[2], sys.argv[3:]
    for task in tasks:
        n = 1
        while (OUT / label / f'{task}-{n}').exists():
            n += 1
        dest = OUT / label / f'{task}-{n}'
        dest.mkdir(parents=True)
        src, meta = pristine(task)
        work = Path(tempfile.mkdtemp(prefix='dsw-work-')) / task
        sh(['git', '-c', 'core.autocrlf=input', 'clone', '-q', str(src), str(work)])
        sh('git remote remove origin', cwd=work)
        sh('git config core.autocrlf input', cwd=work)
        install(work)
        instruction = (TASKS / task / 'instruction.md').read_text(encoding='utf-8')
        t0 = time.time()
        code = run_agent(work, instruction, variant, dest / 'stream.jsonl')
        patch = subprocess.run(['git', 'diff', '--binary', meta['base_commit_hash'], 'HEAD'], cwd=work,
                               capture_output=True).stdout
        (dest / 'model.patch').write_bytes(patch)
        reward = grade(task, patch, dest)
        (dest / 'meta.json').write_text(json.dumps({'task': task, 'variant': variant, 'exit': code,
                                                    'secs': round(time.time() - t0), 'work': str(work)}))
        print(f"{label} {task}-{n}: reward={reward.get('reward')} f2p={reward.get('f2p_passed')}/{reward.get('f2p_total')} "
              f"p2p={reward.get('p2p_passed')}/{reward.get('p2p_total')} patch={len(patch)}B", flush=True)
        shutil.rmtree(work.parent, ignore_errors=True)


if __name__ == '__main__':
    main()
