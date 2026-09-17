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
      <input type='checkbox' checked={fields.done} onChange={e => setField('done', e.target.checked)} />
    </div>
  )}
</FieldsProvider>
```

### `ActionProvider` — async action state

Tracks execution state (`loading`, `result`), an `errors` array of all caught errors, and an `error` state representing the most recent error (`Error | null`).

```tsx
import { ActionProvider } from 'asasvirtuais/action'

<ActionProvider params={{ id: todo.id }} action={archiveTodo} onResult={() => router.push('/')}>
  {({ submit, loading, error }) => (
    <div>
      <button onClick={submit} disabled={loading}>
        {loading ? 'Archiving...' : 'Archive'}
      </button>
      {error && <p>{error.message}</p>}
    </div>
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
      <input type='password' value={fields.password} onChange={e => setField('password', e.target.value)} />
      <button type='submit' disabled={loading}>Login</button>
      {error && <p>{error.message}</p>}
    </form>
  )}
</Form>
```

#### Nested forms & async multi-step flows (namespaced render props)

When building multi-step wizards or composing sub-forms (forms inside forms), **name the render-props parameter after what the form represents** (for example, `order` and `zip`) instead of destructuring `{ fields, setField, submit }`.

This namespaces all fields, actions, and states in the same lexical closure, allowing the developer to access `order.fields` and `zip.fields` side-by-side without collisions:

```tsx
import { Form } from 'asasvirtuais/form'

// Async action handlers
async function submitOrder(data: { item: string quantity: number address: string }) {
  return await placeOrder(data)
}

async function lookupZip(data: { zipCode: string }) {
  return await fetchAddressByZip(data.zipCode)
}

export function CheckoutForm() {
  return (
    <Form
      defaults={{ item: 'Mechanical Keyboard', quantity: 1, address: '' }}
      action={submitOrder}
      onResult={result => alert(`Order placed: ${result.id}`)}
    >
      {order => (
        <form onSubmit={order.submit}>
          <h3>Order Details</h3>

          <input
            value={order.fields.item}
            onChange={e => order.setField('item', e.target.value)}
          />
          <input
            type='number'
            value={order.fields.quantity}
            onChange={e => order.setField('quantity', Number(e.target.value))}
          />

          {/* Nested async form for postal code verification & address lookup */}
          <Form defaults={{ zipCode: '' }} action={lookupZip}>
            {zip => (
              <div className='nested-lookup'>
                <h4>Shipping Address Lookup</h4>
                <input
                  placeholder='Enter ZIP code...'
                  value={zip.fields.zipCode}
                  onChange={e => zip.setField('zipCode', e.target.value)}
                />
                <button
                  type='button'
                  disabled={zip.loading || !zip.fields.zipCode}
                  onClick={async () => {
                    // Trigger the inner async action and set the outer form field in the same closure
                    const addressInfo = await zip.callback(zip.fields)
                    order.setField('address', `${addressInfo.street}, ${addressInfo.city} - ${addressInfo.state}`)
                  }}
                >
                  {zip.loading ? 'Verifying ZIP...' : 'Autofill Address'}
                </button>
                {zip.error && <p className='error'>{zip.error.message}</p>}
              </div>
            )}
          </Form>

          {/* Display address populated from the nested form */}
          {order.fields.address && (
            <p><strong>Shipping to:</strong> {order.fields.address}</p>
          )}

          <button type='submit' disabled={order.loading}>
            {order.loading ? 'Placing Order...' : 'Place Order'}
          </button>
          {order.error && <p className='error'>{order.error.message}</p>}
        </form>
      )}
    </Form>
  )
}
```

Key advantages of namespacing props:
- **Zero collisions in closure:** `order.fields` and `zip.fields` (plus `order.setField`, `zip.callback`, etc.) coexist cleanly without naming clashes or prop drilling.
- **Independent async states:** `order.loading` and `zip.loading` run independently. Sub-actions do not falsely trigger loading on the parent form.
- **Multi-step wizards:** Inner forms can act as discrete validation steps, remote token generators, or async selectors, writing back their validated results to `order.setField(...)` before the parent form advances or completes.

---

## Full-stack CRUD

The framework provides a schema-first CRUD layer where create, update, and remove operations automatically keep the UI in sync through a reactive index — no manual state updates, no refetching.

### Project structure

```
app/
├── schema.ts             # All table schemas in one place
├── actions.ts            # Server actions — the backend
├── providers.tsx         # App-level providers (InterfaceProvider + TablesProvider)
├── layout.tsx
├── todos/
│   ├── schema.ts         # Schema + types
│   ├── fields.tsx        # Input components
│   ├── forms.tsx         # Create / Update / Delete / Filter forms
│   ├── components.tsx    # Display components
│   └── hooks.tsx         # useTodos hook (wrapping useTable)
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
import { InterfaceProvider, TablesProvider } from 'asasvirtuais/context'
import * as actions from '@/app/actions'
import { schema as todosSchema } from '@/app/todos/schema'
import { schema as tagsSchema } from '@/app/tags/schema'

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <InterfaceProvider {...actions}>
      <TablesProvider tables={{ todos: todosSchema, tags: tagsSchema }}>
        {children}
      </TablesProvider>
    </InterfaceProvider>
  )
}
```

- **`InterfaceProvider`**: Receives `find`, `list`, `create`, `update`, and `remove` directly as props instead of an interface method, so you spread them (`<InterfaceProvider {...actions}>`).
- **`TablesProvider`**: Configured collectively using the pattern `<TablesProvider tables={{ [tableA]: schemaA, tableB: schemaB }} />`. You no longer pass interface methods to the table provider; it automatically relies on the interfaces having already been passed to the `InterfaceProvider` above.

```tsx
// app/layout.tsx
import AppProviders from './providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
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

### 4. Model hook

Since tables are provided collectively via `TablesProvider`, individual model providers are no longer needed. Simply define a model hook wrapping `useTable`:

```tsx
// app/todos/hooks.tsx
'use client'
import { useTable } from 'asasvirtuais/context'
import { schema } from './schema'

export function useTodos() {
  return useTable('todos', schema)
}
```

---

### 5. UI

```tsx
// app/todos/page.tsx
'use client'
import { useEffect } from 'react'
import { useTodos } from './hooks'
import { SingleProvider } from 'asasvirtuais/single'
import { schema } from './schema'
import { TodoItem } from './components'
import { CreateTodo } from './forms'

export default function TodosPage() {
  const { array, list } = useTodos()

  useEffect(() => { list.trigger({}) }, [])

  return (
    <div>
      <CreateTodo />
      {array.map(todo => (
        <SingleProvider key={todo.id} id={todo.id} table='todos' schema={schema}>
          <TodoItem />
        </SingleProvider>
      ))}
    </div>
  )
}
```

When `create` resolves, the item appears in `array` immediately. Same for `update` and `remove`.

---

## Rapid prototyping & demo bootstrapping (AGENTS.md standard)

> [!IMPORTANT]
> **Architecture rule for agents and developers:**
> When building new applications, prototypes, or feature demos, **always initiate apps directly with the framework from scratch**. Never build throwaway UI mockups using disconnected React state (`useState`) or temporary mock arrays. The UI demos should *already* be built on the framework architecture from day one.

### The zero-backend bootstrap strategy: `asasvirtuais-dexie` + `TablesProvider`

To prototype rapidly without setting up a remote backend or database:
1. Use client-side IndexedDB via `asasvirtuais-dexie` as the `TableInterface`.
2. Wrap your application with `InterfaceProvider` (spreading the adapter methods) and `TablesProvider` with your table schemas.

```tsx
// app/providers.tsx
'use client'
import { dexieInterface } from 'asasvirtuais-dexie'
import { InterfaceProvider, TablesProvider } from 'asasvirtuais/context'
import { schema as todosSchema } from './todos/schema'
import { schema as tagsSchema } from './tags/schema'

// 1. Client-side IndexedDB adapter matching the TableInterface contract
const db = dexieInterface({
  todos: todosSchema,
  tags: tagsSchema,
})

export default function DemoProviders({ children }: { children: React.ReactNode }) {
  return (
    <InterfaceProvider {...db}>
      <TablesProvider tables={{ todos: todosSchema, tags: tagsSchema }}>
        {children}
      </TablesProvider>
    </InterfaceProvider>
  )
}
```

### Transitioning from demo to production

Because your prototype already uses `TablesProvider`, `CreateForm`, `SingleProvider`, and reactive hooks, transitioning to production requires **zero changes to your UI or business logic components**:

1. Replace `dexieInterface` in `AppProviders` with server actions (`makeSchemaTableInterface`) or `asasvirtuais-firebase`.

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
  <SingleProvider key={todo.id} id={todo.id} table='todos' schema={schema}>
    <TodoItem />
  </SingleProvider>
))
```

### `FilterForm` — local, paginated, or conditional

Use `FilterForm` when you need pagination, live search, or results that belong to the component rather than the global index. Using `FilterForm` is better for pagination. Unlike `useTable.list`, the `FilterForm` only saves the result to the `result` prop (inside the child function) rather than updating the global index. Results only update when `submit` is called:

```tsx
import { FilterForm } from 'asasvirtuais/forms'
import { schema } from './schema'

<FilterForm table='todos' schema={schema} defaults={{ query: { done: false } }} autoTrigger>
  {({ result, loading, fields, setField, submit }) => (
    <div>
      <input
        placeholder='Search...'
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
> **Combining with `SingleProvider`:** If you use `FilterForm`, you can combine it with `SingleProvider` (from `asasvirtuais/single`) by passing just the record's `id`. This ensures that the piece of data you want to present is always updated and reactive. For example, if your list query only fetches a subset of fields, but you need to show the full object details in a drawer or modal, wrapping the detail view in a `SingleProvider` will automatically fetch the complete object from the index if it's not already fully cached, while allowing the list itself to use the `result` array instead of the global `array`.

---

## Async selector fields

When a form needs the user to pick a record from another table, `FilterForm` composes naturally inside a field component. The field reads and writes to the parent form's context via `useFields()` — no props needed to bridge them.

Say a todo can be tagged, and the user needs to search and select a tag while creating the todo:

```tsx
// app/todos/fields.tsx
import { useFields } from 'asasvirtuais/fields'
import { FilterForm } from 'asasvirtuais/forms'
import { schema as tagsSchema } from '@/app/tags/schema'

export function TagSelectorField() {
  // reads/writes to whatever Form or FieldsProvider this is rendered inside
  const { fields, setField } = useFields<{ tagId: string }>()

  return (
    <FilterForm table='tags' schema={tagsSchema} defaults={{ query: {} }}>
      {({ fields: search, setField: setSearch, submit, result }) => (
        <div>
          <input
            placeholder='Search tags...'
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
import { CreateForm } from 'asasvirtuais/forms'
import { schema } from './schema'
import { TitleField, TagSelectorField } from './fields'

export function CreateTodo({ onSuccess }: { onSuccess?: () => void }) {
  return (
    <CreateForm table='todos' schema={schema} defaults={{ title: '', tagId: '' }} onSuccess={onSuccess}>
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
import { SingleProvider, useSingle } from 'asasvirtuais/single'

// Detail page
<SingleProvider id={params.id} table='todos' schema={schema}>
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

### Nesting `SingleProvider`s

If you're going to nest 2 `SingleProvider`s, you have to keep the parent object:

```tsx
<SingleProvider table='users' schema={usersSchema} id={currentUserId}>
    {({single: user}) => (
        <SingleProvider table='todos' schema={todosSchema} id={todoId}>
            {({single: todo}) => (
                // Here you have to use the user variable because useSingle('users') won't work anymore.
                <div>
                  <p>User: {user.name}</p>
                  <p>Todo: {todo.title}</p>
                </div>
            )}
        </SingleProvider>
    )}
</SingleProvider>
```

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
  table='todos'
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
| Tables provider | `TablesProvider` | `<TablesProvider tables={{ todos: schema }} />` |
| Hook | `use{Model}s()` | `useTodos()` |
| Create form | `Create{Model}` | `CreateTodo` |
| Update form | `Update{Model}` | `UpdateTodo` |
| Delete action | `Delete{Model}` | `DeleteTodo` |
| Item component | `{Model}Item` | `TodoItem` |
| Detail component | `Single{Model}` | `SingleTodo` |

---

## Error handling (optional pattern)

`asasvirtuais` doesn't enforce a return or throw convention for actions — that's intentional. Most MVPs don't need error handling beyond 'don't crash,' and this pattern exists for when you do.

```ts
// app/actions.ts
export const { find, list, create, update, remove } = makeSchemaTableInterface(schema, null, {
  create: async (props) => {
    try {
      return await db.create(props)
    } catch (error) {
      return { error }
    }
  },
  // same shape for update, remove, etc.
})!
```

```tsx
// app/providers.tsx — wrap the methods passed to InterfaceProvider
import { InterfaceProvider, TablesProvider } from 'asasvirtuais/context'

const wrap = (fn: Function) => async (props: any) => {
  const result = await fn(props)
  if (result?.error) throw result.error
  return result
}

<InterfaceProvider
  find={wrap(find)}
  list={wrap(list)}
  create={wrap(create)}
  update={wrap(update)}
  remove={wrap(remove)}
>
  <TablesProvider tables={{ todos: schema }}>
    {children}
  </TablesProvider>
</InterfaceProvider>
```
