import z from 'zod'
import { DatabaseSchema, ListProps, TableInterface, TableSchema } from './interface'
import { createContextFromHook, useAction as useAsyncAction, useIndex } from './hooks'
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react'
import { ActionProvider, useAction, useActionProvider } from './action'
import { FieldsProvider, useFields } from './fields'

export function useDatabaseProvider() {

    const [database, setDatabase] = useState<Record<string, ReturnType<typeof useInterface<any>>>>({})

    return {
        database,
        setDatabase,
    }
}

export const [DatabaseProvider, useDatabase] = createContextFromHook(useDatabaseProvider)

export function useDatabaseTable<TSchema extends TableSchema>(table: string) {
    const { database } = useDatabase()

    const tableMethods = database[table] as ReturnType<typeof useInterface<TSchema>> | undefined

    if (!tableMethods)
        throw new Error(`Table "${table}" is not defined in the database schema.`)

    return tableMethods
}

export type TableProviderProps<TSchema extends TableSchema> = {
    table: string
    schema: TSchema
    interface: TableInterface<z.infer<TSchema['readable']>, z.infer<TSchema['writable']>>
    asAbove?: Record<string, z.infer<TSchema['readable']>>
}

export function useInterface<TSchema extends TableSchema>(table: string, {
    find, create, update, remove, list
}: TableInterface<z.infer<TSchema['readable']>, z.infer<TSchema['writable']>>, index: ReturnType<typeof useIndex<z.infer<TSchema['readable']>>>) {
    return {
        index,
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

export function useTableProvider<TSchema extends TableSchema>({
    table,
    schema,
    interface: tableInterface,
    asAbove,
}: TableProviderProps<TSchema>) {

    type Readable = z.infer<TSchema['readable']>

    const index = useIndex<Readable>({ ...(asAbove ?? {}) })

    useEffect(function soBelow() {
        index.setIndex((prev) => ({ ...prev, ...asAbove }))
    }, [])

    return useInterface<TSchema>(table, tableInterface, index)
}

export const [TableContextProvider, useTableContext] = createContextFromHook(useTableProvider<any>)

export function TableProvider<TSchema extends TableSchema>({ children, ...props }: PropsWithChildren<TableProviderProps<TSchema>>) {
    return <TableContextProvider {...props}>{children}</TableContextProvider>
}

export function useTable<TSchema extends TableSchema>() {
    return useTableContext() as ReturnType<typeof useTableProvider<TSchema>>
}

export function CreateForm<TSchema extends TableSchema>({ table, defaults, onSuccess, children }: {
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

    const { create } = useDatabaseTable<TSchema>(table)

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

    const { update } = useDatabaseTable<TSchema>(table)

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

    const { list } = useDatabaseTable<TSchema>(table)

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

export function useFiltersForm <TSchema extends TableSchema>(schema: TSchema) {
    return {
        ...useFields<z.infer<TSchema['readable']>>(),
        ...useAction<z.infer<TSchema['readable']>,
            z.infer<TSchema['readable']>[]
        >()
    }
}

export function useSingleProvider<T>({
    id,
    table,
}: {
    id: string
    table: string
}) {
    const { index, find } = useDatabaseTable(table)
    const [single, setSingle] = useState<T>(
        // @ts-expect-error
        () => index[id as keyof typeof index]
    )
    useEffect(() => {
        // @ts-expect-error
        if (!single) find.trigger({ id }).then(setSingle)
    }, [])
    useEffect(() => {
        // @ts-expect-error
        setSingle(index[id as keyof typeof index])
    }, [index[id as keyof typeof index]])
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

export function SingleProvider<T>({
    children,
    ...props
}: {
    id: string
    table: string
    children: React.ReactNode | ((props: ReturnType<typeof useSingleProvider>) => React.ReactNode)
}) {
    const value = useSingleProvider(props)
    if (!value.single) return null
    return (
        <SingleContext.Provider value={value}>
            {typeof children === 'function' ? (
                children(value)
            ) : (
                children
            )}
        </SingleContext.Provider>
    )
}

export function useSingle<T>() {
    return useContext(SingleContext) as ReturnType<typeof useSingleProvider<T>>
}
