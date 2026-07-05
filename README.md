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

// any database adapter works here — firestoreInterface is just an example
import { firestoreInterface } from 'asasvirtuais-firebase/interface'
import { makeSchemaTableInterface } from 'asasvirtuais/interface'
import { schema } from './schema'

const db = firestoreInterface()

export const { find, list, create, update, remove } = makeSchemaTableInterface(schema, null, {
  find: async (props) => db.find(props),

  list: async (props) => db.list(props),

  create: async (props) => {
    // authentication, validation, default values...
    const result = await db.create(props)
    // after-effects: send email, trigger webhook, revalidate cache...
    return result
  },

  update: async (props) => {
    // authentication, authorization, validation...
    const result = await db.update(props)
    // after-effects...
    return result
  },

  remove: async (props) => {
    // authentication, authorization...
    const result = await db.remove(props)
    // after-effects...
    return result
  },
})!
```

This is where business logic lives: auth, default values, permission checks. All in one place, all readable top to bottom.

#### Method props

Each method receives props automatically typed to the schema and table being used:

| Method   | Props |
|----------|-------|
| `find`   | `{ table?: string, id: string }` |
| `list`   | `{ table?: string, query?: Query<Readable> }` |
| `create` | `{ table?: string, data: Writable }` |
| `update` | `{ table?: string, id: string, data: Partial<Writable> }` |
| `remove` | `{ table?: string, id: string }` |

`Query` is FeathersJS-inspired and supports field matching plus operators:

```ts
{
  // field matchers
  title: 'Buy milk',
  done: false,

  // comparison operators
  createdAt: { $gt: '2024-01-01' },
  priority: { $in: [1, 2, 3] },

  // pagination & projection
  $limit: 10,
  $skip: 20,
  $sort: { createdAt: -1 },
  $select: ['id', 'title'],

  // logical operators
  $or: [{ done: true }, { title: 'urgent' }],
}
```

Available operators: `$ne`, `$lt`, `$lte`, `$gt`, `$gte`, `$in`, `$nin`, `$or`, `$and`.

---

### 3. Providers

```tsx
// app/providers.tsx
import { InterfaceProvider } from 'asasvirtuais/interface-provider'
import { DatabaseProvider } from 'asasvirtuais/react-interface'
import { TodosProvider } from '@/app/todos/provider'
import { find, list, create, update, remove } from '@/app/actions'

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <InterfaceProvider
      find={find}
      list={list}
      create={create}
      update={update}
      remove={remove}
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

These represent two distinct approaches to fetching data:

### `useTable().list` — reactive, global

Use this when you want the fetched results to be available across the entire application. The `useTable.list` method updates the global index at the table context level (app level). Results live in `array` and stay in sync with every create, update, and remove automatically:

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

Use `FilterForm` when you need pagination, live search, or results that belong to the component rather than the global index. Using `FilterForm` is better for pagination. Unlike `useTable.list`, the `FilterForm` only saves the result to the `result` prop (inside the child function) rather than updating the global index. Results only update when `submit` is called:

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

> [!TIP]
> **Combining with `SingleProvider`:** If you use `FilterForm`, you can combine it with `SingleProvider` by passing just the record's `id`. This ensures that the piece of data you want to present is always updated and reactive. For example, if your list query only fetches a subset of fields, but you need to show the full object details in a drawer or modal, wrapping the detail view in a `SingleProvider` will automatically fetch the complete object from the index if it's not already fully cached, while allowing the list itself to use the `result` array instead of the global `array`.

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

---

## `asasvirtuais/post`

Ready-to-use module for handling content items like blog posts or articles.

### Sub-modules

- `asasvirtuais/post/schema`: The Zod schema and `Post` type.
- `asasvirtuais/post/provider`: `PostsProvider` and `usePosts` hook.
- `asasvirtuais/post/fields`: Pre-built input components.

### Schema

```ts
import z from 'zod'

export const readable = z.object({
    id: z.string(),
    type: z.string().default('post'),
    name: z.string(),
    slug: z.string(),
    title: z.string(),
    content: z.string(),
    definition: z.string(),
    description: z.string(),
    thumbnail: z.string(),
    cover: z.string(),
    tags: z.string().array(),
})

export const writable = readable.pick({
    name: true,
    type: true,
    slug: true,
    title: true,
    content: true,
    definition: true,
    description: true,
    thumbnail: true,
    cover: true,
    tags: true,
})

export const schema = {
    readable,
    writable,
}

export type Post = z.infer<typeof schema.readable>
```

### Exported Components (`asasvirtuais/post/fields`)

- `NameInput`
- `TitleInput`
- `SlugInput`
- `DescriptionInput`
- `DefinitionTextarea`
- `DescriptionTextarea`