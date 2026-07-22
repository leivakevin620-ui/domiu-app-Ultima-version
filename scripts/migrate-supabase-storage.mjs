import dns from 'node:dns'
import fs from 'node:fs'
import { StorageClient } from '@supabase/storage-js'

dns.setDefaultResultOrder('ipv4first')

const required = [
  'SOURCE_SUPABASE_URL',
  'SOURCE_SERVICE_ROLE_KEY',
  'TARGET_SUPABASE_URL',
  'TARGET_SERVICE_ROLE_KEY',
]

fs.mkdirSync('migration-work', { recursive: true })
const diagnosticPath = 'migration-work/service-verification.txt'
fs.writeFileSync(
  diagnosticPath,
  `# Migración de Storage\nFecha UTC: ${new Date().toISOString()}\nModo: legacy service_role JWT\nRed: IPv4 preferido\n`,
)

function diagnostic(message, level = 'info') {
  const safeMessage = String(message)
  fs.appendFileSync(diagnosticPath, `${level.toUpperCase()}: ${safeMessage}\n`)
  if (level === 'error') console.error(safeMessage)
  else console.log(safeMessage)
}

function formatError(error) {
  if (!(error instanceof Error)) return String(error)
  const cause = error.cause instanceof Error ? ` | cause=${error.cause.message}` : ''
  return `${error.stack ?? error.message}${cause}`
}

function assertLegacyServiceRole(name, value) {
  if (value.split('.').length !== 3) {
    throw new Error(
      `${name} must be the legacy service_role JWT from Legacy API Keys; opaque sb_secret keys are not accepted by this Storage migration`,
    )
  }
}

function createStorageClient(projectUrl, serviceRoleKey) {
  return new StorageClient(`${projectUrl}/storage/v1`, {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  })
}

async function withRetry(label, operation, attempts = 4) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === attempts) break
      const delay = 500 * 2 ** (attempt - 1)
      diagnostic(`${label}: intento ${attempt} falló; reintentando en ${delay} ms`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

let source

try {
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }

  assertLegacyServiceRole('SOURCE_SERVICE_ROLE_KEY', process.env.SOURCE_SERVICE_ROLE_KEY)
  assertLegacyServiceRole('TARGET_SERVICE_ROLE_KEY', process.env.TARGET_SERVICE_ROLE_KEY)

  diagnostic(`Source URL host: ${new URL(process.env.SOURCE_SUPABASE_URL).host}`)
  diagnostic(`Target URL host: ${new URL(process.env.TARGET_SUPABASE_URL).host}`)
  diagnostic('Source key type: legacy service_role JWT')
  diagnostic('Target key type: legacy service_role JWT')

  source = createStorageClient(
    process.env.SOURCE_SUPABASE_URL,
    process.env.SOURCE_SERVICE_ROLE_KEY,
  )
  diagnostic('Source Storage client initialized; target uploads will use raw HTTP')
} catch (error) {
  diagnostic(formatError(error), 'error')
  process.exit(1)
}

const PAGE_SIZE = 1000
const CONCURRENCY = 4

async function listFolder(bucket, path = '') {
  const all = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await withRetry(`List ${bucket}/${path}`, () =>
      source.from(bucket).list(path, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    )
    if (error) throw new Error(`List failed ${bucket}/${path}: ${error.message}`)
    all.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return all
}

async function listAllFiles(bucket, path = '') {
  const entries = await listFolder(bucket, path)
  const files = []

  for (const entry of entries) {
    const fullPath = path ? `${path}/${entry.name}` : entry.name
    if (entry.id && entry.metadata) {
      files.push({ path: fullPath, metadata: entry.metadata })
    } else {
      files.push(...(await listAllFiles(bucket, fullPath)))
    }
  }
  return files
}

function encodeStoragePath(value) {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

async function uploadRaw(bucket, path, body, contentType, cacheControl) {
  const targetHost = new URL(process.env.TARGET_SUPABASE_URL).hostname
  const projectRef = targetHost.split('.')[0]
  const endpoint = `${process.env.TARGET_SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: process.env.TARGET_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.TARGET_SERVICE_ROLE_KEY}`,
      'x-forwarded-host': `${projectRef}.supabase.co`,
      'Content-Type': contentType || 'application/octet-stream',
      'Cache-Control': `max-age=${cacheControl || '3600'}`,
      'x-upsert': 'true',
    },
    body,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `HTTP ${response.status} ${response.statusText}${text ? `: ${text.slice(0, 500)}` : ''}`,
    )
  }
}

async function copyFile(bucket, file) {
  const { data, error: downloadError } = await withRetry(
    `Download ${bucket}/${file.path}`,
    () => source.from(bucket).download(file.path),
  )
  if (downloadError) {
    throw new Error(`Download ${bucket}/${file.path}: ${downloadError.message}`)
  }

  const bytes = Buffer.from(await data.arrayBuffer())
  const contentType = file.metadata?.mimetype ?? data.type ?? 'application/octet-stream'
  const cacheControl = file.metadata?.cacheControl ?? '3600'

  await withRetry(`Upload ${bucket}/${file.path}`, () =>
    uploadRaw(bucket, file.path, bytes, contentType, cacheControl),
  )
}

async function runPool(items, worker, concurrency) {
  let cursor = 0
  const errors = []

  async function runner() {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      try {
        await worker(items[index], index)
      } catch (error) {
        errors.push(error)
        diagnostic(formatError(error), 'error')
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runner()))
  if (errors.length) {
    throw new Error(`${errors.length} Storage objects failed to migrate`)
  }
}

try {
  const { data: buckets, error: bucketsError } = await withRetry('List buckets', () =>
    source.listBuckets(),
  )
  if (bucketsError) throw new Error(`List buckets: ${bucketsError.message}`)

  diagnostic(`Buckets found: ${(buckets ?? []).length}`)
  diagnostic('Bucket metadata already restored through the database migration; skipping bucket recreation')

  let copied = 0
  for (const bucket of buckets ?? []) {
    diagnostic(`Preparing bucket: ${bucket.id}`)
    const files = await listAllFiles(bucket.id)
    diagnostic(`Objects discovered in ${bucket.id}: ${files.length}`)

    await runPool(
      files,
      async (file) => {
        await copyFile(bucket.id, file)
        copied += 1
        if (copied % 25 === 0) diagnostic(`Objects copied: ${copied}`)
      },
      CONCURRENCY,
    )
  }

  diagnostic(`Storage migration completed. Objects copied: ${copied}`)
} catch (error) {
  diagnostic(formatError(error), 'error')
  process.exit(1)
}
