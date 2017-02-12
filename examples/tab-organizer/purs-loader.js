"use strict"

/*
 * Webpack 2 loader that can take CommonJS output by psc 0.9.1 and convert
 * it into tree shakable ES6 modules. No transpiling required.
 */
const fs = require('fs')

const commonJsRequire = /var ([_$a-zA-Z0-9]+) = require\([\'\"]([^\'\"]+)[\'\"]\)/g
const moduleExports = /module\.exports = \{(\n(    ([\"\'_$a-zA-Z0-9]+): ([_$a-zA-Z0-9\.]+)(, )?\n)*)?\};/m
const actualExports = /(    ((?:[\'\"][^\'\"]+[\'\"])|(?:[_$a-zA-Z0-9]+)): ([_$a-zA-Z0-9\.]+)(, )?\n)/g


module.exports = function (content) {
  this.cacheable()

  const funcs = [
    upconvertImports,
    upconvertExports,
    upconvertFfiExports
  ]

  content = content.replace(/([_$a-zA-Z][_$a-zA-Z0-9]*)\["([_$a-zA-Z][_$a-zA-Z0-9]*)"\]/g, "$1.$2");

  const out = funcs.reduce((prev, curr) => curr(prev), content)

  return out
}

function findMatches(regex, content, action) {
  let current;
  let updated = content.slice()

  while ((current = regex.exec(content)) !== null) {
    updated = action(updated, current)
  }
  return updated
}

function upconvertImports (content) {
  function action (content, currentImport) {
    return content.replace(currentImport[0], `import * as ${currentImport[1]} from "${currentImport[2]}"`)
  }
  return findMatches(commonJsRequire, content, action)
}

function upconvertExports (content) {
  function action (noop, currentExport) {
    const externalName = currentExport[2]
    const internalName = currentExport[3]

    if (externalName[0] === "'" || externalName[0] === "\"") {
      content += `export { ${internalName} as ${externalName.slice(1, -1)} };`

    } else if (externalName === internalName) {
      content += `export { ${externalName} };`

    } else {
      content += `export var ${externalName} = ${internalName};`
    }
  }

  const moduleExporting = moduleExports.exec(content)

  if (moduleExporting) {
    content = content.replace(moduleExports, '')
    findMatches(actualExports, moduleExporting[0], action)
  }

  return content
}

function upconvertFfiExports (content) {
  return content.replace(/^exports\.([$_a-zA-Z0-9]+) *= *([$_a-zA-Z][$_a-z-A-Z0-9]*);/gm, 'export { $2 as $1 };').replace(/^exports\./gm, 'export var ')
}
