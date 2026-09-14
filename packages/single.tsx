import React from 'react'

import { z } from 'zod'

import { useState, useCallback, useEffect, createContext, useContext, useMemo } from 'react'

import { useTable } from './table'
import { TableSchema } from './interface'

export function useSingleProvider<TSchema extends TableSchema>({
    id, table, schema,
}: {
    id: string
    table: string
    schema: TSchema
}) {
    const { find, index } = useTable(table, schema)
    const [loading, setLoading] = useState<boolean>(false)
    const [single, setSingle] = useState<z.infer<TSchema['readable']>>(() => index[id])
    const fetch = useCallback(() => {
        if (loading)
            return
        setLoading(true)
        find.trigger({ id })
            .then(setSingle)
            .finally(() => setLoading(false))
    }, [loading])
    useEffect(() => {
        if (!single)
            fetch()
    }, []) // Never pass callbacks to array dependencies
    useEffect(() => {
        setSingle(index[id])
    }, [index[id]])
    return {
        id,
        table,
        single,
        setSingle,
        fetch,
        loading,
    }
}
const SingleRegistryContext = createContext<Record<string, ReturnType<typeof useSingleProvider<any>>> | undefined>(undefined)

export function SingleProvider<TSchema extends TableSchema>({
    children, ...props
}: {
    id: string
    table: string
    schema: TSchema
    children: React.ReactNode | ((props: ReturnType<typeof useSingleProvider<TSchema>>) => React.ReactNode)
    nullIfNotFound?: boolean
}) {
    const value = useSingleProvider<TSchema>(props)
    const registry = useContext(SingleRegistryContext) ?? {}

    const newRegistry = useMemo(() => {
        return { ...registry, [props.table]: value }
    }, [registry, props.table, value])

    if (props.nullIfNotFound && !value.single) return null
    return (
        <SingleRegistryContext.Provider value={newRegistry}>
            {typeof children === 'function' ? (
                children(value)
            ) : (
                children
            )}
        </SingleRegistryContext.Provider>
    )
}

export function useSingle<TSchema extends TableSchema>(schema: TSchema, table: string) {
    const registry = useContext(SingleRegistryContext)
    if (!registry || !registry[table]) throw new Error(`useSingle('${table}') must be used within a SingleProvider for that table.`)
    return registry[table] as ReturnType<typeof useSingleProvider<TSchema>>
}
