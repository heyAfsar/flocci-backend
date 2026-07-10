/**
 * Minimal supabase-js query-builder shim over node-postgres, covering exactly
 * the subset this codebase uses: from().select().eq().gt().order().limit()
 * .single()/.maybeSingle(), insert().select().single(), update().eq(),
 * upsert(rows, {onConflict}), delete().eq().
 *
 * Lets every route keep its `const { data, error } = await supabase.from(...)`
 * shape while the storage moves from Supabase to the VPS Postgres (reached
 * through the TLS pgbouncer door). DB_TARGET=vps selects this shim in
 * lib/supabase(-admin).ts; anything else keeps the real Supabase client.
 */
import { Pool } from 'pg';

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    const raw = process.env.DATABASE_URL;
    if (!raw) throw new Error('DB_TARGET=vps requires DATABASE_URL');
    // Strip sslmode from the URL — pg's URL-derived ssl config would override
    // the explicit ssl object below and reject pgbouncer's self-signed cert.
    const connectionString = raw.replace(/[?&]sslmode=[^&]+/, (m) => (m.startsWith('?') ? '?' : '')).replace(/\?$/, '');
    pool = new Pool({
      connectionString,
      // pgbouncer fronts a self-signed cert until db.flocci.in gets a CA cert.
      ssl: { rejectUnauthorized: false },
      max: 3, // serverless: keep per-instance footprint tiny; pgbouncer pools upstream
      idleTimeoutMillis: 10_000,
    });
  }
  return pool;
}

type Row = Record<string, unknown>;
export type ShimResult<T = Row | Row[] | null> = { data: T; error: { message: string; code?: string } | null; count?: number | null };

const ident = (name: string) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error(`unsafe identifier: ${name}`);
  return `"${name}"`;
};

class QueryBuilder implements PromiseLike<ShimResult> {
  private table: string;
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private columns = '*';
  private wheres: Array<{ col: string; cmp: string; val: unknown }> = [];
  private orderBy: { col: string; asc: boolean } | null = null;
  private limitN: number | null = null;
  private rows: Row[] = [];
  private updates: Row = {};
  private onConflictCol: string | null = null;
  private wantSingle: 'strict' | 'maybe' | null = null;
  private returning = false;

  constructor(table: string) {
    this.table = table;
  }

  select(cols = '*') {
    if (this.op === 'select') {
      this.columns = cols;
    } else {
      this.returning = true; // .insert()/.update()/.upsert() followed by .select()
    }
    return this;
  }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.rows = Array.isArray(rows) ? rows : [rows]; return this; }
  update(values: Row) { this.op = 'update'; this.updates = values; return this; }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.rows = Array.isArray(rows) ? rows : [rows];
    this.onConflictCol = opts?.onConflict || null;
    return this;
  }
  delete() { this.op = 'delete'; return this; }
  eq(col: string, val: unknown) { this.wheres.push({ col, cmp: '=', val }); return this; }
  gt(col: string, val: unknown) { this.wheres.push({ col, cmp: '>', val }); return this; }
  gte(col: string, val: unknown) { this.wheres.push({ col, cmp: '>=', val }); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, asc: opts?.ascending !== false }; return this; }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.wantSingle = 'strict'; return this; }
  maybeSingle() { this.wantSingle = 'maybe'; return this; }

  private build(): { text: string; values: unknown[] } {
    const values: unknown[] = [];
    const ph = (v: unknown) => { values.push(v); return `$${values.length}`; };
    const whereSql = () =>
      this.wheres.length ? ` WHERE ${this.wheres.map((w) => `${ident(w.col)} ${w.cmp} ${ph(w.val)}`).join(' AND ')}` : '';
    const colsSql = this.columns === '*' ? '*' : this.columns.split(',').map((c) => ident(c.trim())).join(', ');

    if (this.op === 'select') {
      let text = `SELECT ${colsSql} FROM ${ident(this.table)}${whereSql()}`;
      if (this.orderBy) text += ` ORDER BY ${ident(this.orderBy.col)} ${this.orderBy.asc ? 'ASC' : 'DESC'}`;
      if (this.limitN != null) text += ` LIMIT ${Number(this.limitN)}`;
      return { text, values };
    }
    if (this.op === 'insert' || this.op === 'upsert') {
      const cols = Object.keys(this.rows[0]);
      const tuples = this.rows
        .map((r) => `(${cols.map((c) => ph(r[c] === undefined ? null : r[c])).join(', ')})`)
        .join(', ');
      let text = `INSERT INTO ${ident(this.table)} (${cols.map(ident).join(', ')}) VALUES ${tuples}`;
      if (this.op === 'upsert') {
        const conflict = this.onConflictCol || 'id';
        const sets = cols.filter((c) => c !== conflict).map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`).join(', ');
        text += ` ON CONFLICT (${ident(conflict)}) DO UPDATE SET ${sets}`;
      }
      text += ' RETURNING *';
      return { text, values };
    }
    if (this.op === 'update') {
      const cols = Object.keys(this.updates);
      const sets = cols.map((c) => `${ident(c)} = ${ph(this.updates[c])}`).join(', ');
      const text = `UPDATE ${ident(this.table)} SET ${sets}${whereSql()} RETURNING *`;
      return { text, values };
    }
    // delete
    return { text: `DELETE FROM ${ident(this.table)}${whereSql()} RETURNING *`, values };
  }

  private async run(): Promise<ShimResult> {
    try {
      const { text, values } = this.build();
      // JSONB columns accept objects via pg's JSON serialization; DATE/TS pass through.
      const res = await getPool().query(text, values as never[]);
      let data: Row | Row[] | null = res.rows;
      if (this.wantSingle) {
        if (res.rows.length === 0) {
          if (this.wantSingle === 'strict') {
            return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
          }
          data = null;
        } else {
          data = res.rows[0];
        }
      } else if (this.op !== 'select' && !this.returning) {
        data = res.rows; // supabase returns null without .select(); rows are harmless
      }
      return { data, error: null };
    } catch (e) {
      const err = e as Error & { code?: string };
      return { data: null, error: { message: err.message, code: err.code } };
    }
  }

  then<R1 = ShimResult, R2 = never>(
    onfulfilled?: ((value: ShimResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/** Shim object with the same `.from()` surface as a supabase client. */
export const pgDb = {
  from(table: string) {
    return new QueryBuilder(table);
  },
};

export const isVpsTarget = () => (process.env.DB_TARGET || '').toLowerCase() === 'vps';
