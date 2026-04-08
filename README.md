# asasvirtuais

A React framework for building full-stack apps where code is organized by feature, not by layer.

---

## Primitives

Three building blocks, each usable on its own.

### `FieldsProvider` — field state

```tsx
import { FieldsProvider } from 'asasvirtuais/fields'

<FieldsProvider defaults={{ title: '', done: false }}>
  {({ fields, setField }) => (
    <div>
      <input value={fields.title} onChange={e => setField('title', e.target.value)} />
      <input type="checkbox" checked={fields.done} onChange={e => setField('done', e.target.checked)} />
    </div>
  )}
</FieldsProvider>
```

### `ActionProvider` — async action state

```tsx
import { ActionProvider } from 'asasvirtuais/action'

<ActionProvider params={{ id: todo.id }} action={archiveTodo} onResult={() => router.push('/')}>
  {({ submit, loading, error }) => (
    <button onClick={submit} disabled={loading}>
      {loading ? 'Archiving...' : 'Archive'}
    </button>
  )}
</ActionProvider>
```

### `Form` — fields + action together

```tsx
import { Form } from 'asasvirtuais/form'

<Form defaults={{ email: '', password: '' }} action={login} onResult={handleResult}>
  {({ fields, setField, submit, loading, error }) => (
    <form onSubmit={submit}>
      <input value={fields.email} onChange={e => setField('email', e.target.value)} />
      <input type="password" value={fields.password} onChange={e => setField('password', e.target.value)} />
      <button type="submit" disabled={loading}>Login</button>
      {error && <p>{error.message}</p>}
    </form>
  )}
</Form>
```

---

## Full-stack CRUD

The framework provides a schema-first CRUD layer where create, update, and remove operations automatically keep the UI in sync through a reactive index — no manual state updates, no refetching.

### Project structure

```
app/
├── schema.ts             # All table schemas in one place
├── actions.ts            # Server actions — the backend
├── providers.tsx         # App-level providers
├── layout.tsx
├── todos/
│   ├── schema.ts          # Schema + types
│   ├── fields.tsx        # Input components
│   ├── forms.tsx         # Create / Update / Delete / Filter forms
│   ├── components.tsx    # Display components
│   └── provider.tsx      # TableProvider + hook
```

---

### 1. Schema

Each model defines `readable` (what comes out of the database) and `writable` (what users can create or modify):

```ts
// app/todos/schema.ts
import z from 'zod'

export const readable = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  author: z.string(),
  createdAt: z.string(),
})

export const writable = readable.pick({
  title: true,
  done: true,
})

export const schema = { readable, writable }

export type Readable = z.infer<typeof readable>
export type Writable = z.infer<typeof writable>
```

All models are assembled into a single database schema file:

```ts
// app/schema.ts
import { schema as todosSchema } from './todos/schema'
import { schema as tagsSchema } from './tags/schema'

export const schema = {
  todos: todosSchema,
  tags: tagsSchema,
}
```

---

### 2. Server actions — the backend

The backend is plain Next.js server actions. You pass them directly to the provider — no REST routes, no fetch client needed:

```ts
// app/actions.ts
'use server'

import { firestoreInterface } from 'asasvirtuais-firebase/interface'
import { auth0 } from '@/lib/auth0'

const db = firestoreInterface()

function clean(obj: any): any {
  if (Array.isArray(obj)) return obj.map(clean)
  if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, clean(v)])
    )
  }
  return obj
}

export const find = async (props: any) => db.find(props)

export const list = async (props: any) => db.list(props)

export const create = async (props: any) => {
  const session = await auth0.getSession()
  if (!session?.user) throw new Error('Unauthorized')

  const data = clean({ ...props.data })

  if (props.table === 'todos') {
    data.author = session.user.id
    data.done = false
    data.createdAt = new Date().toISOString()
  }

  return db.create({ ...props, data })
}

export const update = async (props: any) => {
  const session = await auth0.getSession()
  if (!session?.user) throw new Error('Unauthorized')

  const data = clean({ ...props.data })

  if (props.table === 'todos') {
    const existing = await db.find({ table: 'todos', id: props.id })
    if (existing.author !== session.user.id) throw new Error('Forbidden')
  }

  return db.update({ ...props, data })
}

export const remove = async (props: any) => {
  const session = await auth0.getSession()
  if (!session?.user) throw new Error('Unauthorized')

  if (props.table === 'todos') {
    const existing = await db.find({ table: 'todos', id: props.id })
    if (existing.author !== session.user.id) throw new Error('Forbidden')
  }

  return db.remove(props)
}
```

This is where business logic lives: auth, default values, permission checks. All in one place, all readable top to bottom.

---

### 3. Providers

```tsx
// app/providers.tsx
import { InterfaceProvider } from 'asasvirtuais/interface-provider'
import { DatabaseProvider } from 'asasvirtuais/react-interface'
import { TodosProvider } from '@/app/todos/provider'
import * as db from '@/app/actions'

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <InterfaceProvider
      find={db.find}
      list={db.list}
      create={db.create}
      update={db.update}
      remove={db.remove}
    >
      <DatabaseProvider>
        <TodosProvider>
          {children}
        </TodosProvider>
      </DatabaseProvider>
    </InterfaceProvider>
  )
}
```

```tsx
// app/layout.tsx
import AppProviders from './providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  )
}
```

---

### 4. Model provider

```tsx
// app/todos/provider.tsx
'use client'
import { TableProvider, useTable } from 'asasvirtuais/react-interface'
import { useInterface } from 'asasvirtuais/interface-provider'
import { schema } from '.'

export function useTodos() {
  return useTable('todos', schema)
}

export function TodosProvider({ children }: { children: React.ReactNode }) {
  return (
    <TableProvider table="todos" schema={schema} interface={useInterface()}>
      {children}
    </TableProvider>
  )
}
```

---

### 5. UI

```tsx
// app/todos/page.tsx
'use client'
import { useEffect } from 'react'
import { useTodos } from './provider'
import { SingleProvider } from 'asasvirtuais/react-interface'
import { schema } from '.'
import { TodoItem } from './components'
import { CreateTodo } from './forms'

export default function TodosPage() {
  const { array, list } = useTodos()

  useEffect(() => { list.trigger({}) }, [])

  return (
    <div>
      <CreateTodo />
      {array.map(todo => (
        <SingleProvider key={todo.id} id={todo.id} table="todos" schema={schema}>
          <TodoItem />
        </SingleProvider>
      ))}
    </div>
  )
}
```

When `create` resolves, the item appears in `array` immediately. Same for `update` and `remove`.

---

## Listing vs. filtering

### `useTable().list` — reactive, global

Use this when you want all records in the reactive index. Results live in `array` and stay in sync with every create, update, and remove automatically:

```tsx
const { array, list } = useTodos()

useEffect(() => { list.trigger({}) }, [])

// array updates automatically when any todo is created, updated, or removed
return array.map(todo => (
  <SingleProvider key={todo.id} id={todo.id} table="todos" schema={schema}>
    <TodoItem />
  </SingleProvider>
))
```

### `FilterForm` — local, paginated, or conditional

Use `FilterForm` when you need pagination, live search, or results that belong to the component rather than the global index. Results live in `form.result` and only update when `submit` is called:

```tsx
import { FilterForm } from 'asasvirtuais/form'
import { schema } from '.'

<FilterForm table="todos" schema={schema} defaults={{ query: { done: false } }} autoTrigger>
  {({ result, loading, fields, setField, submit }) => (
    <div>
      <input
        placeholder="Search..."
        value={fields.query?.title ?? ''}
        onChange={e => {
          setField('query', { title: e.target.value })
          submit()
        }}
      />
      {loading && <p>Loading...</p>}
      {result?.map(todo => <p key={todo.id}>{todo.title}</p>)}
    </div>
  )}
</FilterForm>
```

---

## Async selector fields

When a form needs the user to pick a record from another table, `FilterForm` composes naturally inside a field component. The field reads and writes to the parent form's context via `useFields()` — no props needed to bridge them.

Say a todo can be tagged, and the user needs to search and select a tag while creating the todo:

```tsx
// app/todos/fields.tsx
import { useFields } from 'asasvirtuais/fields'
import { FilterForm } from 'asasvirtuais/form'
import { schema as tagsSchema } from '@/app/tags'

export function TagSelectorField() {
  // reads/writes to whatever Form or FieldsProvider this is rendered inside
  const { fields, setField } = useFields<{ tagId: string }>()

  return (
    <FilterForm table="tags" schema={tagsSchema} defaults={{ query: {} }}>
      {({ fields: search, setField: setSearch, submit, result }) => (
        <div>
          <input
            placeholder="Search tags..."
            onChange={e => {
              setSearch('query', { name: e.target.value })
              submit()
            }}
          />
          <ul>
            {result?.map(tag => (
              <li
                key={tag.id}
                onClick={() => setField('tagId', tag.id)}
                style={{ fontWeight: fields.tagId === tag.id ? 'bold' : 'normal' }}
              >
                {tag.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </FilterForm>
  )
}
```

Use it inside any form — it just works:

```tsx
// app/todos/forms.tsx
import { CreateForm } from 'asasvirtuais/form'
import { schema } from '.'
import { TitleField, TagSelectorField } from './fields'

export function CreateTodo({ onSuccess }: { onSuccess?: () => void }) {
  return (
    <CreateForm table="todos" schema={schema} defaults={{ title: '', tagId: '' }} onSuccess={onSuccess}>
      {({ submit, loading }) => (
        <div>
          <TitleField />
          <TagSelectorField />
          <button onClick={submit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Todo'}
          </button>
        </div>
      )}
    </CreateForm>
  )
}
```

The `FilterForm` queries the `tags` table asynchronously. The `CreateForm` owns the selected `tagId`. Neither knows about the other.

---

## The single record pattern

`SingleProvider` makes a record available to all its descendants without prop drilling. When multiple components share one record, wrap them all in one provider:

```tsx
import { SingleProvider, useSingle } from 'asasvirtuais/react-interface'

// Detail page
<SingleProvider id={params.id} table="todos" schema={schema}>
  <TodoDetail />
  <UpdateTodoForm />
  <DeleteTodoButton />
</SingleProvider>

// Inside any of those:
function TodoDetail() {
  const { single } = useSingle(schema, 'todos')
  return <h1>{single.title}</h1>
}
```

If the record isn't in the reactive index yet, `SingleProvider` fetches it automatically.

---

## Effects

There is no middleware or lifecycle configuration. Effects are code written around the action:

```tsx
// Before submit
<button onClick={() => {
  validateForm(form.fields)
  form.submit()
}}>
  Save
</button>

// After success
<CreateForm
  table="todos"
  schema={schema}
  onSuccess={todo => {
    router.push(`/todos/${todo.id}`)
    showNotification('Todo created!')
  }}
>
  {/* ... */}
</CreateForm>

// Using field values without submitting
<button onClick={() => saveDraftLocally(form.fields)}>
  Save Draft
</button>
```

---

## Naming pattern examples

| Concept | Pattern | Example |
|---|---|---|
| Table name | lowercase plural | `'todos'` |
| Schema types | `Readable`, `Writable` | `type Readable = z.infer<...>` |
| Field components | `{Field}Field` | `TitleField`, `DoneField` |
| Provider | `{Model}sProvider` | `TodosProvider` |
| Hook | `use{Model}s()` | `useTodos()` |
| Create form | `Create{Model}` | `CreateTodo` |
| Update form | `Update{Model}` | `UpdateTodo` |
| Delete action | `Delete{Model}` | `DeleteTodo` |
| Item component | `{Model}Item` | `TodoItem` |
| Detail component | `Single{Model}` | `SingleTodo` |