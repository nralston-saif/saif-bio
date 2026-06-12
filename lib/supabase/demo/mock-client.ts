/**
 * Minimal Supabase client mock backed by the in-memory demo store.
 * Implements exactly the query-builder surface this app uses:
 *   select / eq / in / gte / lte / gt / lt / not(col,'is',null) / order /
 *   limit / single / maybeSingle / insert / update / upsert / delete,
 * plus auth.getUser/signOut and storage upload/download/remove/createSignedUrl.
 */
import { getDemoStore, DEMO_AUTH_USER_ID } from './store'

type Row = Record<string, unknown>
type Result = { data: unknown; error: { message: string; code?: string } | null }

type Filter = (row: Row) => boolean

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a) < String(b) ? -1 : 1
}

class DemoQueryBuilder implements PromiseLike<Result> {
  private filters: Filter[] = []
  private orderings: { column: string; ascending: boolean }[] = []
  private limitCount: number | null = null
  private mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: Row | Row[] | null = null
  private onConflict: string | null = null
  private single_: 'single' | 'maybeSingle' | null = null

  constructor(private table: string) {}

  private get rows(): Row[] {
    const store = getDemoStore()
    if (!store.tables[this.table]) store.tables[this.table] = []
    return store.tables[this.table]
  }

  select(_columns?: string) {
    // Column projection is ignored: returning full rows is a superset of
    // any projection the app asks for
    return this
  }

  insert(payload: Row | Row[]) {
    this.mode = 'insert'
    this.payload = payload
    return this
  }

  update(payload: Row) {
    this.mode = 'update'
    this.payload = payload
    return this
  }

  upsert(payload: Row | Row[], options?: { onConflict?: string }) {
    this.mode = 'upsert'
    this.payload = payload
    this.onConflict = options?.onConflict ?? 'id'
    return this
  }

  delete() {
    this.mode = 'delete'
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value)
    return this
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values)
    this.filters.push((row) => set.has(row[column]))
    return this
  }

  gte(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== null && compare(row[column], value) >= 0)
    return this
  }

  lte(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== null && compare(row[column], value) <= 0)
    return this
  }

  gt(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== null && compare(row[column], value) > 0)
    return this
  }

  lt(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== null && compare(row[column], value) < 0)
    return this
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === 'is' && value === null) {
      this.filters.push((row) => row[column] !== null && row[column] !== undefined)
    }
    return this
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value)
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderings.push({ column, ascending: options?.ascending ?? true })
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  single() {
    this.single_ = 'single'
    return this
  }

  maybeSingle() {
    this.single_ = 'maybeSingle'
    return this
  }

  private matching(): Row[] {
    return this.rows.filter((row) => this.filters.every((f) => f(row)))
  }

  private newRow(input: Row): Row {
    const now = new Date().toISOString()
    return { id: crypto.randomUUID(), created_at: now, updated_at: now, ...input }
  }

  private execute(): Result {
    const store = getDemoStore()

    if (this.mode === 'insert' || this.mode === 'upsert') {
      const inputs = Array.isArray(this.payload) ? this.payload : [this.payload!]
      const written: Row[] = []
      for (const input of inputs) {
        if (this.mode === 'upsert') {
          const keys = this.onConflict!.split(',').map((k) => k.trim())
          const existing = this.rows.find((row) => keys.every((k) => row[k] === input[k]))
          if (existing) {
            Object.assign(existing, input, { updated_at: new Date().toISOString() })
            written.push(existing)
            continue
          }
        }
        const row = this.newRow(input)
        store.tables[this.table].push(row)
        written.push(row)
      }
      return this.finish(written)
    }

    if (this.mode === 'update') {
      const matched = this.matching()
      for (const row of matched) {
        Object.assign(row, this.payload, { updated_at: new Date().toISOString() })
      }
      return this.finish(matched)
    }

    if (this.mode === 'delete') {
      const matched = new Set(this.matching())
      store.tables[this.table] = this.rows.filter((row) => !matched.has(row))
      return this.finish([...matched])
    }

    // select
    let result = [...this.matching()]
    for (const { column, ascending } of [...this.orderings].reverse()) {
      result.sort((a, b) => (ascending ? 1 : -1) * compare(a[column], b[column]))
    }
    if (this.limitCount !== null) result = result.slice(0, this.limitCount)
    return this.finish(result)
  }

  private finish(rows: Row[]): Result {
    // Deep-copy reads so callers can't mutate the store accidentally
    const data = JSON.parse(JSON.stringify(rows)) as Row[]
    if (this.single_ === 'single') {
      if (data.length === 0) {
        return { data: null, error: { message: 'No rows found', code: 'PGRST116' } }
      }
      return { data: data[0], error: null }
    }
    if (this.single_ === 'maybeSingle') {
      return { data: data[0] ?? null, error: null }
    }
    return { data, error: null }
  }

  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    try {
      return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
    } catch (err) {
      return Promise.reject(err).then(onfulfilled, onrejected)
    }
  }
}

const demoUser = {
  id: DEMO_AUTH_USER_ID,
  email: 'nick@saif.vc',
  aud: 'authenticated',
  role: 'authenticated',
}

function demoStorageBucket(bucket: string) {
  const store = getDemoStore()
  const key = (path: string) => `${bucket}/${path}`
  return {
    async upload(path: string, file: File | Buffer | Uint8Array | Blob, options?: { contentType?: string; upsert?: boolean }) {
      let bytes: Uint8Array
      let contentType = options?.contentType ?? 'application/octet-stream'
      if (file instanceof Uint8Array) {
        bytes = file
      } else {
        const blob = file as Blob
        bytes = new Uint8Array(await blob.arrayBuffer())
        if (blob.type) contentType = options?.contentType ?? blob.type
      }
      store.files.set(key(path), { bytes, contentType })
      return { data: { path }, error: null }
    },
    async download(path: string) {
      const file = store.files.get(key(path))
      if (!file) {
        return { data: null, error: { message: 'File not found (demo files reset on restart)' } }
      }
      return { data: new Blob([Buffer.from(file.bytes)], { type: file.contentType }), error: null }
    },
    async remove(paths: string[]) {
      paths.forEach((path) => store.files.delete(key(path)))
      return { data: null, error: null }
    },
    async createSignedUrl(path: string, _expiresIn: number) {
      if (!store.files.has(key(path))) {
        return { data: null, error: { message: 'File not found (demo files reset on restart)' } }
      }
      return {
        data: { signedUrl: `/api/demo-files?key=${encodeURIComponent(key(path))}` },
        error: null,
      }
    },
  }
}

export function createDemoClient() {
  return {
    from(table: string) {
      return new DemoQueryBuilder(table)
    },
    auth: {
      async getUser() {
        return { data: { user: demoUser }, error: null }
      },
      async signOut() {
        return { error: null }
      },
      async signInWithOtp() {
        return { data: {}, error: { message: 'Demo mode: authentication is disabled' } }
      },
      async exchangeCodeForSession() {
        return { data: {}, error: { message: 'Demo mode: authentication is disabled' } }
      },
      async verifyOtp() {
        return { data: {}, error: { message: 'Demo mode: authentication is disabled' } }
      },
    },
    storage: {
      from(bucket: string) {
        return demoStorageBucket(bucket)
      },
    },
  }
}

export function isDemoMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL
}
