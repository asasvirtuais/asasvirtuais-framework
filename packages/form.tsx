import z from 'zod'
import React, { useCallback } from 'react'
import { FieldsProvider, FieldsProps, useFieldsProvider, useFields } from './fields'
import { ActionProvider, ActionProps, useActionProvider, useAction } from './action'
import { TableSchema, ListProps } from './interface'
import { useTable } from './providers'

export type FormProps<Fields, Result> = FieldsProps<Fields> & Omit<ActionProps<Fields, Result>, 'params'> & {
    children?: React.ReactNode | ((props: ReturnType<typeof useFieldsProvider<Fields>> & ReturnType<typeof useActionProvider<Fields, Result>>) => React.ReactNode)
}

export function Form<Fields, Result>({children, ...params}: FormProps<Fields, Result>) {

    return (
        <FieldsProvider<Fields> defaults={params.defaults}>
            {fields => (
                <ActionProvider<Fields, Result> params={fields.fields} action={params.action} autoTrigger={params.autoTrigger} onError={params.onError}>
                    {form => (
                        typeof children === 'function' ? children({...fields, ...form}) : children
                    )}
                </ActionProvider>
            )}
        </FieldsProvider>
    )
}

export function useForm<Fields, Result>() {
    return {
        ...useFields<Fields>(),
        ...useAction<Fields, Result>()
    }
}

export function CreateForm<TSchema extends TableSchema>({ table, schema, defaults, onSuccess, children }: {
    table: string
    schema: TSchema
    defaults?: Partial<z.infer<TSchema['writable']>>
    onSuccess?: (result: z.infer<TSchema['readable']>) => void
    children: React.ReactNode | ((props: ReturnType<typeof useActionProvider<z.infer<TSchema['writable']>, z.infer<TSchema['readable']>>> &
        ReturnType<typeof useFields<z.infer<TSchema['writable']>>>
    ) => React.ReactNode)
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
    schema, table, id, defaults, onSuccess, children,
}: {
    schema: TSchema
    table: string
    id: string
    defaults?: Partial<z.infer<TSchema['writable']>>
    onSuccess?: (result: z.infer<TSchema['readable']>) => void
    children: React.ReactNode | ((props: ReturnType<typeof useActionProvider<Partial<z.infer<TSchema['writable']>>, z.infer<TSchema['readable']>>> &
        ReturnType<typeof useFields<z.infer<TSchema['writable']>>>
    ) => React.ReactNode)
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
    schema, table, defaults, autoTrigger, onSuccess, children,
}: {
    schema: TSchema
    table: string
    defaults?: Partial<ListProps<z.infer<TSchema['readable']>>>
    autoTrigger?: boolean
    onSuccess?: (result: z.infer<TSchema['readable']>[]) => void
    children: React.ReactNode | ((props: ReturnType<typeof useActionProvider<ListProps<z.infer<TSchema['readable']>>, z.infer<TSchema['readable']>[]>> &
        ReturnType<typeof useFields<ListProps<z.infer<TSchema['readable']>>>>
    ) => React.ReactNode)
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
                <ActionProvider<ListProps<Readable>, Readable[]> action={callback} params={fields.fields} autoTrigger={autoTrigger}>
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

export function useFilterForm<TSchema extends TableSchema>(schema: TSchema) {
    return {
        ...useFields<z.infer<TSchema['readable']>>(),
        ...useAction<z.infer<TSchema['readable']>,
            z.infer<TSchema['readable']>[]
        >()
    }
}
