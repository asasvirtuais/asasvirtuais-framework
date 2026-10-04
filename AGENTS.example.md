# AGENTS.md

> Starting point for an app built on asasvirtuais. Copy it to the app root as `AGENTS.md` and fill in **Project** at
> the end.

---

## How to work

1. **Grounded.** Name the tables, schemas and forms that already exist for the task before changing anything.
2. **Ruly.** Say what will happen and where the code goes.
3. **Consistent.** Follow the existing patterns. Don't add exceptions or patches.
4. **Careful.** When something is uncertain, don't rush to solve it. Aim to clear up the most ambiguity with the fewest
   moves.
5. **Clear.** Say what you're doing as you go and what outcome you expect. If that contradicts the patterns here,
   don't push the broken plan through. Go back to step 1.
6. **Ask.** Ask about UI decisions that weren't given: screens, routes, what's shown where, navigation, and where
   controls go.

---

## Principles

### The index already holds the state

When `CreateForm`, `UpdateForm` or `remove` resolves, the returned row goes into the table's index, and everything
reading that table re-renders. Keeping rows in `useState`, calling `table.set`, or revalidating adds a second copy of
state that can drift from the first. If a view doesn't update after an operation, it's probably not reading from the
index (a `TablesProvider` or `SingleProvider` is missing), and that's the thing to fix.

### Database access lives in one file

`app/actions.ts` is where the app reads and writes its database. Every extra server action that writes is another
entry point, with its own copy of the permission check, or with the check missing. With checks in the CRUD handlers,
they're written once and apply to every form that touches the table, and the file doubles as a readable list of what
the app allows.

### Forms come first

A feature is usually a form on a table. `UpdateForm` covers edits of any size, down to a single column: a flag, a
status, a name. Single-column edits are where it saves the most code, and also where it gets skipped most often in
favour of a custom server action that rebuilds the same thing without the index or the central checks.

### Forms compose

`Form` nests. An inner form can run its own async step (a lookup, a validation, an AI draft) and write its result into
the outer form's fields. Naming each render prop after what it represents (`order`, `zip`, `draft`) keeps both forms
readable in one closure. Multi-step flows are built this way rather than with one large action.

### Server code that doesn't touch the database is just a function

LLM calls, previews and lookups can be plain async functions run through `Form` or `ActionProvider`. When their result
should be saved, it goes into a `CreateForm` or `UpdateForm`.

---

## Orchestrating several operations

When a feature touches more than one table, the deciding question is: **does the user trigger each operation, or does
one have to follow another automatically?**

**The user triggers each one.** These are steps. Each step is its own form and its own operation, with its rule in the
CRUD file. The result of one step (`onSuccess`, `onResult`, or `await form.callback(...)`) opens the next.

**One has to follow automatically.** Placing an order records a payment, for example. Chaining that on the client
would let a client skip the second request, leave half the work done if the tab closes, and let two requests pass the
same check at once. The order's `create` handler records the payment itself, inside the same transaction.

The CRUD call returns only the row it was asked for (the order). Views that show the other table (payments) refetch it
with `list.trigger(...)` in the form's `onSuccess`.

---

## Project layout

```
app/
├── schema.ts          # all table schemas
├── actions.ts         # 'use server' — the CRUD interface
├── providers.tsx      # InterfaceProvider
└── [feature]/
    ├── schema.ts      # readable / writable
    ├── hooks.tsx      # use{Model}s(), use{Model}()
    ├── providers.tsx  # {Model}Provider
    ├── fields.tsx     # {Field}Field
    ├── forms.tsx      # Create{Model}, Update{Model}, Delete{Model}, Filter{Model}s
    ├── components.tsx # {Model}Item, Single{Model}
    └── page.tsx
```

---

## Schema

```ts
// app/todos/schema.ts
import z from 'zod'

export const readable = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  author: z.string(),
})
export const writable = readable.pick({ title: true, done: true })   // server-filled fields stay out

export const schema = { readable, writable }
export type Readable = z.infer<typeof readable>
export type Writable = z.infer<typeof writable>
```

```ts
// app/schema.ts
import { schema as todos } from './todos/schema'
import { schema as orders } from './orders/schema'
import { schema as payments } from './payments/schema'

export const schema = { todos, orders, payments }
```

---

## The CRUD file

The handlers stay generic. What differs per table goes in two maps: `allowed` (who may do what) and `after` (what
follows an operation automatically).

```ts
// app/actions.ts
'use server'
import { makeSchemaTableInterface } from 'asasvirtuais/interface'
import { schema } from './schema'
import { db } from './db'
import { currentUser } from './auth'

type Operation = 'create' | 'update' | 'remove'

// Who may do what. An operation without an entry isn't allowed.
const allowed: Record<string, Partial<Record<Operation, (ctx: any) => boolean | Promise<boolean>>>> = {
  todos: {
    create: ({ user }) => !!user,
    update: ({ user, current }) => current.author === user.id,
    remove: ({ user, current }) => current.author === user.id,
  },
  orders: {
    create: ({ user }) => !!user,
  },
}

// What follows automatically, in the same transaction.
const after: Record<string, Partial<Record<Operation, (ctx: any) => Promise<void>>>> = {
  orders: {
    create: async ({ tx, row }) => {
      await tx.create({ table: 'payments', data: { order: row.id, amount: row.total } })
    },
  },
}

async function check(op: Operation, table: string, ctx: any) {
  const rule = allowed[table]?.[op]
  if (!rule || !(await rule(ctx))) throw new Error(`Not allowed: ${op} ${table}`)
}

export const { find, list, create, update, remove } = makeSchemaTableInterface(schema, null, {
  find: async (props) => db.find(props),
  list: async (props) => db.list(props),

  create: async ({ table, data }) => db.transaction(async (tx) => {
    const user = await currentUser()
    await check('create', table!, { user, data, tx })
    const row = await tx.create({ table, data: { ...data, author: user.id } })
    await after[table!]?.create?.({ user, row, tx })
    return row
  }),

  update: async ({ table, id, data }) => db.transaction(async (tx) => {
    const user = await currentUser()
    const current = await tx.find({ table, id })
    await check('update', table!, { user, data, current, tx })
    const row = await tx.update({ table, id, data })
    await after[table!]?.update?.({ user, row, current, tx })
    return row
  }),

  remove: async ({ table, id }) => db.transaction(async (tx) => {
    const user = await currentUser()
    const current = await tx.find({ table, id })
    await check('remove', table!, { user, current, tx })
    const row = await tx.remove({ table, id })
    await after[table!]?.remove?.({ user, row, current, tx })
    return row
  }),
})!
```

`allowed` gets the new `data` as well as the `current` row, so rules can depend on which fields change. A check that
counts rows ("fewer than ten open orders") runs inside the transaction, so it can't be passed twice at once.

The row returned by a handler is what lands in the index. When the server changes what was sent (filling in `author`,
normalising a status), the client sees the stored version.

---

## Providers and hooks

```tsx
// app/providers.tsx
'use client'
import { InterfaceProvider } from 'asasvirtuais/context'
import * as actions from './actions'

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <InterfaceProvider {...actions}>{children}</InterfaceProvider>
}
```

```tsx
// app/todos/layout.tsx — each route mounts the tables it uses
'use client'
import { TablesProvider } from 'asasvirtuais/context'
import { schema } from './schema'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <TablesProvider tables={{ todos: schema }}>{children}</TablesProvider>
}
```

```tsx
// app/todos/hooks.tsx
'use client'
import { useTable } from 'asasvirtuais/context'
import { useSingle } from 'asasvirtuais/registry'
import { schema } from './schema'

export const useTodos = () => useTable('todos', schema)
export const useTodo = () => useSingle(schema, 'todos')
```

```tsx
// app/todos/providers.tsx
'use client'
import { SingleProvider } from 'asasvirtuais/registry'
import { schema } from './schema'

export function TodoProvider({ id, children }: { id: string, children: React.ReactNode }) {
  return <SingleProvider id={id} table='todos' schema={schema}>{children}</SingleProvider>
}
```

`SingleProvider` fetches the record if it isn't in the index yet. Components under it read the record with
`useTodo()` instead of receiving it as a prop. Providers for different tables can be nested.

---

## Forms

```tsx
// app/todos/forms.tsx
'use client'
import { CreateForm, UpdateForm, FilterForm } from 'asasvirtuais/forms'
import { ActionProvider } from 'asasvirtuais/action'
import { schema } from './schema'
import { useTodos, useTodo } from './hooks'
import { TitleField } from './fields'
```

### Create

```tsx
export function CreateTodo() {
  return (
    <CreateForm table='todos' schema={schema} defaults={{ title: '', done: false }}>
      {todo => (
        <form onSubmit={todo.submit}>
          <TitleField />
          <button type='submit' disabled={todo.loading}>Create</button>
          {todo.error && <p>{todo.error.message}</p>}
        </form>
      )}
    </CreateForm>
  )
}
```

### Update

`UpdateForm` sends the fields in its state: `defaults` plus whatever `setField` changed.

```tsx
export function UpdateTodo() {
  const { single } = useTodo()
  return (
    <UpdateForm table='todos' schema={schema} id={single.id} defaults={{ title: single.title }}>
      {todo => (
        <form onSubmit={todo.submit}>
          <TitleField />
          <button type='submit' disabled={todo.loading}>Save</button>
        </form>
      )}
    </UpdateForm>
  )
}
```

For a one-click change, `callback` takes the data directly:

```tsx
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
```

The checkbox reads `single.done` from the index, so it follows the stored value once the update resolves.

### Remove

```tsx
export function DeleteTodo({ onSuccess }: { onSuccess?: () => void }) {
  const { single } = useTodo()
  const { remove } = useTodos()
  return (
    <ActionProvider action={remove.trigger} params={{ id: single.id }} onResult={onSuccess}>
      {del => <button onClick={del.submit} disabled={del.loading}>Delete</button>}
    </ActionProvider>
  )
}
```

### Filter

```tsx
<FilterForm table='todos' schema={schema} autoTrigger defaults={{ query: { done: false } }}>
  {todos => todos.result?.map(t => (
    <TodoProvider key={t.id} id={t.id}><TodoItem /></TodoProvider>
  ))}
</FilterForm>
```

A `FilterForm`'s `result` belongs to that form. A list that other operations add to should read
`useTodos().array` after `list.trigger(...)`.

### Selecting a record from another table

A field component can host a `FilterForm` and write into the surrounding form through `useFields`:

```tsx
export function TagField() {
  const { fields, setField } = useFields<{ tag: string }>()
  return (
    <FilterForm table='tags' schema={tagsSchema} autoTrigger>
      {tags => tags.result?.map(tag => (
        <button key={tag.id} type='button' onClick={() => setField('tag', tag.id)}
          aria-pressed={fields.tag === tag.id}>{tag.name}</button>
      ))}
    </FilterForm>
  )
}
```

---

## Multi-step forms

Steps inside one screen chain through results:

```tsx
<CreateForm table='orders' schema={orders} defaults={{ item: '', total: 0 }}>
  {order => order.result ? (
    <CreateForm table='reviews' schema={reviews} defaults={{ order: order.result.id, text: '' }}>
      {review => (
        <form onSubmit={review.submit}>
          <ReviewTextField />
          <button type='submit' disabled={review.loading}>Send review</button>
        </form>
      )}
    </CreateForm>
  ) : (
    <form onSubmit={order.submit}>
      <ItemField />
      <button type='submit' disabled={order.loading}>Place order</button>
    </form>
  )}
</CreateForm>
```

A draft followed by a save is also two steps:

```tsx
<CreateForm table='posts' schema={posts} defaults={{ title: '', body: '' }}>
  {post => (
    <form onSubmit={post.submit}>
      <Form defaults={{ topic: '' }} action={draftPost} onResult={draft => post.setFields(f => ({ ...f, ...draft }))}>
        {draft => <button type='button' onClick={draft.submit} disabled={draft.loading}>Draft with AI</button>}
      </Form>
      <TitleField />
      <BodyField />
      <button type='submit' disabled={post.loading}>Publish</button>
    </form>
  )}
</CreateForm>
```

When the operation has an automatic follow-up, the form only makes the first one and refreshes what else is shown:

```tsx
<CreateForm table='orders' schema={orders} defaults={{ item, total }}
  onSuccess={order => payments.list.trigger({ query: { order: order.id } })}>
  {order => <button onClick={order.submit} disabled={order.loading}>Buy</button>}
</CreateForm>
```

---

## Common detours

| Tempting | Instead |
|---|---|
| A `'use server'` function that updates one field | `UpdateForm` with `callback({ field: value })` |
| A server action that writes several tables the user triggers one by one | One form per step |
| Two client requests where the second must always happen | An `after` entry in the CRUD file |
| `table.set(...)` with rows a server action returned | An operation through the CRUD interface; refetch other tables with `list.trigger` |
| `useState(props.todo)` | `useTodo()` inside a `TodoProvider` |
| `revalidatePath` / `router.refresh()` after saving | Nothing, since the index updates |
| A permission check inside a component's action | An `allowed` entry |
| `form.callback(form.fields).then(...)` | `onResult` / `onSuccess` |

---

## API

| Import | Exports |
|---|---|
| `asasvirtuais/form` | `Form` (`defaults`, `action`, `onResult`, `onError`, `autoTrigger`), `useForm` |
| `asasvirtuais/fields` | `FieldsProvider`, `useFields`, `useField` |
| `asasvirtuais/action` | `ActionProvider` (`params`, `action`, `onResult`, `onError`, `autoTrigger`), `useAction` |
| `asasvirtuais/forms` | `CreateForm`, `UpdateForm` (`id`), `FilterForm` (`autoTrigger`); all take `table`, `schema`, `defaults`, `onSuccess` |
| `asasvirtuais/context` | `InterfaceProvider`, `TablesProvider`, `useTable(table, schema)` |
| `asasvirtuais/registry` | `SingleProvider` (`id`, `table`, `schema`, `nullIfNotFound`), `useSingle(schema, table)` |
| `asasvirtuais/interface` | `makeSchemaTableInterface`, `TableInterface`, `Query`, `TableSchema` |

Form render props: `fields`, `setField`, `setFields`, `submit`, `callback(params)`, `loading`, `result`, `error`,
`errors`.

`useTable` returns `index`, `array`, and `find` / `list` / `create` / `update` / `remove`, each as
`{ trigger, loading, result }`.

`Query`: field matches, `$ne $lt $lte $gt $gte $in $nin $or $and`, `$limit $skip $sort $select`.

### Naming

| Concept | Pattern | Example |
|---|---|---|
| Table | lowercase plural | `'todos'` |
| Field component | `{Field}Field` | `TitleField` |
| Hooks | `use{Model}s()`, `use{Model}()` | `useTodos()`, `useTodo()` |
| Forms | `Create{Model}`, `Update{Model}`, `Delete{Model}` | `UpdateTodo` |
| One-click update | `{Verb}{Model}` | `ToggleTodo` |
| Components | `{Model}Item`, `Single{Model}` | `TodoItem` |

---

## Prototyping

Demos start on the framework, not on mock arrays. Without a backend, `asasvirtuais-dexie` stores tables in IndexedDB:

```tsx
'use client'
import { dexieInterface } from 'asasvirtuais-dexie'
import { InterfaceProvider } from 'asasvirtuais/context'
import { schema } from './schema'

const db = dexieInterface(schema)

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <InterfaceProvider {...db}>{children}</InterfaceProvider>
}
```

Moving to production means passing `app/actions.ts` to `InterfaceProvider` instead.

---

## Project

<!-- Per app. For example: -->

- **Workflow:** <!-- how changes are tested and deployed -->
- **Database adapter:** <!-- -->
- **Auth:** <!-- where `currentUser()` comes from -->
- **Tables:** <!-- one line each -->
- **Legacy code:** <!-- older server actions that shouldn't be copied as examples -->
