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

## About the examples

The code in this file shows the framework's API on a placeholder domain: `projects` and their `todos`. Their tables,
fields, screens and button labels are placeholders, not features. Build what the user asked for, with the user's
tables, and never add a feature, a button or an automation because something like it appears here.

## Structure

```
app/
├── schema.ts             # all table schemas
├── actions.ts            # 'use server' — the CRUD interface
├── db.ts                 # the raw database interface (Prisma, Firestore...)
├── providers.tsx         # InterfaceProvider
└── [route]/
    ├── layout.tsx        # {Model}sProvider with the rows its own components show (asAbove)
    ├── page.tsx          # fetches its rows, {Model}sProvider with them (asAbove)
    └── components/       # this page's components, one directory each
packages/
└── [model]/
    ├── schema.ts         # readable / writable
    ├── fields.tsx        # inputs hooked to useFields()
    ├── forms.tsx         # Create{Model}, Update{Model}, Filter{Model}s
    ├── components.tsx    # {Model}Item, Single{Model}
    ├── providers.tsx     # {Model}sProvider (the table), {Model}Provider (one row)
    ├── hooks.tsx         # use{Model}s(), use{Model}()
    └── middleware.ts     # the table's authorization, written last
lib/                      # small shared files, only once code repeats
```

In a larger app the database access is a package of its own. Here it's `app/db.ts` for simplicity.

## Building an app

An app is built in five stages, in this order. Each stage builds on what the one before it settled, and the rules come
last: rules written while the features are still changing have to be rewritten every time the UI changes. The order is
what makes fast prototyping possible.

1. **Data modeling.** Each feature's tables become packages, starting with `packages/{model}/schema.ts`: the Zod
   schemas of what gets stored. Whatever can be read from the relations between rows is not a column
   ([derived state](#derived-state-is-read-not-written)).
2. **Layout and routing.** Routes, layouts, navigation and page skeletons, each page providing the tables it shows
   with the rows it fetched.
3. **Pages and forms.** Each page gets its forms (`CreateForm`, `UpdateForm`, `FilterForm`), its pagination and
   filters, and the [custom server actions](#custom-server-actions) its components call. When this stage ends, the
   features of the app are defined.
4. **Workflows.** Processes of several steps: [client workflows](#client-workflows) with nested forms and hand-written
   state, and [backend workflows](#backend-workflows) with the Vercel Workflow SDK.
5. **Middleware and authorization.** Authentication, each table's [middleware](#table-middleware), and the
   authorization of each custom server action. This is the advanced part of the app, and it waits until the features
   are settled.

A team working by hand runs the same order as a four-week sprint, presenting at the end of each week: planning and
project setup, then stages 1 and 2, then stage 3, then stages 4 and 5. An agent goes through the stages much faster, but
in the same order.

---

## Form

`Form` holds fields and an async action. The render prop gets `fields`, `setField`, `setFields`, `submit`,
`callback(params)`, `loading`, `result`, `error` and `errors`. `onResult` runs with the result.

```tsx
<Form defaults={{ title: '' }} action={createProject} onResult={project => router.push(`/projects/${project.id}`)}>
  {project => (
    <form onSubmit={project.submit}>
      <input value={project.fields.title} onChange={e => project.setField('title', e.target.value)} />
      <button type='submit' disabled={project.loading}>Create project</button>
      {project.error && <p>{project.error.message}</p>}
    </form>
  )}
</Form>
```

Name the render prop after what the form represents. Nested forms then share one closure, each with its own `loading`,
`error` and `result`. An inner form runs its own action, and its `onResult` can write into the outer form's fields
before the outer form submits:

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

This is how multi-step forms and [client workflows](#client-workflows) are built. An inner step exists only when the
user asked for that step.

---

## CRUD

### Schema

```ts
// packages/todos/schema.ts
export const readable = z.object({ id: z.string(), title: z.string(), done: z.boolean(), project: z.string() })
export const writable = readable.pick({ title: true, done: true, project: true })
export const schema = { readable, writable }
```

```ts
// app/schema.ts
export const schema = { projects, todos }
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

Each method receives the `table` it was called for, and works on that table only. The row it returns is what lands in
the index.

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
// packages/todos/hooks.tsx + providers.tsx
export const useTodos = () => useTable('todos', schema)
export const useTodo = () => useSingle(schema, 'todos')

export function TodosProvider({ children, asAbove }: React.PropsWithChildren<Pick<TableProviderProps<typeof schema>, 'asAbove'>>) {
  return <TableProvider table='todos' schema={schema} asAbove={asAbove}>{children}</TableProvider>
}

export function TodoProvider({ id, children }: { id: string, children: React.ReactNode }) {
  return <SingleProvider id={id} table='todos' schema={schema}>{children}</SingleProvider>
}
```

```tsx
// app/[route]/page.tsx: a Server Component
export default async function TodosPage() {
  const todos = ok(await list({ table: 'todos', query: { done: false } }))
  return (
    <TodosProvider asAbove={index(todos)}>
      <Todos />
    </TodosProvider>
  )
}
```

`asAbove` is the index the table starts with: the rows keyed by id (`index(rows)`, `single(row)`, small helpers in
`lib/`). New server rows passed to it later (`router.refresh()`) merge in. `SingleProvider` fetches the record only if
it isn't in the index, so a page that passes its rows makes no request from the client. Components under it read it
with `useTodo()`.

### One record: `SingleProvider`

`SingleProvider` reads a row from the table's index, fetches it only if it's missing, and follows the index. It comes
in two implementations with the same behavior. The difference between them is technical:

- **`asasvirtuais/registry`** (the default). Each `SingleProvider` adds its record, by table, to a registry the
  framework keeps, on top of the records above it. Nested providers of different tables all stay readable: under a
  `ProjectProvider` and a `TodoProvider`, `useSingle(schema, 'projects')` and `useSingle(schema, 'todos')` both work.
  `useSingle` takes the table.
- **`asasvirtuais/single`**. A plain React context: `useSingle(schema)` takes no table, and the record isn't kept in a
  registry inside the framework. A nested `SingleProvider` replaces the one above it, so only the closest record is
  readable, and records of two tables can't be combined.

`SingleProvider` always renders its children, also while the record is loading or when it doesn't exist. To render
nothing until there is a record, use the render prop and return `null`:

```tsx
<SingleProvider id={id} table='todos' schema={schema}>
  {({ single }) => single ? <TodoItem /> : null}
</SingleProvider>
```

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

The page provides the rows; a list reads the table's `array`, which follows every operation, and filters it. Wrap
each item in its `SingleProvider` so it stays in sync:

```tsx
export function Todos() {
  const { array } = useTodos()
  return array.filter(t => !t.done).map(t => <TodoProvider key={t.id} id={t.id}><TodoItem /></TodoProvider>)
}
```

`FilterForm` (and `list.trigger(...)`) fetch from the client: for what the user asks for while on the page, such as a
search or the next page of results. `FilterForm` keeps its `result` local.

`query` supports field matches, `$ne $lt $lte $gt $gte $in $nin $or $and`, and `$limit $skip $sort $select`.

---

## Server code

The server runs three kinds of code. Each has one place, and they don't mix.

| Kind | What it does | Where it lives | Its authorization |
|---|---|---|---|
| CRUD operation | `find`, `list`, `create`, `update` or `remove` on **one** table | `app/actions.ts` → the table's middleware → `app/db.ts` | the table's `middleware.ts` |
| Custom server action | any other computation: an external API, an LLM, a file, a calculation, a read the CRUD can't express | `actions.tsx` of the component that calls it | inside the action |
| Complex operation | a mutation of several tables that must happen together | a custom server action of its own, in a transaction | inside the action |

### A CRUD operation is one table

A CRUD operation reads or writes the table it was called for, and nothing else. The table's middleware decides whether
the caller may run it, and that is all it does: it doesn't write to other tables, call external APIs, or run business
logic. A `create` answers with the row it created. That answer is what the client acts on next.

### Custom server actions

A custom server action is any server computation that isn't a CRUD operation: calling an external API or an LLM,
processing a file, a calculation, a server-side read the CRUD can't express. Each action does one thing and lives in the
`actions.tsx` of the component that calls it, wrapped with `action(...)`.

Custom server actions are the exception to the CRUD rule. They call `app/db.ts` directly, without going through any
middleware, because the middleware is for CRUD operations. So each one carries its own authorization check (written in
stage 5, like the middleware). Where the same check or helper repeats across actions, it moves into a small function in
`lib/`.

When an action's result should be saved, the action returns it, and a form saves it through the CRUD.

### Complex operations

A complex operation is the one case where a single request writes to several tables: the writes must happen together,
and one must never exist without the others. That need has to be clear, not assumed. A complex operation is written as
its own custom server action, running the writes in one transaction. It is never placed in the CRUD or in a table's
middleware. The client puts the rows it returns into each table's index (`set` in `onResult`), or calls
`router.refresh()`.

These are not complex operations:

- **Steps the user takes.** Each is its own form, and the result of one (`onSuccess`, `onResult`,
  `await form.callback(...)`) opens the next.
- **Something that can follow a write.** The client receives the created row, then starts what comes next.
- **Keeping a summary up to date.** See below.

### Derived state is read, not written

A value that follows from other rows (whether related rows exist, how many there are, which one is the latest, a status
that only reflects them) is not a column, and no write keeps it up to date. The relational database already holds the
answer: read the related rows (the ones the page fetched, or a `list` with a query) and render from them. A column
stores only what a user or a process decides.

---

## Workflows

A workflow is a process of several steps. Most of them run in the client.

### Client workflows

The user is present through the whole process. The current state decides what the screen shows, and each state has the
action that moves it forward. If the action fails, the state doesn't advance, and the user runs it again. Reloading the
page shows the same state with the same action. Nothing has to be resumed on the server.

Client workflows are built with nested and multi-step [forms](#form): each step is a `Form`, and its result opens the
next step. State the steps share is hand-written in the page's `context.tsx` / `hooks.tsx`. State that must survive a
reload is a field of the record the workflow is about, saved with an `UpdateForm`.

Most business processes are client workflows, with someone following the process on screen. Having a workflow is not a
reason to use a workflow engine.

### Backend workflows

When the steps run on the server without the user (long jobs, retries, waiting on external events, several server
steps that must all complete), the workflow uses the Vercel Workflow SDK. A custom server action starts it. When it has
to follow a CRUD write whatever the client does, the table's middleware may start it after the write. Starting a backend
workflow is the only thing a middleware does after the write.

---

## Table middleware

Authorization rules are read by domain, so each table keeps its own in `packages/{model}/middleware.ts`. The middleware
wraps the raw database interface with `asasvirtuaisInterface`, typed by the table's schema:

```ts
// packages/todos/middleware.ts
import { asasvirtuaisInterface } from 'asasvirtuais/interface'
import { db } from '@/app/db'
import { schema } from './schema'

export const todos = asasvirtuaisInterface(schema, {
  find: async (props) => {
    // authorization
    return db.find(props)
  },
  list: async (props) => {
    // authorization
    return db.list(props)
  },
  create: async (props) => {
    // authorization
    return db.create(props)
  },
  update: async (props) => {
    // authorization
    return db.update(props)
  },
  remove: async (props) => {
    // authorization
    return db.remove(props)
  },
})
```

`app/actions.ts` then only switches on the table and calls its middleware. It is still the one interface for every
table:

```ts
// app/actions.ts
'use server'
import type { TableInterface, FindProps, ListProps, CreateProps, UpdateProps, RemoveProps } from 'asasvirtuais/interface'
import { action } from '@/lib/action'
import { projects } from '@/packages/projects/middleware'
import { todos } from '@/packages/todos/middleware'

function middleware(table?: string): TableInterface<any, any> {
  switch (table) {
    case 'projects': return projects
    case 'todos': return todos
    default: throw new Error(`Unknown table: ${table}`)
  }
}

export const find = action(async (props: FindProps) => middleware(props.table).find(props))
export const list = action(async (props: ListProps) => middleware(props.table).list(props))
export const create = action(async (props: CreateProps) => middleware(props.table).create(props))
export const update = action(async (props: UpdateProps) => middleware(props.table).update(props))
export const remove = action(async (props: RemoveProps) => middleware(props.table).remove(props))
```

`asasvirtuaisInterface` takes one table's schema (`{ readable, writable }`) for a middleware, or the whole database
schema (`{ projects, todos }`) for an interface over every table, such as an adapter.

The middleware is written in stage 5 of [Building an app](#building-an-app). Until then, `app/actions.ts` passes
straight to `app/db.ts`.

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

1. **Build only what was asked.** The examples in this file are placeholders for the API. Features, steps, buttons
   and automations come from the user's request, never from an example.
2. **Read records from their provider.** Inside `{Model}Provider`, components use `use{Model}()`. They don't receive
   the record, or its fields, as props.
3. **Use the framework forms for database operations**, including single-column updates. A flag, a status or a name is
   an `UpdateForm` with one field, not a custom server action. The reactive index updates the UI, so there's no need
   for `useState` copies of rows, manual `set` calls, or revalidation.
4. **A CRUD operation is one table.** CRUD goes through `app/actions.ts` and the table's middleware, and the middleware
   holds that table's authorization only. A CRUD operation or a middleware never writes to another table, never calls
   an external API, and never runs business logic.
5. **Custom server actions do one thing.** External APIs, LLM calls and any other computation live in the
   `actions.tsx` of the component that uses them, one call per action. They call `app/db.ts` directly and carry their
   own authorization; repeated checks go into `lib/`. When their result should be saved, it goes into a form.
6. **Complex operations only when clearly needed.** Several tables are written in one request only when the writes
   must happen together, in a custom server action with a transaction. Steps the user takes are separate forms, and
   what can follow a write starts in the client after the response.
7. **Don't store what the relations already say.** No column, and no extra write, for whether related rows exist,
   how many there are, or a status that only reflects them. Read the related rows and render from them.
8. **Client workflows are forms.** A process the user follows on screen is nested and multi-step `Form`s with
   hand-written state. The Vercel Workflow SDK is for steps that run on the server without the user.
9. **Fail fast, return errors.** Throw `new Error('Unauthorized')` / `new Error('Forbidden')`, and call `notFound()`
   for missing records. Every server action is wrapped with `action(...)`, client components call `unwrap(actions)`,
   and server code calling another action uses `ok(await name(...))`.
10. **Pages hand their data down.** `page.tsx` is a Server Component: it fetches the rows its components show with
    `ok(await list(...))` or `find` from `app/actions.ts`, and mounts each table's `{Model}sProvider` with them as
    `asAbove`. A layout does the same for the rows its own components show, so their `SingleProvider`s find them and
    fetch nothing. Components read `use{Model}s().array`, filtered, or `use{Model}()` under a `{Model}Provider`; they
    don't fetch on mount. Each table is provided once, where its rows are fetched: no empty providers kept around for
    safety. A table with nothing to show is provided without rows only around the form that writes to it. Cache
    invalidation is avoided rather than handled: the forms keep the index current, and a write that doesn't go through
    a form sets or unsets its rows in `onSuccess` / `onResult`. A `{Model}sProvider` replaces its table only for its
    subtree, so a component outside it (e.g. a dialog in the layout) that writes to that table calls
    `router.refresh()`, and the page's `asAbove` brings the row in. `TablesProvider` mounts tables without rows, which
    leaves components to fetch them with `FilterForm`; it is only for tables a route has reason to keep fetching, such
    as data from outside sources. Real-time data comes from a client context that receives the signals and passes
    them as `asAbove` to a `TableProvider`. `context.tsx` holds state, not table providers. Shells shared by several
    pages are hoisted to their closest common `layout.tsx`.
11. **Component directories.** A page keeps its components in `components/` next to `page.tsx`, one lowercase
    directory per component, with only the files it needs:
    - `component.tsx`: `'use client'`, the UI.
    - `actions.tsx`: `'use server'`, the custom server actions it calls.
    - `index.tsx`: a server component. It's usually the high-level version of the component, fetching on the server
      and rendering `component.tsx`, and often goes inside `Suspense`. It is never a barrel file: import each file
      from its own path.
    - `cache.tsx`: `'use cache'`. Receives the params the cache depends on (e.g. from the URL) and renders `index.tsx`
      with them, so caching is decided here rather than in the fetching layer.
    - `context.tsx`, `hooks.tsx`: state the page's components share (React context) and local state, when needed.
      Never table providers: tables come from `{Model}sProvider` with the rows the server fetched.

    Code used only by a component stays in its directory. A component shared by several pages lives with their closest
    common route.
12. **Packages are atomic.** `packages/{model}/` holds the schema, fields, forms, components, providers, hooks and
    middleware of one table. Page composition lives in `app/`.
13. **`lib/` only for repeated code.** A library is a small single file that appears once the same code repeats across
    several actions.
14. **Trust the schema.** Access guaranteed fields directly. Declare optional fields in the schema and give them
    standard UI defaults.
15. **Plain names and text.** Contextual variable names. Simple UI text: "Create {Object}", "Update {Object}", "Delete
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
| `asasvirtuais/registry` | `TableProvider`, `SingleProvider`, `useSingle(schema, table)` |
| `asasvirtuais/single` | `SingleProvider`, `useSingle(schema)` |
| `asasvirtuais/interface` | `asasvirtuaisInterface`, `TableInterface`, `Query`, `TableSchema`, `DatabaseSchema` |

| Concept | Pattern | Example |
|---|---|---|
| Table | lowercase plural | `'todos'` |
| Fields | `{Field}Field` | `TitleField` |
| Hooks | `use{Model}s()`, `use{Model}()` | `useTodos()`, `useTodo()` |
| Providers | `{Model}sProvider` (table), `{Model}Provider` (row) | `TodosProvider`, `TodoProvider` |
| Forms | `Create{Model}`, `Update{Model}`, `Filter{Model}s`, `Delete{Model}` | `UpdateTodo` |
| One-click update | `{Verb}{Model}` | `ToggleTodo` |
| Components | `{Model}Item`, `Single{Model}` | `TodoItem` |
