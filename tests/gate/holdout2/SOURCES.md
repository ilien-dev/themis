# Second held-out corpus sources

Snapshots of public Node/TypeScript/JavaScript repositories, taken at the commit shown, used to validate the gate blind (nobody read the rules, the checks or the tables before collecting). `rules.md` in each directory is the repository's root rule file stored under another name; the text belongs to its authors under the licence listed. The snapshot directories are not versioned (see `../.gitignore`): rebuild them with `node tests/gate/holdout/collect.mjs tests/gate/holdout2/sources.json --extras`, which reads everything from GitHub at the exact commits in `sources.json`. `../holdout2-unlabelled.jsonl` has one case per rule (`node tests/gate/holdout/unlabel.mjs tests/gate/holdout2 40 tests/gate/holdout2-unlabelled.jsonl`).

Selection was fixed before looking at any rule, with the same criteria as the first corpus: primary language TypeScript or JavaScript, a root `package.json`, licence MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause or ISC (as GitHub identifies it), and a root `AGENTS.md` or `CLAUDE.md` of at least 10 rules by the gate's own parser. Candidates were taken in the order GitHub code search returned them (`filename:AGENTS.md path:/ language:markdown` first, screened until 22 repositories were taken so that at least 15 use AGENTS.md; then `filename:CLAUDE.md path:/ language:markdown` until there were at least 40 repositories and about 1,000 rules). A candidate found by both searches was taken once, with the file of the search that found it first, and noted below when it has both files. A file of more than 40 rules contributes its first 40. Forks, repositories whose licence is not one of the five, the 40 repositories of the first corpus and the reference repositories (instrlint, ctxlint) are skipped. Besides the files the first corpus stored, each snapshot has `.gitignore`, up to 30 `package.json` files of the tree at their real paths, and the licence file.

## Taken (40 repositories, 1223 rules; 22 with AGENTS.md, 18 with CLAUDE.md)

| Repository | Commit | Licence | Rule file | Rules taken | Rules in file |
|---|---|---|---|---|---|
| [`qawolf/cli`](https://github.com/qawolf/cli) | [`1188c32dea1a`](https://github.com/qawolf/cli/tree/1188c32dea1ae2ff668d0e641320b4851f620a28) | Apache-2.0 | AGENTS.md (also has CLAUDE.md) | 28 | 28 |
| [`PaloAltoNetworks/docusaurus-openapi-docs`](https://github.com/PaloAltoNetworks/docusaurus-openapi-docs) | [`4d08a3f2eab9`](https://github.com/PaloAltoNetworks/docusaurus-openapi-docs/tree/4d08a3f2eab9c93864c694ac3ba67ce86d0c497f) | MIT | AGENTS.md | 40 | 52 |
| [`bbc/bug`](https://github.com/bbc/bug) | [`4266870bb061`](https://github.com/bbc/bug/tree/4266870bb061479d617d8296a66c8407d9c04cf2) | Apache-2.0 | AGENTS.md | 39 | 39 |
| [`hellooops/vscode-edi-support`](https://github.com/hellooops/vscode-edi-support) | [`9daaa95671dd`](https://github.com/hellooops/vscode-edi-support/tree/9daaa95671dd3ba096faefcc673389a7b9241849) | MIT | AGENTS.md | 18 | 18 |
| [`tin-computer/with-md`](https://github.com/tin-computer/with-md) | [`079bb6c3585b`](https://github.com/tin-computer/with-md/tree/079bb6c3585b0f706875e0a1e3d314ab3f13273d) | MIT | AGENTS.md | 40 | 48 |
| [`avatune/avatune`](https://github.com/avatune/avatune) | [`820de8be393d`](https://github.com/avatune/avatune/tree/820de8be393d69b4d30a0c2b8f52b508f5bebde8) | MIT | AGENTS.md (also has CLAUDE.md) | 40 | 40 |
| [`cobbler/cobbler-web`](https://github.com/cobbler/cobbler-web) | [`d9d3d74b3d8b`](https://github.com/cobbler/cobbler-web/tree/d9d3d74b3d8bf271260624c71c773b098b7f309d) | MIT | AGENTS.md (also has CLAUDE.md) | 27 | 27 |
| [`HorusGoul/eslint-plugin-react-render-types`](https://github.com/HorusGoul/eslint-plugin-react-render-types) | [`eae86d53252d`](https://github.com/HorusGoul/eslint-plugin-react-render-types/tree/eae86d53252da49f26eb4fe16aa932f44ec81c61) | MIT | AGENTS.md (also has CLAUDE.md) | 31 | 31 |
| [`pawcoding/astro-loader-pocketbase`](https://github.com/pawcoding/astro-loader-pocketbase) | [`91614e979dd7`](https://github.com/pawcoding/astro-loader-pocketbase/tree/91614e979dd71f36e7baf7e43ac00937e4f43bc9) | MIT | AGENTS.md | 40 | 44 |
| [`caretive-ai/project-careti`](https://github.com/caretive-ai/project-careti) | [`fca59a277cca`](https://github.com/caretive-ai/project-careti/tree/fca59a277cca5dfd639426527d3519fadeecc070) | Apache-2.0 | AGENTS.md (also has CLAUDE.md) | 40 | 62 |
| [`CyberBoyAyush/zenox`](https://github.com/CyberBoyAyush/zenox) | [`e6dd816755bf`](https://github.com/CyberBoyAyush/zenox/tree/e6dd816755bf6134caeb6ec70e5b9d128f37b1d5) | MIT | AGENTS.md | 36 | 36 |
| [`JuandaGarcia/crd-ui`](https://github.com/JuandaGarcia/crd-ui) | [`47beca25c474`](https://github.com/JuandaGarcia/crd-ui/tree/47beca25c474bc0d2f5e63122da2cf34ce6d948a) | MIT | AGENTS.md | 17 | 17 |
| [`jantimon/web-performance-debugger`](https://github.com/jantimon/web-performance-debugger) | [`c6549b330e85`](https://github.com/jantimon/web-performance-debugger/tree/c6549b330e85937052b7254ebe1e0dd3ceddf32a) | MIT | AGENTS.md (also has CLAUDE.md) | 22 | 22 |
| [`firelex/jeff-code`](https://github.com/firelex/jeff-code) | [`830689599991`](https://github.com/firelex/jeff-code/tree/8306895999915523c9ae609f0a845587938e5656) | MIT | AGENTS.md | 40 | 74 |
| [`ministryofjustice/hmpps-contacts-ui`](https://github.com/ministryofjustice/hmpps-contacts-ui) | [`be4e9b952c1f`](https://github.com/ministryofjustice/hmpps-contacts-ui/tree/be4e9b952c1f9d8c11c756d5189b11e0b254fdc5) | MIT | AGENTS.md | 30 | 30 |
| [`pankajudhas81/pi-claude-auth`](https://github.com/pankajudhas81/pi-claude-auth) | [`30d7a44ab2ba`](https://github.com/pankajudhas81/pi-claude-auth/tree/30d7a44ab2ba7538fc610f437867318a73d05e40) | MIT | AGENTS.md (also has CLAUDE.md) | 16 | 16 |
| [`jiawei686/wechat-dev-mcp`](https://github.com/jiawei686/wechat-dev-mcp) | [`f357c6a01e15`](https://github.com/jiawei686/wechat-dev-mcp/tree/f357c6a01e156bdda418ca4f8726d5241ef42cc1) | MIT | AGENTS.md | 22 | 22 |
| [`jeremy0dell/station`](https://github.com/jeremy0dell/station) | [`bfb2813164ed`](https://github.com/jeremy0dell/station/tree/bfb2813164edcbed2d2da5e2923559dc914859eb) | Apache-2.0 | AGENTS.md (also has CLAUDE.md) | 38 | 38 |
| [`dangreenisrael/eslint-plugin-jest-formatting`](https://github.com/dangreenisrael/eslint-plugin-jest-formatting) | [`8efabaefff81`](https://github.com/dangreenisrael/eslint-plugin-jest-formatting/tree/8efabaefff81a8d46be5a2904c185ac6296c92dc) | MIT | AGENTS.md | 40 | 41 |
| [`Jahia/tomcat-log-provider`](https://github.com/Jahia/tomcat-log-provider) | [`5d7746cf22a5`](https://github.com/Jahia/tomcat-log-provider/tree/5d7746cf22a5ae09f472879f69c46da54593dbfb) | MIT | AGENTS.md (also has CLAUDE.md) | 33 | 33 |
| [`sablier-labs/price-data`](https://github.com/sablier-labs/price-data) | [`821f568fed13`](https://github.com/sablier-labs/price-data/tree/821f568fed13ae5080043827dc28e24cb1a8ee7d) | MIT | AGENTS.md | 17 | 17 |
| [`shreyansh232/promptr`](https://github.com/shreyansh232/promptr) | [`52ea4c7a9c72`](https://github.com/shreyansh232/promptr/tree/52ea4c7a9c72bfd8f925f7a35f15574687d2219d) | MIT | AGENTS.md | 38 | 38 |
| [`ai-driven-dev/framework`](https://github.com/ai-driven-dev/framework) | [`6f70b656faee`](https://github.com/ai-driven-dev/framework/tree/6f70b656faeeacb9ba96e51a6ab1e79ff830803b) | MIT | CLAUDE.md (also has AGENTS.md) | 33 | 33 |
| [`Roznoshchik/Lurnby`](https://github.com/Roznoshchik/Lurnby) | [`5479480fa6f6`](https://github.com/Roznoshchik/Lurnby/tree/5479480fa6f681de5524a206f4ae32932f82b81f) | BSD-3-Clause | CLAUDE.md | 40 | 110 |
| [`narnia-sh/layrr`](https://github.com/narnia-sh/layrr) | [`e4e7a0ab972d`](https://github.com/narnia-sh/layrr/tree/e4e7a0ab972d3df4f5acc6a5929f36f3def89c59) | MIT | CLAUDE.md | 20 | 20 |
| [`hoangsonww/JWT-Module`](https://github.com/hoangsonww/JWT-Module) | [`caea4805f441`](https://github.com/hoangsonww/JWT-Module/tree/caea4805f4419be6658e667aca40a290d45fdc18) | MIT | CLAUDE.md | 25 | 25 |
| [`samuelloranger/labby`](https://github.com/samuelloranger/labby) | [`25322ee3dc97`](https://github.com/samuelloranger/labby/tree/25322ee3dc975b80576e5b9dd32f4cb228be9faa) | MIT | CLAUDE.md | 21 | 21 |
| [`StanfordSpezi/spezi-web-design-system`](https://github.com/StanfordSpezi/spezi-web-design-system) | [`1b939965d7e7`](https://github.com/StanfordSpezi/spezi-web-design-system/tree/1b939965d7e76f058199cb1827dcfe263b865fee) | MIT | CLAUDE.md | 11 | 11 |
| [`oozoofrog/mcp-baepsae`](https://github.com/oozoofrog/mcp-baepsae) | [`4e36492380ca`](https://github.com/oozoofrog/mcp-baepsae/tree/4e36492380ca82ae2c3ea28f5475e0ac9050d193) | MIT | CLAUDE.md (also has AGENTS.md) | 38 | 38 |
| [`bankless-academy/bankless-academy`](https://github.com/bankless-academy/bankless-academy) | [`4ed37a8843f0`](https://github.com/bankless-academy/bankless-academy/tree/4ed37a8843f0c4e1bea157a06cb3a015763ed45a) | MIT | CLAUDE.md | 40 | 222 |
| [`manifesto-ai/core-legacy`](https://github.com/manifesto-ai/core-legacy) | [`dbfa320cb3a1`](https://github.com/manifesto-ai/core-legacy/tree/dbfa320cb3a1319df71e151e0cfd146adce0c339) | MIT | CLAUDE.md | 25 | 25 |
| [`keshrath/agent-knowledge`](https://github.com/keshrath/agent-knowledge) | [`b614c04720a6`](https://github.com/keshrath/agent-knowledge/tree/b614c04720a6da25801a1fea6ae1ffd25d8b4373) | MIT | CLAUDE.md | 40 | 43 |
| [`ivanreeve/upspace`](https://github.com/ivanreeve/upspace) | [`12abc7e90d8b`](https://github.com/ivanreeve/upspace/tree/12abc7e90d8b0e11dace35a9f72073e1174f532a) | MIT | CLAUDE.md (also has AGENTS.md) | 29 | 29 |
| [`getcatalystiq/agent-plane`](https://github.com/getcatalystiq/agent-plane) | [`ea9370397abd`](https://github.com/getcatalystiq/agent-plane/tree/ea9370397abd5cfc7abf9a8f9e3d13e3d2c80233) | MIT | CLAUDE.md | 40 | 133 |
| [`DobroslavRadosavljevic/hsize`](https://github.com/DobroslavRadosavljevic/hsize) | [`4a77e458349b`](https://github.com/DobroslavRadosavljevic/hsize/tree/4a77e458349b3a94f9049fba81a6ce889e4552bc) | MIT | CLAUDE.md (also has AGENTS.md) | 40 | 81 |
| [`typlx/chrome-grammar-fix-extension`](https://github.com/typlx/chrome-grammar-fix-extension) | [`b5d421981b1f`](https://github.com/typlx/chrome-grammar-fix-extension/tree/b5d421981b1f0c13dd8df3e4b405da97ec691ed0) | MIT | CLAUDE.md | 19 | 19 |
| [`Alfred768/xclaw`](https://github.com/Alfred768/xclaw) | [`8e76c4611f09`](https://github.com/Alfred768/xclaw/tree/8e76c4611f0959cca633a1740d39763276723abd) | MIT | CLAUDE.md | 31 | 31 |
| [`madspaaskesen/gifmeta-gui`](https://github.com/madspaaskesen/gifmeta-gui) | [`6fef01ef0eaf`](https://github.com/madspaaskesen/gifmeta-gui/tree/6fef01ef0eaff545b5ed224cb54f28a5bba03352) | MIT | CLAUDE.md | 30 | 30 |
| [`ireaneus/ChristmasTower`](https://github.com/ireaneus/ChristmasTower) | [`8d1f1ef51f5b`](https://github.com/ireaneus/ChristmasTower/tree/8d1f1ef51f5b56422c838c1e887a19d966266ed5) | MIT | CLAUDE.md | 21 | 21 |
| [`ccmdesign/ccm-feedback-tool`](https://github.com/ccmdesign/ccm-feedback-tool) | [`bf5d1e6879ea`](https://github.com/ccmdesign/ccm-feedback-tool/tree/bf5d1e6879ead5b3db3cf903e02dce1a97f5d153) | MIT | CLAUDE.md | 28 | 28 |

## Skipped candidates (224)

Every candidate examined before the stopping point appears here by objective reason; the search returned more.

| Reason | Count | Candidates |
|---|---|---|
| primary language Python | 50 | `saubakirov/KZ-IT-telegram-list`, `1Password/SCAM`, `LeadMagic/gtm-skills`, `songshuquant/ssquant`, `Smith42/astroPT`, `originheartgold/origin-heart-gold-EN-translation`, `w00ing/seer-skill`, `Arize-ai/arize-skills`, `cpuguy96/StepCOVNet`, `Zambav/ComfyUI-Agent-Toolkit`, `omoinoki/sekaisync`, `thomasnormal/codex-auto-continue`, `Xiaxia1997/mini-claude-code-python`, `larsderidder/tether`, `ZJU-PL/pyflow`, `oklabflensburg/open-city-planner`, `liustack/vibemaster`, `beyond-all-reason/BARScriptCompiler`, `deanpeters/product-manager-antagonist-skills`, `sandro-defender/OspreyPi-esp32-s3-480x480`, `bytechminds/meritRankerAgent`, `insightitsGit/prism-eval`, `NieRMHY/ALAS-NieRMHY`, `smwitkowski/tech-diagrams`, `m4bwav/pixelwright`, `haddocking/haddock3`, `resilient-tech/india-compliance`, `sethlaw/sputr`, `jvkersch/tmtools`, `stefanbschneider/mobile-env`, `SSSYoung/vibe-coding-mobile-engineering`, `jasonanewcoder/abaqus_skills`, `axeII/home-ops`, `oborchers/mcp-server-docy`, `vichannnnn/holy-grail`, `URML-MARS/URML`, `smallbunnies/Solverz`, `jamesbrink/mcp-coroot`, `adrianoamalfi/hassos-addons`, `JordanCoin/openfoia`, `excatt/superclaude-plusplus`, `LindaHaviv/second-brain`, `CodeCrow/talesofvalor_python`, `erix/autoresearch-trading`, `dcurlewis/ai-context-system`, `Aleks-Ya/anki-addons-dataset`, `Lucasmind/nodeava-workshop-public`, `davidsheffield/WorkshopCode`, `joshspeagle/frasian_tilting`, `chinthana-w/s-imply` |
| primary language Go | 26 | `kubernetes-sigs/cluster-api-provider-openstack`, `GoogleContainerTools/config-sync`, `openshift/cluster-kube-apiserver-operator`, `gogpu/gg`, `extsoft/elegant-git`, `manusa/podman-mcp-server`, `lounge/tuify`, `yungwood/ical-filter-proxy`, `Kevandrew/sophia`, `mh-language/mhl-core-runtime`, `jimyag/jvp`, `serty2005/goMH`, `seb-schulz/hostsharing-dyndns`, `evrone/go-clean-template`, `ckotzbauer/vulnerability-operator`, `hectcastro/gh-metrics`, `openshift/ocm-agent`, `delving/hub3`, `tfcace/hash`, `mshogin/archlint`, `fedir/ghstat`, `mdelapenya/biomelab`, `justinabrahms/agent-chat`, `firetiger-oss/connect-sse`, `yassineS/bio_ai_experiment`, `pulumi-labs/pulumi-namespace` |
| primary language Rust | 21 | `purton-tech/rust-on-nails`, `fundamental-research-labs/mog`, `raphaelmansuy/edgecrab`, `russfellows/s3dlio`, `multiversx/mx-sovereign-sc`, `brianmay/robotica-rust`, `Arrekin/dark-wisps-defence`, `vivekpal1/kdo`, `kennetpostigo/omascreentime`, `vllm-project/agentic-api`, `rust-tieng-viet/rust-tieng-viet.github.io`, `kantord/headson`, `Endle/fireSeqSearch`, `xxraincandyxx/Amadeus`, `KaiserGranatapfel/GameCubeRecompiled`, `arch-hdl-lang/arch-com`, `saveoursecrets/sdk`, `rvigo/cl`, `quilrai/AgentGuard`, `KenanSalar/Melodia`, `JustJoinSpace/behave` |
| primary language C++ | 10 | `Andersbakken/rtags`, `nzh63/syc`, `vincentlaucsb/svg`, `jakildev/IrredenEngine`, `YimingQiao/bloom`, `TornLux/UnrealBridge`, `broadinstitute/delphy`, `J-D-3/density-clustering`, `Ajakfial/Wilfred`, `seanwilliamcarroll/interpreters` |
| primary language Java | 9 | `Xceptance/neodymium`, `Protelis/Protelis`, `HKPC-1967/spring-ant`, `aotemiao/artemis`, `kousen/java_8_recipes`, `digitalpetri/opc-ua-demo-server`, `alexshamrai/junit-ctrf-reporter`, `GeoffWilson/ToolkitCE`, `alexkapoulas/BiomePruner` |
| primary language C | 9 | `edwnh/dqmc`, `bekker/qvopenapi-rs`, `shikokuchuo/secretbase`, `CheshiAI/Cheshi`, `yahiafarghaly/PrettyOS`, `hasseily/NoxArchaistCompanion`, `NetraRuntime/sam3.c`, `zw3rk/hyper-linux`, `husarion/rosbot-firmware` |
| primary language C# | 9 | `am385/Lineup`, `VPDPersonal/Aspid.FastTools`, `Kas1o/ShimmerChat`, `zh667/ScCsgoKnives`, `EricZimmerman/Lnk`, `altasoft/DomainPrimitives`, `Accenture/DBTestCompareGenerator`, `PandaTechAM/be-lib-masstransit-outbox`, `mvdmio/ASP.Jobs` |
| licence NOASSERTION | 9 | `samuelnovaes/smart-tiling`, `hiyoriOS/kaji`, `flurdy/dreamfactory`, `TheRealSimon42/simon42-dashboard-strategy`, `TheAndrewStaker/mcp-midi-control`, `nirholas/universal-crypto-mcp`, `codescene-oss/codescene-vscode`, `anchildress1/save-the-sun`, `zeus2611/portfolio` |
| licence AGPL-3.0 | 7 | `ViewComfy/ViewComfy`, `baimard/gestion`, `yojo-art/cherrypick`, `yuanyuekejiJN/AivoClaw`, `ichiroc/chatgpt2scratch`, `lucasmen9527/claude-suite`, `amvlab/WebATM` |
| primary language Swift | 7 | `honishi/Hakumai`, `Weixi779/WICompress`, `glsorre/Crane`, `dilee/zen-dev-toolkit`, `ilikebug/VeloxClip`, `skyblanket/swift-render`, `arolang/aro` |
| primary language Shell | 5 | `openshift-examples/web`, `function1st/PhoneZero`, `cenconq25/claude-code-app-studio`, `Procrat/dotfiles`, `Jartan-LLC/enchantments` |
| primary language Kotlin | 5 | `Johnny520/wcx`, `easyhooon/dari`, `BBBEANNN/limbusZhCN`, `edilsonvilarinho/usage-monitor`, `firebase/FirebaseUI-Android` |
| licence none | 5 | `byigitt/postmaker-x`, `Ashisheng2005/RadishMD`, `Gerstep/HumanCompiler`, `KonghaYao/harness-perf-benchmark`, `HenriqueBragaMoreira/web-portfolio` |
| primary language HTML | 5 | `AndreaGriffiths11/annotation-overlay`, `NaverPayDev/pie`, `Glorktelligence/Claude-AI-Export-Renderer`, `SolaceLabs/solace-msg-utility`, `CaoYuhaoCarl/seedx` |
| licence GPL-3.0 | 3 | `DamianB-BitFlipper/proton-drive-sync`, `hotosm/ui`, `gorazenxu/pimate` |
| no root package.json | 3 | `DanielPan12/JobHuntBot`, `vangberg/pdit`, `Aurealibe/claude-config` |
| primary language PHP | 3 | `owncloud/moodle-repository_ocis`, `stackkit/laravel-google-cloud-scheduler`, `msrbuilds/elementor-mcp` |
| in the first corpus | 3 | `davraamides/todotxt-mode`, `PeonPing/openpeon`, `decentraland/events` |
| fewer than 10 rules (8) | 2 | `ECarry/photography-website`, `co-cddo/cloudmaturity` |
| primary language Lua | 2 | `alex35mil/pi.nvim`, `patrick-motard/dotfiles` |
| primary language Ruby | 2 | `sankichi92/LiveLog`, `glossarist/iev` |
| primary language Astro | 2 | `datopian/autoclaw.sh`, `ro80t/website` |
| fewer than 10 rules (1) | 2 | `ThilinaTLM/inkwell`, `Open-Document-Alliance/Agent-Review-CLI` |
| primary language Zig | 2 | `semos-labs/attyx`, `nullclaw/nulltickets` |
| fewer than 10 rules (4) | 2 | `badlogic/vs-claude`, `ClawVoice/clawvoice` |
| primary language null | 2 | `Dizzy-Security/dizzy`, `juanje/complex-system-kb` |
| primary language Julia | 1 | `comonicon/Comonicon.jl` |
| primary language Vim Script | 1 | `treyhunner/dotfiles` |
| primary language HCL | 1 | `cisagov/ScubaConnect` |
| primary language Jupyter Notebook | 1 | `changyaochen/MECE4520` |
| primary language Go Template | 1 | `eftechcombr/glpi` |
| licence PostgreSQL | 1 | `supabase/pg-toolbelt` |
| fewer than 10 rules (2) | 1 | `cjhyy/codeshell` |
| primary language MATLAB | 1 | `ultralytics/magellan` |
| fewer than 10 rules (9) | 1 | `leochiu-a/elden-ring-github` |
| primary language Erlang | 1 | `openworkload/swm-core` |
| primary language Dart | 1 | `guoxiucai/ohos-scrcpy-app` |
| primary language SCSS | 1 | `PabloLerma/PabloLerma.github.io` |
| primary language Crystal | 1 | `coverallsapp/coverage-reporter` |
| primary language Pascal | 1 | `JavierusTk/delphi-lookup` |
| licence CC-BY-4.0 | 1 | `mateonunez/website` |
| fewer than 10 rules (3) | 1 | `IlyaGrshin/wallet_animations` |
| primary language Elixir | 1 | `rpmessner/waveform` |
| licence MPL-2.0 | 1 | `CornWorld/zod-codepen` |
| primary language Vue | 1 | `mr-creative-hmh/laravel-vue-creative-starter-dashboard-kit` |

Source files that the rules cite (backticked or bold paths, parenthesised paths, found in `files.txt`) are also stored, each at its real path and at most 64 KB, by `tests/gate/holdout/fetch-cited.mjs`: 279 files for this corpus (334 cited paths found; the rest were already stored, over 64 KB, lockfiles, binary types or named CLAUDE.md/AGENTS.md).
