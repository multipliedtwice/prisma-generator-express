import { DMMF } from '@prisma/generator-helper'
import { capitalize, toPascalCase } from '../utils/strings'

type MiddlewareType = 'queryFull' | 'bodyArgs' | 'partialArgs' | 'emptyParsedQs'

export interface OperationConfig {
  operation: string
  prismaMethod: string
  source: 'query' | 'body'
  successStatus: number
  resultVar: 'data' | 'result'
  exportInterface: boolean
  hasPassToNext: boolean
  importsModel: boolean
  argsPartial: boolean
  useCapitalizeForArgs: boolean
  tsIgnoreCall: boolean
  noCastInCall: boolean
  wrapCount: boolean
  useResLocalsValidator: boolean
  importValidatorConfig: boolean
  localsDataType: 'nullable' | 'array' | null
  validatorLocalsType: string
  zodTypeGeneric: string | null
  middlewareType: MiddlewareType
}

export const OPERATION_CONFIGS: OperationConfig[] = [
  {
    operation: 'FindUnique',
    prismaMethod: 'findUnique',
    source: 'query',
    successStatus: 200,
    resultVar: 'data',
    exportInterface: true,
    hasPassToNext: true,
    importsModel: true,
    argsPartial: false,
    useCapitalizeForArgs: false,
    tsIgnoreCall: false,
    noCastInCall: false,
    wrapCount: false,
    useResLocalsValidator: false,
    importValidatorConfig: false,
    localsDataType: 'nullable',
    validatorLocalsType: 'ZodType',
    zodTypeGeneric: null,
    middlewareType: 'queryFull',
  },
  {
    operation: 'FindFirst',
    prismaMethod: 'findFirst',
    source: 'query',
    successStatus: 200,
    resultVar: 'data',
    exportInterface: true,
    hasPassToNext: true,
    importsModel: true,
    argsPartial: false,
    useCapitalizeForArgs: false,
    tsIgnoreCall: false,
    noCastInCall: false,
    wrapCount: false,
    useResLocalsValidator: false,
    importValidatorConfig: false,
    localsDataType: 'nullable',
    validatorLocalsType: 'ZodType',
    zodTypeGeneric: null,
    middlewareType: 'queryFull',
  },
  {
    operation: 'FindMany',
    prismaMethod: 'findMany',
    source: 'query',
    successStatus: 200,
    resultVar: 'data',
    exportInterface: true,
    hasPassToNext: true,
    importsModel: true,
    argsPartial: false,
    useCapitalizeForArgs: false,
    tsIgnoreCall: false,
    noCastInCall: false,
    wrapCount: false,
    useResLocalsValidator: false,
    importValidatorConfig: false,
    localsDataType: 'array',
    validatorLocalsType: 'ZodType',
    zodTypeGeneric: null,
    middlewareType: 'queryFull',
  },
  {
    operation: 'Create',
    prismaMethod: 'create',
    source: 'body',
    successStatus: 201,
    resultVar: 'data',
    exportInterface: false,
    hasPassToNext: false,
    importsModel: false,
    argsPartial: false,
    useCapitalizeForArgs: false,
    tsIgnoreCall: false,
    noCastInCall: false,
    wrapCount: false,
    useResLocalsValidator: false,
    importValidatorConfig: false,
    localsDataType: null,
    validatorLocalsType: 'ZodType',
    zodTypeGeneric: null,
    middlewareType: 'bodyArgs',
  },
  {
    operation: 'CreateMany',
    prismaMethod: 'createMany',
    source: 'body',
    successStatus: 201,
    resultVar: 'data',
    exportInterface: false,
    hasPassToNext: false,
    importsModel: false,
    argsPartial: false,
    useCapitalizeForArgs: false,
    tsIgnoreCall: false,
    noCastInCall: false,
    wrapCount: false,
    useResLocalsValidator: false,
    importValidatorConfig: false,
    localsDataType: null,
    validatorLocalsType: 'ZodType',
    zodTypeGeneric: null,
    middlewareType: 'bodyArgs',
  },
  {
    operation: 'Update',
    prismaMethod: 'update',
    source: 'body',
    successStatus: 200,
    resultVar: 'data',
    exportInterface: false,
    hasPassToNext: false,
    importsModel: false,
    argsPartial: false,
    useCapitalizeForArgs: false,
    tsIgnoreCall: false,
    noCastInCall: false,
    wrapCount: false,
    useResLocalsValidator: false,
    importValidatorConfig: false,
    localsDataType: null,
    validatorLocalsType: 'ZodType',
    zodTypeGeneric: null,
    middlewareType: 'bodyArgs',
  },
  {
    operation: 'UpdateMany',
    prismaMethod: 'updateMany',
    source: 'body',
    successStatus: 200,
    resultVar: 'data',
    exportInterface: false,
    hasPassToNext: false,
    importsModel: false,
    argsPartial: false,
    useCapitalizeForArgs: false,
    tsIgnoreCall: false,
    noCastInCall: false,
    wrapCount: true,
    useResLocalsValidator: false,
    importValidatorConfig: false,
    localsDataType: null,
    validatorLocalsType: 'ZodType',
    zodTypeGeneric: 'UpdateManyResult',
    middlewareType: 'bodyArgs',
  },
  {
    operation: 'Upsert',
    prismaMethod: 'upsert',
    source: 'body',
    successStatus: 200,
    resultVar: 'data',
    exportInterface: false,
    hasPassToNext: false,
    importsModel: false,
    argsPartial: false,
    useCapitalizeForArgs: false,
    tsIgnoreCall: false,
    noCastInCall: false,
    wrapCount: false,
    useResLocalsValidator: false,
    importValidatorConfig: false,
    localsDataType: null,
    validatorLocalsType: 'ZodType',
    zodTypeGeneric: null,
    middlewareType: 'bodyArgs',
  },
  {
    operation: 'Delete',
    prismaMethod: 'delete',
    source: 'body',
    successStatus: 200,
    resultVar: 'data',
    exportInterface: false,
    hasPassToNext: false,
    importsModel: false,
    argsPartial: false,
    useCapitalizeForArgs: false,
    tsIgnoreCall: false,
    noCastInCall: false,
    wrapCount: false,
    useResLocalsValidator: false,
    importValidatorConfig: false,
    localsDataType: null,
    validatorLocalsType: 'ZodType',
    zodTypeGeneric: null,
    middlewareType: 'bodyArgs',
  },
  {
    operation: 'DeleteMany',
    prismaMethod: 'deleteMany',
    source: 'body',
    successStatus: 200,
    resultVar: 'result',
    exportInterface: false,
    hasPassToNext: false,
    importsModel: false,
    argsPartial: false,
    useCapitalizeForArgs: false,
    tsIgnoreCall: false,
    noCastInCall: false,
    wrapCount: false,
    useResLocalsValidator: false,
    importValidatorConfig: false,
    localsDataType: null,
    validatorLocalsType: 'ZodType',
    zodTypeGeneric: null,
    middlewareType: 'bodyArgs',
  },
  {
    operation: 'Aggregate',
    prismaMethod: 'aggregate',
    source: 'query',
    successStatus: 200,
    resultVar: 'result',
    exportInterface: false,
    hasPassToNext: false,
    importsModel: false,
    argsPartial: true,
    useCapitalizeForArgs: true,
    tsIgnoreCall: false,
    noCastInCall: false,
    wrapCount: false,
    useResLocalsValidator: true,
    importValidatorConfig: true,
    localsDataType: null,
    validatorLocalsType: 'ValidatorConfig',
    zodTypeGeneric: null,
    middlewareType: 'partialArgs',
  },
  {
    operation: 'Count',
    prismaMethod: 'count',
    source: 'query',
    successStatus: 200,
    resultVar: 'result',
    exportInterface: false,
    hasPassToNext: false,
    importsModel: false,
    argsPartial: true,
    useCapitalizeForArgs: false,
    tsIgnoreCall: false,
    noCastInCall: false,
    wrapCount: false,
    useResLocalsValidator: false,
    importValidatorConfig: false,
    localsDataType: null,
    validatorLocalsType: 'ZodType',
    zodTypeGeneric: null,
    middlewareType: 'emptyParsedQs',
  },
  {
    operation: 'GroupBy',
    prismaMethod: 'groupBy',
    source: 'query',
    successStatus: 200,
    resultVar: 'result',
    exportInterface: false,
    hasPassToNext: false,
    importsModel: false,
    argsPartial: true,
    useCapitalizeForArgs: false,
    tsIgnoreCall: true,
    noCastInCall: true,
    wrapCount: false,
    useResLocalsValidator: false,
    importValidatorConfig: false,
    localsDataType: null,
    validatorLocalsType: 'ZodType',
    zodTypeGeneric: null,
    middlewareType: 'emptyParsedQs',
  },
]

export function generateOperationFunction(
  cfg: OperationConfig,
  model: DMMF.Model,
  prismaImportStatement: string,
): string {
  const modelName = model.name
  const functionName = `${modelName}${cfg.operation}`
  const interfaceName = `${cfg.operation}Request`
  const middlewareTypeName = `${cfg.operation}Middleware`

  const argsTypeName = cfg.useCapitalizeForArgs
    ? `Prisma.${capitalize(modelName)}${cfg.operation}Args`
    : `Prisma.${modelName}${cfg.operation}Args`

  const zodType = cfg.zodTypeGeneric ? `ZodType<${cfg.zodTypeGeneric}>` : 'ZodType'

  const prismaImport = cfg.importsModel
    ? prismaImportStatement.replace('{ Prisma }', `{ Prisma, ${modelName} }`)
    : prismaImportStatement

  const importLines = [
    prismaImport,
    `import { Request, Response, NextFunction } from 'express';`,
    `import { RequestHandler, ParamsDictionary } from 'express-serve-static-core';`,
  ]

  if (cfg.source === 'query') {
    importLines.push(`import { ParsedQs } from 'qs';`)
  }

  importLines.push(`import { ZodType } from 'zod';`)

  if (cfg.importValidatorConfig) {
    importLines.push(`import { ValidatorConfig } from '../routeConfig';`)
  }

  const extraTypes = cfg.wrapCount ? `\ntype UpdateManyResult = { count: number };\n` : ''

  const queryType = cfg.argsPartial
    ? `Partial<${argsTypeName}> & ParsedQs`
    : `${argsTypeName} & ParsedQs`

  let interfaceBody: string
  if (cfg.source === 'query') {
    const localsEntries: string[] = []
    if (cfg.localsDataType === 'nullable') {
      localsEntries.push(`    data?: ${modelName} | null`)
    } else if (cfg.localsDataType === 'array') {
      localsEntries.push(`    data?: ${modelName}[]`)
    }
    localsEntries.push(`    outputValidator?: ${cfg.validatorLocalsType};`)

    interfaceBody = [
      `  prisma: PrismaClient;`,
      `  query: ${queryType};`,
      `  outputValidation?: ${zodType};`,
      ...(cfg.hasPassToNext ? [`  passToNext?: boolean;`] : []),
      `  locals?: {`,
      ...localsEntries,
      `  }`,
    ].join('\n')
  } else {
    interfaceBody = [
      `  prisma: PrismaClient;`,
      `  body: ${argsTypeName};`,
      `  outputValidation?: ${zodType};`,
      `  locals?: {`,
      `    outputValidator?: ${zodType};`,
      `  };`,
    ].join('\n')
  }

  const exportKw = cfg.exportInterface ? 'export ' : ''
  const interfaceDecl = `${exportKw}interface ${interfaceName} extends Request {\n${interfaceBody}\n}`

  let middlewareTypeDecl: string
  switch (cfg.middlewareType) {
    case 'queryFull':
      middlewareTypeDecl = `export type ${middlewareTypeName} = RequestHandler<ParamsDictionary, any, any, ${argsTypeName} & ParsedQs, Record<string, any>>`
      break
    case 'bodyArgs':
      middlewareTypeDecl = `export type ${middlewareTypeName} = RequestHandler<ParamsDictionary, any, ${argsTypeName}, Record<string, any>>`
      break
    case 'partialArgs':
      middlewareTypeDecl = `export type ${middlewareTypeName} = RequestHandler<ParamsDictionary, any, Partial<${argsTypeName}>, Record<string, any>>`
      break
    case 'emptyParsedQs':
      middlewareTypeDecl = `export type ${middlewareTypeName} = RequestHandler<ParamsDictionary, any, {}, ParsedQs>`
      break
  }

  const validatorLine = cfg.useResLocalsValidator
    ? `const outputValidator = res.locals.outputValidator?.schema || req.outputValidation;`
    : `const outputValidator = req.locals?.outputValidator || req.outputValidation;`

  const v = cfg.resultVar
  const callArg = cfg.source === 'body'
    ? 'req.body'
    : cfg.noCastInCall
      ? 'req.query'
      : `req.query as ${argsTypeName}`

  const prismaCall = [
    cfg.tsIgnoreCall ? '    // @ts-ignore' : '',
    `    const ${v} = await req.prisma.${toPascalCase(modelName)}.${cfg.prismaMethod}(${callArg});`,
  ].filter(Boolean).join('\n')

  const successJson = cfg.wrapCount
    ? `{ count: validationResult.data.count }`
    : `validationResult.data`

  const elseJson = cfg.wrapCount
    ? `{ count: ${v}.count }`
    : v

  let bodyLines: string[]

  if (cfg.hasPassToNext) {
    bodyLines = [
      `    ${validatorLine}`,
      ``,
      prismaCall,
      `    if (req.passToNext) {`,
      `      if (req.locals) req.locals.data = ${v};`,
      `      next();`,
      `    } else if (outputValidator) {`,
      `      const validationResult = outputValidator.safeParse(${v});`,
      `      if (validationResult.success) {`,
      `        return res.status(${cfg.successStatus}).json(${successJson});`,
      `      } else {`,
      `        return res.status(400).json({ error: 'Invalid data format', details: validationResult.error });`,
      `      }`,
      `    } else {`,
      `      return res.status(${cfg.successStatus}).json(${elseJson});`,
      `    }`,
    ]
  } else {
    bodyLines = [
      `    ${validatorLine}`,
      ``,
      prismaCall,
      ``,
      `    if (outputValidator) {`,
      `      const validationResult = outputValidator.safeParse(${v});`,
      `      if (validationResult.success) {`,
      `        return res.status(${cfg.successStatus}).json(${successJson});`,
      `      } else {`,
      `        return res.status(400).json({ error: 'Invalid data format', details: validationResult.error });`,
      `      }`,
      `    } else {`,
      `      return res.status(${cfg.successStatus}).json(${elseJson});`,
      `    }`,
    ]
  }

  return `
${importLines.join('\n')}
${extraTypes}
${interfaceDecl}

${middlewareTypeDecl}

export async function ${functionName}(req: ${interfaceName}, res: Response, next: NextFunction) {
  try {
${bodyLines.join('\n')}
  } catch(error: unknown) {
    next(error)
  }
}`
}