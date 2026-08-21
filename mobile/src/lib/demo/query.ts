import type { Row, Tables } from './tables';

/**
 * Just enough PostgREST to run the app's own queries.
 *
 * Deliberately not a general implementation: it covers the calls the screens
 * actually make -- filtering on equality, ordering, embedded relations and
 * counts -- and returns the same `{ data, error }` shape so no screen has to
 * know it is talking to a fake.
 */

type Embed = { table: string; type: 'one' | 'many'; localKey: string; foreignKey: string };

/**
 * Which embedded selects resolve to what. PostgREST reads these from foreign
 * keys; here they are spelled out, and anything not listed comes back null
 * rather than silently wrong.
 */
const EMBEDS: Record<string, Record<string, Embed>> = {
  tours: {
    clients: { table: 'clients', type: 'one', localKey: 'client_id', foreignKey: 'id' },
    tour_stops: { table: 'tour_stops', type: 'many', localKey: 'id', foreignKey: 'tour_id' },
    stop_notes: { table: 'stop_notes', type: 'many', localKey: 'id', foreignKey: 'tour_id' },
    stop_photos: { table: 'stop_photos', type: 'many', localKey: 'id', foreignKey: 'tour_id' },
  },
  tour_stops: {
    properties: { table: 'properties', type: 'one', localKey: 'property_id', foreignKey: 'id' },
  },
  stop_notes: {
    tour_participants: {
      table: 'tour_participants',
      type: 'one',
      localKey: 'participant_id',
      foreignKey: 'id',
    },
  },
  stop_photos: {
    tour_participants: {
      table: 'tour_participants',
      type: 'one',
      localKey: 'participant_id',
      foreignKey: 'id',
    },
  },
};

/** Splits on commas that are not inside parentheses: `a, b(c, d), e`. */
export function splitColumns(select: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const character of select) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export type DemoError = { message: string };
export type DemoResult<T> = { data: T; error: DemoError | null };

export class DemoQuery<T = unknown> implements PromiseLike<DemoResult<T>> {
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private columns = '*';
  private filters: [string, unknown][] = [];
  private ordering: { column: string; ascending: boolean }[] = [];
  private payload: Row[] = [];
  private rowMode: 'many' | 'single' | 'maybe' = 'many';
  private returning = false;

  constructor(
    private tables: Tables,
    private table: string,
    private onChange: () => void,
    private makeId: () => string,
  ) {}

  select(columns = '*'): this {
    // Called after a write, .select() means "give me back the affected rows".
    if (this.operation !== 'select') this.returning = true;
    this.columns = columns;
    return this;
  }

  insert(payload: Row | Row[]): this {
    this.operation = 'insert';
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload: Row): this {
    this.operation = 'update';
    this.payload = [payload];
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.ordering.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(): this {
    return this;
  }

  single(): this {
    this.rowMode = 'single';
    return this;
  }

  maybeSingle(): this {
    this.rowMode = 'maybe';
    return this;
  }

  private rows(): Row[] {
    return (this.tables[this.table] ??= []);
  }

  private matches(row: Row): boolean {
    return this.filters.every(([column, value]) => row[column] === value);
  }

  /**
   * Recursive, so an embed can carry its own embeds -- a tour's stops each
   * carrying their property, which is how a tour card shows its buildings in
   * one query rather than one per stop.
   */
  private projectRow(table: string, row: Row, columns: string): Row {
    if (columns.trim() === '*') return { ...row };

    const output: Row = {};
    for (const part of splitColumns(columns)) {
      const embedMatch = /^([a-z_]+)\s*\(([\s\S]*)\)$/.exec(part);

      if (!embedMatch) {
        output[part] = row[part];
        continue;
      }

      const [, name, inner] = embedMatch;
      const embed = EMBEDS[table]?.[name];
      if (!embed) {
        output[name] = null;
        continue;
      }

      const related = (this.tables[embed.table] ?? []).filter(
        (candidate) => candidate[embed.foreignKey] === row[embed.localKey],
      );

      // PostgREST returns an aggregate as a one-element array, which is why
      // the screens read `tour_stops[0].count`.
      if (inner.trim() === 'count') {
        output[name] = [{ count: related.length }];
        continue;
      }

      if (embed.type === 'one') {
        output[name] = related[0] ? this.projectRow(embed.table, related[0], inner) : null;
        continue;
      }

      // A to-many embed keeps the child table's own ordering, which for an
      // itinerary is the thing that matters.
      const ordered = embed.table === 'tour_stops'
        ? [...related].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
        : related;

      output[name] = ordered.map((candidate) => this.projectRow(embed.table, candidate, inner));
    }
    return output;
  }

  private project(row: Row): Row {
    return this.projectRow(this.table, row, this.columns);
  }

  private sort(rows: Row[]): Row[] {
    if (!this.ordering.length) return rows;

    return [...rows].sort((left, right) => {
      for (const { column, ascending } of this.ordering) {
        const a = left[column];
        const b = right[column];
        // Nulls last, matching the app's `nullsFirst: false` ordering.
        if (a == null && b == null) continue;
        if (a == null) return 1;
        if (b == null) return -1;
        if (a === b) continue;
        return (a < b ? -1 : 1) * (ascending ? 1 : -1);
      }
      return 0;
    });
  }

  private run(): DemoResult<T> {
    const table = this.rows();
    const stamp = new Date().toISOString();

    if (this.operation === 'insert') {
      const inserted = this.payload.map((row) => ({
        id: this.makeId(),
        created_at: stamp,
        updated_at: stamp,
        ...row,
      }));
      table.push(...inserted);
      this.onChange();
      return this.shape(this.returning ? inserted.map((row) => this.project(row)) : []);
    }

    if (this.operation === 'update') {
      const updated: Row[] = [];
      for (const row of table) {
        if (!this.matches(row)) continue;
        Object.assign(row, this.payload[0], { updated_at: stamp });
        updated.push(row);
      }
      this.onChange();
      return this.shape(updated.map((row) => this.project(row)));
    }

    if (this.operation === 'delete') {
      const kept = table.filter((row) => !this.matches(row));
      this.tables[this.table] = kept;
      this.onChange();
      return this.shape([]);
    }

    return this.shape(this.sort(table.filter((row) => this.matches(row))).map((row) => this.project(row)));
  }

  private shape(rows: Row[]): DemoResult<T> {
    if (this.rowMode === 'many') return { data: rows as T, error: null };
    if (rows.length) return { data: rows[0] as T, error: null };

    return this.rowMode === 'maybe'
      ? { data: null as T, error: null }
      : { data: null as T, error: { message: 'No rows returned' } };
  }

  then<R1 = DemoResult<T>, R2 = never>(
    onFulfilled?: ((value: DemoResult<T>) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    let result: DemoResult<T>;
    try {
      result = this.run();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Demo query failed';
      result = { data: null as T, error: { message } };
    }
    return Promise.resolve(result).then(onFulfilled, onRejected);
  }
}
