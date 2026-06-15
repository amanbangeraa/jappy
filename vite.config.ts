import { defineConfig, loadEnv, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { type IncomingMessage, type ServerResponse } from 'http'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Parse a .env file and return key-value pairs.
 * Handles basic quoting and inline comments.
 */
function parseDotEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    const content = readFileSync(path, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      let key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      // Remove surrounding quotes
      if ((value.startsWith("'") && value.endsWith("'")) ||
          (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1)
      }
      // Remove inline comment if not quoted
      const hashIdx = value.indexOf('#')
      if (hashIdx > 0) {
        value = value.slice(0, hashIdx).trim()
      }
      env[key] = value
    }
  } catch {
    // .env file not found — that's OK
  }
  return env
}

/**
 * Load .env into process.env so @neondatabase/serverless can read DATABASE_URL
 * when loaded via Vite SSR (which doesn't auto-load .env into process.env).
 */
function loadEnvIntoProcess(mode: string, root: string) {
  // Vite's loadEnv loads from .env, .env.local, .env.[mode], .env.[mode].local
  const viteEnv = loadEnv(mode, root, '')
  for (const [key, value] of Object.entries(viteEnv)) {
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
  // Also try direct .env parse as fallback for keys Vite might exclude
  const directEnv = parseDotEnv(join(root, '.env'))
  for (const [key, value] of Object.entries(directEnv)) {
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

/**
 * Vite plugin that intercepts /api/* requests during dev mode and executes
 * the corresponding Vercel Function handler from the api/ directory.
 *
 * This mirrors the Vercel Functions runtime locally so that `vite dev` can
 * serve the full stack (React frontend + Neon DB API) without needing
 * `vercel dev` or a separate process.
 */
function apiDevPlugin() {
  // Map URL paths to handler module paths (relative to project root)
  const routeMap: Record<string, string> = {
    '/api/lessons': 'api/lessons.ts',
    '/api/cards': 'api/cards.ts',
    '/api/review': 'api/review.ts',
  }

  /**
   * Convert a Node.js IncomingMessage to a Web-standard Request object.
   */
  async function nodeToWebRequest(req: IncomingMessage): Promise<Request> {
    const url = `http://localhost${req.url ?? '/'}`
    const method = req.method ?? 'GET'
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v))
        } else {
          headers.append(key, value)
        }
      }
    }

    let body: string | null = null
    if (method !== 'GET' && method !== 'HEAD') {
      body = await new Promise<string>((resolve) => {
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => resolve(Buffer.concat(chunks).toString()))
      })
    }

    return new Request(url, { method, headers, body })
  }

  /**
   * Write a Web-standard Response to a Node.js ServerResponse.
   */
  async function webResponseToNode(webRes: Response, nodeRes: ServerResponse): Promise<void> {
    nodeRes.statusCode = webRes.status
    webRes.headers.forEach((value, key) => {
      nodeRes.setHeader(key, value)
    })

    const body = await webRes.text()
    nodeRes.end(body)
  }

  return {
    name: 'api-dev-plugin',
    configureServer(server: ViteDevServer) {
      // Load .env into process.env at startup (before any SSR loads)
      loadEnvIntoProcess(server.config.mode, server.config.root)

      // Intercept all requests before Vite's internal handlers
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '/'

        // Find matching route prefix
        const matchedPrefix = Object.keys(routeMap).find((prefix) =>
          url.startsWith(prefix)
        )

        if (!matchedPrefix) {
          return next()
        }

        try {
          const modulePath = join(process.cwd(), routeMap[matchedPrefix])
          const module = await server.ssrLoadModule(modulePath)

          if (!module.default || typeof module.default !== 'function') {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Handler does not export a default function' }))
            return
          }

          const webReq = await nodeToWebRequest(req)
          const webRes = await module.default(webReq)
          await webResponseToNode(webRes, res)
        } catch (err) {
          console.error(`[api-dev-plugin] Error handling ${url}:`, err)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          const message = err instanceof Error ? err.message : String(err)
          res.end(JSON.stringify({ error: 'Internal server error', detail: message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiDevPlugin()],
})
