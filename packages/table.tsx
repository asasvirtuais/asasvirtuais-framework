import { z } from 'zod'
import React, { useEffect, createContext, useContext, useMemo } from 'react'
import { useIndex, useAction as useAsyncAction } from './hooks'
import { TableSchema, TableInterface } from './interface'

export type TableProviderProps<TSchema extends TableSchema> = {
    table: string
    schema: TSchema
    interface: TableInterface<z.infer<TSchema['readable']>, z.infer<TSchema['writable']>>
    asAbove?: Record<string, z.infer<TSchema['readable']>>
}

export function useTableProvider<TSchema extends TableSchema>({
    table, schema, interface: { find, list, create, update, remove }, asAbove,
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

const Registry = createContext<Record<string, ReturnType<typeof useTableProvider<any>>> | undefined>(undefined)

export function TableProvider<TSchema extends TableSchema>({ children, ...props }: React.PropsWithChildren<TableProviderProps<TSchema>>) {

    const context = useTableProvider(props)
    const registry = useContext(Registry) ?? {}

    const newRegistry = useMemo(() => {
        return { ...registry, [props.table]: context }
    }, [registry, props.table, context])

    return (
        <Registry.Provider value={newRegistry}>
            {children}
        </Registry.Provider>
    )
}

export function useTable<TSchema extends TableSchema>(table: string, schema: TSchema) {
    const registry = useContext(Registry)
    if (!registry || !registry[table]) throw new Error(`useTable('${table}') must be used within a TableProvider for that table.`)
    return registry[table] as ReturnType<typeof useTableProvider<TSchema>>
}
