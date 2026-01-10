import { z } from 'zod'
import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  createContext,
  useContext,
} from 'react'

import { useAction as useAsyncAction, useIndex } from './hooks'
import { ActionProvider, useAction, useActionProvider } from './action'
import { TableInterface, ListProps, DatabaseSchema } from './interface'
import { FieldsProvider, useFields } from './fields'

export function reactInterface<
  Database extends DatabaseSchema>(
  database: Database,
  {
    find,
    create,
    update,
    remove,
    list,
  }: TableInterface<
    z.infer<Database[keyof Database]['readable']>,
    z.infer<Database[keyof Database]['writable']>
  >
) {
  type TableKey = keyof Database & string

  type TableProviderProps<Table extends TableKey> = {
    table: Table
    asAbove?: Record<string, z.infer<Database[Table]["readable"]>>
  }

  function useTableProvider<Table extends TableKey>({
    table,
    asAbove,
  }: TableProviderProps<Table>) {
    type Readable = z.infer<Database[Table]['readable']>
    type Writable = z.infer<Database[Table]['writable']>

    const index = useIndex<Readable>({ ...(asAbove ?? {}) })

    const array = useMemo(
      () => Object.values(index.index) as Readable[],
      [index.index]
    )

    useEffect(function soBelow() {
      index.setIndex((prev) => ({ ...prev, ...asAbove }))
    }, [])

    const methods = { find, create, update, remove, list } as TableInterface<
      Readable,
      Writable
    >

    return {
      ...index,
      array,
      find: useAsyncAction(((props) => methods.find({ ...props, table }).then(res => {
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
  // Create a separate context for each table dynamically
  const tableContexts = new Map<TableKey, React.Context<ReturnType<typeof useTableProvider<any>> | undefined>>();

  function getTableContext<T extends TableKey>(table: T) {
    if (!tableContexts.has(table)) {
      tableContexts.set(table, createContext<ReturnType<typeof useTableProvider<T>> | undefined>(undefined));
    }
    return tableContexts.get(table)!;
  }

  function TableProvider<Table extends TableKey>({ children, ...props }: TableProviderProps<Table> & {
    children: React.ReactNode | ((props: ReturnType<typeof useTableProvider<Table>>) => React.ReactNode)
  }) {
    const context = useTableProvider(props);
    const TableContext = getTableContext(props.table);

    return (
      <TableContext.Provider value={context}>
        {typeof children === 'function' ? children(context) : children}
      </TableContext.Provider>
    )
  }

  function DatabaseProvider({
    children,
    ...tables
  }: React.PropsWithChildren<{
    [T in TableKey]?: Record<string, z.infer<Database[T]['readable']>>
  }>) {
    return Object.entries(tables).reduce(
      (prev, [table, asAbove]) => {
        return (
          <TableProvider table={table as TableKey} asAbove={asAbove}>
            {prev}
          </TableProvider>
        );
      },
      children as React.ReactNode
    )
  }

  function useTable<T extends TableKey>(name: T) {
    const TableContext = getTableContext(name);
    const context = useContext(TableContext);

    if (!context) {
      throw new Error(`useTable("${String(name)}") must be used within a TableProvider or DatabaseProvider with table="${String(name)}"`);
    }

    return context as ReturnType<typeof useTableProvider<T>>;
  }

  function useSingleProvider<Table extends TableKey>({
    id,
    table,
  }: {
    id: string
    table: Table
  }) {
    const { index, find } = useTable(table)
    const [single, setSingle] = useState<z.infer<Database[Table]['readable']>>(
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

  const SingleContext = createContext<
    ReturnType<typeof useSingleProvider<any>> | undefined
  >(undefined)

  function SingleProvider<Table extends TableKey>({
    children,
    ...props
  }: {
    id: string
    table: Table
    children: React.ReactNode | ((props: ReturnType<typeof useSingleProvider<Table>>) => React.ReactNode)
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

  const useSingle = <Table extends TableKey>(table: Table) =>
    useContext(SingleContext) as ReturnType<typeof useSingleProvider<Table>>

  function CreateForm<
    T extends TableKey
  >({
    table,
    defaults,
    onSuccess,
    children,
  }: {
    table: T
    defaults?: Partial<z.infer<Database[T]['writable']>>
    onSuccess?: (result: z.infer<Database[T]['readable']>) => void
    children: React.ReactNode | (
      ( props: ReturnType<typeof useActionProvider<z.infer<Database[T]['writable']>, z.infer<Database[T]['readable']>>>
        & ReturnType<typeof useFields<z.infer<Database[T]['writable']>>>
      ) => React.ReactNode
    )
  }) {
    type Readable = z.infer<Database[T]['readable']>
    type Writable = z.infer<Database[T]['writable']>

    const { create } = useTable(table)

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

  function UpdateForm<T extends TableKey>({
    table,
    id,
    defaults,
    onSuccess,
    children,
  }: {
    table: T
    id: string
    defaults?: Partial<z.infer<Database[T]['writable']>>
    onSuccess?: (result: z.infer<Database[T]['readable']>) => void
    children: React.ReactNode | (
      (props: ReturnType<typeof useActionProvider<Partial<z.infer<Database[T]['writable']>>, z.infer<Database[T]['readable']>>>
        & ReturnType<typeof useFields<z.infer<Database[T]['writable']>>>
      ) => React.ReactNode
    )
  }) {
    type Readable = z.infer<Database[T]['readable']>
    type Writable = z.infer<Database[T]['writable']>

    const { update } = useTable(table)

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

  function FilterForm<T extends TableKey>({
    table,
    defaults,
    onSuccess,
    children,
  }: {
    table: T
    defaults?: Partial<ListProps<z.infer<Database[T]['readable']>>>
    onSuccess?: (result: z.infer<Database[T]['readable']>[]) => void
    children: React.ReactNode | (
      ( props: ReturnType<typeof useActionProvider<ListProps<z.infer<Database[T]['readable']>>, z.infer<Database[T]['readable']>[]>>
        & ReturnType<typeof useFields<ListProps<z.infer<Database[T]['readable']>>>>
      ) => React.ReactNode
    )
  }) {
    type Readable = z.infer<Database[T]['readable']>
    type Writable = z.infer<Database[T]['writable']>

    const { list } = useTable(table)

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

  const useCreateForm = <T extends TableKey>(table: T) => {
    return {
      ...useFields<z.infer<Database[T]['writable']>>(),
      ...useAction<
        z.infer<Database[T]['writable']>,
        z.infer<Database[T]['readable']>
      >(),
    }
  }
  const useUpdateForm = <T extends TableKey>(table: T) => {
    return {
      ...useFields<Partial<z.infer<Database[T]['writable']>>>(),
      ...useAction<
        Partial<z.infer<Database[T]['writable']>>,
        z.infer<Database[T]['readable']>
      >(),
    }
  }
  const useFiltersForm = <T extends TableKey>(table: T) => {
    return {
      ...useFields<z.infer<Database[T]['readable']>>(),
      ...useAction<z.infer<Database[T]['readable']>,
        z.infer<Database[T]['readable']>[]
      >(),
    }
  }

  return {
    DatabaseProvider,
    useTable,
    useTableProvider,
    TableProvider,
    SingleProvider,
    useSingle,
    CreateForm,
    UpdateForm,
    FilterForm,
    useCreateForm,
    useUpdateForm,
    useFiltersForm,
  }
}

export class ReactInterface<Database extends DatabaseSchema> {
  constructor(
    database: Database,
    tableInterface: TableInterface<
        z.infer<Database[keyof Database]['readable']>,
        z.infer<Database[keyof Database]['writable']>
    >
  ) {
    return reactInterface(database, tableInterface)
  }
}
