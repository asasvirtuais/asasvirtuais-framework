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
    └── middleware.ts     # the table's authorization, written in stage 4
lib/                      # small shared files, only once code repeats
```

In a larger app the database access is a package of its own. Here it's `app/db.ts` for simplicity.

## Building an app

An app is built in five stages, in this order. Everything is thought with fast prototyping in mind: if the rules are
coded at the start, every time something simple changes in the front-end, in the way the app works, the code of the
rules written for the previous model has to change too.

1. **Data modeling.** Each feature's tables become packages, starting with `packages/{model}/schema.ts`: the schemas
   in Zod. What the relational database already answers is not a column
   ([derived state](#derived-state-is-read-not-written)).
2. **Layout.** Routes, layouts and page skeletons, each page providing the tables it shows with the rows it fetched.
3. **Pages, forms and server actions.** Each page gets its forms (`CreateForm`, `UpdateForm`, `FilterForm`), its
   pagination, and the [server actions](#server-actions) it needs, [complex operations](#complex-operations)
   included.
4. **Middleware and authorization.** Middleware rules, authentication, authorization: the advanced part of the app.
   It comes once the features of the app are defined, and gives each table its [middleware](#table-middleware) and
   each server action its own authorization.
5. **Workflows and custom features.** [Workflows](#workflows) and [custom features](#custom-features): what needs a
   hand-written state management or a state machine.

A team working by hand runs the same order as a four-week sprint, presenting at the end of each week: planning and
project setup, then stages 1 and 2, then stage 3, then stages 4 and 5. An agent develops much faster and doesn't need
the planning, but it has to do things in this order.

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

This is how multi-step forms and [simple workflows](#simple-workflows) are built. An inner step exists only when the
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

What is CRUD goes through the CRUD interface. What is not CRUD is a server action.

| Kind | What it does | Where it lives | Its authorization |
|---|---|---|---|
| CRUD operation | `find`, `list`, `create`, `update` or `remove` on **one** table | `app/actions.ts` → the table's middleware → `app/db.ts` | the table's `middleware.ts` |
| Server action | everything that isn't CRUD: an external API call, an LLM call, any computation | `actions.tsx` of the component that calls it | inside the action |
| Complex operation | a mutation of two or more tables in one operation | a server action of its own | inside the action |

### A CRUD operation is one table

A CRUD operation reads or writes the table it was called for, and nothing else. The table's middleware decides whether
the caller may run it, and that is all it does: it doesn't write to other tables, call external APIs, or run business
logic. A `create` answers with the row it created. That answer is what the client acts on next.

### Server actions

Server actions are for executing external APIs and calls, LLM calls, and any other computational operation. Each one
does one thing and lives in the `actions.tsx` of the component that calls it, wrapped with `action(...)`.

Server actions are the exception to the rule. They call `app/db.ts` without going through the middleware, because the
middleware is for CRUD operations. So each one receives its own authorization logic (in stage 4, with the middleware).
Even when that repeats logic, what is a repeated function goes into a file in the project's `lib/`.

When an action's result should be saved, the action returns it, and a form saves it through the CRUD.

### Complex operations

When there is a clearly defined need to mutate two tables in one operation, write a server action specific for it. Never
put that logic into the CRUD middleware, which is defined for the operations of one table. Often a double operation is
just a server action, not that complex.

These are not complex operations:

- **Steps the user takes.** Each is its own form, and the result of one (`onSuccess`, `onResult`,
  `await form.callback(...)`) opens the next.
- **Something that follows a write.** A request that creates a row answers with the row created. Most of the time the
  client starts what comes next after it has that response.
- **Keeping a status of a relation up to date.** See below.

### Derived state is read, not written

A status that only notes the state of a table's relation with another table (whether there are related rows, whether
there still are) is not a column, and no update writes it. The relational database already holds it: read the related
rows, and in the front-end show what they say.

---

## Workflows

### Simple workflows

A simple workflow has a state, the state shows the screen, and the screen has a button that is always there in that
state. If there's an error, it just doesn't advance to the next state, and the user clicks again. If it stops or fails
at any moment, the user restarts it by reloading the page and clicking the button they had clicked before. It doesn't
execute several things in the back-end, and the user is constantly present.

Simple workflows, such as multi-step asynchronous forms, are built with nested [forms](#form). Having a workflow is not
a reason to use the Vercel Workflow SDK: in most business cases an employee is constantly there following the process.

### The workflow's record

A workflow is usually accompanied by a record in the database, and the state of the workflow is in that record, in its
table. When a result must not be lost if the user closes the page, the workflow creates its record first with status
`pending`, and the record gets status `error` when something goes wrong. The interface shows that it went wrong, with a
retry button. That is the MVP solution: no automatic retries.

### Backend workflows

Workflows that run in the back-end use the Vercel Workflow SDK. They are usually programming problems that need it. A
server action starts them. A side effect of a CRUD write can start one too, but most of the time that isn't necessary:
the client starts the workflow after it has the response.

## Custom features

A custom feature is something that has to be written by hand: a custom state management or a state machine. It can be
a piece of a game, or following an active workflow while it executes, with polling. Its state lives in the page's
`context.tsx` / `hooks.tsx`.

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

The middleware is written in stage 4 of [Building an app](#building-an-app). Until then, `app/actions.ts` passes
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
   an `UpdateForm` with one field, not a server action. The reactive index updates the UI, so there's no need
   for `useState` copies of rows, manual `set` calls, or revalidation.
4. **A CRUD operation is one table.** CRUD goes through `app/actions.ts` and the table's middleware, which centralizes
   the authorization of that table's operations. Never put the mutation of other tables or the execution of effects in
   the back-end into a CRUD operation or its middleware.
5. **What isn't CRUD is a server action.** External APIs and calls, LLM calls and any other computation live in the
   `actions.tsx` of the component that uses them, one call per action. They call `app/db.ts` without the middleware
   and receive their own authorization logic; repeated functions go into `lib/`. When their result should be saved,
   it goes into a form.
6. **Complex operations only when clearly defined.** Two tables are mutated in one operation only when the need is
   clear, in a server action written for it. Steps the user takes are separate forms, and what follows a write starts
   in the client after the response.
7. **Don't write a status the relations already hold.** No column, and no update, for whether a table has related
   rows in another. Read the relation and show it in the front-end.
8. **Simple workflows are nested forms.** A workflow the user follows on screen is nested `Form`s. The Vercel Workflow
   SDK is for workflows that run in the back-end.
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
    - `actions.tsx`: `'use server'`, the server actions it calls.
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
