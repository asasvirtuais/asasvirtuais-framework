# asasvirtuais

A React framework made of architectural decisions, so you (or your LLM) can skip making them and go straight to the
feature.

Most stacks leave the same questions open for every feature: where the state lives, how a form reaches the server, how
lists refresh after a save, where the permission check goes. An LLM answers them again each time, and writes the
boilerplate that comes with each answer. asasvirtuais answers them once. A feature becomes a form on top of a table,
and code gets written several times faster.

---

## What it looks like

Marking a todo as done, in a typical Next.js app:

```tsx
// actions.ts
'use server'
export async function setTodoDone(id: string, done: boolean) {
  const user = await currentUser()
  const todo = await db.todos.find(id)
  if (todo.author !== user.id) throw new Error('Forbidden')
  await db.todos.update(id, { done })
  revalidatePath('/todos')
}

// component
const [done, setDone] = useState(todo.done)
const [pending, startTransition] = useTransition()

<input type='checkbox' checked={done} disabled={pending} onChange={() => {
  setDone(!done)
  startTransition(() => setTodoDone(todo.id, !done))
}} />
```

That gets repeated for every field of every table, and each copy carries its own permission check.

With asasvirtuais:

```tsx
<UpdateForm table='todos' schema={schema} id={todo.id}>
  {form => (
    <input type='checkbox' checked={todo.done} disabled={form.loading}
      onChange={() => form.callback({ done: !todo.done })} />
  )}
</UpdateForm>
```

The permission check lives once, in the `todos` middleware. When the update resolves, every view of that todo updates.

---

## Why it's faster

- **No manual state.** Operations return rows into a reactive index, and every list and detail view of that table
  follows. You don't need `useState` copies, `revalidatePath`, or refetching.
- **Forms do the work.** `Form` pairs fields with an async action, and nests into multi-step flows. `CreateForm`,
  `UpdateForm` and `FilterForm` do the same against your tables.
- **Business rules by table.** All database writes go through one CRUD interface, and each table's authorization
  lives in its own middleware instead of being repeated in every action.
- **One obvious way.** With fewer choices to make, an LLM writes the same structure every time and you review less.

---

## Install

```sh
pnpm add asasvirtuais zod
```

Building with a coding agent? Start your `AGENTS.md` from the guide that ships with the package:

```sh
cp node_modules/asasvirtuais/AGENTS.example.md AGENTS.md
```

---

## Form

`Form` holds a set of fields and an async action. The render prop gets both.

```tsx
import { Form } from 'asasvirtuais/form'

<Form defaults={{ email: '', password: '' }} action={login} onResult={() => router.push('/')}>
  {login => (
    <form onSubmit={login.submit}>
      <input value={login.fields.email} onChange={e => login.setField('email', e.target.value)} />
      <input type='password' value={login.fields.password} onChange={e => login.setField('password', e.target.value)} />
      <button disabled={login.loading}>Log in</button>
      {login.error && <p>{login.error.message}</p>}
    </form>
  )}
</Form>
```

Render props: `fields`, `setField`, `setFields`, `submit`, `callback(params)`, `loading`, `result`, `error`, `errors`.

`FieldsProvider` (`asasvirtuais/fields`) and `ActionProvider` (`asasvirtuais/action`) are the two halves of `Form`.
You can use either one on its own.

### Nested and multi-step forms

Naming the render prop after what the form represents (`order`, `zip`) lets nested forms share one closure. The inner
form can run its own async step and write the result into the outer one:

```tsx
<Form defaults={{ item: '', address: '' }} action={placeOrder} onResult={order => router.push(`/orders/${order.id}`)}>
  {order => (
    <form onSubmit={order.submit}>
      <input value={order.fields.item} onChange={e => order.setField('item', e.target.value)} />

      <Form defaults={{ zip: '' }} action={lookupZip} onResult={a => order.setField('address', `${a.street}, ${a.city}`)}>
        {zip => (
          <div>
            <input value={zip.fields.zip} onChange={e => zip.setField('zip', e.target.value)} />
            <button type='button' onClick={zip.submit} disabled={zip.loading}>
              {zip.loading ? 'Looking up…' : 'Fill address'}
            </button>
          </div>
        )}
      </Form>

      {order.fields.address && <p>Shipping to {order.fields.address}</p>}
      <button type='submit' disabled={order.loading}>Place order</button>
    </form>
  )}
</Form>
```

`order.loading` and `zip.loading` are independent. You can add steps the same way: validation, AI drafts, address
lookups, or anything that feeds a field before the outer form submits.

---

## CRUD

### Schema

Each table has a `readable` schema (what the database returns) and a `writable` schema (what a user may send).

```ts
// packages/todos/schema.ts
import z from 'zod'

export const readable = z.object({ id: z.string(), title: z.string(), done: z.boolean(), author: z.string() })
export const writable = readable.pick({ title: true, done: true })
export const schema = { readable, writable }
```

```ts
// app/schema.ts
import { schema as todos } from '@/packages/todos/schema'
export const schema = { todos }
```

### The CRUD file

Five server actions make up the whole backend. They pass straight to your database until the
[table middleware](#table-middleware) is written.

```ts
// app/actions.ts
'use server'
import { db } from './db'      // the raw interface over your database: Prisma, Firestore...

export const { find, list, create, update, remove } = db
```

Each method receives `table` along with its props: `{ id }`, `{ query }`, `{ data }` or `{ id, data }`.

Next.js hides the message of an error a server action throws in production, so server actions return
`{ error: message }` instead, and the client throws it again for the forms to display.
[`AGENTS.example.md`](./AGENTS.example.md#errors) has the small wrapper that does both.

### Providers

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
// app/todos/layout.tsx: each route mounts the tables it uses
'use client'
import { TablesProvider } from 'asasvirtuais/context'
import { schema } from '@/packages/todos/schema'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <TablesProvider tables={{ todos: schema }}>{children}</TablesProvider>
}
```

### Forms and records

```tsx
'use client'
import { CreateForm, UpdateForm, FilterForm } from 'asasvirtuais/forms'
import { SingleProvider, useSingle } from 'asasvirtuais/registry'
import { schema } from '@/packages/todos/schema'

export default function TodosPage() {
  return (
    <>
      <CreateForm table='todos' schema={schema} defaults={{ title: '', done: false }}>
        {todo => (
          <form onSubmit={todo.submit}>
            <input value={todo.fields.title} onChange={e => todo.setField('title', e.target.value)} />
            <button disabled={todo.loading}>Add</button>
          </form>
        )}
      </CreateForm>

      <FilterForm table='todos' schema={schema} autoTrigger>
        {todos => todos.result?.map(t => (
          <SingleProvider key={t.id} id={t.id} table='todos' schema={schema}>
            <TodoItem />
          </SingleProvider>
        ))}
      </FilterForm>
    </>
  )
}

function TodoItem() {
  const { single: todo } = useSingle(schema, 'todos')
  return (
    <UpdateForm table='todos' schema={schema} id={todo.id}>
      {form => (
        <label>
          <input type='checkbox' checked={todo.done} onChange={() => form.callback({ done: !todo.done })} />
          {todo.title}
        </label>
      )}
    </UpdateForm>
  )
}
```

`SingleProvider` fetches the record if it isn't in the index yet, and any descendant can read it with `useSingle`.
For deletion, `useTable('todos', schema).remove.trigger({ id })` works on its own or wrapped in an `ActionProvider`.

`list` queries are FeathersJS-style: field matches, `$ne $lt $lte $gt $gte $in $nin $or $and`, and
`$limit $skip $sort $select`.

---

## Orchestrating operations

Some features touch several tables. Two patterns cover them:

- **Steps the user takes.** Each step is its own form, and one step's result (`onSuccess`, `onResult`, or
  `await form.callback(...)`) opens the next. Each step is a normal operation, so its rules sit in its table's
  middleware.
- **Things that must follow automatically.** An order that records a payment shouldn't depend on the client making a
  second request. The payment runs as a side effect in the `orders` middleware's `create`, inside the same transaction.

---

## How an app gets built

1. **Data modeling, by feature.** Each feature's tables become packages: `packages/{model}/schema.ts`.
2. **UI layout and routing.** Routes, layouts and page skeletons.
3. **Business logic.** The forms get assembled: `CreateForm`, `UpdateForm`, nested and multi-step `Form`s.
4. **Authorization.** With the UI settled and the features clear, each table gets its middleware.
5. **Workflows** *(upcoming)*. Workflow validation and long-running workflows.

---

## Table middleware

Nobody reads every table's business rules together. You read them by domain. So each model gets a `middleware.ts`
that wraps the raw database interface for its table, by passing the table to `makeSchemaTableInterface`:

```ts
// packages/todos/middleware.ts
export const todos = makeSchemaTableInterface({ todos: schema }, 'todos', {
  find: (props) => db.find(props),
  list: (props) => db.list(props),
  create: async (props) => {
    // pre-flight: authorization
    const result = await db.create(props)
    // side effects
    return result
  },
  update: async (props) => { /* pre-flight */ const result = await db.update(props); /* side effects */ return result },
  remove: async (props) => { /* pre-flight */ const result = await db.remove(props); /* side effects */ return result },
})!
```

The CRUD file then switches on the table and calls its middleware:

```ts
// app/actions.ts
function middleware(table?: string) {
  switch (table) {
    case 'todos': return todos
    case 'tags': return tags
    default: throw new Error(`Unknown table: ${table}`)
  }
}

export const create = async (props: CreateProps) => middleware(props.table).create(props)
// find, list, update and remove the same way
```

Pre-flight is for authorization only. LLM calls and other business logic get actions of their own instead of being
merged into the CRUD.

The middleware comes late in the build (stage 4). While the app is being prototyped these rules change with every
iteration of the UI, so they wait until the UI is settled and the features are clear.

---

## Prototype without a backend

```tsx
import { dexieInterface } from 'asasvirtuais-dexie'

<InterfaceProvider {...dexieInterface(schema)}>{children}</InterfaceProvider>
```

Everything runs on IndexedDB. Swap in `app/actions.ts` when you're ready, and the UI stays the same.

Other adapters: [`asasvirtuais-firebase`](https://www.npmjs.com/package/asasvirtuais-firebase). Anything that
implements `find`, `list`, `create`, `update` and `remove` works.

---

## API

| Import | Exports |
|---|---|
| `asasvirtuais/form` | `Form`, `useForm` |
| `asasvirtuais/fields` | `FieldsProvider`, `useFields`, `useField` |
| `asasvirtuais/action` | `ActionProvider`, `useAction` |
| `asasvirtuais/forms` | `CreateForm`, `UpdateForm`, `FilterForm`, `useCreateForm`, `useUpdateForm`, `useFilterForm` |
| `asasvirtuais/context` | `InterfaceProvider`, `TablesProvider`, `useTable` |
| `asasvirtuais/registry` | `SingleProvider`, `useSingle` |
| `asasvirtuais/interface` | `makeSchemaTableInterface`, `TableInterface`, `Query`, `TableSchema` |

---

## For coding agents

[`AGENTS.example.md`](./AGENTS.example.md) explains how to build with asasvirtuais: the principles behind it, the
project and component-directory structure, the build stages, the CRUD file, table middleware and error handling, form patterns, orchestration, and coding rules. Copy it into your app as `AGENTS.md`.
