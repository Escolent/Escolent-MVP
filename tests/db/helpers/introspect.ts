import type { PoolClient } from "pg";

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
}

/** All columns for a public-schema table, in declaration order. */
export async function getColumns(client: PoolClient, table: string): Promise<ColumnInfo[]> {
  const { rows } = await client.query<ColumnInfo>(
    `select column_name, data_type, is_nullable, column_default
     from information_schema.columns
     where table_schema = 'public' and table_name = $1
     order by ordinal_position`,
    [table],
  );
  return rows;
}

export async function getColumn(
  client: PoolClient,
  table: string,
  column: string,
): Promise<ColumnInfo | undefined> {
  return (await getColumns(client, table)).find((c) => c.column_name === column);
}

export async function tableExists(client: PoolClient, table: string): Promise<boolean> {
  const { rows } = await client.query(
    `select 1 from information_schema.tables where table_schema = 'public' and table_name = $1`,
    [table],
  );
  return rows.length > 0;
}

export async function indexExists(client: PoolClient, indexName: string): Promise<boolean> {
  const { rows } = await client.query(
    `select 1 from pg_indexes where schemaname = 'public' and indexname = $1`,
    [indexName],
  );
  return rows.length > 0;
}

export async function rlsEnabled(client: PoolClient, table: string): Promise<boolean> {
  const { rows } = await client.query(
    `select relrowsecurity from pg_class where relname = $1 and relnamespace = 'public'::regnamespace`,
    [table],
  );
  return rows[0]?.relrowsecurity === true;
}

export async function policyNames(client: PoolClient, table: string): Promise<string[]> {
  const { rows } = await client.query<{ policyname: string }>(
    `select policyname from pg_policies where schemaname = 'public' and tablename = $1`,
    [table],
  );
  return rows.map((r) => r.policyname);
}

/** Concatenated `pg_get_constraintdef` for every CHECK constraint on a table — for substring assertions. */
export async function checkConstraintDefs(client: PoolClient, table: string): Promise<string> {
  const { rows } = await client.query<{ def: string }>(
    `select pg_get_constraintdef(c.oid) as def
     from pg_constraint c
     join pg_class t on t.oid = c.conrelid
     where t.relname = $1 and c.contype = 'c'`,
    [table],
  );
  return rows.map((r) => r.def).join("\n");
}

export async function primaryKeyColumns(client: PoolClient, table: string): Promise<string[]> {
  const { rows } = await client.query<{ attname: string }>(
    `select a.attname
     from pg_index i
     join pg_class t on t.oid = i.indrelid
     join pg_attribute a on a.attrelid = t.oid and a.attnum = any(i.indkey)
     where t.relname = $1 and i.indisprimary`,
    [table],
  );
  return rows.map((r) => r.attname);
}

export async function foreignKeyTargets(
  client: PoolClient,
  table: string,
  column: string,
): Promise<{ targetTable: string; onDelete: string } | undefined> {
  const { rows } = await client.query<{ target_table: string; confdeltype: string }>(
    `select
       ft.relname as target_table,
       c.confdeltype
     from pg_constraint c
     join pg_class t on t.oid = c.conrelid
     join pg_class ft on ft.oid = c.confrelid
     join pg_attribute a on a.attrelid = t.oid and a.attnum = any(c.conkey)
     where t.relname = $1 and a.attname = $2 and c.contype = 'f'`,
    [table, column],
  );
  if (rows.length === 0) return undefined;
  const onDeleteMap: Record<string, string> = { c: "CASCADE", a: "NO ACTION", r: "RESTRICT", n: "SET NULL", d: "SET DEFAULT" };
  return { targetTable: rows[0].target_table, onDelete: onDeleteMap[rows[0].confdeltype] ?? rows[0].confdeltype };
}
