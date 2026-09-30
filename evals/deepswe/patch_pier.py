"""Local patches to Pier for running DeepSWE on Windows with the themis plugin.
Run from evals/deepswe after a clean checkout of pier/: python patch_pier.py"""
import re

# 1. Claude Code agent: install node for plugin hooks; upload and load themis on request.
p = 'pier/src/pier/agents/installed/claude_code.py'
t = open(p, encoding='utf-8').read()
old = '  apt-get update && apt-get install -y curl;'
assert old in t
t = t.replace(old, '  apt-get update && apt-get install -y curl nodejs;', 1)
old = '            "FORCE_AUTO_BACKGROUND_TASKS": "1",\n            "ENABLE_BACKGROUND_TASKS": "1",\n        }\n'
new = old + '''
        # themis A/B: upload a local plugin and load it via CLAUDE_CODE_PLUGIN_DIRS
        themis_dir = os.environ.get("THEMIS_PLUGIN_DIR", "").strip()
        if themis_dir:
            await environment.upload_dir(themis_dir, "/opt/themis")
            await self.exec_as_root(environment, command="chmod -R a+rX /opt/themis")
            env["CLAUDE_CODE_PLUGIN_DIRS"] = "/opt/themis"
'''
assert old in t
t = t.replace(old, new, 1)

# 1b. Local TLS-inspecting antivirus: trust its public root inside the agent image and for Claude Code.
old = '        root_run = (\n'
new = '''        extra_ca = ""
        ca_path = os.environ.get("THEMIS_EXTRA_CA", "").strip()
        if ca_path:
            import base64
            b64 = base64.b64encode(open(ca_path, "rb").read()).decode()
            extra_ca = (
                "mkdir -p /usr/local/share/ca-certificates && "
                f"echo {b64} | base64 -d > /usr/local/share/ca-certificates/extra-root.crt && "
                "(update-ca-certificates >/dev/null 2>&1 || true); "
            )
        root_run = extra_ca + (
'''
assert old in t
t = t.replace(old, new, 1)
old = '        env["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"] = "1"\n'
new = old + '''        if os.environ.get("THEMIS_EXTRA_CA", "").strip():
            env["NODE_EXTRA_CA_CERTS"] = "/usr/local/share/ca-certificates/extra-root.crt"
        # Same git identity in every arm, as on a developer machine (the task image has none).
        env.update({"GIT_AUTHOR_NAME": "Dev", "GIT_AUTHOR_EMAIL": "dev@example.com",
                    "GIT_COMMITTER_NAME": "Dev", "GIT_COMMITTER_EMAIL": "dev@example.com"})
'''
assert old in t
t = t.replace(old, new, 1)
open(p, 'w', encoding='utf-8', newline='\n').write(t)

# 2. Files generated for Linux containers must use LF even when Pier runs on Windows.
LF = 'newline="' + chr(92) + 'n"'
for p in ['pier/src/pier/environments/agent_setup.py', 'pier/src/pier/environments/docker/__init__.py']:
    t = open(p, encoding='utf-8').read()
    t = re.sub(r'(\.write_text\([^\n]*)\)(?=\n)', lambda m: m.group(1) + ', ' + LF + ')', t)
    # the multi-line Dockerfile write in agent_setup.py ends with "\n    )\n    )"
    t = t.replace('                "",\n            ]\n        )\n    )\n', '                "",\n            ]\n        ),\n        ' + LF + ',\n    )\n')
    open(p, 'w', encoding='utf-8', newline='\n').write(t)
print('patched')
