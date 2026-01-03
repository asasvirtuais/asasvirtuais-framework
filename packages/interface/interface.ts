import { z } from 'zod'

// Core query types for consistent querying across all backends

export type BasicOperators<T, K extends keyof T> = {
  '$ne'?: T[K]
  '$in'?: T[K][]
  '$nin'?: T[K][]
  '$lt'?: T[K]
  '$lte'?: T[K]
  '$gt'?: T[K]
  '$gte'?: T[K]
}

export type Filters<T> = {
  '$limit'?: number
  '$skip'?: number
  '$sort'?: {
    [K in keyof T]?: 1 | -1
  }
  '$select'?: Array<keyof T>
}

export type Query<T = any> = {
  [K in keyof T]?: T[K] | BasicOperators<T, K>
} & Filters<T> & {
  '$or'?: Array<Query<T>>
  '$and'?: Array<Query<T>>
}

export type Operators<T, K extends keyof T> = BasicOperators<T, K> & {
  '$or'?: Array<Query<T>>
  '$and'?: Array<Query<T>>
}

export interface FindProps {
  table?: string
  id: string
}

export interface CreateProps<T = any> {
  table?: string
  data: T
}

export interface UpdateProps<T = any> {
  table?: string
  id: string
  data: Partial<T>
}

export interface RemoveProps {
  table?: string
  id: string
}

export interface ListProps<T = any> {
  table?: string
  query?: Query<T>
}

export interface DatabaseInterface {
  [T: string]: {
    readable: z.ZodObject
    writable: z.ZodObject
  }
}

export interface TableInterface<Readable, Writable = Readable> {
  find(props: FindProps): Promise<Readable>
  create(props: CreateProps<Writable>): Promise<Readable>
  update(props: UpdateProps<Writable>): Promise<Readable>
  remove(props: RemoveProps): Promise<Readable>
  list(props: ListProps<Readable>): Promise<Readable[]>
}

export function tableInterface<Schema extends DatabaseInterface, Table extends keyof Schema & string>(schema: Schema, table?: Table | null, tableInterface?: TableInterface<z.infer<Schema[Table]['readable']>, z.infer<Schema[Table]['writable']>>) {
  return tableInterface
}
