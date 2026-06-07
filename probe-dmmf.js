const { getDMMF } = require('@prisma/internals')
const fs = require('fs')
const path = require('path')

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: node probe-dmmf.js <path-to-schema.prisma>')
    process.exit(1)
  }
  const datamodel = fs.readFileSync(path.resolve(arg), 'utf-8')
  const dmmf = await getDMMF({ datamodel })

  for (const model of dmmf.datamodel.models) {
    console.log('=== Model:', model.name, '===')
    for (const field of model.fields) {
      if (field.kind !== 'object') continue
      console.log('  Relation:', field.name)
      console.log('    type:               ', field.type)
      console.log('    isList:             ', field.isList)
      console.log('    isRequired:         ', field.isRequired)
      console.log('    relationName:       ', field.relationName)
      console.log('    relationFromFields: ', JSON.stringify(field.relationFromFields))
      console.log('    relationToFields:   ', JSON.stringify(field.relationToFields))
    }
    console.log()
  }
}

main().catch((err) => { console.error(err); process.exit(1) })