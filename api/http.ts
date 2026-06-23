type WebHandler = (req: Request) => Promise<Response>;

interface NodeLikeRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  [Symbol.asyncIterator]?: () => AsyncIterableIterator<Buffer | string>;
}

interface NodeLikeResponse {
  statusCode: number;
  setHeader(name: string, value: string | string[]): void;
  end(body?: string): void;
}

function isWebRequest(req: Request | NodeLikeRequest): req is Request {
  return typeof Request !== 'undefined' && req instanceof Request;
}

async function readNodeBody(req: NodeLikeRequest): Promise<string | null> {
  if (req.method === 'GET' || req.method === 'HEAD') return null;

  if (req.body !== undefined) {
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString();
    return JSON.stringify(req.body);
  }

  if (!req[Symbol.asyncIterator]) return null;

  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length ? Buffer.concat(chunks).toString() : null;
}

async function nodeToWebRequest(req: NodeLikeRequest): Promise<Request> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else {
      headers.set(key, value);
    }
  }

  const protocol = headers.get('x-forwarded-proto') ?? 'https';
  const host = headers.get('host') ?? 'localhost';
  const url = new URL(req.url ?? '/', `${protocol}://${host}`).toString();
  const method = req.method ?? 'GET';
  const body = await readNodeBody(req);

  return new Request(url, { method, headers, body });
}

async function sendNodeResponse(webRes: Response, nodeRes: NodeLikeResponse): Promise<void> {
  nodeRes.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    nodeRes.setHeader(key, key.toLowerCase() === 'set-cookie' ? [value] : value);
  });
  nodeRes.end(await webRes.text());
}

export function adaptHandler(webHandler: WebHandler) {
  return async function handler(req: Request | NodeLikeRequest, res?: NodeLikeResponse): Promise<Response | void> {
    if (isWebRequest(req) && !res) {
      return webHandler(req);
    }

    const webReq = isWebRequest(req) ? req : await nodeToWebRequest(req);
    const webRes = await webHandler(webReq);

    if (!res) return webRes;
    await sendNodeResponse(webRes, res);
  };
}
