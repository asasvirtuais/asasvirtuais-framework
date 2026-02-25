# asasvirtuais Framework — AI Reference Guide
> For AI coding assistants. This guide covers building local-first PWA apps (no server, no backend) using the asasvirtuais framework with React, Next.js App Router, and IndexedDB.

---

## INSTALLATION & SETUP

```bash
npm install asasvirtuais
```

`asasvirtuais` is a **TypeScript-source-only package** — it ships `.ts` and `.tsx` files with no pre-compilation step. This means the consuming app is responsible for transpiling it, which requires framework-specific configuration.

### Next.js (App Router)

Add `asasvirtuais` to `transpilePackages` in `next.config.ts`. This tells Next.js to run the package through its own compiler rather than expecting pre-built JS.

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['asasvirtuais'],
}

export default nextConfig
```

### Vite (React SPA / PWA)

Vite's dep optimizer uses esbuild to pre-bundle dependencies, but by default it does not process `.ts` files inside `node_modules`. You need to: (1) tell esbuild to handle TypeScript extensions inside the package, and (2) explicitly include `dexie` (a dependency of `asasvirtuais`) in the optimization boundary so it gets pre-bundled correctly alongside the package.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['asasvirtuais', 'dexie'],
    esbuildOptions: {
      loader: {
        '.ts': 'ts',
        '.tsx': 'tsx',
      },
    },
  },
})
```

### Imports

All framework primitives are imported directly from their source file within the package. There is no barrel `index` re-exporting everything — import from the specific module:

```ts
import { useFields }                    from 'asasvirtuais/fields'
import { useAction }                    from 'asasvirtuais/action'
import { IndexedInterfaceProvider }     from 'asasvirtuais/indexed-interface'
import { InterfaceProvider, useInterface } from 'asasvirtuais/interface-provider'
import {
  TableProvider,
  useTable,
  SingleProvider,
  useSingle,
  CreateForm,
  UpdateForm,
  FilterForm,
} from 'asasvirtuais/react-interface'
```

---

## WHAT WE'RE BUILDING

The target product is a **local-first SPA installable as a PWA**. All data lives in IndexedDB on the user's device — no server, no cloud, no login required. The typical app has three sections:

- A **landing page** that presents the product, its value proposition, and a call to action. This is a marketing/presentation page.
- An **onboarding flow** where the user configures the app for their needs — this might mean entering a name, choosing preferences, or saving an API key for an AI feature. Onboarding data is saved to IndexedDB just like any other entity.
- The **main app** where the user creates and manages their data. This is a standard CRUD interface with list, detail, create, and edit views.

Use whichever UI component library fits your project (e.g. Chakra UI, shadcn/ui, MUI, etc.).

---

## THE MODEL PACKAGE PATTERN

Every data entity is a self-contained package with 5 files:

```
packages/todo/
├── index.ts        # Zod schema + types
├── fields.tsx      # Input components (atoms bound to useFields)
├── forms.tsx       # CRUD forms (compose fields)
├── components.tsx  # Display components (read from useSingle)
└── provider.tsx    # TableProvider wrapper + hook
```

### index.ts — Schema

```ts
import z from 'zod'

export const readable = z.object({
  id: z.string(),
  Title: z.string().optional(),
  Done: z.boolean().optional(),
  Notes: z.string().optional(),
})

export const writable = readable.pick({
  Title: true,
  Done: true,
  Notes: true,
})

export const schema = { readable, writable }

export type Readable = z.infer<typeof readable>
export type Writable = z.infer<typeof writable>

declare global {
  type Todo = Readable
}
```

- `readable` always has `id: z.string()` as first field
- `writable` is always derived from `readable` via `.pick()`
- Always export `schema`, `Readable`, `Writable`
- Add the `declare global { type Todo = Readable }` block for global type access

### fields.tsx — Input Atoms

Each field component reads and writes exactly one field via `useFields()`. They are the smallest building blocks — forms compose them. Use whatever UI primitives your chosen library provides.

```tsx
'use client'
import { useFields } from 'asasvirtuais/fields'

export function TitleField() {
  const { fields, setField } = useFields<{ Title: string }>()
  return (
    <div>
      <label>Title</label>
      <input
        value={fields.Title || ''}
        onChange={e => setField('Title', e.target.value)}
        placeholder='What needs to be done?'
      />
    </div>
  )
}

export function NotesField() {
  const { fields, setField } = useFields<{ Notes: string }>()
  return (
    <textarea
      value={fields.Notes || ''}
      onChange={e => setField('Notes', e.target.value)}
      placeholder='Optional notes...'
      rows={4}
    />
  )
}

export function DoneField() {
  const { fields, setField } = useFields<{ Done: boolean }>()
  return (
    <label>
      <input
        type='checkbox'
        checked={fields.Done || false}
        onChange={e => setField('Done', e.target.checked)}
      />
      Mark as done
    </label>
  )
}
```

### forms.tsx — CRUD Forms

```tsx
'use client'
import { CreateForm, UpdateForm, useSingle } from 'asasvirtuais/react-interface'
import { schema, type Readable } from '.'
import { TitleField, NotesField, DoneField } from './fields'
import { useTodos } from './provider'

// Standalone — does not require any provider
export function CreateTodo({ onSuccess }: { onSuccess?: (todo: Readable) => void }) {
  return (
    <CreateForm table='Todos' schema={schema} onSuccess={onSuccess}>
      {form => (
        <form onSubmit={form.submit}>
          <TitleField />
          <NotesField />
          <button type='submit' disabled={form.loading}>
            {form.loading ? 'Saving...' : 'Add Todo'}
          </button>
        </form>
      )}
    </CreateForm>
  )
}

// Must be inside SingleProvider for the 'Todos' table
export function UpdateTodo({ onSuccess }: { onSuccess?: (todo: Readable) => void }) {
  const { single, id } = useSingle('Todos', schema)
  const todo = single as Readable
  return (
    <UpdateForm
      table='Todos'
      schema={schema}
      id={id}
      defaults={{
        Title: todo.Title || '',
        Notes: todo.Notes || '',
        Done: todo.Done || false,
      }}
      onSuccess={onSuccess}
    >
      {form => (
        <form onSubmit={form.submit}>
          <TitleField />
          <NotesField />
          <DoneField />
          <button type='submit' disabled={form.loading}>
            {form.loading ? 'Saving...' : 'Save'}
          </button>
        </form>
      )}
    </UpdateForm>
  )
}

// Must be inside SingleProvider for the 'Todos' table
export function DeleteTodo({ onSuccess }: { onSuccess?: () => void }) {
  const { id } = useSingle('Todos', schema)
  const { remove } = useTodos()
  return (
    <button
      onClick={async () => { await remove.trigger({ id }); onSuccess?.() }}
      disabled={remove.loading}
    >
      {remove.loading ? 'Deleting...' : 'Delete'}
    </button>
  )
}
```

### components.tsx — Display Components

These read from `useSingle()` — they never receive record data as props.

```tsx
'use client'
import { useSingle } from 'asasvirtuais/react-interface'
import { schema, type Readable } from '.'

// Compact view for lists — must be inside SingleProvider
export function TodoItem() {
  const { single } = useSingle('Todos', schema)
  const todo = single as Readable
  return (
    <div style={{ opacity: todo.Done ? 0.6 : 1 }}>
      <h3 style={{ textDecoration: todo.Done ? 'line-through' : 'none' }}>
        {todo.Title || 'Untitled'}
      </h3>
      {todo.Notes && <p>{todo.Notes}</p>}
      {todo.Done && <span>Done</span>}
    </div>
  )
}

// Full detail view — must be inside SingleProvider
export function SingleTodo() {
  const { single } = useSingle('Todos', schema)
  const todo = single as Readable
  return (
    <div>
      <h1 style={{ textDecoration: todo.Done ? 'line-through' : 'none' }}>
        {todo.Title}
      </h1>
      {todo.Notes && <p>{todo.Notes}</p>}
    </div>
  )
}
```

### provider.tsx — Table Context Wrapper

```tsx
'use client'
import { TableProvider, useTable } from 'asasvirtuais/react-interface'
import { useInterface } from 'asasvirtuais/interface-provider'
import { schema, Readable } from '.'

export function useTodos() {
  return useTable('Todos', schema)
}

export function TodosProvider({ children }: { children: React.ReactNode }) {
  const iface = useInterface()
  return (
    <TableProvider table='Todos' schema={schema} interface={iface}>
      {children}
    </TableProvider>
  )
}
```

---

## APP WIRING

### app/schema.ts

Assembles all model schemas into the database definition. Each key is an IndexedDB table name.

```ts
import * as TodoModule from '@/packages/todo'
// import * as SettingsModule from '@/packages/settings'

export const schema = {
  'Todos': TodoModule.schema,
  // 'Settings': SettingsModule.schema,
}
```

### app/providers.tsx

```tsx
'use client'
import { IndexedInterfaceProvider } from 'asasvirtuais/indexed-interface'
import { TodosProvider } from '@/packages/todo/provider'
import { schema } from '@/app/schema'

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <IndexedInterfaceProvider dbName='my-todo-app-v1' schema={schema}>
      <TodosProvider>
        {children}
      </TodosProvider>
    </IndexedInterfaceProvider>
  )
}
```

For multiple models, nest providers:
```tsx
<IndexedInterfaceProvider dbName='my-app-v1' schema={schema}>
  <TodosProvider>
    <SettingsProvider>
      {children}
    </SettingsProvider>
  </TodosProvider>
</IndexedInterfaceProvider>
```

### app/layout.tsx

```tsx
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

## PAGE PATTERNS

### List Page — useTable hook (preferred)

`useTodos().array` is the canonical reactive list. Any `create`, `update`, or `remove` triggered anywhere in the app automatically reflects in `array` and `index`. This is the preferred approach for lists that need to stay in sync with user actions.

```tsx
'use client'
import { SingleProvider } from 'asasvirtuais/react-interface'
import { schema, type Readable } from '@/packages/todo'
import { TodoItem } from '@/packages/todo/components'
import { useTodos } from '@/packages/todo/provider'
import Link from 'next/link'
import { useEffect } from 'react'

export default function TodoListPage() {
  const { list, array } = useTodos()

  useEffect(() => { list.trigger({}) }, [])

  if (list.loading) return <p>Loading...</p>

  return (
    <div>
      <Link href='/todos/new'><button>New Todo</button></Link>

      {array.length === 0 && <p>No todos yet.</p>}

      {array.map((todo: Readable) => (
        <SingleProvider key={todo.id} id={todo.id} table='Todos' schema={schema}>
          <Link href={`/todos/${todo.id}`}>
            <TodoItem />
          </Link>
        </SingleProvider>
      ))}
    </div>
  )
}
```

### List Page — FilterForm alternative

`FilterForm` with `autoTrigger` is a convenient alternative to `useEffect` + `list.trigger`. However, `form.result` is a local snapshot — it does **not** update when data changes elsewhere in the app (e.g., when another component creates or updates a todo). To work around this, wrap each result item in a `SingleProvider`. The `SingleProvider` reads from the app-level index (which does update reactively), not from `form.result`. This way the displayed data stays current even if `form.result` is stale.

```tsx
'use client'
import { FilterForm, SingleProvider } from 'asasvirtuais/react-interface'
import { schema, type Readable } from '@/packages/todo'
import { TodoItem } from '@/packages/todo/components'
import Link from 'next/link'

export default function TodoListPage() {
  return (
    <FilterForm table='Todos' schema={schema} autoTrigger>
      {form => (
        <div>
          {form.loading && <p>Loading...</p>}
          {(form.result || []).map((todo: Readable) => (
            <SingleProvider key={todo.id} id={todo.id} table='Todos' schema={schema}>
              <Link href={`/todos/${todo.id}`}>
                <TodoItem />
              </Link>
            </SingleProvider>
          ))}
        </div>
      )}
    </FilterForm>
  )
}
```

### Detail / Edit Page

```tsx
'use client'
import { SingleProvider } from 'asasvirtuais/react-interface'
import { schema } from '@/packages/todo'
import { SingleTodo } from '@/packages/todo/components'
import { UpdateTodo, DeleteTodo } from '@/packages/todo/forms'
import { useParams, useRouter } from 'next/navigation'

export default function TodoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  return (
    <SingleProvider id={id} table='Todos' schema={schema}>
      <SingleTodo />
      <UpdateTodo onSuccess={() => router.push('/todos')} />
      <DeleteTodo onSuccess={() => router.push('/todos')} />
    </SingleProvider>
  )
}
```

### Create Page

```tsx
'use client'
import { CreateTodo } from '@/packages/todo/forms'
import { useRouter } from 'next/navigation'

export default function NewTodoPage() {
  const router = useRouter()
  return (
    <CreateTodo onSuccess={(todo) => router.push(`/todos/${todo.id}`)} />
  )
}
```

---

## HOOKS REFERENCE

```tsx
// Table-level operations — reactive, always in sync
const { list, array, index, find, create, update, remove } = useTodos()

list.trigger({})                              // fetch all
list.trigger({ query: { Done: false } })      // with filter
create.trigger({ data: { Title: 'Buy milk' } })
update.trigger({ id, data: { Done: true } })
remove.trigger({ id })

// array — reactive array of all records, updates on any CRUD
// index — reactive map of id → record

// Single record — must be inside SingleProvider
const { single, id } = useSingle('Todos', schema)

// Field state — inside CreateForm or UpdateForm
const { fields, setField } = useFields<{ Title: string }>()
```

---

## FILTERING & QUERY DSL

The `list.trigger` and `FilterForm` accept a `query` object with these operators:

```tsx
// Equality
list.trigger({ query: { Done: false } })

// Comparison operators
list.trigger({ query: { Priority: { $gt: 3 } } })
list.trigger({ query: { Status: { $in: ['active', 'pending'] } } })
list.trigger({ query: { Title: { $ne: 'placeholder' } } })

// Pagination & sorting
list.trigger({ query: { $limit: 10, $skip: 0, $sort: { Title: 1 } } })
// $sort: { field: 1 } = ascending, { field: -1 } = descending
```

Available operators: `$ne`, `$lt`, `$lte`, `$gt`, `$gte`, `$in`, `$nin`, `$limit`, `$skip`, `$sort`

---

## NAMING CONVENTIONS

| Thing | Pattern | Example |
|---|---|---|
| Table name | PascalCase plural | `'Todos'` |
| Schema export | `{ readable, writable, schema }` | — |
| Types | `Readable`, `Writable` | `type Readable = z.infer<...>` |
| Field component | `{FieldName}Field` | `TitleField` |
| Hook | `use{Model}s()` | `useTodos()` |
| Provider | `{Model}sProvider` | `TodosProvider` |
| Create form | `Create{Model}` | `CreateTodo` |
| Update form | `Update{Model}` | `UpdateTodo` |
| Delete | `Delete{Model}` | `DeleteTodo` |
| Item component | `{Model}Item` | `TodoItem` |
| Single component | `Single{Model}` | `SingleTodo` |

---

## MULTI-MODEL TEMPLATE

```
packages/
  todo/         index.ts, fields.tsx, forms.tsx, components.tsx, provider.tsx
  settings/     index.ts, fields.tsx, forms.tsx, components.tsx, provider.tsx
app/
  schema.ts     { 'Todos': todoSchema, 'Settings': settingsSchema }
  providers.tsx  IndexedInterfaceProvider > TodosProvider > SettingsProvider
  layout.tsx    imports AppProviders
  todos/
    page.tsx    list
    new/page.tsx create
    [id]/page.tsx detail + edit
```