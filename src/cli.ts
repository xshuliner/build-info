#!/usr/bin/env node
import { DEFAULT_GLOBAL_NAME, DEFAULT_OUT_DIR } from './constants'
import { generateBuildInfo } from './node'
import type { GenerateBuildInfoOptions } from './types'

const HELP = `Usage:
  xshuliner-build-info generate [options]
  xbi generate [options]

Options:
  --out <dir>                  Output directory. Default: ${DEFAULT_OUT_DIR}
  --global-name <name>         Global variable name. Default: ${DEFAULT_GLOBAL_NAME}
  --app-name <name>            Application name.
  --app-version <version>      Application version.
  --env <env>                  Application environment.
  --mode <mode>                Application mode.
  --deploy-target <target>     Deployment target.
  --deploy-region <region>     Deployment region.
  --deploy-url <url>           Deployment URL.
  --release-id <id>            Release ID.
  --build-id <id>              Build ID.
  -h, --help                   Show help.
  -v, --version                Show package version.
`

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(HELP)
    return
  }

  if (args.includes('--version') || args.includes('-v')) {
    process.stdout.write('0.1.0\n')
    return
  }

  const command = args[0] && !args[0].startsWith('-') ? args.shift() : 'generate'
  if (command !== 'generate') {
    throw new Error(`Unknown command: ${command}`)
  }

  const options = parseOptions(args)
  const result = await generateBuildInfo(options)

  process.stdout.write(`Generated build info:
- ${result.jsonPath}
- ${result.jsPath}
`)
}

function parseOptions(args: string[]): GenerateBuildInfoOptions {
  const options: GenerateBuildInfoOptions = {}
  const optionMap: Record<string, keyof GenerateBuildInfoOptions> = {
    '--out': 'outDir',
    '--global-name': 'globalName',
    '--app-name': 'appName',
    '--app-version': 'appVersion',
    '--env': 'env',
    '--mode': 'mode',
    '--deploy-target': 'deployTarget',
    '--deploy-region': 'deployRegion',
    '--deploy-url': 'deployUrl',
    '--release-id': 'releaseId',
    '--build-id': 'buildId'
  }

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (!flag) {
      continue
    }

    const key = optionMap[flag]
    if (!key) {
      throw new Error(`Unknown option: ${flag}`)
    }

    const value = args[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${flag}`)
    }

    options[key] = value
    index += 1
  }

  return options
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`xshuliner-build-info: ${message}\n`)
  process.exitCode = 1
})
