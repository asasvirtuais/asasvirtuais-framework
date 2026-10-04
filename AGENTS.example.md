# AGENTS.md

> Starting point for an app built on asasvirtuais. Copy it to the app root as `AGENTS.md`
> (`cp node_modules/asasvirtuais/AGENTS.example.md AGENTS.md`) and fill in **Workflow** and **Project**.

---

# Thinking: How the LLM model should proceed about any and all tasks.

1. Grounded: Name and define what entities are currently at disposal based on the given context.
2. Ruly: Clearly state what happens and where to go next.
3. Consistent: Do not contradict existing/consolidated patterns, do not come-up with exceptions or patches.
4. Careful: Given uncertainty do not try to solve it immediately, carefully aim to resolve the most ambiguity with the fewest moves.
5. Clear: Output what you're doing as you go explicitly stating the desired outcome, and if the statement contradicts the established patterns/goals do not push through the broken plan, return to step 1 and re-ground.
6. Ask: Always ask the user about UI layouts and UI decisions (screens, routes, what is shown where, navigation, placement of controls) that were not explicitly given. Do not come up with what you think is smart.

# Workflow

<!-- How this project is worked on, tested and deployed. -->

---

# asasvirtuais

A React framework for building full-stack apps where code is organized by feature, not by layer. Database operations
go through one CRUD interface, their results land in a reactive index, and every view of a table follows it.

## Project structure

```
app/
├── schema.ts               # all table schemas
├── actions.ts              # 'use server' — the CRUD interface
├── providers.tsx           # InterfaceProvider
├── layout.tsx
└── (app)/chat/[id]/
    ├── layout.tsx          # TablesProvider for the tables this route uses
    ├── page.tsx
    └── components/         # see rule 11
packages/
└── todos/
    ├── schema.ts           # readable / writable + types
    ├── fields.tsx          # atomic inputs hooked to useFields()
    ├── forms.tsx           # CreateTodo, UpdateTodo, FilterTodos
    ├── components.tsx      # TodoItem, SingleTodo
    ├── providers.tsx       # TodoProvider, TodosProvider
    └── hooks.tsx           # useTodos(), useTodo()
lib/
└── action.ts               # error wrapper for server actions (rule 13)
```

---

## Form

`Form` (`asasvirtuais/form`) holds fields and an async action. `FieldsProvider` (`asasvirtuais/fields`) and
`ActionProvider` (`asasvirtuais/action`) are its two halves and work on their own.

```tsx
<Form defaults={{ email: '', password: '' }} action={login} onResult={() => router.push('/')}>
  {login => (
    <form onSubmit={login.submit}>
      <input value={login.fields.email} onChange={e => login.setField('email', e.target.value)} />
      <input type='password' value={login.fields.password} onChange={e => login.setField('password', e.target.value)} />
      <button type='submit' disabled={login.loading}>Log in</button>
      {login.error && <p>{login.error.message}</p>}
    </form>
  )}
</Form>
```

Render props: `fields`, `setField`, `setFields`, `submit`, `callback(params)`, `loading`, `result`, `error`, `errors`.
`submit` sends the current fields; `callback(params)` sends whatever it's given and returns the result.

### Nested forms & async multi-step flows

Name the render prop after what the form represents (`order`, `zip`) instead of destructuring. Nested forms then share
one closure without collisions, each with its own `loading` and `error`, and an inner form can write its result into
the outer one:

```tsx
<Form defaults={{ item: '', quantity: 1, address: '' }} action={placeOrder} onResult={order => alert(`Order ${order.id}`)}>
  {order => (
    <form onSubmit={order.submit}>
      <input value={order.fields.item} onChange={e => order.setField('item', e.target.value)} />

      <Form defaults={{ zipCode: '' }} action={lookupZip}
        onResult={a => order.setField('address', `${a.street}, ${a.city} - ${a.state}`)}>
        {zip => (
          <div>
            <input value={zip.fields.zipCode} onChange={e => zip.setField('zipCode', e.target.value)} />
            <button type='button' onClick={zip.submit} disabled={zip.loading || !zip.fields.zipCode}>
              {zip.loading ? 'Verifying...' : 'Autofill address'}
            </button>
            {zip.error && <p>{zip.error.message}</p>}
          </div>
        )}
      </Form>

      {order.fields.address && <p>Shipping to: {order.fields.address}</p>}
      <button type='submit' disabled={order.loading}>Place order</button>
    </form>
  )}
</Form>
```

Inner forms work as validation steps, token generators, AI drafts or async selectors that fill the outer form before
it submits.

---

## Full-stack CRUD

### Schema

```ts
// packages/todos/schema.ts
import z from 'zod'

export const readable = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  author: z.string(),
  createdAt: z.string(),
})

export const writable = readable.pick({ title: true, done: true })

export const schema = { readable, writable }
export type Readable = z.infer<typeof readable>
export type Writable = z.infer<typeof writable>
```

```ts
// app/schema.ts
import { schema as todos } from '@/packages/todos/schema'
import { schema as tags } from '@/packages/tags/schema'

export const schema = { todos, tags }
```

### The CRUD file

`app/actions.ts` is the backend: five server actions that every `CreateForm`, `UpdateForm`, `FilterForm` and
`SingleProvider` go through. Whatever must happen around a database operation is written here, once, and applies to
every form that touches the table:

- **Before the operation (pre-flight):** authentication, authorization, validation, default values. This is the
  app's middleware.
- **After the operation (side effects):** sending an email, triggering a webhook, writing the records that must
  follow this one.

Each method receives the `table` it's called for, so table-specific logic branches on it.

```ts
// app/actions.ts
'use server'
import { makeSchemaTableInterface } from 'asasvirtuais/interface'
import { action } from '@/lib/action'
import { schema } from './schema'
import { db } from '@/lib/db'          // any adapter: Prisma, Firestore, ...

const crud = makeSchemaTableInterface(schema, null, {
  find: async (props) => db.find(props),

  list: async (props) => db.list(props),

  create: async (props) => {
    // pre-flight: authentication, validation, default values...
    const result = await db.create(props)
    // side effects: send email, trigger webhook...
    return result
  },

  update: async (props) => {
    // pre-flight: authentication, authorization, validation...
    const result = await db.update(props)
    // side effects...
    return result
  },

  remove: async (props) => {
    // pre-flight: authentication, authorization...
    const result = await db.remove(props)
    // side effects...
    return result
  },
})!

export const find = action(crud.find)
export const list = action(crud.list)
export const create = action(crud.create)
export const update = action(crud.update)
export const remove = action(crud.remove)
```

Inside the handlers, fail fast (rule 7): `throw new Error('Unauthorized')`, `throw new Error('Forbidden')`. The row a
handler returns is what lands in the index, so when the server fills in or changes a value, the client shows the stored
version.

| Method   | Props |
|----------|-------|
| `find`   | `{ table, id }` |
| `list`   | `{ table, query? }` |
| `create` | `{ table, data: Writable }` |
| `update` | `{ table, id, data: Partial<Writable> }` |
| `remove` | `{ table, id }` |

`query` is FeathersJS-style: field matches, `$ne $lt $lte $gt $gte $in $nin $or $and`, and
`$limit $skip $sort $select`.

### Errors

In production, Next.js hides the message of an error thrown by a server action, so the user would only see a generic
failure. Server actions therefore return the error instead of throwing it, and the client turns it back into a thrown
error so `ActionProvider` and the forms can show `error.message`.

```ts
// lib/action.ts
import { unstable_rethrow } from 'next/navigation'

type Failure = { error: string }

// server: wrap an action so a thrown error comes back as { error: message }
export function action<A extends any[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R | Failure> => {
    try {
      return await fn(...args)
    } catch (error) {
      unstable_rethrow(error)           // let notFound() and redirect() through
      return { error: (error as Error).message }
    }
  }
}

// throw the error again where the result is used
export function ok<R>(result: R | Failure): R {
  if (result && typeof result === 'object' && 'error' in result) throw new Error(result.error)
  return result as R
}

// client: unwrap every action of a module once
export function unwrap<T extends Record<string, (...args: any[]) => Promise<any>>>(actions: T) {
  return Object.fromEntries(
    Object.entries(actions).map(([name, fn]) => [name, async (...args: any[]) => ok(await fn(...args))])
  ) as { [K in keyof T]: (...args: Parameters<T[K]>) => Promise<Exclude<Awaited<ReturnType<T[K]>>, Failure>> }
}
```

### Providers

```tsx
// app/providers.tsx
'use client'
import { InterfaceProvider } from 'asasvirtuais/context'
import { unwrap } from '@/lib/action'
import * as actions from './actions'

const crud = unwrap(actions)

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <InterfaceProvider {...crud}>{children}</InterfaceProvider>
}
```

Each route or layout mounts only the tables it uses:

```tsx
// app/(app)/chat/[id]/layout.tsx
import { TablesProvider } from 'asasvirtuais/context'
import { schema as todos } from '@/packages/todos/schema'
import { schema as tags } from '@/packages/tags/schema'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <TablesProvider tables={{ todos, tags }}>{children}</TablesProvider>
}
```

### Model provider & hooks

```tsx
// packages/todos/hooks.tsx
'use client'
import { useTable } from 'asasvirtuais/context'
import { useSingle } from 'asasvirtuais/registry'
import { schema } from './schema'

export const useTodos = () => useTable('todos', schema)
export const useTodo = () => useSingle(schema, 'todos')
```

```tsx
// packages/todos/providers.tsx
'use client'
import { TablesProvider } from 'asasvirtuais/context'
import { SingleProvider } from 'asasvirtuais/registry'
import { schema } from './schema'

export function TodoProvider({ id, children }: { id: string, children: React.ReactNode }) {
  return <SingleProvider id={id} table='todos' schema={schema}>{children}</SingleProvider>
}

export function TodosProvider({ children }: { children: React.ReactNode }) {
  return <TablesProvider tables={{ todos: schema }}>{children}</TablesProvider>
}
```

### Forms

```tsx
// packages/todos/forms.tsx
'use client'
import { CreateForm, UpdateForm, FilterForm } from 'asasvirtuais/forms'
import { ActionProvider } from 'asasvirtuais/action'
import { schema, type Readable } from './schema'
import { useTodos, useTodo } from './hooks'
import { TitleField } from './fields'

export function CreateTodo({ onSuccess }: { onSuccess?: (todo: Readable) => void }) {
  return (
    <CreateForm table='todos' schema={schema} defaults={{ title: '', done: false }} onSuccess={onSuccess}>
      {todo => (
        <form onSubmit={todo.submit}>
          <TitleField />
          <button type='submit' disabled={todo.loading}>Create todo</button>
          {todo.error && <p>{todo.error.message}</p>}
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

export function FilterTodos(props: Omit<React.ComponentProps<typeof FilterForm<typeof schema>>, 'table' | 'schema'>) {
  return <FilterForm table='todos' schema={schema} {...props} />
}
```

`UpdateForm` sends only the fields in its state (`defaults` plus what `setField` changed), so a single-column update is
the same form with one field. For a one-click change, pass the data to `callback`:

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

Removing goes through the table's `remove`, inside an `ActionProvider` for its state:

```tsx
export function DeleteTodo({ onSuccess }: { onSuccess?: () => void }) {
  const { single } = useTodo()
  const { remove } = useTodos()
  return (
    <ActionProvider action={remove.trigger} params={{ id: single.id }} onResult={onSuccess}>
      {del => <button onClick={del.submit} disabled={del.loading}>Delete todo</button>}
    </ActionProvider>
  )
}
```

### Listing vs. filtering

`useTable().list` fills the table's index. Its `array` follows every create, update and remove:

```tsx
const { array, list } = useTodos()
useEffect(() => { list.trigger({}) }, [])

return array.map(todo => (
  <TodoProvider key={todo.id} id={todo.id}><TodoItem /></TodoProvider>
))
```

`FilterForm` keeps its `result` local to the component: pagination, live search, conditional results. Wrapping each
item in its `SingleProvider` keeps the items themselves in sync:

```tsx
<FilterTodos autoTrigger defaults={{ query: { done: false } }}>
  {todos => (
    <div>
      <input placeholder='Search' value={todos.fields.query?.title ?? ''}
        onChange={e => { todos.setField('query', { title: e.target.value }); todos.submit() }} />
      {todos.result?.map(todo => (
        <TodoProvider key={todo.id} id={todo.id}><TodoItem /></TodoProvider>
      ))}
    </div>
  )}
</FilterTodos>
```

### Async selector fields

A field component can host a `FilterForm` for another table and write the selection into whatever form it's rendered
in, through `useFields()`:

```tsx
// packages/todos/fields.tsx
export function TagField() {
  const { fields, setField } = useFields<{ tag: string }>()
  return (
    <FilterForm table='tags' schema={tagsSchema} autoTrigger>
      {tags => (
        <ul>
          {tags.result?.map(tag => (
            <li key={tag.id} onClick={() => setField('tag', tag.id)}
              style={{ fontWeight: fields.tag === tag.id ? 'bold' : 'normal' }}>{tag.name}</li>
          ))}
        </ul>
      )}
    </FilterForm>
  )
}
```

The `CreateForm` owns the selected `tag`, and the `FilterForm` searches tags. Neither knows about the other.

### The single record pattern

`SingleProvider` makes a record available to its descendants and fetches it if it isn't in the index yet. Providers
for different tables can be nested:

```tsx
<TodoProvider id={params.id}>
  <SingleTodo />
  <UpdateTodo />
  <DeleteTodo />
</TodoProvider>

function SingleTodo() {
  const { single } = useTodo()
  return <h1>{single.title}</h1>
}
```

### Effects in the client

On the client, effects are code written around the action:

```tsx
<button onClick={() => { validate(form.fields); form.submit() }}>Save</button>

<CreateTodo onSuccess={todo => router.push(`/todos/${todo.id}`)} />
```

---

## Orchestrating several operations

When a feature touches more than one table, ask whether the user triggers each operation, or one has to follow another
automatically.

**The user triggers each one.** These are steps. Each step is its own form and its own CRUD operation, and the result
of one (`onSuccess`, `onResult`, `await form.callback(...)`) opens the next:

```tsx
<CreateForm table='orders' schema={orders} defaults={{ item: '' }}>
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

**One has to follow automatically.** For example, an order records a payment. Done from the client, a second request
could be skipped, or interrupted halfway. So the payment is a side effect in the `create` handler for `orders`, in the
same transaction. The handler returns the order. Views of `payments` refetch with `list.trigger(...)` in the form's
`onSuccess`.

A server action that calls an LLM and saves nothing (a draft) is a step too. Its result fills a `CreateForm`:

```tsx
<CreateForm table='posts' schema={posts} defaults={{ title: '', body: '' }}>
  {post => (
    <form onSubmit={post.submit}>
      <Form defaults={{ topic: '' }} action={draftPost} onResult={draft => post.setFields(f => ({ ...f, ...draft }))}>
        {draft => <button type='button' onClick={draft.submit} disabled={draft.loading}>Draft</button>}
      </Form>
      <TitleField />
      <BodyField />
      <button type='submit' disabled={post.loading}>Create post</button>
    </form>
  )}
</CreateForm>
```

---

## Rapid prototyping

New apps, prototypes and demos start on the framework from day one, not on `useState` or mock arrays. Without a
backend, `asasvirtuais-dexie` stores the tables in IndexedDB:

```tsx
// app/providers.tsx
'use client'
import { dexieInterface } from 'asasvirtuais-dexie'
import { InterfaceProvider } from 'asasvirtuais/context'
import { schema } from './schema'

const db = dexieInterface(schema)

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <InterfaceProvider {...db}>{children}</InterfaceProvider>
}
```

Moving to production means replacing `dexieInterface` with the CRUD file. The UI stays the same.

---

## Naming

| Concept | Pattern | Example |
|---|---|---|
| Table name | lowercase plural | `'todos'` |
| Schema types | `Readable`, `Writable` | |
| Field components | `{Field}Field` | `TitleField` |
| Table provider | `{Model}sProvider` | `TodosProvider` |
| Single provider | `{Model}Provider` | `TodoProvider` |
| Hooks | `use{Model}s()`, `use{Model}()` | `useTodos()`, `useTodo()` |
| Forms | `Create{Model}`, `Update{Model}`, `Filter{Model}s` | `UpdateTodo` |
| Delete action | `Delete{Model}` | `DeleteTodo` |
| One-click update | `{Verb}{Model}` | `ToggleTodo` |
| Item / detail | `{Model}Item`, `Single{Model}` | `TodoItem`, `SingleTodo` |

## API

| Import | Exports |
|---|---|
| `asasvirtuais/form` | `Form`, `useForm` |
| `asasvirtuais/fields` | `FieldsProvider`, `useFields`, `useField` |
| `asasvirtuais/action` | `ActionProvider`, `useAction` |
| `asasvirtuais/forms` | `CreateForm`, `UpdateForm`, `FilterForm`, `useCreateForm`, `useUpdateForm`, `useFilterForm` |
| `asasvirtuais/context` | `InterfaceProvider`, `TablesProvider`, `useTable(table, schema)` |
| `asasvirtuais/registry` | `SingleProvider`, `useSingle(schema, table)` |
| `asasvirtuais/interface` | `makeSchemaTableInterface`, `TableInterface`, `Query`, `TableSchema` |

`useTable` returns `index`, `array`, and `find` / `list` / `create` / `update` / `remove`, each as
`{ trigger, loading, result }`.

---

# Coding rules

### 1. Single source of truth
Inside a `SingleProvider` (`{Model}Provider`), read data through its hook (`use{Model}()`). Components are hook-driven:
they don't receive the model, or attributes already available from it (id, slug, title...), as props.

### 2. Page architecture
Keep `page.tsx` a Server Component, especially when `params`/`searchParams` are involved. Build the page from an
HTML/Tailwind skeleton with focused atomic components arranged inside it. Keep data fetching declarative with client
`<Filter{Model}s autoTrigger>` forms or `useTable().list.trigger()`. Don't hydrate tables with `asAbove` (deprecated
in v5). Scope `TablesProvider` per route or layout with only the tables it needs. Use parallel route slots (e.g.
`@modal`) for dialogs, drawers and overlays.

### 3. Layout hoisting
When sibling routes share tables, layout shell, header, nav or provider stack, mount them in `layout.tsx` with a scoped
`TablesProvider` or single entity providers (`{Model}Provider`). Child pages and parallel route slots inherit them.

### 4. Package vs app boundaries
`packages/{model}/` stays atomic and reusable: `schema.ts`, `fields.tsx`, `forms.tsx`, `components.tsx`,
`providers.tsx`, `hooks.tsx`. Full-page layouts, multi-tab coordinators, route-specific modals and page composition
live in `app/...`, organized with the component-directory architecture (rule 11). Markup goes directly in `page.tsx`
rather than in an intermediary view component.

### 5. Naming & closures
Use plain, contextual names scoped to the file (`title`, `counters`, `level`, `portrait`), and pass props and closure
variables through with their natural names.

### 6. Trust the schema
Access typed, guaranteed fields directly (`record.name`). Define optional/nullable fields explicitly in the schema and
handle them with standard UI defaults.

### 7. Fail fast
Let errors surface: throw `new Error('Unauthorized')` for missing auth, call `notFound()` for missing entities, throw
`new Error('Forbidden')` for failed permission checks, and let `error.tsx` boundaries present them.

### 8. Use framework forms
Database operations use `CreateForm`, `UpdateForm` and `FilterForm` from `asasvirtuais/forms` (plural) with atomic
fields, and rely on the reactive index to update the UI. That includes single-column updates (a flag, a status, a
name), which are an `UpdateForm` with one field rather than a custom server action. Favor `CreateForm` over calling
`use{Model}().create.trigger` directly, unless custom create behavior is needed.

### 9. Lean server actions
Writes to the database go through the CRUD in `app/actions.ts`, where their pre-flight checks and side effects live.
Each extra action that writes is another way into the database, with its own copy of the checks or none. A
component's `actions.tsx` (rule 11) holds what isn't a CRUD operation: LLM calls, previews, external APIs, server-side
reads. Keep each action to one clear operation with a direct implementation.

### 10. Plain text
Use simple, direct language for buttons, headings and other text: "Main", "Create {Object}", "Update {Object}",
"Delete {Object}", "List {Objects}", "Search", "Clear", "Cancel".

### 11. Component-directory architecture
Every page keeps its own components in a `components/` directory next to its `page.tsx`. Each component is a directory:

```
app/(app)/chat/[id]/
├── page.tsx
└── components/
    ├── composer/
    │   ├── component.tsx   # 'use client': the UI
    │   └── actions.tsx     # 'use server': the server actions it calls
    └── thread/
        ├── index.tsx       # server component (server-side fetching), when needed
        ├── component.tsx
        ├── context.tsx     # shared context and its hook, when needed
        ├── hooks.tsx       # local state management, when needed
        └── actions.tsx
```

- Directory names are lowercase and kebab-case. Prefer a single word (`composer`, `thread`, `rewards`).
- Only create the files a component needs. A component that uses the framework forms is often just `component.tsx`.
  `actions.tsx` appears when it has a non-CRUD action (rule 9). `index.tsx` is optional.
- The code a component needs lives in its directory: its prompts, schemas for its LLM calls, and helpers used only
  there. Don't move code out "for reuse" before it's actually reused.
- A component used by more than one page lives with the closest common route (e.g. `app/(app)/chat/[id]/components/`),
  not in a global folder.

### 12. Libraries only for repeated code
`lib/` is not a home for features. A library is a small single file (an LLM helper, the database client, auth, the
action wrapper) and only appears once the same code repeats across several actions. Until then, the code stays in the
component's `actions.tsx`. No layers of wrappers: an action calls the database client and the LLM helper directly.

### 13. Actions return errors
Production hides the message of an error a server action throws, so every server action is wrapped with `action(...)`
from `lib/action.ts`, including the CRUD. Inside, keep failing fast with `throw` (rule 7); the wrapper returns
`{ error: message }`. Client components unwrap a module once (`const { name } = unwrap(actions)`), so `ActionProvider`
and the forms show the message. Server code calling another action uses `ok(await name(...))`.

---

# Project

<!-- Per app: database adapter, auth, tables, conventions, legacy code that shouldn't be copied. -->
