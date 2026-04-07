'use client'
import z from 'zod'
import { TableInterface, TableSchema } from './interface'
import { createContextFromHook, useAction as useAsyncAction, useIndex } from './hooks'
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export function useInterfaceProvider(tableInterface: TableInterface<any, any>) {
    return tableInterface
}

export const [InterfaceProvider, useInterface] = createContextFromHook(useInterfaceProvider)

export function useDatabaseProvider() {

    const [tables, setTables] = useState<Record<string, ReturnType<typeof useTableProvider<any>>>>({})

    return {
        tables,
        setTables,
    }
}

export const [DatabaseProvider, useDatabase] = createContextFromHook(useDatabaseProvider)

export type TableProviderProps<TSchema extends TableSchema> = {
    table: string
    schema: TSchema
    interface: TableInterface<z.infer<TSchema['readable']>, z.infer<TSchema['writable']>>
    asAbove?: Record<string, z.infer<TSchema['readable']>>
}

export function useTableProvider<TSchema extends TableSchema>({
    table,
    schema,
    interface: { find, list, create, update, remove },
    asAbove,
}: TableProviderProps<TSchema>) {

    type Readable = z.infer<TSchema['readable']>

    const index = useIndex<Readable>({ ...(asAbove ?? {}) })

    useEffect(function soBelow() {
        index.setIndex((prev) => ({ ...prev, ...asAbove }))
    }, [])

    return {
        ...index,
        find: useAsyncAction(((props) => find({ ...props, table }).then(res => {
            index.set(res)
            return res
        })) as typeof find),
        create: useAsyncAction(((props) => create({ ...props, table }).then(res => {
            index.set(res)
            return res
        })) as typeof create),
        update: useAsyncAction(((props) => update({ ...props, table }).then(res => {
            index.set(res)
            return res
        })) as typeof update),
        remove: useAsyncAction(((props) => remove({ ...props, table }).then(res => {
            index.unset(res)
            return res
        })) as typeof remove),
        list: useAsyncAction(((props) => list({ ...props, table }).then(arr => {
            index.set(...arr)
            return arr
        })) as typeof list),
    }
}

const TableRegistryContext = createContext<Record<string, ReturnType<typeof useTableProvider<any>>> | undefined>(undefined)

export function TableProvider<TSchema extends TableSchema>({ children, ...props }: React.PropsWithChildren<TableProviderProps<TSchema>>) {

    const context = useTableProvider(props)
    const registry = useContext(TableRegistryContext) ?? {}

    const newRegistry = useMemo(() => {
        return { ...registry, [props.table]: context }
    }, [registry, props.table, context])

    return (
        <TableRegistryContext.Provider value={newRegistry}>
            {children}
        </TableRegistryContext.Provider>
    )
}

export function TableConsumer<TSchema extends TableSchema>({ children }: { children: React.ReactNode | ((props: ReturnType<typeof useTableProvider<TSchema>>) => React.ReactNode) }) {

    const registry = useContext(TableRegistryContext)

    if (!registry || Object.keys(registry).length === 0) throw new Error('TableConsumer must be used within a TableProvider.')

    const context = Object.values(registry)[0]

    return (
        <>
            {typeof children === 'function' ? children(context) : children}
        </>
    )
}

export function useTable<TSchema extends TableSchema>(table: string, schema: TSchema) {
    const registry = useContext(TableRegistryContext)
    if (!registry || !registry[table]) throw new Error(`useTable("${table}") must be used within a TableProvider for that table.`)
    return registry[table] as ReturnType<typeof useTableProvider<TSchema>>
}

export function useSingleProvider<TSchema extends TableSchema>({
    id,
    table,
    schema,
}: {
    id: string
    table: string
    schema: TSchema
}) {
    const { find, index } = useTable(table, schema)
    const [single, setSingle] = useState<z.infer<TSchema['readable']>>(
        () => index[id]
    )
    useEffect(() => {
        if (!single) find.trigger({ id }).then(setSingle)
    }, [])
    useEffect(() => {
        setSingle(index[id])
    }, [index[id]])
    return {
        id,
        table,
        single,
        setSingle,
        loading: find.loading,
    }
}

const SingleRegistryContext = createContext<Record<string, ReturnType<typeof useSingleProvider<any>>> | undefined>(undefined)

export function SingleProvider<TSchema extends TableSchema>({
    children,
    ...props
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
    if (!registry || !registry[table]) throw new Error(`useSingle("${table}") must be used within a SingleProvider for that table.`)
    return registry[table] as ReturnType<typeof useSingleProvider<TSchema>>
}
