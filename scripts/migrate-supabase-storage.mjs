import { createClient } from '@supabase/supabase-js'

const required = [
  'SOURCE_SUPABASE_URL',
  'SOURCE_SERVICE_ROLE_KEY',
  'TARGET_SUPABASE_URL',
  'TARGET_SERVICE_ROLE_KEY',
]

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

const source = createClient(
  process.env.SOURCE_SUPABASE_URL,
  process.env.SOURCE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
const target = createClient(
  process.env.TARGET_SUPABASE_URL,
  process.env.TARGET_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const PAGE_SIZE = 1000
const CONCURRENCY = 4

async function listFolder(bucket, path = '') {
  const all = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await source.storage.from(bucket).list(path, {
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

  const { data: existing } = await target.storage.getBucket(bucket.id)
  if (!existing) {
    const { error } = await target.storage.createBucket(bucket.id, options)
    if (error) throw new Error(`Create bucket ${bucket.id}: ${error.message}`)
  } else {
    const { error } = await target.storage.updateBucket(bucket.id, options)
    if (error) throw new Error(`Update bucket ${bucket.id}: ${error.message}`)
  }
}

async function copyFile(bucket, file) {
  const { data, error: downloadError } = await source.storage
    .from(bucket)
    .download(file.path)
  if (downloadError) {
    throw new Error(`Download ${bucket}/${file.path}: ${downloadError.message}`)
  }

  const { error: uploadError } = await target.storage
    .from(bucket)
    .upload(file.path, data, {
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
        console.error(error instanceof Error ? error.message : String(error))
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runner()))
  if (errors.length) {
    throw new Error(`${errors.length} Storage objects failed to migrate`)
  }
}

const { data: buckets, error: bucketsError } = await source.storage.listBuckets()
if (bucketsError) throw new Error(`List buckets: ${bucketsError.message}`)

let copied = 0
for (const bucket of buckets ?? []) {
  console.log(`Preparing bucket: ${bucket.id}`)
  await ensureBucket(bucket)
  const files = await listAllFiles(bucket.id)
  console.log(`Copying ${files.length} objects from ${bucket.id}`)

  await runPool(
    files,
    async (file) => {
      await copyFile(bucket.id, file)
      copied += 1
      if (copied % 25 === 0) console.log(`Copied ${copied} objects`)
    },
    CONCURRENCY,
  )
}

console.log(`Storage migration completed. Objects copied: ${copied}`)
