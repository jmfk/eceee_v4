import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const parseArgs = (argv) => {
  const args = {
    baseUrl: process.env.HOWTO_PROD_BASE_URL || process.env.HOWTO_BASE_URL || 'https://app.eceee.org',
    storageState: process.env.HOWTO_AUTH_STATE || '.auth/eceee-prod-storage-state.json',
    username: process.env.HOWTO_USERNAME || '',
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--base-url') args.baseUrl = next
    if (arg === '--storage-state') args.storageState = next
    if (arg === '--username') args.username = next
    if (arg === '--help' || arg === '-h') args.help = true

    if (arg.startsWith('--') && next && !next.startsWith('--')) {
      index += 1
    }
  }

  return args
}

const printUsage = () => {
  console.log(`Save Playwright auth state for how-to video generation.

Usage:
  npm run howto:auth -- --base-url https://app.eceee.org --storage-state ../.auth/eceee-prod-storage-state.json

Options:
  --base-url <url>       Admin site URL. Defaults to https://app.eceee.org.
  --storage-state <path> Output Playwright storage state file.
  --username <name>      Optional username. Password is always prompted.
`)
}

const promptVisible = async (question) => {
  const rl = createInterface({ input, output })

  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

const promptHidden = (question) => new Promise((resolvePrompt, rejectPrompt) => {
  let value = ''
  const stdin = process.stdin
  const stdout = process.stdout
  const wasRaw = stdin.isRaw

  const cleanup = () => {
    stdin.off('data', onData)
    if (stdin.isTTY) stdin.setRawMode(Boolean(wasRaw))
    stdout.write('\n')
  }

  const onData = (chunk) => {
    const text = chunk.toString('utf8')

    for (const char of text) {
      if (char === '\u0003') {
        cleanup()
        rejectPrompt(new Error('Cancelled.'))
        return
      }

      if (char === '\r' || char === '\n' || char === '\u0004') {
        cleanup()
        resolvePrompt(value)
        return
      }

      if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1)
        continue
      }

      value += char
    }
  }

  stdout.write(question)
  stdin.resume()
  stdin.setEncoding('utf8')
  if (stdin.isTTY) stdin.setRawMode(true)
  stdin.on('data', onData)
})

const requestJson = async (url, options) => {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const detail = data.detail || data.error || response.statusText
    throw new Error(`${response.status} ${detail}`)
  }

  return data
}

const saveAuthState = async (args, tokens) => {
  const origin = new URL(args.baseUrl).origin
  const storageStatePath = resolve(args.storageState)

  await mkdir(dirname(storageStatePath), { recursive: true })
  await writeFile(storageStatePath, JSON.stringify({
    cookies: [],
    origins: [{
      origin,
      localStorage: [
        { name: 'access_token', value: tokens.access },
        { name: 'refresh_token', value: tokens.refresh }
      ]
    }]
  }, null, 2), 'utf8')

  return storageStatePath
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printUsage()
    return
  }

  const username = args.username || await promptVisible(`Username for ${args.baseUrl}: `)
  const password = await promptHidden('Password: ')

  if (!username || !password) {
    throw new Error('Username and password are required.')
  }

  const tokenUrl = new URL('/api/v1/auth/token/', args.baseUrl)
  const tokens = await requestJson(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })

  await requestJson(new URL('/api/v1/utils/current-user/', args.baseUrl), {
    headers: { Authorization: `Bearer ${tokens.access}` }
  })

  const storageStatePath = await saveAuthState(args, tokens)
  console.log(`Saved auth state for ${username} to ${storageStatePath}`)
}

main().catch(error => {
  console.error(error.message || error)
  process.exitCode = 1
})
