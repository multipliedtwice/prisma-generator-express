const fs = require('fs')
const path = require('path')

// Assuming the script is run from the packages/generator directory
const sourceReadme = path.resolve(__dirname, '../../README.md')
const sourceLicense = path.resolve(__dirname, '../../LICENSE')
const destinationPath = __dirname

// Copy files function
function copyFile(source, destinationPath) {
  const filename = path.basename(source)
  const destination = path.join(destinationPath, filename)
  fs.copyFileSync(source, destination)
  console.log(`Copied ${filename} to ${destination}`)
}

// Execute copy
copyFile(sourceReadme, destinationPath)
copyFile(sourceLicense, destinationPath)
