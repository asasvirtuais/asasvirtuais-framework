import { z } from 'zod'
import React, { useEffect, createContext, useContext, useMemo } from 'react'
import { useIndex, useAction as useAsyncAction } from './hooks'
import { TableSchema, TableInterface } from './interface'
import { useInterface } from './provider'

export type TableProviderProps<TSchema extends TableSchema> = {
    table: string
    schema: TSchema
    asAbove?: Record<string, z.infer<TSchema['readable']>>
}

export function useTableProvider<TSchema extends TableSchema>({
    table, schema, asAbove,
}: TableProviderProps<TSchema>) {
    const { find, list, create, update, remove } = useInterface()

    type Readable = z.infer<TSchema['readable']>

    const index = useIndex<Readable>({ ...(asAbove ?? {}) })

    useEffect(function soBelow() {
        index.setIndex((prev) => ({ ...prev, ...asAbove }))
    }, [asAbove])

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

const Context = createContext<Record<string, ReturnType<typeof useTableProvider<any>>> | undefined>(undefined)

export function TablesProvider({ children, tables }: { children: React.ReactNode, tables: Record<string, TableSchema> }) {

    const context: Record<string, ReturnType<typeof useTableProvider<any>>> = {}


    for (const [table, schema] of Object.entries(tables)) {
        context[table] = useTableProvider({
            table: table,
            schema: schema,
        })
    }

    return <Context.Provider value={context}>{children}</Context.Provider>
}

export function useTable<TSchema extends TableSchema>(table: string, schema: TSchema) {
    const context = useContext(Context)
    if (!context)
        throw new Error('useTable must be used within a TablesProvider')
    const tableContext = context[table]
    if (!tableContext)
        throw new Error(`Table ${table} is not provided in TablesProvider`)
    return tableContext
}
