import { z } from 'zod'

export interface TableInterface<Readable, Writable = Readable> {
  find   (props: FindProps)             : Promise<Readable>
  create (props: CreateProps<Writable>) : Promise<Readable>
  update (props: UpdateProps<Writable>) : Promise<Readable>
  remove (props: RemoveProps)           : Promise<Readable>
  list   (props: ListProps<Readable>)   : Promise<Readable[]>
}

export function tableInterface<Schema extends DatabaseSchema, Table extends keyof Schema & string>(schema: Schema, table?: Table | null, tableInterface?: TableInterface<z.infer<Schema[Table]['readable']>, z.infer<Schema[Table]['writable']>>) {
  return tableInterface
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

export type Filters<T> = {
  '$limit'  ?: number
  '$skip'   ?: number
  '$select' ?: Array<keyof T>
  '$sort'   ?: { [K in keyof T]?: 1 | -1 }
}

export type Query<T = any> = { [K in keyof T]?: T[K] | BasicOperators<T, K> } & Filters<T> & {
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
