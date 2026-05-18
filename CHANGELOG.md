# [2.1.0](https://github.com/Sogni-AI/sogni-intelligence-client/compare/v2.0.0...v2.1.0) (2026-05-18)


### Bug Fixes

* **deps:** correct file:// path from worktree to canonical repo ([1306881](https://github.com/Sogni-AI/sogni-intelligence-client/commit/13068813e752dda0f19d1fc82979463b4765bb12))
* **esm:** add .js extensions to relative imports in src/index.ts ([71856c9](https://github.com/Sogni-AI/sogni-intelligence-client/commit/71856c965e3190160e1e3f743be25715a12796a2))
* **intelligence-client:** replay recent creative-agent fixes from main ([68d68bc](https://github.com/Sogni-AI/sogni-intelligence-client/commit/68d68bcafe44b29d676b8db4b233d07b43248cfb))
* **lockfile:** resolve stash-pop conflict (drop creative-agent dep) ([bf63d65](https://github.com/Sogni-AI/sogni-intelligence-client/commit/bf63d65be9a176755de5fef47ce79879e3508f1e))
* **openai-tools:** bake JSON manifests into TS so ESM build works in Node 22 ([7c5b013](https://github.com/Sogni-AI/sogni-intelligence-client/commit/7c5b01387e73bf4d3810ae0a752003912a23b087))
* **storyboard-parser:** paren-aware sfx split + concise scene titles ([02df13b](https://github.com/Sogni-AI/sogni-intelligence-client/commit/02df13b0394658e0b33d6fb69beefdac1a84d72e))


### Features

* **chatRun,context:** publish chat-run protocol + context-window primitives ([824bf37](https://github.com/Sogni-AI/sogni-intelligence-client/commit/824bf37b40fa8ba271a9d535f1ddbd60eae885fa))
* **contracts:** add composition-planning prompt contracts and skill ([5820a89](https://github.com/Sogni-AI/sogni-intelligence-client/commit/5820a892df3a118a173054bffdc875bbeb6cf2fa))
* **intelligence-client/contracts:** expose Path C extracted symbols ([79e0bd4](https://github.com/Sogni-AI/sogni-intelligence-client/commit/79e0bd43e1d462099064ef5f8de8cf1fe84b2a48))
* **intelligence-client/tools:** export expandSingleSourceFanOutForPerClipPrompts ([c8b2d8a](https://github.com/Sogni-AI/sogni-intelligence-client/commit/c8b2d8a2ad27b423049a48da94baedafc4c501cc))
* **intelligence-client/workflows:** add primitives namespace + embedded bindings + parsedSectionCount ([5936328](https://github.com/Sogni-AI/sogni-intelligence-client/commit/59363281b063d3fe5c68992dad9c78136d2bf041))
* **intelligence-client:** add carved-out public subpaths via re-export shims ([3b7c827](https://github.com/Sogni-AI/sogni-intelligence-client/commit/3b7c8277c49c566c55da6d1432227fd5ff3466a8))
* **intelligence-client:** add legacy-resolution subpath stubs ([8457afd](https://github.com/Sogni-AI/sogni-intelligence-client/commit/8457afd7f0b713c0db55b32cd7c7ceb0220f84c0)), closes [package.json#exports](https://github.com/package.json/issues/exports)
* **intelligence-client:** emit dual CJS+ESM builds for bundler compat ([e5dbf2e](https://github.com/Sogni-AI/sogni-intelligence-client/commit/e5dbf2e01c21b24ac88ff1ec62cceec124aac280))
* **intelligence-client:** emit dual CJS+ESM subpath shims for Rollup compat ([f286bcb](https://github.com/Sogni-AI/sogni-intelligence-client/commit/f286bcb18b9af19b653156b97e1d1ab7385a89bc))
* **intelligence-client:** move public-bucket source from @sogni/creative-agent ([3dc3d40](https://github.com/Sogni-AI/sogni-intelligence-client/commit/3dc3d404d8b988a7c542de03e71211b5d6e3f7fe))
* **intelligence-client:** re-export SogniClient from @sogni-ai/sogni-client ([54387b8](https://github.com/Sogni-AI/sogni-intelligence-client/commit/54387b8d491c2835c79f9d9858713aa39d2d1d30))
* **tools/shared:** add dynamicPromptBranches helpers ([7b1c714](https://github.com/Sogni-AI/sogni-intelligence-client/commit/7b1c71494da40d05c2a1ad7b4ac1419c5a7b581a))
* **tools/shared:** add maybeAlignNumberOfVariationsToDynamicBranchCount ([2736ff5](https://github.com/Sogni-AI/sogni-intelligence-client/commit/2736ff51d90525894d3034f7ce05a2995a7468cd))
* **tools/shared:** add textExplicitlyRequestsMultipleImageOutputs ([68c8488](https://github.com/Sogni-AI/sogni-intelligence-client/commit/68c84883101a161296831bed8859fb6a97ea49cc))
* **tools:** export dynamic-prompt + multi-image-intent helpers ([f11645a](https://github.com/Sogni-AI/sogni-intelligence-client/commit/f11645ad195d9a58cb91bcdb7b242349bab18ad2))
