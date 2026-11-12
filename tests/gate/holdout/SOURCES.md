# Held-out corpus sources

Public Node/TypeScript/JavaScript repositories, taken at the commit shown. The repository holds only `sources.json`, the scripts in this directory, this file and the labelled cases in `../holdout.jsonl`; the snapshots of the third-party repositories are not stored (see `../.gitignore`). A snapshot directory, once rebuilt, is named `<owner>__<repo>` and holds `rules.md` (the repository's root rule file under another name), `files.txt` (its file listing) and the files the gate reads. The rule text belongs to its authors under the licence listed.

To rebuild the snapshots (it needs the `gh` CLI, signed in), from the repository root:

```
node tests/gate/holdout/collect.mjs
node tests/gate/holdout/fetch-cited.mjs tests/gate/holdout.jsonl tests/gate/holdout
node hooks/dist/gate.js report tests/gate/holdout.jsonl
```

`collect.mjs` reads everything from GitHub at the exact commits in `sources.json`. A rebuilt snapshot also has `.gitignore` and the source files the rules cite, which the snapshots of the original blind run did not have, so that run's figures may not reproduce exactly. `node tests/gate/holdout/unlabel.mjs` writes the cases without labels, as the labellers got them, to `../holdout-unlabelled.jsonl` (not stored).

Selection was fixed before looking at any rule: primary language TypeScript or JavaScript, a root `package.json`, licence MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause or ISC, and a root `CLAUDE.md` (or `AGENTS.md`) of at least 10 rules. Candidates were taken in the order GitHub code search returned them (root `CLAUDE.md` hits first); a file of more than 60 rules contributes its first 60. Rules are the units of the gate's own parser (`parseRules`), headings and code blocks included. Forks, repositories whose licence GitHub does not identify (`NOASSERTION`, `none`) and the excluded reference repositories are skipped.

## Taken (40 repositories, 1502 rules)

Three of these rules (`jaccen__AIRoute-06`, `-10` and `-14`) were bare `---` lines. The parser no longer treats a thematic break as a rule, so they were removed from both corpus files, which now hold 1,499 rules; the counts below are as collected.

| Repository | Commit | Licence | Rule file | Rules taken | Rules in file |
|---|---|---|---|---|---|
| [`chanzuckerberg/single-cell-data-portal`](https://github.com/chanzuckerberg/single-cell-data-portal) | [`b1f2fc837e02`](https://github.com/chanzuckerberg/single-cell-data-portal/tree/b1f2fc837e02347e1004e6666327880ff0ca54a7) | MIT | CLAUDE.md | 49 | 49 |
| [`hendt/ebay-api`](https://github.com/hendt/ebay-api) | [`fceaab5f9940`](https://github.com/hendt/ebay-api/tree/fceaab5f9940cbf9599681c400ac96b4a7fcf525) | MIT | CLAUDE.md | 21 | 21 |
| [`dyatko/arkit`](https://github.com/dyatko/arkit) | [`f228b60a65d5`](https://github.com/dyatko/arkit/tree/f228b60a65d555da9693f8ec50eb231ac434c239) | MIT | CLAUDE.md | 60 | 163 |
| [`etowahadams/interprot`](https://github.com/etowahadams/interprot) | [`fae2d3ae9022`](https://github.com/etowahadams/interprot/tree/fae2d3ae90220781289e27a26cb3b0826cf2b07e) | MIT | CLAUDE.md | 21 | 21 |
| [`hakimio/ngx-ui-tour`](https://github.com/hakimio/ngx-ui-tour) | [`583f68037bbe`](https://github.com/hakimio/ngx-ui-tour/tree/583f68037bbe1b05396f0125d756007ff1efdaa2) | MIT | CLAUDE.md | 31 | 31 |
| [`davraamides/todotxt-mode`](https://github.com/davraamides/todotxt-mode) | [`f05e2f4b0420`](https://github.com/davraamides/todotxt-mode/tree/f05e2f4b0420d98a0200443fd5251855319a56e2) | MIT | CLAUDE.md | 28 | 28 |
| [`iPzard/electron-react-python-template`](https://github.com/iPzard/electron-react-python-template) | [`080c09d2d206`](https://github.com/iPzard/electron-react-python-template/tree/080c09d2d2063928158c265c44590b8517119ae0) | MIT | CLAUDE.md | 60 | 88 |
| [`platformatic/undici-cache-redis`](https://github.com/platformatic/undici-cache-redis) | [`2c3b154d2970`](https://github.com/platformatic/undici-cache-redis/tree/2c3b154d297092caf445955451a4ea2a7c35afb0) | Apache-2.0 | CLAUDE.md | 33 | 33 |
| [`mateenagy/vue-formify`](https://github.com/mateenagy/vue-formify) | [`9c29ff556986`](https://github.com/mateenagy/vue-formify/tree/9c29ff556986d47c14f93f1904578a9bda52bca7) | MIT | CLAUDE.md | 23 | 23 |
| [`CodeForBreakfast/eventsourcing`](https://github.com/CodeForBreakfast/eventsourcing) | [`626b45a01ff5`](https://github.com/CodeForBreakfast/eventsourcing/tree/626b45a01ff52e2a9229e3b02c2250fee8577110) | MIT | CLAUDE.md | 23 | 23 |
| [`vishwajeetraj11/osresume`](https://github.com/vishwajeetraj11/osresume) | [`255d3a6b899a`](https://github.com/vishwajeetraj11/osresume/tree/255d3a6b899a949326b91be9618862a4444caaf2) | MIT | CLAUDE.md | 28 | 28 |
| [`gaopengbin/cesium-mcp`](https://github.com/gaopengbin/cesium-mcp) | [`6572b727ff86`](https://github.com/gaopengbin/cesium-mcp/tree/6572b727ff86aa28f1ddfd234539dd82af2fcd33) | MIT | CLAUDE.md | 27 | 27 |
| [`RedHatInsights/frontend-starter-app`](https://github.com/RedHatInsights/frontend-starter-app) | [`76897cfc1d3f`](https://github.com/RedHatInsights/frontend-starter-app/tree/76897cfc1d3fcbb018bc0e4b377b83846cb3e4e3) | Apache-2.0 | CLAUDE.md | 60 | 266 |
| [`jordanhindo/beadboard`](https://github.com/jordanhindo/beadboard) | [`9e3059dbb7c2`](https://github.com/jordanhindo/beadboard/tree/9e3059dbb7c2e907cef79b5fa68d51f8cb390457) | MIT | CLAUDE.md | 23 | 23 |
| [`sectsect/webpack-sweet-entry`](https://github.com/sectsect/webpack-sweet-entry) | [`98f4739312cc`](https://github.com/sectsect/webpack-sweet-entry/tree/98f4739312cc6d15a2bb7b4071484eb0c34234c6) | MIT | CLAUDE.md | 31 | 31 |
| [`PeonPing/openpeon`](https://github.com/PeonPing/openpeon) | [`b0727d5abefc`](https://github.com/PeonPing/openpeon/tree/b0727d5abefc882982c4c7349bd1a8c45b1b73b1) | MIT | CLAUDE.md | 21 | 21 |
| [`mixmaxhq/commitlint-jenkins`](https://github.com/mixmaxhq/commitlint-jenkins) | [`fe1bc9fbfd38`](https://github.com/mixmaxhq/commitlint-jenkins/tree/fe1bc9fbfd3847ac4d6cf7faa7abeea3dfcbb55b) | MIT | CLAUDE.md | 15 | 15 |
| [`decentraland/events`](https://github.com/decentraland/events) | [`7da6943e8fdf`](https://github.com/decentraland/events/tree/7da6943e8fdf7843fe0b644eef10d98af716c575) | MIT | CLAUDE.md | 55 | 55 |
| [`forcedotcom/lwc-dev-mobile-core`](https://github.com/forcedotcom/lwc-dev-mobile-core) | [`313afbed48fe`](https://github.com/forcedotcom/lwc-dev-mobile-core/tree/313afbed48feb1c34be616e25813bf304e61cc84) | MIT | CLAUDE.md | 41 | 41 |
| [`liuxingqitd/skills-hub`](https://github.com/liuxingqitd/skills-hub) | [`3d74a83ef908`](https://github.com/liuxingqitd/skills-hub/tree/3d74a83ef908be6aff906d9908addfdeedff4f3f) | MIT | CLAUDE.md | 17 | 17 |
| [`moleculerjs/database`](https://github.com/moleculerjs/database) | [`ff8316b99271`](https://github.com/moleculerjs/database/tree/ff8316b99271c6cef4ab5f9f1374e4ad1c147511) | MIT | CLAUDE.md | 54 | 54 |
| [`just-every/mcp-read-website-fast`](https://github.com/just-every/mcp-read-website-fast) | [`78d0bf83a904`](https://github.com/just-every/mcp-read-website-fast/tree/78d0bf83a9043d46d56205a26755d81d9eb1b55e) | MIT | CLAUDE.md | 60 | 66 |
| [`stacksjs/besting`](https://github.com/stacksjs/besting) | [`875370775979`](https://github.com/stacksjs/besting/tree/8753707759793c07179bc4e5b16826e2421bd6de) | MIT | CLAUDE.md | 12 | 12 |
| [`wpnuxt/wpnuxt`](https://github.com/wpnuxt/wpnuxt) | [`86051f402def`](https://github.com/wpnuxt/wpnuxt/tree/86051f402def0dccce64de5b6098cd31d6f28a28) | MIT | CLAUDE.md | 60 | 92 |
| [`ikemo3/gossip-site-blocker`](https://github.com/ikemo3/gossip-site-blocker) | [`f040624eaea0`](https://github.com/ikemo3/gossip-site-blocker/tree/f040624eaea0c989529f64ced4a5df7f2058287c) | MIT | CLAUDE.md | 60 | 70 |
| [`galacticcouncil/sdk`](https://github.com/galacticcouncil/sdk) | [`b4e1cc0ed449`](https://github.com/galacticcouncil/sdk/tree/b4e1cc0ed4497f22ee69dd098169dffc1178e01d) | Apache-2.0 | CLAUDE.md | 59 | 59 |
| [`jasona/gameweaver`](https://github.com/jasona/gameweaver) | [`9da09d439458`](https://github.com/jasona/gameweaver/tree/9da09d439458d8e54c75f4cba5c0169461339757) | MIT | CLAUDE.md | 25 | 25 |
| [`Lessify/localess`](https://github.com/Lessify/localess) | [`880c63733bf8`](https://github.com/Lessify/localess/tree/880c63733bf87823858435cc9e34497603699ed7) | MIT | CLAUDE.md | 42 | 42 |
| [`formio/core`](https://github.com/formio/core) | [`da0b92f22c5a`](https://github.com/formio/core/tree/da0b92f22c5aa7ded0c7ee46742982e4e40d4a16) | MIT | CLAUDE.md | 38 | 38 |
| [`m2b-creator/N8N-Close`](https://github.com/m2b-creator/N8N-Close) | [`f3f72e9dfdbd`](https://github.com/m2b-creator/N8N-Close/tree/f3f72e9dfdbd40625461b568117ee02e34de4cf4) | MIT | CLAUDE.md | 29 | 29 |
| [`EnzoMartin/gpu-stats-reporter`](https://github.com/EnzoMartin/gpu-stats-reporter) | [`fea72a297868`](https://github.com/EnzoMartin/gpu-stats-reporter/tree/fea72a297868457a3a5cdd803e0dbd5482ec4eae) | MIT | CLAUDE.md | 14 | 14 |
| [`swax/SCDB`](https://github.com/swax/SCDB) | [`f7fbe75bd988`](https://github.com/swax/SCDB/tree/f7fbe75bd988419d9f90146009625d547ac98449) | MIT | CLAUDE.md | 39 | 39 |
| [`liujiayii/react-keep-alive`](https://github.com/liujiayii/react-keep-alive) | [`41152cb2892a`](https://github.com/liujiayii/react-keep-alive/tree/41152cb2892aecb31450654184e6ea9142a78889) | MIT | CLAUDE.md | 41 | 41 |
| [`maple-kit/maple`](https://github.com/maple-kit/maple) | [`c4491e8333a2`](https://github.com/maple-kit/maple/tree/c4491e8333a2f55c6e6ffb8a8656dcc0484d10d0) | Apache-2.0 | CLAUDE.md | 35 | 35 |
| [`iobroker-community-adapters/ioBroker.zoneminder`](https://github.com/iobroker-community-adapters/ioBroker.zoneminder) | [`a4c90871c902`](https://github.com/iobroker-community-adapters/ioBroker.zoneminder/tree/a4c90871c902d1cfdbd6fb720d58460ab8944a0c) | MIT | CLAUDE.md | 15 | 15 |
| [`Living-Snow-Project/LivingSnowProject`](https://github.com/Living-Snow-Project/LivingSnowProject) | [`ffd5411b17c0`](https://github.com/Living-Snow-Project/LivingSnowProject/tree/ffd5411b17c05728dd65f69d874f1baab20ec416) | MIT | CLAUDE.md | 60 | 75 |
| [`shrektan/formaldoc`](https://github.com/shrektan/formaldoc) | [`5935e4902f86`](https://github.com/shrektan/formaldoc/tree/5935e4902f86fe604b585328e9eec785e6ffa88a) | Apache-2.0 | CLAUDE.md | 59 | 59 |
| [`jaccen/AIRoute`](https://github.com/jaccen/AIRoute) | [`02ad18d75328`](https://github.com/jaccen/AIRoute/tree/02ad18d75328784cb8184c90883a3e989bc8de0b) | Apache-2.0 | CLAUDE.md | 60 | 150 |
| [`eason-dev/csp-kit`](https://github.com/eason-dev/csp-kit) | [`024933e27ac4`](https://github.com/eason-dev/csp-kit/tree/024933e27ac43b80d24b30fae1f2993dee4de513) | MIT | CLAUDE.md | 60 | 93 |
| [`builtbyfew/effing`](https://github.com/builtbyfew/effing) | [`a87ca035dd62`](https://github.com/builtbyfew/effing/tree/a87ca035dd620dbbdee09332bba4a9582d2ad241) | MIT | CLAUDE.md | 13 | 13 |

## Skipped candidates (37)

Only the candidates examined before the 40-repository minimum was reached appear here; the search returned more.

| Candidate | Reason |
|---|---|
| `NaverPayDev/pie` | primary language HTML |
| `puikinsh/kiaalap` | primary language HTML |
| `LianjiaTech/bella-openapi` | primary language Java |
| `Prismer-AI/Prismer` | licence NOASSERTION |
| `postalsys/imapflow` | licence NOASSERTION |
| `TheRealSimon42/simon42-dashboard-strategy` | licence NOASSERTION |
| `DotNet-MoYu/SimpleAdmin` | primary language C# |
| `mojaloop/mojaloop-simulator` | licence NOASSERTION |
| `withLinda/claude-JSONL-browser` | licence none |
| `fivetaku/cc101` | licence NOASSERTION |
| `Autonomy-Logic/STruCpp` | licence GPL-3.0 |
| `centralnicgroup-opensource/rtldev-middleware-idna-uts46` | licence NOASSERTION |
| `utopia-os/utopia-map` | licence GPL-3.0 |
| `Navibyte-Innovations-Pvt-Ltd/expo-icon-generator` | licence NOASSERTION |
| `rtk-ai/grit` | primary language Rust |
| `Yiuman/autoflow` | primary language Java |
| `playwithllm/store` | licence none |
| `trezm/superposition` | primary language Go |
| `isroil01/premation` | licence AGPL-3.0 |
| `chadly/blog` | licence NOASSERTION |
| `statusline/statusline` | licence none |
| `albiexai/synth-city` | primary language Python |
| `lishehao/RPG_Demo` | licence NOASSERTION |
| `cuonghx-dev/evm-kms-signer` | licence none |
| `mateonunez/website` | licence CC-BY-4.0 |
| `scope42/scope42` | licence GPL-3.0 |
| `kausaltech/kausal-paths-ui` | licence none |
| `akshayturtle/ai-community-intelligence` | primary language Python |
| `zenml-io/zenml-dashboard` | licence none |
| `stacksjs/gitit` | near-duplicate of stacksjs/besting |
| `team-mirai-volunteer/polister` | licence AGPL-3.0 |
| `makeplane/prd-agent` | licence none |
| `hoangnhat42/guru-mono` | no root package.json |
| `AutomationSolutionz/Zeuz_Python_Node` | licence GPL-3.0 |
| `2ue/ccman` | licence none |
| `thoughtspot/ts-chart-sdk` | licence none |
| `speedandfunction/automatization` | no root package.json |

Source files that the rules cite (backticked or bold paths, parenthesised paths, found in `files.txt`) are also stored, each at its real path and at most 64 KB, by `fetch-cited.mjs`: 305 files for this corpus (371 cited paths found; the rest were already stored, over 64 KB, lockfiles or named CLAUDE.md/AGENTS.md).
