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

export async function executeQuery<T = Record<string, unknown>>(queryText: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const connectionString = getConnectionString()
  const endpoint = getHttpEndpoint()

  let finalQuery = queryText
  for (let i = params.length - 1; i >= 0; i--) {
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
    finalQuery = finalQuery.replace(new RegExp('\\$' + (i + 1) + '\\b', 'g'), value.replace(/\$/g, '$$$$'))
  }

  const body = JSON.stringify({ query: finalQuery })

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': connectionString,
      },
      body,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, response: ${text.slice(0, 200)}`)
    }

    const parsed = await response.json() as QueryResult<T>
    if ((parsed as any).error) {
      throw new Error((parsed as any).message || 'Unknown database error')
    }
    return parsed
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`fetch failed: ${error.message}`)
    }
    throw new Error('Unknown fetch error')
  }
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