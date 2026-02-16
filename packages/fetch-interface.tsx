'use client'
import { z } from 'zod'
import { useMemo } from 'react'
import { createContextFromHook } from './hooks'
import type { TableInterface, TableSchema } from './interface'

export function useFetchInterfaceProvider<TSchema extends TableSchema>({
  schema, baseUrl = '/api/v1', headers = {},
}: {
  schema: TSchema
  baseUrl?: string
  headers?: Record<string, string>
}) {
  return useMemo(() => fetchInterface({ schema, baseUrl, headers }), [schema, baseUrl])
}

export const [FetchInterfaceProvider, useFetchInterface] = createContextFromHook(useFetchInterfaceProvider<any>)

export function fetchInterface<Schema extends TableSchema, Table extends string>({
  schema, defaultTable, baseUrl = '/api/v1', headers = {}
}: {
  schema: Schema
  defaultTable?: Table
  baseUrl?: string
  headers?: Record<string, string>
}): TableInterface<z.infer<Schema['readable']>, z.infer<Schema['writable']>> {

  return {
    async find({ table = defaultTable as string, id }) {
      const response = await fetch(`${baseUrl}/${table}/${id}`, {
        headers
      })
      if (response.ok)
        return response.json()
      else
        throw new Error(await response.json())
    },

    async create({ table = defaultTable as string, data }) {
      const response = await fetch(`${baseUrl}/${table}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(data)
      })
      if (response.ok)
        return response.json()
      else
        throw new Error(await response.json())
    },

    async update({ table = defaultTable as string, id, data }) {
      const response = await fetch(`${baseUrl}/${table}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(data)
      })
      if (response.ok)
        return response.json()
      else
        throw new Error(await response.json())
    },

    async remove({ table = defaultTable as string, id }) {
      const response = await fetch(`${baseUrl}/${table}/${id}`, {
        method: 'DELETE',
        headers
      })
      if (response.ok)
        return response.json()
      else
        throw new Error(await response.json())
    },

    async list({ table = defaultTable as string, query }) {
      const params = new URLSearchParams(query as any)
      const response = await fetch(`${baseUrl}/${table}?${params}`, {
        headers
      })
      if (response.ok)
        return response.json()
      else
        throw new Error(await response.json())
    }
  }
}