'use client'
import { z } from 'zod'
import React, { useState, useCallback, useEffect, createContext, useContext, useMemo } from 'react'

import { TableSchema } from './interface'
import { useTable, useTableProvider, TableProviderProps, TablesContext } from './context'

export function TableProvider<TSchema extends TableSchema>({ children, ...props }: React.PropsWithChildren<TableProviderProps<TSchema>>) {

    const context = useTableProvider(props)
    const tables = useContext(TablesContext) ?? {}

    const value = useMemo(() => {
        return { ...tables, [props.table]: context }
    }, [tables, props.table, context])

    return (
        <TablesContext.Provider value={value}>
            {children}
        </TablesContext.Provider>
    )
}

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
    }, [loading, id])
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

const SingleRegistry = createContext<Record<string, ReturnType<typeof useSingleProvider<any>>> | undefined>(undefined)

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
    const registry = useContext(SingleRegistry) ?? {}

    const newRegistry = useMemo(() => {
        return { ...registry, [props.table]: value }
    }, [registry, props.table, value])

    if (props.nullIfNotFound && !value.single) return null
    return (
        <SingleRegistry.Provider value={newRegistry}>
            {typeof children === 'function' ? (
                children(value)
            ) : (
                children
            )}
        </SingleRegistry.Provider>
    )
}

export function useSingle<TSchema extends TableSchema>(schema: TSchema, table: string) {
    const registry = useContext(SingleRegistry)
    if (!registry || !registry[table])
        throw new Error(`useSingle('${table}') must be used within a SingleProvider for that table.`)
    return registry[table] as ReturnType<typeof useSingleProvider<TSchema>>
}
