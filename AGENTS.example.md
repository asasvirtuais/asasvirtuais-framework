# AGENTS.md

> Copy to the root of an asasvirtuais app as `AGENTS.md`.

---

# Thinking: How the LLM model should proceed about any and all tasks.

1. Grounded: Name and define what entities are currently at disposal based on the given context.
2. Ruly: Clearly state what happens and where to go next.
3. Consistent: Do not contradict existing/consolidated patterns, do not come-up with exceptions or patches.
4. Careful: Given uncertainty do not try to solve it immediately, carefully aim to resolve the most ambiguity with the fewest moves.
5. Clear: Output what you're doing as you go explicitly stating the desired outcome, and if the statement contradicts the established patterns/goals do not push through the broken plan, return to step 1 and re-ground.
6. Ask: Always ask the user about UI layouts and UI decisions (screens, routes, what is shown where, navigation, placement of controls) that were not explicitly given. Do not come up with what you think is smart.

---

# asasvirtuais

Database operations go through one CRUD interface. Their results land in a reactive index, and every view of a table
follows it. Most of an app is forms on top of tables.

## Structure

```
app/
├── schema.ts             # all table schemas
├── actions.ts            # 'use server' — the CRUD interface
├── providers.tsx         # InterfaceProvider
└── [route]/
    ├── layout.tsx        # TablesProvider with the tables this route uses
    ├── page.tsx
    └── components/       # this page's components, one directory each
packages/
└── [model]/
    ├── schema.ts         # readable / writable
    ├── fields.tsx        # inputs hooked to useFields()
    ├── forms.tsx         # Create{Model}, Update{Model}, Filter{Model}s
    ├── components.tsx    # {Model}Item, Single{Model}
    ├── providers.tsx     # {Model}Provider
    └── hooks.tsx         # use{Model}s(), use{Model}()
lib/                      # small shared files, only once code repeats
```

---

## Form

`Form` holds fields and an async action. The render prop gets `fields`, `setField`, `setFields`, `submit`,
`callback(params)`, `loading`, `result`, `error` and `errors`. `onResult` runs with the result.

Name the render prop after what the form represents. Nested forms then share one closure, each with its own state,
and an inner form can fill the outer one:

```tsx
<Form defaults={{ item: '', address: '' }} action={placeOrder} onResult={order => router.push(`/orders/${order.id}`)}>
  {order => (
    <form onSubmit={order.submit}>
      <input value={order.fields.item} onChange={e => order.setField('item', e.target.value)} />

      <Form defaults={{ zip: '' }} action={lookupZip} onResult={a => order.setField('address', a.street)}>
        {zip => (
          <div>
            <input value={zip.fields.zip} onChange={e => zip.setField('zip', e.target.value)} />
            <button type='button' onClick={zip.submit} disabled={zip.loading}>Fill address</button>
          </div>
        )}
      </Form>

      <button type='submit' disabled={order.loading}>Place order</button>
      {order.error && <p>{order.error.message}</p>}
    </form>
  )}
</Form>
```

---

## CRUD

### Schema

```ts
// packages/todos/schema.ts
export const readable = z.object({ id: z.string(), title: z.string(), done: z.boolean(), author: z.string() })
export const writable = readable.pick({ title: true, done: true })
export const schema = { readable, writable }
```

```ts
// app/schema.ts
export const schema = { todos, tags }
```

### The CRUD file

`app/actions.ts` is the backend. Pre-flight work (authentication, authorization, validation, default values) goes
before the database call. Side effects (emails, webhooks, records that must follow this one) go after it. Each method
receives the `table` it was called for.

```ts
// app/actions.ts
'use server'
import { makeSchemaTableInterface } from 'asasvirtuais/interface'
import { action } from '@/lib/action'
import { schema } from './schema'

const crud = makeSchemaTableInterface(schema, null, {
  find: async (props) => db.find(props),
  list: async (props) => db.list(props),
  create: async (props) => {
    // pre-flight
    const result = await db.create(props)
    // side effects
    return result
  },
  update: async (props) => {
    // pre-flight
    const result = await db.update(props)
    // side effects
    return result
  },
  remove: async (props) => {
    // pre-flight
    const result = await db.remove(props)
    // side effects
    return result
  },
})!

export const find = action(crud.find)
export const list = action(crud.list)
export const create = action(crud.create)
export const update = action(crud.update)
export const remove = action(crud.remove)
```

The row a handler returns is what lands in the index.

### Errors

Production hides the message of an error a server action throws. Server actions catch it and return
`{ error: message }`, and the client throws it again so the forms can show it.

```ts
// lib/action.ts
import { unstable_rethrow } from 'next/navigation'

type Failure = { error: string }

export function action<A extends any[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R | Failure> => {
    try { return await fn(...args) }
    catch (error) { unstable_rethrow(error); return { error: (error as Error).message } }
  }
}

export function ok<R>(result: R | Failure): R {
  if (result && typeof result === 'object' && 'error' in result) throw new Error(result.error)
  return result as R
}

export function unwrap<T extends Record<string, (...args: any[]) => Promise<any>>>(actions: T) {
  return Object.fromEntries(
    Object.entries(actions).map(([name, fn]) => [name, async (...args: any[]) => ok(await fn(...args))])
  ) as { [K in keyof T]: (...args: Parameters<T[K]>) => Promise<Exclude<Awaited<ReturnType<T[K]>>, Failure>> }
}
```

### Providers and hooks

```tsx
// app/providers.tsx
'use client'
import * as actions from './actions'
const crud = unwrap(actions)

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <InterfaceProvider {...crud}>{children}</InterfaceProvider>
}
```

```tsx
// app/[route]/layout.tsx
export default function Layout({ children }: { children: React.ReactNode }) {
  return <TablesProvider tables={{ todos, tags }}>{children}</TablesProvider>
}
```

```tsx
// packages/todos/hooks.tsx + providers.tsx
export const useTodos = () => useTable('todos', schema)
export const useTodo = () => useSingle(schema, 'todos')

export function TodoProvider({ id, children }: { id: string, children: React.ReactNode }) {
  return <SingleProvider id={id} table='todos' schema={schema}>{children}</SingleProvider>
}
```

`SingleProvider` fetches the record if it isn't in the index yet. Components under it read it with `useTodo()`.

### Forms

```tsx
// packages/todos/forms.tsx
export function CreateTodo() {
  return (
    <CreateForm table='todos' schema={schema} defaults={{ title: '', done: false }}>
      {todo => (
        <form onSubmit={todo.submit}>
          <TitleField />
          <button type='submit' disabled={todo.loading}>Create todo</button>
        </form>
      )}
    </CreateForm>
  )
}

export function UpdateTodo() {
  const { single } = useTodo()
  return (
    <UpdateForm table='todos' schema={schema} id={single.id} defaults={{ title: single.title }}>
      {todo => (
        <form onSubmit={todo.submit}>
          <TitleField />
          <button type='submit' disabled={todo.loading}>Update todo</button>
        </form>
      )}
    </UpdateForm>
  )
}

// one column, one click
export function ToggleTodo() {
  const { single } = useTodo()
  return (
    <UpdateForm table='todos' schema={schema} id={single.id}>
      {toggle => (
        <input type='checkbox' checked={single.done} disabled={toggle.loading}
          onChange={() => toggle.callback({ done: !single.done })} />
      )}
    </UpdateForm>
  )
}

export function DeleteTodo() {
  const { single } = useTodo()
  const { remove } = useTodos()
  return (
    <ActionProvider action={remove.trigger} params={{ id: single.id }}>
      {del => <button onClick={del.submit} disabled={del.loading}>Delete todo</button>}
    </ActionProvider>
  )
}
```

`UpdateForm` sends only the fields in its state (`defaults` plus what `setField` changed).

### Listing

`useTable().list.trigger(...)` fills the table's index, and `array` follows every operation. `FilterForm` keeps its
`result` local (search, pagination). Wrap each item in its `SingleProvider` so it stays in sync:

```tsx
<FilterForm table='todos' schema={schema} autoTrigger defaults={{ query: { done: false } }}>
  {todos => todos.result?.map(t => <TodoProvider key={t.id} id={t.id}><TodoItem /></TodoProvider>)}
</FilterForm>
```

`query` supports field matches, `$ne $lt $lte $gt $gte $in $nin $or $and`, and `$limit $skip $sort $select`.

---

## Several operations

If the user triggers each operation, they are steps. Each one is its own form, and the result of one (`onSuccess`,
`onResult`, `await form.callback(...)`) opens the next.

If one operation has to follow another automatically (an order records a payment), the second one is a side effect in
the first one's CRUD handler, in the same transaction. A client could skip a second request or be interrupted
halfway. Views of the other table refetch with `list.trigger(...)` in `onSuccess`.

---

# Rules

1. **Read records from their provider.** Inside `{Model}Provider`, components use `use{Model}()`. They don't receive
   the record, or its fields, as props.
2. **Use the framework forms for database operations**, including single-column updates. A flag, a status or a name is
   an `UpdateForm` with one field, not a custom server action. The reactive index updates the UI, so there's no need
   for `useState` copies of rows, manual `set` calls, or revalidation.
3. **Writes go through the CRUD.** Their checks and side effects live in `app/actions.ts`. Each extra server action that
   writes is another way into the database, with its own copy of the checks or none.
4. **Other server actions do one thing.** LLM calls, previews, external APIs and server-side reads live in the
   `actions.tsx` of the component that uses them. When their result should be saved, it goes into a form.
5. **Fail fast, return errors.** Throw `new Error('Unauthorized')` / `new Error('Forbidden')`, and call `notFound()`
   for missing records. Every server action is wrapped with `action(...)`, client components call `unwrap(actions)`,
   and server code calling another action uses `ok(await name(...))`.
6. **Pages are declarative.** `page.tsx` stays a Server Component made of markup and focused components. Data comes from
   `Filter{Model}s autoTrigger` or `list.trigger()`. Each layout mounts a `TablesProvider` with only the tables its
   routes use. Shared providers and shells are hoisted to the closest common `layout.tsx`.
7. **Component directories.** A page keeps its components in `components/` next to `page.tsx`, one lowercase directory
   per component, with only the files it needs: `component.tsx` (`'use client'`), and when needed `actions.tsx`
   (`'use server'`), `index.tsx` (server-side fetching), `context.tsx` or `hooks.tsx`. Code used only by a component
   stays in its directory. A component shared by several pages lives with their closest common route.
8. **Packages are atomic.** `packages/{model}/` holds the schema, fields, forms, components, providers and hooks of
   one table. Page composition lives in `app/`.
9. **`lib/` only for repeated code.** A library is a small single file that appears once the same code repeats across
   several actions. Don't add layers of wrappers.
10. **Trust the schema.** Access guaranteed fields directly. Declare optional fields in the schema and give them
    standard UI defaults.
11. **Plain names and text.** Contextual variable names. Simple UI text: "Create {Object}", "Update {Object}", "Delete
    {Object}", "Search", "Cancel".
12. **Prototype on the framework.** Demos start with `asasvirtuais-dexie` as the interface instead of `useState` or mock
    arrays. Going to production means replacing it with the CRUD file.

---

## Reference

| Import | Exports |
|---|---|
| `asasvirtuais/form` | `Form`, `useForm` |
| `asasvirtuais/fields` | `FieldsProvider`, `useFields`, `useField` |
| `asasvirtuais/action` | `ActionProvider`, `useAction` |
| `asasvirtuais/forms` | `CreateForm`, `UpdateForm`, `FilterForm` |
| `asasvirtuais/context` | `InterfaceProvider`, `TablesProvider`, `useTable(table, schema)` |
| `asasvirtuais/registry` | `SingleProvider`, `useSingle(schema, table)` |
| `asasvirtuais/interface` | `makeSchemaTableInterface` |

| Concept | Pattern | Example |
|---|---|---|
| Table | lowercase plural | `'todos'` |
| Fields | `{Field}Field` | `TitleField` |
| Hooks | `use{Model}s()`, `use{Model}()` | `useTodos()`, `useTodo()` |
| Providers | `{Model}Provider` | `TodoProvider` |
| Forms | `Create{Model}`, `Update{Model}`, `Filter{Model}s`, `Delete{Model}` | `UpdateTodo` |
| One-click update | `{Verb}{Model}` | `ToggleTodo` |
| Components | `{Model}Item`, `Single{Model}` | `TodoItem` |
