/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Mock Supabase client backed by localStorage.
 * Implements the same chainable query API so all page code works without changes.
 * Activated when VITE_SUPABASE_URL is not set (demo mode).
 */

const STORAGE_PREFIX = 'wf_demo_'

// --------------- helpers ---------------

function uid(): string {
  return crypto.randomUUID()
}

function getTable(name: string): any[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + name) || '[]')
  } catch {
    return []
  }
}

function setTable(name: string, rows: any[]) {
  localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(rows))
}

function matchesFilter(row: any, filters: Filter[]): boolean {
  return filters.every(f => {
    // Support dot-notation for joined fields: invoice.restaurant_id
    let val: any
    if (f.column.includes('.')) {
      const [alias, field] = f.column.split('.')
      val = row[alias]?.[field]
    } else {
      val = row[f.column]
    }
    switch (f.op) {
      case 'eq': return val === f.value
      case 'neq': return val !== f.value
      case 'gte': return val >= f.value
      case 'lte': return val <= f.value
      case 'gt': return val > f.value
      case 'lt': return val < f.value
      default: return true
    }
  })
}

interface Filter { column: string; op: string; value: any }
interface OrderBy { column: string; ascending: boolean }

// Parse join syntax from select string:
// "*, ingredient:ingredients(name, unit, avg_cost)"
// Returns { baseColumns: '*', joins: [{ alias: 'ingredient', table: 'ingredients', columns: ['name','unit','avg_cost'] }] }
interface JoinDef { alias: string; table: string; columns: string[] | '*'; nestedJoins?: JoinDef[] }

function parseSelect(selectStr: string): { raw: string; joins: JoinDef[] } {
  const joins: JoinDef[] = []

  // Match patterns like: alias:table(cols) or table(cols)
  // Handle nested parentheses by finding balanced parens
  function extractTopLevelJoins(str: string): string {
    let cleaned = str
    const regex = /(?:(\w+):)?(\w+)!?\w*\(/g
    let match
    const toRemove: { start: number; end: number }[] = []

    while ((match = regex.exec(str)) !== null) {
      const start = match.index
      // Find balanced closing paren
      let depth = 1
      let i = start + match[0].length
      while (i < str.length && depth > 0) {
        if (str[i] === '(') depth++
        if (str[i] === ')') depth--
        i++
      }
      const innerContent = str.slice(start + match[0].length, i - 1)
      const alias = match[1] || match[2]
      const table = match[2]

      // Parse nested joins from the inner content
      const nested = parseSelect(innerContent)

      joins.push({
        alias,
        table,
        columns: nested.raw === '*' ? '*' : nested.raw.split(',').map(c => c.trim()).filter(Boolean),
        nestedJoins: nested.joins.length > 0 ? nested.joins : undefined,
      })

      toRemove.push({ start, end: i })
    }

    // Remove matched portions from the string (in reverse order to preserve indices)
    for (const r of toRemove.reverse()) {
      cleaned = cleaned.slice(0, r.start) + cleaned.slice(r.end)
    }
    cleaned = cleaned.replace(/,\s*,/g, ',').replace(/^,\s*|\s*,$/g, '').trim()
    return cleaned || '*'
  }

  const raw = extractTopLevelJoins(selectStr)
  return { raw, joins }
}

function resolveJoins(row: any, joins: JoinDef[]): any {
  if (joins.length === 0) return row
  const result = { ...row }
  for (const join of joins) {
    // Check if this is a belongs-to (row has foreign key)
    const fk = row[join.alias + '_id'] ?? row[join.table.replace(/s$/, '') + '_id']
    if (!fk) continue // skip, might be has-many

    const foreignTable = getTable(join.table)
    const foreignRow = foreignTable.find((r: any) => r.id === fk)
    if (!foreignRow) {
      result[join.alias] = null
      continue
    }
    if (join.columns === '*') {
      result[join.alias] = { ...foreignRow }
    } else {
      const picked: any = {}
      for (const col of join.columns) picked[col] = foreignRow[col]
      result[join.alias] = picked
    }
  }
  return result
}

function resolveHasManyJoins(row: any, joins: JoinDef[]): any {
  const result = { ...row }
  for (const join of joins) {
    const fk = row[join.alias + '_id'] ?? row[join.table.replace(/s$/, '') + '_id']
    if (fk) continue // belongs-to, already handled

    const foreignTable = getTable(join.table)
    let children = foreignTable.filter((fr: any) => {
      return Object.values(fr).includes(row.id)
    })

    // Resolve nested joins on each child
    if (join.nestedJoins && join.nestedJoins.length > 0) {
      children = children.map((child: any) => {
        let resolved = resolveJoins(child, join.nestedJoins!)
        resolved = resolveHasManyJoins(resolved, join.nestedJoins!)
        return resolved
      })
    }

    result[join.alias] = children
  }
  return result
}

// --------------- Query Builder ---------------

class MockQueryBuilder {
  private _table: string
  private _filters: Filter[] = []
  private _orders: OrderBy[] = []
  private _limit: number | null = null
  private _single = false
  private _selectStr = '*'
  private _insertData: any = null
  private _updateData: any = null
  private _deleteMode = false
  private _returnData = false // .select() after insert/update

  constructor(table: string) {
    this._table = table
  }

  select(columns = '*') {
    this._selectStr = columns
    this._returnData = true
    return this
  }

  insert(data: any) {
    this._insertData = Array.isArray(data) ? data : [data]
    return this
  }

  update(data: any) {
    this._updateData = data
    return this
  }

  delete() {
    this._deleteMode = true
    return this
  }

  eq(column: string, value: any) { this._filters.push({ column, op: 'eq', value }); return this }
  neq(column: string, value: any) { this._filters.push({ column, op: 'neq', value }); return this }
  gte(column: string, value: any) { this._filters.push({ column, op: 'gte', value }); return this }
  lte(column: string, value: any) { this._filters.push({ column, op: 'lte', value }); return this }
  gt(column: string, value: any) { this._filters.push({ column, op: 'gt', value }); return this }
  lt(column: string, value: any) { this._filters.push({ column, op: 'lt', value }); return this }

  order(column: string, opts?: { ascending?: boolean }) {
    this._orders.push({ column, ascending: opts?.ascending ?? true })
    return this
  }

  limit(n: number) {
    this._limit = n
    return this
  }

  single() {
    this._single = true
    return this._execute()
  }

  // Terminal: resolve the query
  then(resolve: (val: any) => void, reject?: (err: any) => void) {
    try {
      resolve(this._execute())
    } catch (e) {
      if (reject) { reject(e) } else { resolve({ data: null, error: e }) }
    }
  }

  private _execute(): { data: any; error: any } {
    try {
      // INSERT
      if (this._insertData) {
        const rows = getTable(this._table)
        const now = new Date().toISOString()
        const inserted: any[] = []
        for (const item of this._insertData) {
          const row = { id: uid(), created_at: now, updated_at: now, ...item }
          rows.push(row)
          inserted.push(row)
        }
        setTable(this._table, rows)
        const result = inserted.length === 1 ? inserted[0] : inserted
        if (this._single) return { data: inserted[0], error: null }
        return { data: this._returnData ? result : null, error: null }
      }

      // UPDATE
      if (this._updateData) {
        const rows = getTable(this._table)
        let updated: any = null
        for (let i = 0; i < rows.length; i++) {
          if (matchesFilter(rows[i], this._filters)) {
            rows[i] = { ...rows[i], ...this._updateData, updated_at: new Date().toISOString() }
            updated = rows[i]
          }
        }
        setTable(this._table, rows)
        return { data: updated, error: null }
      }

      // DELETE
      if (this._deleteMode) {
        const rows = getTable(this._table)
        const remaining = rows.filter((r: any) => !matchesFilter(r, this._filters))
        setTable(this._table, remaining)
        return { data: null, error: null }
      }

      // SELECT
      let rows = getTable(this._table)

      // Split filters: dot-notation filters apply after joins
      const plainFilters = this._filters.filter(f => !f.column.includes('.'))
      const joinFilters = this._filters.filter(f => f.column.includes('.'))

      // Apply plain filters first
      rows = rows.filter((r: any) => matchesFilter(r, plainFilters))

      // Parse select for joins
      const { joins } = parseSelect(this._selectStr)

      // Resolve joins
      if (joins.length > 0) {
        rows = rows.map((r: any) => {
          let result = resolveJoins(r, joins)
          result = resolveHasManyJoins(result, joins)
          return result
        })
      }

      // Apply dot-notation filters after joins are resolved
      if (joinFilters.length > 0) {
        rows = rows.filter((r: any) => matchesFilter(r, joinFilters))
      }

      // Apply ordering
      for (const ord of [...this._orders].reverse()) {
        rows.sort((a: any, b: any) => {
          const va = a[ord.column], vb = b[ord.column]
          if (va == null && vb == null) return 0
          if (va == null) return ord.ascending ? -1 : 1
          if (vb == null) return ord.ascending ? 1 : -1
          if (va < vb) return ord.ascending ? -1 : 1
          if (va > vb) return ord.ascending ? 1 : -1
          return 0
        })
      }

      // Apply limit
      if (this._limit != null) rows = rows.slice(0, this._limit)

      // Single
      if (this._single) {
        return { data: rows[0] || null, error: rows[0] ? null : { message: 'Row not found', code: 'PGRST116' } }
      }

      return { data: rows, error: null }
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } }
    }
  }
}

// --------------- Auth ---------------

const DEMO_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'demo@wastedfood.app',
  role: 'authenticated',
  aud: 'authenticated',
  app_metadata: {},
  user_metadata: { name: 'Demo User' },
  created_at: '2025-01-01T00:00:00Z',
}

const DEMO_SESSION = {
  access_token: 'demo-token',
  refresh_token: 'demo-refresh',
  expires_in: 999999,
  token_type: 'bearer',
  user: DEMO_USER,
}

type AuthCallback = (event: string, session: any) => void

let authCallbacks: AuthCallback[] = []
let isLoggedIn = localStorage.getItem(STORAGE_PREFIX + 'auth') !== 'logged_out'

const mockAuth = {
  async getSession() {
    if (!isLoggedIn) return { data: { session: null }, error: null }
    return { data: { session: DEMO_SESSION }, error: null }
  },
  onAuthStateChange(callback: AuthCallback) {
    authCallbacks.push(callback)
    // Fire initial event
    setTimeout(() => {
      if (isLoggedIn) callback('SIGNED_IN', DEMO_SESSION)
    }, 50)
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            authCallbacks = authCallbacks.filter(c => c !== callback)
          },
        },
      },
    }
  },
  async signInWithPassword(_creds: { email: string; password: string }) { // eslint-disable-line @typescript-eslint/no-unused-vars
    isLoggedIn = true
    localStorage.setItem(STORAGE_PREFIX + 'auth', 'logged_in')
    authCallbacks.forEach(cb => cb('SIGNED_IN', DEMO_SESSION))
    return { data: { user: DEMO_USER, session: DEMO_SESSION }, error: null }
  },
  async signUp(_creds: { email: string; password: string }) { // eslint-disable-line @typescript-eslint/no-unused-vars
    isLoggedIn = true
    localStorage.setItem(STORAGE_PREFIX + 'auth', 'logged_in')
    authCallbacks.forEach(cb => cb('SIGNED_IN', DEMO_SESSION))
    return { data: { user: DEMO_USER, session: DEMO_SESSION }, error: null }
  },
  async signOut() {
    isLoggedIn = false
    localStorage.setItem(STORAGE_PREFIX + 'auth', 'logged_out')
    authCallbacks.forEach(cb => cb('SIGNED_OUT', null))
    return { error: null }
  },
}

// --------------- Storage ---------------

function createMockStorage() {
  return {
    from(_bucket: string) { // eslint-disable-line @typescript-eslint/no-unused-vars
      return {
        async upload(_path: string, _file: File) { // eslint-disable-line @typescript-eslint/no-unused-vars
          // Store as data URL in localStorage
          return { data: { path: _path }, error: null }
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `/demo-uploads/${path}` } }
        },
      }
    },
  }
}

// --------------- Functions ---------------

function createMockFunctions() {
  return {
    async invoke(name: string, opts?: { body?: any }) {
      if (name === 'process-invoice') {
        // Return a mock structured invoice
        const ocrText: string = opts?.body?.ocr_text || ''
        return {
          data: {
            supplier_name: 'Demo Supplier',
            invoice_date: new Date().toISOString().split('T')[0],
            line_items: ocrText ? [
              { product_name: 'Tomatoes', quantity: 5, unit: 'kg', unit_price: 2.50, total: 12.50 },
              { product_name: 'Olive Oil', quantity: 2, unit: 'l', unit_price: 8.00, total: 16.00 },
              { product_name: 'Mozzarella', quantity: 3, unit: 'kg', unit_price: 12.00, total: 36.00 },
            ] : [],
            confidence: 0.85,
          },
          error: null,
        }
      }
      return { data: null, error: { message: `Unknown function: ${name}` } }
    },
  }
}

// --------------- Main export ---------------

export function createMockSupabaseClient() {
  return {
    from(table: string) {
      return new MockQueryBuilder(table)
    },
    auth: mockAuth,
    storage: createMockStorage(),
    functions: createMockFunctions(),
  }
}

export const DEMO_USER_ID = DEMO_USER.id
