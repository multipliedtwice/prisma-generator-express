## [1.58.3](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.58.2...v1.58.3) (2026-07-01)


### Bug Fixes

* **generator:** improve logging for dropGuard and refactor guardShapesImport handling ([1ba3561](https://github.com/multipliedtwice/prisma-generator-express/commit/1ba3561e633ce92ea624c9bdf464751d9b2e02b4))

## [1.58.2](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.58.1...v1.58.2) (2026-07-01)


### Bug Fixes

* **generator:** simplify dropGuard handling and improve logging for dropped guard ([6a78704](https://github.com/multipliedtwice/prisma-generator-express/commit/6a78704cb01c569009813e21c98b9899783b7d85))

## [1.58.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.58.0...v1.58.1) (2026-07-01)


### Bug Fixes

* **generator:** remove unused findManyPaginatedMode and improve dropGuard error handling ([6217bb6](https://github.com/multipliedtwice/prisma-generator-express/commit/6217bb6c61c5fa19d238f65bf9dba5aca30f8c6c))

# [1.58.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.57.0...v1.58.0) (2026-07-01)


### Features

* **generator:** enhance router generation with updateEach functionality and improve OpenAPI handling ([532b361](https://github.com/multipliedtwice/prisma-generator-express/commit/532b361a86f624c55f70b321532d104b86c521a9))

# [1.57.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.56.4...v1.57.0) (2026-06-30)


### Features

* add global guard drop for E2E SQLite and enhance router configurations ([41b9603](https://github.com/multipliedtwice/prisma-generator-express/commit/41b9603ae256166240bc161c4b73bf558a1d6cda))

## [1.56.4](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.56.3...v1.56.4) (2026-06-23)


### Bug Fixes

* refactor updateEach to use transaction support for atomic updates ([6e82dd0](https://github.com/multipliedtwice/prisma-generator-express/commit/6e82dd0f37c3e90380b845a31bda104135566d7a))

## [1.56.3](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.56.2...v1.56.3) (2026-06-20)


### Bug Fixes

* remove unused dependencies and update package.json ([dba623b](https://github.com/multipliedtwice/prisma-generator-express/commit/dba623b56f6162cf880cbc1fd64bee7eb55d9711))

## [1.56.2](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.56.1...v1.56.2) (2026-06-16)


### Bug Fixes

* enhance applyPaginationLimits to consider guardShape in pagination queries ([2ef1434](https://github.com/multipliedtwice/prisma-generator-express/commit/2ef1434fd5c608022cdff783e0d6fb3ba5cfd152))

## [1.56.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.56.0...v1.56.1) (2026-06-16)


### Bug Fixes

* remove unused pagination import from generateRouteConfigType function ([fc7589b](https://github.com/multipliedtwice/prisma-generator-express/commit/fc7589bf8c30ddacc834c7c7b271dc9eba41421f))

# [1.56.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.55.0...v1.56.0) (2026-06-16)


### Features

* introduce findManyPaginatedMode for enhanced pagination control ([3bf8c8c](https://github.com/multipliedtwice/prisma-generator-express/commit/3bf8c8cdf087b6f634e0fb12267f44670102104f))

# [1.55.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.54.0...v1.55.0) (2026-06-16)


### Features

* introduce write strategy for batch operations in docs and router generation ([2653ce1](https://github.com/multipliedtwice/prisma-generator-express/commit/2653ce15a2bfedbd065bd444a419e75fe005e23c))

# [1.54.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.53.0...v1.54.0) (2026-06-15)


### Features

* enhance auto-include functionality with locator-based nested relation batches ([b6ff8e0](https://github.com/multipliedtwice/prisma-generator-express/commit/b6ff8e091fb3b8db97dd26b320636eaddc2db6b8))

# [1.53.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.52.0...v1.53.0) (2026-06-15)


### Features

* enhance auto-include functionality for findMany and findManyPaginated operations ([3f1596e](https://github.com/multipliedtwice/prisma-generator-express/commit/3f1596e778410890dc2259cb6254180bc98c2e8b))

# [1.52.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.51.0...v1.52.0) (2026-06-15)


### Features

* enhance auto-include support for findMany and improve SSE handling in documentation ([25172ce](https://github.com/multipliedtwice/prisma-generator-express/commit/25172ce52460a1ece24a9f56ab51aa20cfa24e53))

# [1.51.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.50.0...v1.51.0) (2026-06-14)


### Features

* enhance orderBy handling in materialized views router with parsing and allowlist enforcement ([4e256d6](https://github.com/multipliedtwice/prisma-generator-express/commit/4e256d6d1e259eb017f78f88396d47f678803ace))

# [1.50.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.49.1...v1.50.0) (2026-06-14)


### Features

* add standalone materialized views router for read-only access in Express ([6049579](https://github.com/multipliedtwice/prisma-generator-express/commit/6049579f013cb4c506a1afca4e32f0c4bfdd2c0e))

## [1.49.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.49.0...v1.49.1) (2026-06-14)


### Bug Fixes

* add materializedRouter.ts to EXPRESS_ONLY_FILES ([213f6ff](https://github.com/multipliedtwice/prisma-generator-express/commit/213f6ffc037b9021e5cb945df655b57a9b96abff))

# [1.49.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.48.1...v1.49.0) (2026-06-14)


### Features

* implement materialized views router with CRUD operations ([2b3edd4](https://github.com/multipliedtwice/prisma-generator-express/commit/2b3edd48fd7b68616b7f83b8d6116aee3ad0a1ab))

## [1.48.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.48.0...v1.48.1) (2026-06-13)


### Bug Fixes

* update path for updateEach operation to /each ([27fad85](https://github.com/multipliedtwice/prisma-generator-express/commit/27fad85133beab389dbdfc4f9647038cb29db0dd))

# [1.48.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.47.0...v1.48.0) (2026-06-11)


### Features

* update router to handle updateEach operation with correct path and method ([03f2ee3](https://github.com/multipliedtwice/prisma-generator-express/commit/03f2ee30ca04a6005a5b245e51ea7b4e0ee745fb))

# [1.47.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.46.0...v1.47.0) (2026-06-11)


### Features

* add updateEach operation and router handling for batch updates ([93bd713](https://github.com/multipliedtwice/prisma-generator-express/commit/93bd7136e7cf7a4117e21d86fd1befe44be7d613))

# [1.46.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.45.1...v1.46.0) (2026-06-08)


### Features

* Refactor unified documentation generation and handlers ([e9f36ac](https://github.com/multipliedtwice/prisma-generator-express/commit/e9f36acd8589d0e17f820bf7f623c693ca451126))

## [1.45.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.45.0...v1.45.1) (2026-06-07)


### Bug Fixes

* update OpenAPI spec generation to correctly pass config parameter ([1ae0287](https://github.com/multipliedtwice/prisma-generator-express/commit/1ae0287f652347a7567d2dc767a91d08047925f2))

# [1.45.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.44.0...v1.45.0) (2026-06-07)


### Features

* extend RouteConfig to include QueryBuilderConfig for enhanced query handling ([a358d8c](https://github.com/multipliedtwice/prisma-generator-express/commit/a358d8c6dfeea1f8d15d684d42aa3fe74adf467a))

# [1.44.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.43.0...v1.44.0) (2026-06-07)


### Features

* enhance auto-include functionality with improved error handling and support for multiple import styles ([32a41d7](https://github.com/multipliedtwice/prisma-generator-express/commit/32a41d7126534965cbdb0d3700c7ab7c167ceb8d))

# [1.43.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.42.0...v1.43.0) (2026-06-07)


### Features

* automatic progressive include decomposition ([c45a94d](https://github.com/multipliedtwice/prisma-generator-express/commit/c45a94d9eb61e2b66a5be7b3dd53acacb5e67bb5))

# [1.42.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.41.0...v1.42.0) (2026-06-07)


### Features

* improve type handling and enhance router functionality with extended request and operation configurations ([2d9edca](https://github.com/multipliedtwice/prisma-generator-express/commit/2d9edcab61de8b7a650795281de3367923e4a2e9))

# [1.41.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.40.0...v1.41.0) (2026-06-07)


### Features

* enhance import handling and extend functionality for Fastify and Hono routers ([062b4d2](https://github.com/multipliedtwice/prisma-generator-express/commit/062b4d209b0289b124dca0caadf940b90fe063f5))

# [1.40.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.39.0...v1.40.0) (2026-05-27)


### Features

* hono targer ([5a03e13](https://github.com/multipliedtwice/prisma-generator-express/commit/5a03e134ba25087b0462684906f7195f641d9c0b))

# [1.39.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.38.0...v1.39.0) (2026-05-18)


### Features

* add support for POST read endpoints to handle complex queries and large request bodies ([2446362](https://github.com/multipliedtwice/prisma-generator-express/commit/2446362df63179a9ac633335ec40e7ccba3921a7))

# [1.38.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.37.1...v1.38.0) (2026-05-18)


### Features

* enhance route configuration types to support generic shape parameters and add guard shapes import functionality ([d38da45](https://github.com/multipliedtwice/prisma-generator-express/commit/d38da452a2ecb08270761470fd5c64e485364c33))

## [1.37.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.37.0...v1.37.1) (2026-05-11)


### Bug Fixes

* update description to reflect support for Express/Fastify CRUD API ([e46020a](https://github.com/multipliedtwice/prisma-generator-express/commit/e46020a16fa55a9c5f1b95e97f98707a19ce7f81))

# [1.37.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.36.0...v1.37.0) (2026-05-11)

# [1.36.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.35.0...v1.36.0) (2026-05-07)


### Features

* add POST support for read operations with complex query parameters ([a415272](https://github.com/multipliedtwice/prisma-generator-express/commit/a4152723379d344d9f2f7fe1b338d28de9746d60))

# [1.35.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.34.4...v1.35.0) (2026-04-22)

## [1.34.4](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.34.3...v1.34.4) (2026-04-20)


### Bug Fixes

* **generator:** enhance error mapping in mapError function to provide more detailed messages for various Prisma errors ([38e81a3](https://github.com/multipliedtwice/prisma-generator-express/commit/38e81a31ba984ca7d310d1ed0daddaafb57f2667))

## [1.34.3](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.34.2...v1.34.3) (2026-04-19)


### Bug Fixes

* remove .js from imports ([1e801a8](https://github.com/multipliedtwice/prisma-generator-express/commit/1e801a8228c9e07f0df5ec08ee179f3d1b81f8f6))

## [1.34.2](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.34.1...v1.34.2) (2026-04-19)


### Bug Fixes

* router generator signature ([014c765](https://github.com/multipliedtwice/prisma-generator-express/commit/014c76580ab255aca3d1e34a656a463e1f198c87))

## [1.34.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.34.0...v1.34.1) (2026-04-19)


### Bug Fixes

* typescript errors ([885d86d](https://github.com/multipliedtwice/prisma-generator-express/commit/885d86d4a2715b8b3ad22d9cf2c6407486e82585))

# [1.34.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.33.0...v1.34.0) (2026-04-19)

# [1.33.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.32.0...v1.33.0) (2026-04-19)


### Features

* **generator:** add resolveOutputPath function to determine output path dynamically based on generator options ([6cb68a7](https://github.com/multipliedtwice/prisma-generator-express/commit/6cb68a7020b49432b31bb13c08f3970c4ebc942e))

# [1.32.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.31.0...v1.32.0) (2026-04-19)


### Features

* **generator:** add routeConfig for express and fastify to support multiple frameworks ([9f77487](https://github.com/multipliedtwice/prisma-generator-express/commit/9f7748708827f055648d5d30e6bc08abb1621319))

# [1.31.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.30.0...v1.31.0) (2026-04-19)


### Bug Fixes

* copyfiles ([10953e1](https://github.com/multipliedtwice/prisma-generator-express/commit/10953e112b924295f1b899b8c24a442bf510532c))

# [1.30.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.29.0...v1.30.0) (2026-04-19)

# [1.29.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.28.0...v1.29.0) (2026-04-19)


### Features

* fastify support ([bd69530](https://github.com/multipliedtwice/prisma-generator-express/commit/bd69530294c00507c30d0bd6852376dcb1e7e490))

# [1.28.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.27.0...v1.28.0) (2026-04-18)

# [1.27.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.26.1...v1.27.0) (2026-04-17)

## [1.26.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.26.0...v1.26.1) (2026-04-01)


### Bug Fixes

* **generator:** change type assertion from Error to any for error handling to avoid type errors and improve flexibility in error processing ([4157773](https://github.com/multipliedtwice/prisma-generator-express/commit/4157773769b13a2324ea11c07736eaad77d47797))

# [1.26.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.25.1...v1.26.0) (2026-04-01)

## [1.25.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.25.0...v1.25.1) (2026-04-01)


### Bug Fixes

* typescript build ([6cb14b4](https://github.com/multipliedtwice/prisma-generator-express/commit/6cb14b4eaaa72e157bf76591e243ccc860afeb51))

# [1.25.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.24.0...v1.25.0) (2026-04-01)


### Features

* fix build ([d1878b4](https://github.com/multipliedtwice/prisma-generator-express/commit/d1878b4d99df6b305d09e038c2d48cd494c744ea))

# [1.24.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.23.0...v1.24.0) (2026-04-01)


### Features

* **generator:** enhance OpenAPI model generation by adding relation foreign key fields to required scalars ([4a63b73](https://github.com/multipliedtwice/prisma-generator-express/commit/4a63b735dba0ae739446c8fa5a936491b5aad9bc))

# [1.23.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.22.0...v1.23.0) (2026-03-31)

# [1.22.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.21.1...v1.22.0) (2026-03-31)

## [1.21.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.21.0...v1.21.1) (2026-03-31)


### Bug Fixes

* **encodeQueryParams.ts:** update import statement to include .js extension for compatibility ([1f96f4f](https://github.com/multipliedtwice/prisma-generator-express/commit/1f96f4f0902de43a346f7c689e47381309514d8c))

# [1.21.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.20.0...v1.21.0) (2026-03-31)

# [1.20.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.19.0...v1.20.0) (2026-03-31)

# [1.19.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.18.0...v1.19.0) (2026-03-31)


### Features

* documentation generator ([91323f8](https://github.com/multipliedtwice/prisma-generator-express/commit/91323f83405afe3f763fe56e361a7f194a396a6c))

# [1.18.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.17.0...v1.18.0) (2026-03-24)


### Features

* **routeConfig:** add createManyAndReturn and updateManyAndReturn to RouteConfig interface to support new operations ([5fc9c28](https://github.com/multipliedtwice/prisma-generator-express/commit/5fc9c286f6fe2fd94a1656a6fb057ca673ce29d8))

# [1.17.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.16.7...v1.17.0) (2026-03-23)


### Features

* **generator:** remove unused generateUpdate, generateUpdateMany, and generateUpsert functions to clean up the codebase and improve maintainability ([143c0d3](https://github.com/multipliedtwice/prisma-generator-express/commit/143c0d3ed2c93bc762fc8826532136bc1250550b))

## [1.16.7](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.16.6...v1.16.7) (2025-11-03)


### Bug Fixes

* Bump dependencies ([dd8f811](https://github.com/multipliedtwice/prisma-generator-express/commit/dd8f811c33bfee6a2386a00472a8443a7c2c13d9))
* **CI.yml:** update actions/cache from v2 to v4 to leverage improvements and new features ([b07ad0f](https://github.com/multipliedtwice/prisma-generator-express/commit/b07ad0fa7a4c0611d5a101cef469ccf680f5b328))
* **CI.yml:** update actions/cache from v2 to v4 to leverage improvements and new features ([d5ce1ed](https://github.com/multipliedtwice/prisma-generator-express/commit/d5ce1ed922b7b5e590eea8307f0a32f11e53934d))
* lockfile ([3462473](https://github.com/multipliedtwice/prisma-generator-express/commit/3462473bed32ccb3c8de2b4b2e66fd1a3faad866))
* update yarn.lock ([fd43fe0](https://github.com/multipliedtwice/prisma-generator-express/commit/fd43fe0c6a3bf27f55cfef4bdbc2c684ba374501))

## [1.16.6](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.16.5...v1.16.6) (2024-09-22)


### Bug Fixes

* packages/generator/package.json to reduce vulnerabilities ([1733241](https://github.com/multipliedtwice/prisma-generator-express/commit/173324112e74cbcf855d7f3a83007d332e038466))

## [1.16.5](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.16.4...v1.16.5) (2024-08-23)


### Bug Fixes

* remove trailing slash ([45215b9](https://github.com/multipliedtwice/prisma-generator-express/commit/45215b964670d62ddbf4e5c31d25752fb8875d6f))

## [1.16.4](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.16.3...v1.16.4) (2024-08-23)


### Bug Fixes

* remove trailing slash ([f4f1096](https://github.com/multipliedtwice/prisma-generator-express/commit/f4f109616c1487f048deb36467981d6b832ddcda))

## [1.16.3](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.16.2...v1.16.3) (2024-08-23)


### Bug Fixes

* remove trailing slash if  customUrlPrefixi is provided and addModelPrefix is false ([2c230ac](https://github.com/multipliedtwice/prisma-generator-express/commit/2c230ac97a66fd82d20a08d23d9dc33ac74409b7))

## [1.16.2](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.16.1...v1.16.2) (2024-08-23)


### Bug Fixes

* validator typo that caused ts error ([2b50407](https://github.com/multipliedtwice/prisma-generator-express/commit/2b504070592bae3973794228260bc535f3475839))

## [1.16.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.16.0...v1.16.1) (2024-06-17)


### Bug Fixes

* **generateRouteFile.ts:** fix syntax error in object destructuring assignment by adding missing commas between properties ([3861d7f](https://github.com/multipliedtwice/prisma-generator-express/commit/3861d7fc54ba20a3fea6d7d360d454898b52ac66))

# [1.16.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.15.1...v1.16.0) (2024-06-17)


### Features

* remove console log statement from copyFile function to improve code cleanliness and remove unnecessary output ([a4590a2](https://github.com/multipliedtwice/prisma-generator-express/commit/a4590a216ad908b6a34c5d2633afff37e5c15828))

## [1.15.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.15.0...v1.15.1) (2024-06-17)


### Bug Fixes

* **README.md:** remove outdated comment about omitOutputValidation property ([47a1aa0](https://github.com/multipliedtwice/prisma-generator-express/commit/47a1aa0d950f6d6d20deb8c745b31cf42ce8e641))

# [1.15.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.14.3...v1.15.0) (2024-06-08)


### Features

* skip generation ([5a62142](https://github.com/multipliedtwice/prisma-generator-express/commit/5a62142700958cc6ba1bd0e0afc725e0a7765580))

## [1.14.3](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.14.2...v1.14.3) (2024-05-30)


### Bug Fixes

* createOutputValidatorMiddleware types ([015f1ed](https://github.com/multipliedtwice/prisma-generator-express/commit/015f1edf4c391bdcefac36f757c64e6938d3ef87))

## [1.14.2](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.14.1...v1.14.2) (2024-05-30)


### Bug Fixes

* **package.json:** update devDependencies versions for @types/node, prisma-generator-express, ts-jest in demo and generator packages ([f2052c7](https://github.com/multipliedtwice/prisma-generator-express/commit/f2052c7ea6f7eba83df909849f370fed16f4185e))

## [1.14.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.14.0...v1.14.1) (2024-05-28)


### Bug Fixes

* parseQueryParams path ([7451c6c](https://github.com/multipliedtwice/prisma-generator-express/commit/7451c6c70eab105c42a2efc24dadb31d0c5c94c6))

# [1.14.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.13.0...v1.14.0) (2024-05-28)


### Features

* route generator validations ([d2eaffe](https://github.com/multipliedtwice/prisma-generator-express/commit/d2eaffece7e588793693a74fdc8356508f323f4e))

# [1.13.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.12.0...v1.13.0) (2024-05-27)


### Features

* **INVOICE_RECORDS:** add support for output validation schema and omission flag in various CRUD operations to enhance data validation and error handling ([5ad1c28](https://github.com/multipliedtwice/prisma-generator-express/commit/5ad1c2844d23e7de9bf2bffa59b1e821688146f5))

# [1.12.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.11.4...v1.12.0) (2024-05-26)


### Features

* **package.json:** add new dependencies lodash, @types/jest, @types/lodash, jest, ts-jest ([febcde4](https://github.com/multipliedtwice/prisma-generator-express/commit/febcde42f8c000e70c7a0457d3a87ac1221ce3f5))

## [1.11.4](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.11.3...v1.11.4) (2024-05-25)


### Bug Fixes

* parseQueryParams for AND, OR, NOT ([ffa57ab](https://github.com/multipliedtwice/prisma-generator-express/commit/ffa57ab779221d117f7d63cc969944fa531cee3a))

## [1.11.3](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.11.2...v1.11.3) (2024-05-25)


### Bug Fixes

* parse quetry params helper generator ([be524b0](https://github.com/multipliedtwice/prisma-generator-express/commit/be524b0b764e09dd1875607501749045b8703e6d))

## [1.11.2](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.11.1...v1.11.2) (2024-05-25)


### Bug Fixes

* parseQueryParams ([1c2cbf5](https://github.com/multipliedtwice/prisma-generator-express/commit/1c2cbf54fbed4f2195b556561cee4de8c23e108c))

## [1.11.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.11.0...v1.11.1) (2024-05-25)


### Bug Fixes

* parseQueryParams ([4cd023b](https://github.com/multipliedtwice/prisma-generator-express/commit/4cd023b819b409b1c64d60b45fb5dcf021a70dde))

# [1.11.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.10.2...v1.11.0) (2024-05-25)


### Features

* parseQueryParams for router generator ([cfff0b7](https://github.com/multipliedtwice/prisma-generator-express/commit/cfff0b7a166ddbb949e253dd9c1bbd38b7177c25))

## [1.10.2](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.10.1...v1.10.2) (2024-05-25)


### Bug Fixes

* customUrlPrefix ([701286d](https://github.com/multipliedtwice/prisma-generator-express/commit/701286d77f571ba03719548d27cff961eaa95ccc))

## [1.10.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.10.0...v1.10.1) (2024-05-25)


### Bug Fixes

* customUrlPrefix ([1ba0804](https://github.com/multipliedtwice/prisma-generator-express/commit/1ba0804011e80aa243b0a180dde986b829273043))

# [1.10.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.9.1...v1.10.0) (2024-05-25)


### Features

* **README.md:** add customUrlPrefix option to someRouterConfig to allow setting a custom URL prefix for the router ([13da6ea](https://github.com/multipliedtwice/prisma-generator-express/commit/13da6ea4bb92c2b40559b9ae34858997682cd60e))

## [1.9.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.9.0...v1.9.1) (2024-05-25)


### Bug Fixes

* customUrlPrefix ([e6465c8](https://github.com/multipliedtwice/prisma-generator-express/commit/e6465c8f0853bae166dfc40e642530e09dcb876c))

# [1.9.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.8.1...v1.9.0) (2024-05-25)


### Bug Fixes

* add customUrlPrefix type ([df25af4](https://github.com/multipliedtwice/prisma-generator-express/commit/df25af4da567857b476839457962c66c1705f797))


### Features

* **express:** add support for custom URL prefix in generated router functions for various models. This allows flexibility in defining routes with custom prefixes. ([1f01f4a](https://github.com/multipliedtwice/prisma-generator-express/commit/1f01f4a3e6c27b80438120c6add685e2c5ac1661))

## [1.8.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.8.0...v1.8.1) (2024-05-24)


### Bug Fixes

* build ([568074c](https://github.com/multipliedtwice/prisma-generator-express/commit/568074c589233ddf2aa67f34ad3d115e91e9798f))

# [1.8.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.7.2...v1.8.0) (2024-05-24)


### Features

* **README.md:** add Prisma client middleware to attach Prisma client instance to request object for subsequent middleware and route handlers ([e2466b9](https://github.com/multipliedtwice/prisma-generator-express/commit/e2466b99fe3652948277e3d1d1133d416a11fa85))

## [1.7.2](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.7.1...v1.7.2) (2024-05-24)


### Bug Fixes

* error unknown type warning ([8a46a85](https://github.com/multipliedtwice/prisma-generator-express/commit/8a46a85101db27b05647be0551ef6b27759065a5))

## [1.7.1](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.7.0...v1.7.1) (2024-05-24)


### Bug Fixes

* The left-hand side of an assignment expression may not be an optional property access. ([3c5a5f5](https://github.com/multipliedtwice/prisma-generator-express/commit/3c5a5f58d18d9b889f14b572527250c2e20230fa))

# [1.7.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.6.0...v1.7.0) (2024-05-24)


### Features

* add possibly undefined locals.data check ([261f5b0](https://github.com/multipliedtwice/prisma-generator-express/commit/261f5b02ca6696c2f39017e73ac7a28d180bd10f))

# [1.6.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.5.0...v1.6.0) (2024-05-24)


### Features

* improve request typings ([f0f2c53](https://github.com/multipliedtwice/prisma-generator-express/commit/f0f2c539d1ee17ed94baba2bf8061135c89fe7d5))

# [1.5.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.4.0...v1.5.0) (2024-05-22)


### Features

* **docs:** update readme ([803fee2](https://github.com/multipliedtwice/prisma-generator-express/commit/803fee2f7a94abbff2e964346424abbdbf411812))

# [1.4.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.3.0...v1.4.0) (2024-05-22)


### Features

* **generator:** fix async loop logic ([5c5221f](https://github.com/multipliedtwice/prisma-generator-express/commit/5c5221f68d0e63edb2ced39181fa8e8e416c34e0))

# [1.3.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.2.0...v1.3.0) (2024-05-19)


### Features

* **generateAggregate.ts, generateCount.ts, generateCreate.ts, generateCreateMany.ts, generateDelete.ts, generateDeleteMany.ts, generateFindFirst.ts, generateFindMany.ts, generateFindUnique.ts:** add support for dynamic model name capitalization in generated functions to improve code readability and maintain consistency ([1824f58](https://github.com/multipliedtwice/prisma-generator-express/commit/1824f5816cdd3e5b74ef7ed8098314ba04395662))

# [1.2.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.1.0...v1.2.0) (2024-05-15)


### Features

* add MIT License file and README.md ([420a80d](https://github.com/multipliedtwice/prisma-generator-express/commit/420a80dff01ccd61594e387abe7083a9fa75af68))

# [1.1.0](https://github.com/multipliedtwice/prisma-generator-express/compare/v1.0.0...v1.1.0) (2024-05-15)


### Features

* **generator:** add MIT License and README file for Prisma Generator Express ([6c99565](https://github.com/multipliedtwice/prisma-generator-express/commit/6c995652c53946e0f3f303f0495fcfe4e7b96e48))
* **generator:** update package.json description to provide a more specific description of the Prisma generator for Express CRUD API ([7b99050](https://github.com/multipliedtwice/prisma-generator-express/commit/7b99050d2089490082b6c6b7f5174f8572172779))

# 1.0.0 (2024-05-15)


### Bug Fixes

* **generator:** update minimum required Node.js version to 20.0 in engines field ([1b4e7b2](https://github.com/multipliedtwice/prisma-generator-express/commit/1b4e7b2a8e29cc8a9710cc6393ada81b01631de3))
