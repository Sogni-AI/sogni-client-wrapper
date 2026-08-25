## [3.22.3](https://github.com/Sogni-AI/sogni-intelligence-client/compare/v3.22.2...v3.22.3) (2026-08-25)


### Bug Fixes

* **deps:** adopt sogni-client 5.18.3 ([7a4d902](https://github.com/Sogni-AI/sogni-intelligence-client/commit/7a4d902cdb99bdad83d70f9a71878b1f1ae03303))

# [3.22.0](https://github.com/Sogni-AI/sogni-intelligence-client/compare/v3.21.1...v3.22.0) (2026-08-24)


### Bug Fixes

* **deps:** align prompt authoring package dependencies ([d08283a](https://github.com/Sogni-AI/sogni-intelligence-client/commit/d08283a9f4570a4f12ce0e9ae3878c42d55b75b9))


### Features

* **prompts:** add model-native authoring contracts ([1fe6e80](https://github.com/Sogni-AI/sogni-intelligence-client/commit/1fe6e8067ed49262f9c8a52368848c0ca6676227))

## [3.21.1](https://github.com/Sogni-AI/sogni-intelligence-client/compare/v3.21.0...v3.21.1) (2026-08-24)


### Bug Fixes

* **video:** normalize H3 references and estimates ([8a1f2a0](https://github.com/Sogni-AI/sogni-intelligence-client/commit/8a1f2a004be25f9803d657a916d98c1b0e7fa259))

# [3.21.0](https://github.com/Sogni-AI/sogni-intelligence-client/compare/v3.20.0...v3.21.0) (2026-08-24)


### Features

* **music:** make MiniMax Music 3 the default generate_music model ([3f8a550](https://github.com/Sogni-AI/sogni-intelligence-client/commit/3f8a550fea8d89176f1e84fbecb2ba152d0c8fed))
* **video:** retire Seedance 2.0 Fast in favor of Seedance 2.0 Mini ([8dcd999](https://github.com/Sogni-AI/sogni-intelligence-client/commit/8dcd99949eddff053fbc20591c1c6879110f55f4))


### Reverts

* undo the 3.18.0 release commit that downgraded the version ([0363212](https://github.com/Sogni-AI/sogni-intelligence-client/commit/0363212fb775170679a629cd32eea1887b9f40c2))

## [3.12.6](https://github.com/Sogni-AI/sogni-intelligence-client/compare/v3.12.5...v3.12.6) (2026-08-04)


### Bug Fixes

* **deps:** consume sogni-client 5.4.0 ([735c875](https://github.com/Sogni-AI/sogni-intelligence-client/commit/735c875f34ae33f001308dd563eb30dbeafdd32c))

## [3.11.0](https://github.com/Sogni-AI/sogni-intelligence-client/compare/v3.10.1...v3.11.0) (2026-07-30)

### Features

* **media:** add typed, language-agnostic image-edit routing helpers that default
  identity-sensitive referenced-person and character edits to Krea 2 Identity Edit
* **tools:** align edit-image contracts around concise Krea delta prompts, ordered
  references, explicit model overrides, and worker-owned execution defaults

### Bug Fixes

* **deps:** align Sogni Client 5.3.1 and Protocol alpha.10 without a nested stale
  Protocol copy

## [3.10.1](https://github.com/Sogni-AI/sogni-intelligence-client/compare/v3.10.0...v3.10.1) (2026-07-30)

### Bug Fixes

* **deps:** consume Protocol alpha.10 for current Krea image schemas and prompt contracts

# [3.7.0](https://github.com/Sogni-AI/sogni-intelligence-client/compare/v3.6.0...v3.7.0) (2026-07-05)


### Features

* **account:** expose subscription status, account info, and billingMode types ([b8b608f](https://github.com/Sogni-AI/sogni-intelligence-client/commit/b8b608f5e3177398e35399b667499eb230e214d9))

# [3.6.0](https://github.com/Sogni-AI/sogni-intelligence-client/compare/v3.5.1...v3.6.0) (2026-07-02)


### Features

* **chat-run:** type the managed-agent storyboard runtimeConfig fields ([ce68708](https://github.com/Sogni-AI/sogni-intelligence-client/commit/ce68708))

# [2.2.0](https://github.com/Sogni-AI/sogni-intelligence-client/compare/v2.1.0...v2.2.0) (2026-05-18)


### Features

* **contracts:** strengthen generate_image BATCH FAN-OUT rule ([9066104](https://github.com/Sogni-AI/sogni-intelligence-client/commit/9066104a70e7758d2f8168d0ac0e8009d417ebbb))

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
