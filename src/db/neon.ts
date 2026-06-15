import { exec } from 'child_process'

// ── Connection setup ────────────────────────────────────────────────────────

function getConnectionString(): string {
  const cs = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!cs) {
    throw new Error('Neither DATABASE_URL_UNPOOLED nor DATABASE_URL environment variable is set')
  }
  return cs
}

function getHttpEndpoint(): string {
  const cs = getConnectionString()
  const url = new URL(cs)
  return `https://${url.hostname}/sql`
}

// ── HTTP SQL client via curl ────────────────────────────────────────────────

interface QueryResult<T = Record<string, unknown>> {
  fields: { name: string; dataTypeID: number }[]
  rows: T[]
  command: string
  rowCount: number
}

function escapeShell(s: string): string {
  return s.replace(/'/g, `'\\''`)
}

export function executeQuery<T = Record<string, unknown>>(queryText: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const connectionString = getConnectionString()
  const endpoint = getHttpEndpoint()

  // Replace $1, $2, ... style placeholders with the actual values
  let finalQuery = queryText
  for (let i = 0; i < params.length; i++) {
    const param = params[i]
    let value: string
    if (param === null || param === undefined) {
      value = 'NULL'
    } else if (typeof param === 'number') {
      value = String(param)
    } else if (typeof param === 'boolean') {
      value = param ? 'TRUE' : 'FALSE'
    } else if (Array.isArray(param)) {
      if (param.length === 0) {
        value = 'ARRAY[]::integer[]'
      } else {
        value = `ARRAY[${param.map((v) => (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)).join(', ')}]`
      }
    } else {
      value = `'${String(param).replace(/'/g, "''")}'`
    }
    finalQuery = finalQuery.replaceAll(`$${i + 1}`, value)
  }

  const body = JSON.stringify({ query: finalQuery })
  const escapedEndpoint = escapeShell(endpoint)
  const escapedCS = escapeShell(connectionString)
  const escapedBody = escapeShell(body)

  const curlCmd = `curl -s -X POST '${escapedEndpoint}' \
    -H 'Content-Type: application/json' \
    -H 'Neon-Connection-String: ${escapedCS}' \
    -d '${escapedBody}' \
    --connect-timeout 10 --max-time 15`

  return new Promise((resolve, reject) => {
    exec(curlCmd, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`curl failed: ${error.message}. stderr: ${stderr.slice(0, 200)}`))
        return
      }
      if (stderr && !stdout) {
        reject(new Error(`curl error: ${stderr.slice(0, 200)}`))
        return
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as QueryResult<T>
        if ((parsed as unknown as { error?: string }).error) {
          reject(new Error((parsed as unknown as { message: string }).message || 'Unknown database error'))
        } else {
          resolve(parsed)
        }
      } catch {
        reject(new Error(`Failed to parse response: ${stdout.slice(0, 200)}`))
      }
    })
  })
}

/**
 * Tagged template literal for SQL queries.
 * Usage: await sql`SELECT * FROM lessons WHERE id = ${id}`
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<QueryResult['rows']> {
  let queryText = ''
  for (let i = 0; i < strings.length; i++) {
    queryText += strings[i]
    if (i < values.length) {
      queryText += `$${i + 1}`
    }
  }
  return executeQuery(queryText, values).then((result) => result.rows)
}

// ── Migrations ──────────────────────────────────────────────────────────────

export async function runMigrations(): Promise<void> {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS lessons (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      level       TEXT NOT NULL DEFAULT 'N5',
      imported_at BIGINT NOT NULL DEFAULT 0
    )
  `)

  await executeQuery(`
    CREATE TABLE IF NOT EXISTS cards (
      id          SERIAL PRIMARY KEY,
      lesson_id   INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      japanese    TEXT NOT NULL,
      english     TEXT NOT NULL,
      reading     TEXT
    )
  `)

  await executeQuery(`
    CREATE TABLE IF NOT EXISTS review_records (
      id            SERIAL PRIMARY KEY,
      card_id       INTEGER NOT NULL UNIQUE REFERENCES cards(id) ON DELETE CASCADE,
      interval      REAL NOT NULL DEFAULT 0,
      ease_factor   REAL NOT NULL DEFAULT 2.5,
      repetitions   INTEGER NOT NULL DEFAULT 0,
      due_date      BIGINT NOT NULL DEFAULT 0
    )
  `)

  await executeQuery(`
    CREATE TABLE IF NOT EXISTS session_logs (
      id          SERIAL PRIMARY KEY,
      card_id     INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      grade       SMALLINT NOT NULL,
      reviewed_at BIGINT NOT NULL
    )
  `)

  await executeQuery('CREATE INDEX IF NOT EXISTS idx_cards_lesson_id ON cards(lesson_id)')
  await executeQuery('CREATE INDEX IF NOT EXISTS idx_review_records_due_date ON review_records(due_date)')
  await executeQuery('CREATE INDEX IF NOT EXISTS idx_session_logs_card_id ON session_logs(card_id)')
  await executeQuery('CREATE INDEX IF NOT EXISTS idx_session_logs_reviewed_at ON session_logs(reviewed_at)')

  // Add level column to existing tables that may not have it
  await executeQuery("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'N5'")
}