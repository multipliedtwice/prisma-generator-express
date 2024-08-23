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
