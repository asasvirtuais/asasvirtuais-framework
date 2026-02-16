'use client'
import { useMemo } from 'react'
import { createContextFromHook } from './hooks'
import type { TableInterface, TableSchema } from './interface'

export function useMemInterfaceProvider<TSchema extends TableSchema>({
    schema,
}: {
    schema: TSchema
}) {
    return useMemo(() => memInterface<TSchema>(), [schema])
}

export const [MemInterfaceProvider, useMemInterface] = createContextFromHook(useMemInterfaceProvider<any>)

export function memInterface<TSchema extends TableSchema>(): TableInterface<any, any> {

    const store: Record<string, Record<string, any>> = {}

    function getTable(table?: string) {
        if (!table) throw new Error('Table name must be provided.')
        if (!store[table]) store[table] = {}
        return store[table]
    }

    return {
        async find({ table, id }) {
            const t = getTable(table)
            const record = t[id]
            if (!record) throw new Error(`Record with id ${id} not found in ${table}`)
            return record
        },

        async create({ table, data }) {
            const t = getTable(table)
            const id = (data as any).id || crypto.randomUUID()
            const record = { ...data, id }
            t[id] = record
            return record
        },

        async update({ table, id, data }) {
            const t = getTable(table)
            if (!t[id]) throw new Error(`Record with id ${id} not found in ${table}, cannot update.`)
            t[id] = { ...t[id], ...data }
            return t[id]
        },

        async remove({ table, id }) {
            const t = getTable(table)
            const record = t[id]
            if (!record) throw new Error(`Record with id ${id} not found in ${table}, cannot remove.`)
            delete t[id]
            return record
        },

        async list({ table, query }) {
            const t = getTable(table)
            let results = Object.values(t)

            if (query) {
                const { $limit, $skip, $sort, ...filters } = query

                if (Object.keys(filters).length > 0) {
                    results = results.filter(item =>
                        Object.entries(filters).every(([key, value]) => {
                            const itemValue = item[key]
                            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                                return Object.entries(value).every(([op, opValue]) => {
                                    switch (op) {
                                        case '$ne': return itemValue !== opValue
                                        case '$in': return Array.isArray(opValue) && opValue.includes(itemValue)
                                        case '$nin': return Array.isArray(opValue) && !opValue.includes(itemValue)
                                        case '$lt': return itemValue < (opValue as number)
                                        case '$lte': return itemValue <= (opValue as number)
                                        case '$gt': return itemValue > (opValue as number)
                                        case '$gte': return itemValue >= (opValue as number)
                                        default: return true
                                    }
                                })
                            }
                            return itemValue === value
                        })
                    )
                }

                if ($sort) {
                    const sortKey = Object.keys($sort)[0]
                    const direction = ($sort as any)[sortKey]
                    results.sort((a, b) => {
                        if (a[sortKey] < b[sortKey]) return direction === -1 ? 1 : -1
                        if (a[sortKey] > b[sortKey]) return direction === -1 ? -1 : 1
                        return 0
                    })
                }

                if ($skip) results = results.slice($skip)
                if ($limit) results = results.slice(0, $limit)
            }

            return results
        }
    }
}
