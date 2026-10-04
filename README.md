# asasvirtuais

**Full-stack React where you never manage state by hand.**

Define a schema, write one CRUD file, and drop in forms. Every create, update and delete lands in a reactive index,
and every list, filter and detail view showing that table updates by itself. There is no `revalidatePath`, no
refetching, and no `setState` copies of your rows.

```tsx
<UpdateForm table='todos' schema={schema} id={todo.id}>
  {toggle => (
    <input type='checkbox' checked={todo.done} onChange={() => toggle.callback({ done: !todo.done })} />
  )}
</UpdateForm>
```

That checkbox writes to your database through your own server code, checks permissions, and updates every view
of that todo across the page. It takes no extra code.

---

## Why

- **No manual state.** Writes go through a generic CRUD interface, and the returned row syncs the UI.
- **One file for the rules.** `app/actions.ts` holds every mutation rule in the app: who may create, update or remove
  what, and what happens automatically afterwards. Reading it tells you how the app behaves.
- **Organised by feature, not by layer.** Each model has its schema, fields, forms and components in one folder.
- **Backend-agnostic.** Start on IndexedDB with no server, then switch to server actions, Firestore or anything that
  implements five functions, without touching the UI.
- **Built for LLM-written apps.** A small set of patterns that an agent can follow exactly. See
  [`AGENTS.example.md`](./AGENTS.example.md).

---

## Install

```sh
pnpm add asasvirtuais zod
```

Using an AI coding agent? Copy the agent guide into your app:

```sh
cp node_modules/asasvirtuais/AGENTS.example.md AGENTS.md
```

---

## A five-minute tour

### 1. Schema

Each table has `readable` (what comes out of the database) and `writable` (what a user may send).

```ts
// app/todos/schema.ts
import z from 'zod'

export const readable = z.object({ id: z.string(), title: z.string(), done: z.boolean(), author: z.string() })
export const writable = readable.pick({ title: true, done: true })
export const schema = { readable, writable }
```

```ts
// app/schema.ts
import { schema as todos } from './todos/schema'
export const schema = { todos }
```

### 2. The CRUD file

Your backend consists of five server actions. Auth, validation, server-filled fields and after-effects all go here.

```ts
// app/actions.ts
'use server'
import { makeSchemaTableInterface } from 'asasvirtuais/interface'
import { schema } from './schema'

export const { find, list, create, update, remove } = makeSchemaTableInterface(schema, null, {
  find:   async (props) => db.find(props),
  list:   async (props) => db.list(props),
  create: async (props) => { /* check rules */ return db.create(props) /* after-effects */ },
  update: async (props) => { /* check rules */ return db.update(props) },
  remove: async (props) => { /* check rules */ return db.remove(props) },
})!
```

[`AGENTS.example.md`](./AGENTS.example.md#the-crud-file) shows the full pattern: a per-table
`{ create, update, remove }` rule map, transactions, and automatic consequences.

### 3. Providers

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
// app/todos/layout.tsx: each route mounts only the tables it needs
'use client'
import { TablesProvider } from 'asasvirtuais/context'
import { schema } from './schema'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <TablesProvider tables={{ todos: schema }}>{children}</TablesProvider>
}
```

### 4. UI

```tsx
'use client'
import { CreateForm, FilterForm } from 'asasvirtuais/forms'
import { SingleProvider, useSingle } from 'asasvirtuais/registry'
import { schema } from './schema'

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
  return <p>{todo.title}</p>
}
```

When a write resolves, the row is updated in the index and every `SingleProvider` for it re-renders.

---

## How work flows

asasvirtuais apps have one write path: **the client writes rows, and the CRUD file decides whether it may.**

**One click is one row.** Approving, renaming, archiving and toggling are each an `UpdateForm` on one field. They are
not custom endpoints.

**Workflows are steps.** When an operation spans several tables and the user drives each part, each part is its own
CRUD write, and the result of one opens the next: *click, create, result, click, update, result.* Every step's rule
sits in the CRUD file with all the others.

| Step | CRUD write |
|---|---|
| Player joins | `create participants { mission, character }` |
| Emissary approves | `update participants { status: 'approved' }` |
| Emissary starts | `update missions { status: 'active' }` |

**Consequences live on the server.** When a second write must happen automatically (buying a card debits the
wallet), the user's write records the intent, and the consequence runs in the same server handler and the same
transaction. The client never chains them, because that would be untrustworthy, non-atomic and racy.

**Drafts are not writes.** LLM drafts, previews and lookups are plain async functions run through `Form`. Their
results fill a `CreateForm`, which saves them.

---

## Primitives

The CRUD forms are built on three primitives you can use on their own.

```tsx
import { FieldsProvider } from 'asasvirtuais/fields'   // field state
import { ActionProvider } from 'asasvirtuais/action'   // async state: loading, result, error
import { Form } from 'asasvirtuais/form'               // both together

<Form defaults={{ email: '', password: '' }} action={login} onResult={user => router.push('/')}>
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

Name render props after what the form represents (`login`, `order`, `zip`). Nested forms and chained steps then sit
side by side in one closure without collisions:

```tsx
<Form defaults={{ address: '' }} action={placeOrder}>
  {order => (
    <Form defaults={{ zip: '' }} action={lookupZip} onResult={a => order.setField('address', a.street)}>
      {zip => /* zip.fields, order.fields, zip.loading, order.loading ... */ null}
    </Form>
  )}
</Form>
```

Every form and action exposes `fields`, `setField`, `setFields`, `submit`, `callback(params)`, `loading`, `result`,
`error` and `errors`.

---

## Prototype without a backend

```tsx
import { dexieInterface } from 'asasvirtuais-dexie'

<InterfaceProvider {...dexieInterface(schema)}>{children}</InterfaceProvider>
```

The app runs on IndexedDB. Swap in `app/actions.ts` later, and nothing in the UI changes.

---

## API

| Import | Exports |
|---|---|
| `asasvirtuais/fields` | `FieldsProvider`, `useFields`, `useField` |
| `asasvirtuais/action` | `ActionProvider`, `useAction` |
| `asasvirtuais/form` | `Form`, `useForm` |
| `asasvirtuais/forms` | `CreateForm`, `UpdateForm`, `FilterForm`, `useCreateForm`, `useUpdateForm`, `useFilterForm` |
| `asasvirtuais/context` | `InterfaceProvider`, `TablesProvider`, `useTable` |
| `asasvirtuais/registry` | `SingleProvider`, `useSingle` |
| `asasvirtuais/interface` | `makeSchemaTableInterface`, `TableInterface`, `Query`, `TableSchema` |

`list` queries are FeathersJS-style: field matches, `$ne $lt $lte $gt $gte $in $nin $or $and`, and
`$limit $skip $sort $select`.

Adapters: [`asasvirtuais-dexie`](https://www.npmjs.com/package/asasvirtuais-dexie) (IndexedDB),
[`asasvirtuais-firebase`](https://www.npmjs.com/package/asasvirtuais-firebase) (Firestore). Anything implementing
`find`, `list`, `create`, `update` and `remove` works.

---

## For agents

[`AGENTS.example.md`](./AGENTS.example.md) is the complete rulebook for building an asasvirtuais app: numbered rules,
a decision procedure for every kind of write, the CRUD rule map, workflow and consequence patterns, and a table of
common mistakes and their corrections. Copy it to your app as `AGENTS.md`.
