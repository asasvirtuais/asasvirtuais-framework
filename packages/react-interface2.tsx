import z from 'zod'
import { DatabaseSchema, TableInterface, TableSchema } from './interface'
import { createContextFromHook, useAction, useIndex } from './hooks'
import { PropsWithChildren, useEffect } from 'react'

export function useDatabaseProvider() {

}

export function DatabaseProvider<Schema extends DatabaseSchema>() {

}

type TableProviderProps<TSchema extends TableSchema> = {
    table: string
    interface: TableInterface<z.infer<TSchema['readable']>, z.infer<TSchema['writable']>>
    asAbove?: Record<string, z.infer<TSchema['readable']>>
}

function useTableProvider<TSchema extends TableSchema>({
    table,
    interface: { find, create, update, remove, list },
    asAbove,
}: TableProviderProps<TSchema>) {

    type Readable = z.infer<TableSchema['readable']>

    const index = useIndex<Readable>({ ...(asAbove ?? {}) })

    useEffect(function soBelow() {
        index.setIndex((prev) => ({ ...prev, ...asAbove }))
    }, [])

    return {
        find: useAction(((props) => find({ ...props, table }).then(res => {
            index.set(res)
            return res
        })) as typeof find),
        create: useAction(((props) => create({ ...props, table }).then(res => {
            index.set(res)
            return res
        })) as typeof create),
        update: useAction(((props) => update({ ...props, table }).then(res => {
            index.set(res)
            return res
        })) as typeof update),
        remove: useAction(((props) => remove({ ...props, table }).then(res => {
            index.unset(res)
            return res
        })) as typeof remove),
        list: useAction(((props) => list({ ...props, table }).then(arr => {
            index.set(...arr)
            return arr
        })) as typeof list),
        ...index,
    }
}

const [TableContextProvider, useTableContext] = createContextFromHook(useTableProvider<any>)

export function TableProvider<TSchema extends TableSchema>({children, ...props}: PropsWithChildren<TableProviderProps<TSchema>>) {
    return <TableContextProvider {...props}>{children}</TableContextProvider>
}

export function useTable<TSchema extends TableSchema>() {
    return useTableContext() as ReturnType<typeof useTableProvider<TSchema>>
}

export function UpdateForm<TSchema extends TableSchema>(props: TableProviderProps<TSchema>) {
}
