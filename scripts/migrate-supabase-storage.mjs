import fs from 'node:fs'
import { StorageClient } from '@supabase/storage-js'

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
  `# Migración de Storage\nFecha UTC: ${new Date().toISOString()}\n`,
)

function diagnostic(message, level = 'info') {
  const safeMessage = String(message)
  fs.appendFileSync(diagnosticPath, `${level.toUpperCase()}: ${safeMessage}\n`)
  if (level === 'error') console.error(safeMessage)
  else console.log(safeMessage)
}

function keyKind(value) {
  if (value.startsWith('sb_secret_')) return 'sb_secret'
  if (value.split('.').length === 3) return 'legacy_jwt'
  return 'unknown'
}

let source
let target

try {
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }

  diagnostic(`Source URL host: ${new URL(process.env.SOURCE_SUPABASE_URL).host}`)
  diagnostic(`Target URL host: ${new URL(process.env.TARGET_SUPABASE_URL).host}`)
  diagnostic(
    `Source key type: ${keyKind(process.env.SOURCE_SERVICE_ROLE_KEY)}; length: ${process.env.SOURCE_SERVICE_ROLE_KEY.length}`,
  )
  diagnostic(
    `Target key type: ${keyKind(process.env.TARGET_SERVICE_ROLE_KEY)}; length: ${process.env.TARGET_SERVICE_ROLE_KEY.length}`,
  )

  source = new StorageClient(`${process.env.SOURCE_SUPABASE_URL}/storage/v1`, {
    apikey: process.env.SOURCE_SERVICE_ROLE_KEY,
  })
  target = new StorageClient(`${process.env.TARGET_SUPABASE_URL}/storage/v1`, {
    apikey: process.env.TARGET_SERVICE_ROLE_KEY,
  })
  diagnostic('Storage clients initialized with apikey headers')
} catch (error) {
  diagnostic(error instanceof Error ? error.stack ?? error.message : String(error), 'error')
  process.exit(1)
}

const PAGE_SIZE = 1000
const CONCURRENCY = 4

async function listFolder(bucket, path = '') {
  const all = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await source.from(bucket).list(path, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
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

async function ensureBucket(bucket) {
  const options = {
    public: Boolean(bucket.public),
    fileSizeLimit: bucket.file_size_limit ?? undefined,
    allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
  }

  const { data: existing, error: getError } = await target.getBucket(bucket.id)
  if (getError && !String(getError.message).toLowerCase().includes('not found')) {
    throw new Error(`Get bucket ${bucket.id}: ${getError.message}`)
  }

  if (!existing) {
    const { error } = await target.createBucket(bucket.id, options)
    if (error) throw new Error(`Create bucket ${bucket.id}: ${error.message}`)
  } else {
    const { error } = await target.updateBucket(bucket.id, options)
    if (error) throw new Error(`Update bucket ${bucket.id}: ${error.message}`)
  }
}

async function copyFile(bucket, file) {
  const { data, error: downloadError } = await source.from(bucket).download(file.path)
  if (downloadError) {
    throw new Error(`Download ${bucket}/${file.path}: ${downloadError.message}`)
  }

  const { error: uploadError } = await target.from(bucket).upload(file.path, data, {
    upsert: true,
    contentType: file.metadata?.mimetype ?? data.type ?? undefined,
    cacheControl: file.metadata?.cacheControl ?? '3600',
  })
  if (uploadError) {
    throw new Error(`Upload ${bucket}/${file.path}: ${uploadError.message}`)
  }
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
        diagnostic(error instanceof Error ? error.message : String(error), 'error')
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runner()))
  if (errors.length) {
    throw new Error(`${errors.length} Storage objects failed to migrate`)
  }
}

try {
  const { data: buckets, error: bucketsError } = await source.listBuckets()
  if (bucketsError) throw new Error(`List buckets: ${bucketsError.message}`)

  diagnostic(`Buckets found: ${(buckets ?? []).length}`)

  let copied = 0
  for (const bucket of buckets ?? []) {
    diagnostic(`Preparing bucket: ${bucket.id}`)
    await ensureBucket(bucket)
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
  diagnostic(error instanceof Error ? error.stack ?? error.message : String(error), 'error')
  process.exit(1)
}
