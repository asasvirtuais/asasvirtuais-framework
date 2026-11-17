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
- **Authorization by table.** CRUD goes through one interface, and each table's authorization lives in its own
  middleware instead of being repeated in every action.
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

Naming the render prop after what the form represents lets nested forms share one closure. An inner form runs its own
async action, and its `onResult` can write into the outer form's fields before the outer form submits:

```tsx
<Form defaults={outerDefaults} action={outerAction}>
  {outer => (
    <form onSubmit={outer.submit}>
      <Form defaults={innerDefaults} action={innerAction} onResult={result => outer.setField('field', result)}>
        {inner => <button type='button' onClick={inner.submit} disabled={inner.loading}>…</button>}
      </Form>
      <button type='submit' disabled={outer.loading}>…</button>
    </form>
  )}
</Form>
```

`outer.loading` and `inner.loading` are independent. Multi-step forms and most workflows are built this way: each step
is a form, and its result opens the next.

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
// app/todos/page.tsx: the page fetches its rows on the server and hands them to the table
import { TableProvider } from 'asasvirtuais/registry'
import { list } from '@/app/actions'
import { schema } from '@/packages/todos/schema'
import { Todos } from './todos'

export default async function TodosPage() {
  const todos = await list({ table: 'todos', query: {} })
  return (
    <TableProvider table='todos' schema={schema} asAbove={Object.fromEntries(todos.map(t => [t.id, t]))}>
      <Todos />
    </TableProvider>
  )
}
```

### Forms and records

```tsx
// app/todos/todos.tsx
'use client'
import { CreateForm, UpdateForm } from 'asasvirtuais/forms'
import { useTable } from 'asasvirtuais/context'
import { SingleProvider, useSingle } from 'asasvirtuais/registry'
import { schema } from '@/packages/todos/schema'

export function Todos() {
  const { array } = useTable('todos', schema)
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

      {array.map(t => (
        <SingleProvider key={t.id} id={t.id} table='todos' schema={schema}>
          <TodoItem />
        </SingleProvider>
      ))}
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
It always renders its children; to render nothing until the record exists, use its render prop:
`{({ single }) => single ? <TodoItem /> : null}`.

There are two `SingleProvider`s. The one in `asasvirtuais/registry` (the default) keeps every record by table, so
nested providers of different tables all stay readable with `useSingle(schema, table)`. The one in
`asasvirtuais/single` is a plain React context: `useSingle(schema)` needs no table, but a nested provider replaces the
one above it, so records of two tables can't be combined.
For deletion, `useTable('todos', schema).remove.trigger({ id })` works on its own or wrapped in an `ActionProvider`.

`list` queries are FeathersJS-style: field matches, `$ne $lt $lte $gt $gte $in $nin $or $and`, and
`$limit $skip $sort $select`.

---

## Server code

The server runs three kinds of code, and they don't mix:

- **CRUD operations.** `find`, `list`, `create`, `update` and `remove`, each on **one** table. They go through the
  table's middleware, which holds its authorization and nothing else.
- **Custom server actions.** Any other computation: an external API, an LLM, a file, a calculation. Each does one
  thing, lives next to the component that calls it, calls the database directly and carries its own authorization.
  When its result should be saved, a form saves it through the CRUD.
- **Complex operations.** The rare request that must write several tables together. It's a custom server action of
  its own with a transaction, never logic tucked into a table's middleware.

Most features that touch several tables are none of the above: they're steps. Each step is a form, and one step's
result (`onSuccess`, `onResult`, or `await form.callback(...)`) opens the next. And a value that follows from other
rows (whether related rows exist, how many) isn't stored at all: it's read from the relations.

---

## Workflows

Most workflows run in the client: the user follows the process on screen, each state shows the action that moves it
forward, and a failed action just doesn't advance. They're nested, multi-step forms with some hand-written state. The
Vercel Workflow SDK is for workflows that run on the server without the user: long jobs, retries, waiting on external
events.

---

## How an app gets built

1. **Data modeling.** Each feature's tables become packages: `packages/{model}/schema.ts`.
2. **Layout and routing.** Routes, layouts and page skeletons.
3. **Pages and forms.** Forms, pagination, filters, and the custom server actions the pages need.
4. **Workflows.** Client workflows with nested forms, backend workflows with the Vercel Workflow SDK.
5. **Middleware and authorization.** With the features settled, each table gets its middleware and each custom server
   action its authorization.

The rules come last on purpose: written early, they'd have to be rewritten every time the UI changes. A team working
by hand runs the same order as a four-week sprint (planning and setup, stages 1–2, stage 3, stages 4–5).

---

## Table middleware

Nobody reads every table's authorization rules together. You read them by domain. So each model gets a `middleware.ts`
that wraps the raw database interface, typed by the table's schema with `asasvirtuaisInterface`:

```ts
// packages/todos/middleware.ts
import { asasvirtuaisInterface } from 'asasvirtuais/interface'

export const todos = asasvirtuaisInterface(schema, {
  find: async (props) => { /* authorization */ return db.find(props) },
  list: async (props) => { /* authorization */ return db.list(props) },
  create: async (props) => { /* authorization */ return db.create(props) },
  update: async (props) => { /* authorization */ return db.update(props) },
  remove: async (props) => { /* authorization */ return db.remove(props) },
})
```

The CRUD file then switches on the table and calls its middleware:

```ts
// app/actions.ts
function middleware(table?: string): TableInterface<any, any> {
  switch (table) {
    case 'todos': return todos
    case 'tags': return tags
    default: throw new Error(`Unknown table: ${table}`)
  }
}

export const create = async (props: CreateProps) => middleware(props.table).create(props)
// find, list, update and remove the same way
```

The middleware holds authorization only. It doesn't write to other tables or run business logic: that's what custom
server actions are for.

`asasvirtuaisInterface` also takes the whole database schema (`{ todos, tags }`), typing an interface over every table.

This is the last part of the app to be written. While the app is being prototyped these rules change with every
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
| `asasvirtuais/registry` | `TableProvider`, `SingleProvider`, `useSingle(schema, table)` |
| `asasvirtuais/single` | `SingleProvider`, `useSingle(schema)` |
| `asasvirtuais/interface` | `asasvirtuaisInterface`, `TableInterface`, `Query`, `TableSchema`, `DatabaseSchema` |

---

## For coding agents

[`AGENTS.example.md`](./AGENTS.example.md) explains how to build with asasvirtuais: the principles behind it, the
project and component-directory structure, the build stages, the CRUD file, custom server actions and complex operations, workflows, table middleware and
error handling, and coding rules. Copy it into your app as `AGENTS.md`.
