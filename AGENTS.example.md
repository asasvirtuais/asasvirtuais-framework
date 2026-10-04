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
├── db.ts                 # the raw database interface (Prisma, Firestore...)
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
    ├── hooks.tsx         # use{Model}s(), use{Model}()
    └── middleware.ts     # the table's authorization and side effects, written last
lib/                      # small shared files, only once code repeats
```

In a larger app the database access is a package of its own. Here it's `app/db.ts` for simplicity.

## Building an app

1. **Data modeling, by feature.** Each feature's tables become packages, starting with `packages/{model}/schema.ts`.
2. **UI layout and routing.** Routes, layouts and page skeletons, with the `TablesProvider` each one needs.
3. **Business logic.** The forms get assembled: `CreateForm`, `UpdateForm`, nested and multi-step `Form`s, and the
   component actions they call.
4. **Workflow validation.** With the UI settled and the features clear, the workflows are checked end to end, long-running
   ones included, and each table gets its [middleware](#table-middleware).

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

`app/actions.ts` exposes the database to the forms. Until the [table middleware](#table-middleware) is written, it
passes straight to the raw interface in `app/db.ts`:

```ts
// app/actions.ts
'use server'
import { action } from '@/lib/action'
import { db } from './db'

export const find = action(db.find)
export const list = action(db.list)
export const create = action(db.create)
export const update = action(db.update)
export const remove = action(db.remove)
```

Each method receives the `table` it was called for. The row it returns is what lands in the index.

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
the first table's middleware, in the same transaction. A client could skip a second request or be interrupted
halfway. Views of the other table refetch with `list.trigger(...)` in `onSuccess`.

---

## Table middleware

Business rules are read by domain, so each table keeps its own in `packages/{model}/middleware.ts`. The middleware
wraps the raw database interface with `makeSchemaTableInterface`, passing the table instead of `null`:

```ts
// packages/todos/middleware.ts
import { makeSchemaTableInterface } from 'asasvirtuais/interface'
import { db } from '@/app/db'
import { schema } from './schema'

export const todos = makeSchemaTableInterface({ todos: schema }, 'todos', {
  find: (props) => db.find(props),
  list: (props) => db.list(props),
  create: async (props) => {
    // pre-flight: authorization
    const result = await db.create(props)
    // side effects
    return result
  },
  update: async (props) => {
    // pre-flight: authorization
    const result = await db.update(props)
    // side effects
    return result
  },
  remove: async (props) => {
    // pre-flight: authorization
    const result = await db.remove(props)
    // side effects
    return result
  },
})!
```

`app/actions.ts` then only switches on the table and calls its middleware:

```ts
// app/actions.ts
'use server'
import type { FindProps, ListProps, CreateProps, UpdateProps, RemoveProps } from 'asasvirtuais/interface'
import { action } from '@/lib/action'
import { todos } from '@/packages/todos/middleware'
import { tags } from '@/packages/tags/middleware'

function middleware(table?: string) {
  switch (table) {
    case 'todos': return todos
    case 'tags': return tags
    default: throw new Error(`Unknown table: ${table}`)
  }
}

export const find = action(async (props: FindProps) => middleware(props.table).find(props))
export const list = action(async (props: ListProps) => middleware(props.table).list(props))
export const create = action(async (props: CreateProps) => middleware(props.table).create(props))
export const update = action(async (props: UpdateProps) => middleware(props.table).update(props))
export const remove = action(async (props: RemoveProps) => middleware(props.table).remove(props))
```

Pre-flight is for authorization rules only. An LLM call is never a pre-flight step: it gets its own action, and its
result goes through a form like any other data. Keeping business logic out of the CRUD keeps each one readable.

The middleware is the last part of an app to be written. During prototyping these rules change with every iteration of
the UI, so they wait until the UI is settled and the features are clear (stage 4 of
[Building an app](#building-an-app)). Until then, `app/actions.ts` passes straight to `app/db.ts`.

---

## Prototyping

Demos and prototypes start on the framework, with `asasvirtuais-dexie` (IndexedDB) as the interface instead of
`useState` or mock arrays:

```tsx
<InterfaceProvider {...dexieInterface(schema)}>{children}</InterfaceProvider>
```

Going to production means passing the CRUD file's actions instead. The UI stays the same.

---

# Rules

1. **Read records from their provider.** Inside `{Model}Provider`, components use `use{Model}()`. They don't receive
   the record, or its fields, as props.
2. **Use the framework forms for database operations**, including single-column updates. A flag, a status or a name is
   an `UpdateForm` with one field, not a custom server action. The reactive index updates the UI, so there's no need
   for `useState` copies of rows, manual `set` calls, or revalidation.
3. **Writes go through the CRUD.** Their authorization and side effects live in each table's `middleware.ts`. Each
   extra server action that writes is another way into the database, with its own copy of the checks or none.
4. **Other server actions do one thing.** LLM calls, previews, external APIs and server-side reads live in the
   `actions.tsx` of the component that uses them, one call per action. When their result should be saved, it goes into
   a form.
5. **Fail fast, return errors.** Throw `new Error('Unauthorized')` / `new Error('Forbidden')`, and call `notFound()`
   for missing records. Every server action is wrapped with `action(...)`, client components call `unwrap(actions)`,
   and server code calling another action uses `ok(await name(...))`.
6. **Pages are declarative.** `page.tsx` stays a Server Component made of markup and focused components. The client
   components inside it fetch their own data with `Filter{Model}s autoTrigger` or `list.trigger()`. Each layout
   mounts a `TablesProvider` with only the tables its routes use. Shared providers and shells are hoisted to the
   closest common `layout.tsx`.
7. **Component directories.** A page keeps its components in `components/` next to `page.tsx`, one lowercase directory
   per component, with only the files it needs:
   - `component.tsx`: `'use client'`, the UI.
   - `actions.tsx`: `'use server'`, the server actions it calls.
   - `index.tsx`: a server component. It's usually the high-level version of the component, fetching on the server and
     rendering `component.tsx`, and often goes inside `Suspense`. It is never a barrel file: import each file from its
     own path.
   - `cache.tsx`: `'use cache'`. Receives the params the cache depends on (e.g. from the URL) and renders `index.tsx`
     with them, so caching is decided here rather than in the fetching layer.
   - `context.tsx`, `hooks.tsx`: shared context and local state, when needed.

   Code used only by a component stays in its directory. A component shared by several pages lives with their closest
   common route.
8. **Packages are atomic.** `packages/{model}/` holds the schema, fields, forms, components, providers and hooks of
   one table. Page composition lives in `app/`.
9. **`lib/` only for repeated code.** A library is a small single file that appears once the same code repeats across
   several actions.
10. **Trust the schema.** Access guaranteed fields directly. Declare optional fields in the schema and give them
    standard UI defaults.
11. **Plain names and text.** Contextual variable names. Simple UI text: "Create {Object}", "Update {Object}", "Delete
    {Object}", "Search", "Cancel".

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
