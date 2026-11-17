import { z } from 'zod'

export interface TableInterface<Readable, Writable = Readable> {
  find   (props: FindProps)             : Promise<Readable>
  create (props: CreateProps<Writable>) : Promise<Readable>
  update (props: UpdateProps<Writable>) : Promise<Readable>
  remove (props: RemoveProps)           : Promise<Readable>
  list   (props: ListProps<Readable>)   : Promise<Readable[]>
}

type ReadableOf<S extends TableSchema> = z.infer<S['readable']>
type WritableOf<S extends TableSchema> = z.infer<S['writable']>

/** The union of every table's readable / writable rows in a database schema. */
export type DatabaseReadable<D extends DatabaseSchema> = { [T in keyof D]: ReadableOf<D[T]> }[keyof D]
export type DatabaseWritable<D extends DatabaseSchema> = { [T in keyof D]: WritableOf<D[T]> }[keyof D]

/**
 * What `asasvirtuaisInterface` receives: the five CRUD methods, with props typed by the schema.
 * The methods usually pass to the raw database interface, which answers for every table, so their
 * results are taken as the rows the schema declares.
 */
export interface InterfaceImplementation<Readable, Writable> {
  find   (props: FindProps)             : Promise<any>
  create (props: CreateProps<Writable>) : Promise<any>
  update (props: UpdateProps<Writable>) : Promise<any>
  remove (props: RemoveProps)           : Promise<any>
  list   (props: ListProps<Readable>)   : Promise<any[]>
}

/**
 * Types a CRUD interface with a schema.
 *
 * - With one table's schema (`{ readable, writable }`) it is that table's interface: the table middleware.
 * - With the database schema (`{ todos, tags }`) it is the interface for every table: `app/actions.ts`,
 *   adapters, the `InterfaceProvider`.
 */
export function asasvirtuaisInterface<S extends TableSchema>(schema: S, implementation: InterfaceImplementation<ReadableOf<S>, WritableOf<S>>): TableInterface<ReadableOf<S>, WritableOf<S>>
export function asasvirtuaisInterface<D extends DatabaseSchema>(schema: D, implementation: InterfaceImplementation<DatabaseReadable<D>, DatabaseWritable<D>>): TableInterface<DatabaseReadable<D>, DatabaseWritable<D>>
export function asasvirtuaisInterface(schema: TableSchema | DatabaseSchema, implementation: InterfaceImplementation<any, any>): TableInterface<any, any> {
  return implementation
}

export interface TableSchema { readable: z.ZodObject<z.ZodRawShape>, writable: z.ZodObject<z.ZodRawShape> }

export interface DatabaseSchema {
  [T: string]: TableSchema
}

export type BasicOperators<T, K extends keyof T> = {
  '$ne'  ?: T[K]
  '$lt'  ?: T[K]
  '$lte' ?: T[K]
  '$gt'  ?: T[K]
  '$gte' ?: T[K]
  '$in'  ?: T[K][]
  '$nin' ?: T[K][]
}

/** Every key of every member of a union of rows (`keyof` alone keeps only the shared ones). */
type KeysOf<T> = T extends any ? keyof T : never

export type Filters<T> = {
  '$limit'  ?: number
  '$skip'   ?: number
  '$select' ?: Array<KeysOf<T>>
  '$sort'   ?: { [K in keyof T]?: 1 | -1 }
}

/** An untyped query (`Query<any>`) is accepted wherever a typed one is. */
export type Query<T = any> = 0 extends (1 & T) ? any : { [K in keyof T]?: T[K] | BasicOperators<T, K> } & Filters<T> & {
  '$or'  ?: Array<Query<T>>
  '$and' ?: Array<Query<T>>
}

export type Operators<T, K extends keyof T> = BasicOperators<T, K> & {
  '$or'  ?: Array<Query<T>>
  '$and' ?: Array<Query<T>>
}

export interface FindProps { table?: string, id: string }
export interface RemoveProps { table?: string, id: string }
export interface CreateProps<T = any> { table?: string, data: T }
export interface UpdateProps<T = any> { table?: string, id: string, data: Partial<T> }
export interface ListProps<T = any> { table?: string, query?: Query<T> }
