'use client'
import z from 'zod'
import { ListProps, TableInterface, TableSchema } from './interface'
import { createContextFromHook, useAction as useAsyncAction, useIndex } from './hooks'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ActionProvider, useAction, useActionProvider } from './action'
import { FieldsProvider, useFields } from './fields'

export function useDatabaseProvider() {

    const [interfaces, setInterfaces] = useState<Record<string, ReturnType<typeof useTableProvider<any>>>>({})

    return {
        interfaces,
        setInterfaces,
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

const TableContext = createContext<ReturnType<typeof useTableProvider<any>> | undefined>(undefined)

export function TableProvider<TSchema extends TableSchema>({ children, ...props }: React.PropsWithChildren<TableProviderProps<TSchema>>) {

    const context = useTableProvider(props)

    return (
        <TableContext.Provider value={context}>
            {children}
        </TableContext.Provider>
    )
}

export function TableConsumer<TSchema extends TableSchema>({ children }: { children: React.ReactNode | ((props: ReturnType<typeof useTableProvider<TSchema>>) => React.ReactNode) }) {
    const context = useContext(TableContext)
    if (!context) throw new Error('TableConsumer must be used within a TableProvider.')
    return (
        <>
            {typeof children === 'function' ? children(context) : children}
        </>
    )
}

export function useTable<TSchema extends TableSchema>(table: string, schema: TSchema) {
    return useContext(TableContext) as ReturnType<typeof useTableProvider<TSchema>>
}

export function CreateForm<TSchema extends TableSchema>({ table, schema, defaults, onSuccess, children }: {
    table: string
    schema: TSchema
    defaults?: Partial<z.infer<TSchema['writable']>>
    onSuccess?: (result: z.infer<TSchema['readable']>) => void
    children: React.ReactNode | (
        (props: ReturnType<typeof useActionProvider<z.infer<TSchema['writable']>, z.infer<TSchema['readable']>>>
            & ReturnType<typeof useFields<z.infer<TSchema['writable']>>>
        ) => React.ReactNode
    )
}) {
    type Readable = z.infer<TSchema['readable']>
    type Writable = z.infer<TSchema['writable']>

    const { create } = useTable<TSchema>(table, schema)

    const callback = useCallback(
        async (fields: Writable) => {
            const result = await create.trigger({ data: fields })
            if (onSuccess) onSuccess(result as Readable)
            return result
        },
        [create, onSuccess]
    )

    return (
        <FieldsProvider<Writable> defaults={defaults || ({} as Writable)}>
            {fields => (
                <ActionProvider<Writable, Readable> action={callback} params={fields.fields}>
                    {typeof children === 'function' ? (
                        form => children({ ...form, ...fields })
                    ) : (
                        children
                    )}
                </ActionProvider>
            )}
        </FieldsProvider>
    )
}

export function UpdateForm<TSchema extends TableSchema>({
    schema,
    table,
    id,
    defaults,
    onSuccess,
    children,
}: {
    schema: TSchema
    table: string
    id: string
    defaults?: Partial<z.infer<TSchema['writable']>>
    onSuccess?: (result: z.infer<TSchema['readable']>) => void
    children: React.ReactNode | (
        (props: ReturnType<typeof useActionProvider<Partial<z.infer<TSchema['writable']>>, z.infer<TSchema['readable']>>>
            & ReturnType<typeof useFields<z.infer<TSchema['writable']>>>
        ) => React.ReactNode
    )
}) {
    type Readable = z.infer<TSchema['readable']>
    type Writable = z.infer<TSchema['writable']>

    const { update } = useTable<TSchema>(table, schema)

    const callback = useCallback(
        async (fields: Partial<Writable>) => {
            const result = await update.trigger({ id, data: fields })
            if (onSuccess) onSuccess(result as Readable)
            return result
        },
        [update, id, onSuccess]
    )

    return (
        <FieldsProvider<Writable>
            defaults={defaults || ({} as Partial<Writable>)}
        >
            {fields => (
                <ActionProvider<Partial<Writable>, Readable> action={callback} params={fields.fields}>
                    {typeof children === 'function' ? (
                        form => children({ ...form, ...fields })
                    ) : (
                        children
                    )}
                </ActionProvider>
            )}
        </FieldsProvider>
    )
}

export function FilterForm<TSchema extends TableSchema>({
    schema,
    table,
    defaults,
    onSuccess,
    children,
}: {
    schema: TSchema
    table: string
    defaults?: Partial<ListProps<z.infer<TSchema['readable']>>>
    onSuccess?: (result: z.infer<TSchema['readable']>[]) => void
    children: React.ReactNode | (
        (props: ReturnType<typeof useActionProvider<ListProps<z.infer<TSchema['readable']>>, z.infer<TSchema['readable']>[]>>
            & ReturnType<typeof useFields<ListProps<z.infer<TSchema['readable']>>>>
        ) => React.ReactNode
    )
}) {
    type Readable = z.infer<TSchema['readable']>

    const { list } = useTable<TSchema>(table, schema)

    const callback = useCallback(
        async (fields: Omit<ListProps<Readable>, 'table'>) => {
            const result = await list.trigger(fields)
            if (onSuccess) onSuccess(result)
            return result
        },
        [list, onSuccess]
    )

    return (
        <FieldsProvider<ListProps<Readable>>
            defaults={(defaults || { query: {} }) as ListProps<Readable>}
        >
            {fields => (
                <ActionProvider<ListProps<Readable>, Readable[]> action={callback} params={fields.fields}>
                    {typeof children === 'function' ? (
                        form => children({ ...form, ...fields })
                    ) : (
                        children
                    )}
                </ActionProvider>
            )}
        </FieldsProvider>
    )
}

export function useCreateForm<TSchema extends TableSchema>(schema: TSchema) {
    return {
        ...useFields<z.infer<TSchema['writable']>>(),
        ...useAction<
            z.infer<TSchema['writable']>,
            z.infer<TSchema['readable']>
        >()
    }
}

export function useUpdateForm<TSchema extends TableSchema>(schema: TSchema) {
    return {
        ...useFields<Partial<z.infer<TSchema['writable']>>>(),
        ...useAction<
            Partial<z.infer<TSchema['writable']>>,
            z.infer<TSchema['readable']>
        >()
    }
}

export function useFiltersForm<TSchema extends TableSchema>(schema: TSchema) {
    return {
        ...useFields<z.infer<TSchema['readable']>>(),
        ...useAction<z.infer<TSchema['readable']>,
            z.infer<TSchema['readable']>[]
        >()
    }
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
        single,
        setSingle,
        loading: find.loading,
    }
}

export const SingleContext = createContext<
    ReturnType<typeof useSingleProvider> | undefined
>(undefined)

export function SingleProvider<TSchema extends TableSchema>({
    children,
    ...props
}: {
    id: string
    table: string
    schema: TSchema
    children: React.ReactNode | ((props: ReturnType<typeof useSingleProvider<TSchema>>) => React.ReactNode)
}) {
    const value = useSingleProvider<TSchema>(props)
    if (!value.single) return null
    return (
        // @ts-expect-error
        <SingleContext.Provider value={value}>
            {typeof children === 'function' ? (
                children(value)
            ) : (
                children
            )}
        </SingleContext.Provider>
    )
}

export function useSingle<TSchema extends TableSchema>() {
    // @ts-expect-error
    return useContext(SingleContext) as ReturnType<typeof useSingleProvider<TSchema>>
}
