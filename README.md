# asasvirtuais

A React framework made of architectural decisions, so you (or your LLM) can skip making them and go straight to the
feature.

Most stacks leave the same questions open for every feature: where the state lives, how a form reaches the server, how
lists refresh after a save, where the permission check goes. An LLM answers them again each time, and writes the
boilerplate that comes with each answer. asasvirtuais answers them once. A feature becomes a form on top of a table,
and code gets written several times faster.

> **Free to use, with credit.** asasvirtuais is free for personal, learning and commercial projects. The one rule:
> every app built with it shows **"Built with asasvirtuais"** linked to [asasvirtuais.com](https://asasvirtuais.com).
> Forks, rebrands, starter kits and resold copies are not allowed, and gambling, betting and scam products need written
> permission first. Want to skip the credit or do something the license doesn't cover? Ask:
> [Asas Virtuais on LinkedIn](https://www.linkedin.com/company/asasvirtuaisdev). Full terms in [LICENSE](./LICENSE).

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

What is CRUD goes through the CRUD interface. What is not CRUD is a server action.

- **CRUD operations.** `find`, `list`, `create`, `update` and `remove`, each on **one** table. They go through the
  table's middleware, which centralizes the authorization of that table's operations.
- **Server actions.** Execution of external APIs and calls, LLM calls, any other computational operation. Each does
  one thing, lives next to the component that calls it, calls the database without the middleware and receives its
  own authorization logic. When its result should be saved, a form saves it through the CRUD.
- **Complex operations.** When there's a clearly defined need to mutate two tables in one operation, a server action
  specific for it. Never logic inside the CRUD middleware.

A request that creates a row answers with the row created, and most of the time the client starts what comes next
after that response. A status that only notes a table's relation with another (whether there are related rows) isn't
written anywhere: the relational database already holds it, and the front-end shows it.

---

## Workflows and custom features

A simple workflow has a state, the state shows the screen, and the screen always has the same button in that state. If
there's an error, it just doesn't advance, and the user clicks again. The user is constantly present, so simple
workflows, such as multi-step asynchronous forms, are nested forms. A workflow's state is kept in the record it's about
(`pending`, `error`), and an error shows in the interface with a retry button. Workflows that run in the back-end use the Vercel
Workflow SDK.

A custom feature is something written by hand: a custom state management or a state machine, like a piece of a game or
following an active workflow while it executes, with polling.

---

## How an app gets built

1. **Data modeling.** Each feature's tables become packages: `packages/{model}/schema.ts`, the schemas in Zod.
2. **Layout.** Routes, layouts and page skeletons.
3. **Pages, forms and server actions.** Forms, pagination, and the server actions the pages need.
4. **Middleware and authorization.** Middleware rules, authentication, authorization, once the features are defined.
5. **Workflows and custom features.** What needs a hand-written state management or a state machine.

Everything is thought with fast prototyping in mind: rules coded at the start have to change every time something
simple changes in the front-end. A team working by hand runs the same order as a four-week sprint (planning and setup,
stages 1–2, stage 3, stages 4–5).

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

The middleware holds authorization only. It doesn't mutate other tables or execute effects in the back-end: what
isn't CRUD is a server action.

`asasvirtuaisInterface` also takes the whole database schema (`{ todos, tags }`), typing an interface over every table.

The middleware is written in stage 4, once the features of the app are defined. While the app is being prototyped
these rules would change with every iteration of the UI.

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

## Recommended project files

Building with a coding agent works best when the project keeps its context in a few Markdown files:

- `brief.md`: what the client asked for.
- `specs.md`: how it's built, technically. Kept up to date as development goes and things change.
- `plan.md`: the initial plan for the project.
- `changelog.md`: what has been developed so far.
- `roadmap.md`: ideas for the future of the project.
- `README.md`: written at the end from the plan, the changelog and the commits: what was done, how, and how to start
  using it.

---

## For coding agents

[`AGENTS.example.md`](./AGENTS.example.md) explains how to build with asasvirtuais: the principles behind it, the
project and component-directory structure, the build stages, the CRUD file, server actions and complex operations, workflows and custom features, table middleware and
error handling, and coding rules. Copy it into your app as `AGENTS.md`.

---

## License

[Asas Virtuais Attribution License 1.0](./LICENSE). Use it freely, keep the "Built with asasvirtuais" credit, don't
fork or resell it, and ask before using it for gambling, betting or scams. Everything else:
[talk to us](https://www.linkedin.com/company/asasvirtuaisdev).
