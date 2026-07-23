import { createClient } from '@supabase/supabase-js'

const required = [
  'SOURCE_SUPABASE_URL',
  'SOURCE_SERVICE_ROLE_KEY',
  'TARGET_SUPABASE_URL',
  'TARGET_SERVICE_ROLE_KEY',
]
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`)
}

function assertLegacyServiceRole(name, value) {
  if (value.split('.').length !== 3) {
    throw new Error(`${name} must be the legacy service_role JWT from Legacy API Keys`)
  }
}

assertLegacyServiceRole('SOURCE_SERVICE_ROLE_KEY', process.env.SOURCE_SERVICE_ROLE_KEY)
assertLegacyServiceRole('TARGET_SERVICE_ROLE_KEY', process.env.TARGET_SERVICE_ROLE_KEY)

const source = createClient(process.env.SOURCE_SUPABASE_URL, process.env.SOURCE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const target = createClient(process.env.TARGET_SUPABASE_URL, process.env.TARGET_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function countUsers(client) {
  let page = 1
  let total = 0
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`List auth users: ${error.message}`)
    const users = data?.users ?? []
    total += users.length
    if (users.length < 1000) return total
    page += 1
  }
}

async function listAllFiles(client, bucket, path = '') {
  const entries = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from(bucket).list(path, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`List ${bucket}/${path}: ${error.message}`)
    entries.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  let total = 0
  for (const entry of entries) {
    const fullPath = path ? `${path}/${entry.name}` : entry.name
    if (entry.id && entry.metadata) total += 1
    else total += await listAllFiles(client, bucket, fullPath)
  }
  return total
}

async function storageSummary(client) {
  const { data: buckets, error } = await client.storage.listBuckets()
  if (error) throw new Error(`List buckets: ${error.message}`)
  const details = {}
  for (const bucket of buckets ?? []) {
    details[bucket.id] = await listAllFiles(client, bucket.id)
  }
  return details
}

const [sourceUsers, targetUsers, sourceStorage, targetStorage] = await Promise.all([
  countUsers(source),
  countUsers(target),
  storageSummary(source),
  storageSummary(target),
])

const summary = {
  authUsers: { source: sourceUsers, target: targetUsers },
  storage: { source: sourceStorage, target: targetStorage },
}
console.log(JSON.stringify(summary, null, 2))

let failed = sourceUsers !== targetUsers
const bucketNames = new Set([...Object.keys(sourceStorage), ...Object.keys(targetStorage)])
for (const bucket of bucketNames) {
  if ((sourceStorage[bucket] ?? 0) !== (targetStorage[bucket] ?? 0)) failed = true
}
if (failed) process.exit(1)
