# DeepSWE A/B harness

Runs DeepSWE v1.1 tasks with Claude Code, with and without themis, using Pier and the user's own Claude subscription. The results summary is in `pilot-results.json` and RESULTS.md.

## Recreate

```bash
cd evals/deepswe
git -c core.autocrlf=false clone --depth 1 https://github.com/datacurve-ai/deep-swe.git repo
git -c core.autocrlf=false clone --depth 1 https://github.com/datacurve-ai/pier.git pier
python patch_pier.py                      # node for hooks, plugin upload, LF files, git identity, extra CA
python -m venv .venv && ./.venv/Scripts/python -m pip install -e ./pier
mkdir plugin && cp -r ../../.claude-plugin ../../hooks ../../skills ../../agents plugin/ && rm plugin/.claude-plugin/marketplace.json
```

- **Token:** `claude setup-token` in a separate terminal, saved as `CLAUDE_CODE_OAUTH_TOKEN=...` in the env file named in `pilot.sh`. Keep it outside the repo and delete it when done.
- **TLS-inspecting antivirus:** export its public root certificate as PEM and point `THEMIS_EXTRA_CA` at it. Otherwise leave that variable unset.
- **Run:** `bash pilot.sh` (sequential and resumable), then `python audit.py pilot-base pilot-themis` and `python summarize.py out.json pilot-base pilot-themis`.

## Without a token: host runner

`hostrun.py` runs the task with the host's logged-in Claude Code. It clones the repo at the base commit with future history removed, installs dependencies, and runs `claude -p` with an optional `--plugin-dir`. It then grades the committed patch in DeepSWE's isolated verifier by running Pier's oracle with the patch as the "solution". Repo clone, Pier venv and the CA file are needed as above, but no token.

    ARMS="v10 spec" ROUNDS=2 bash hostab.sh "<task> <task>"   # variants: plugin/, plugin-spec/, plugin-noext/
    python abreport.py host-runs/v10 host-runs/spec
    python extras.py host-runs/v10 host-runs/spec
