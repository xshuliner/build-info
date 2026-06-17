import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const reactEntry = resolve('dist/react.js')
const directive = "'use client';"
const content = await readFile(reactEntry, 'utf8')

if (!content.startsWith(directive) && !content.startsWith('"use client";')) {
  await writeFile(reactEntry, `${directive}\n${content}`, 'utf8')
}
