# asasvirtuais

**A React framework for building maintainable web applications without the architectural debt.**

After 7 years of wrestling with complex tech stacks, I built asasvirtuais to solve a problem nobody seems to talk about: the elephant under the carpet of modern web development. Every framework gives you components and state management, but none of them solve the fundamental challenge every project faces—connecting CRUD APIs to UI forms with clean, maintainable state management.

This isn't about fancy animations or advanced performance optimization. This is about making codebases simple enough that you (or an AI) can focus on business logic instead of wrestling with architectural patterns.

## The Problem

Software development has convinced itself that complexity is inevitable. We've been taught that proper applications require:

- State scattered across dozens of files
- Design patterns that make simple things complicated
- Dependencies injected through layers of abstraction
- Code that's impossible to reason about without opening 10 files

But here's the thing: **complexity exists, but overengineering is a human tendency, not a technical requirement.**

## The Solution

asasvirtuais is built on a simple foundation: **React + RESTful APIs**. No magic, no over-abstraction. Just a library that makes the right architectural decisions obvious.

The core insight: **developers and AI shouldn't need to think about state management—just focus on business logic.**

### What Makes This Different

1. **Nested forms that actually make sense** - Build multi-step async validation workflows without the pain
2. **CRUD operations as a solved problem** - Filter, create, update with zero boilerplate
3. **Code in one place** - Business logic lives in readable, single files, not scattered across a dependency tree
4. **AI-friendly patterns** - Simple enough that AI can generate complex forms correctly on the first try

## Installation

### From npm
```bash
npm install asasvirtuais
```

### From esm.sh
```typescript
import { Form } from 'https://esm.sh/asasvirtuais@latest/form'
import { useFields } from 'https://esm.sh/asasvirtuais@latest/fields'
import { useAction } from 'https://esm.sh/asasvirtuais@latest/action'
```

## Quick Start

### Simple Form

```tsx
import { Form } from 'asasvirtuais/form'

type LoginFields = {
  email: string
  password: string
}

type LoginResult = {
  token: string
  user: { id: string; name: string }
}

async function loginAction(fields: LoginFields): Promise<LoginResult> {
  const response = await fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify(fields)
  })
  return response.json()
}

function LoginForm() {
  return (
    <Form<LoginFields, LoginResult>
      defaults={{ email: '', password: '' }}
      action={loginAction}
      onResult={(result) => console.log('Logged in:', result.user.name)}
    >
      {({ fields, setField, submit, loading, error }) => (
        <form onSubmit={submit}>
          <input
            type="email"
            value={fields.email}
            onChange={(e) => setField('email', e.target.value)}
          />
          <input
            type="password"
            value={fields.password}
            onChange={(e) => setField('password', e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          {error && <p>Error: {error.message}</p>}
        </form>
      )}
    </Form>
  )
}
```

## Core Concepts

### 1. Forms: The N8N for React

Think of forms like nodes in a visual workflow builder. Each form is self-contained, knows its state, and can trigger actions. Nest them to create complex workflows without state management headaches.

```tsx
// Multi-step form with async validation between steps
<Form<EmailFields, EmailResult>
  defaults={{ email: '' }}
  action={checkEmail}
>
  {(emailForm) => (
    <div>
      <input
        value={emailForm.fields.email}
        onChange={(e) => emailForm.setField('email', e.target.value)}
      />
      <button onClick={emailForm.submit}>Next</button>

      {emailForm.result?.exists && (
        <Form<PasswordFields, PasswordResult>
          defaults={{ userId: emailForm.result.userId, password: '' }}
          action={verifyPassword}
        >
          {(passwordForm) => (
            <input
              type="password"
              value={passwordForm.fields.password}
              onChange={(e) => passwordForm.setField('password', e.target.value)}
            />
          )}
        </Form>
      )}
    </div>
  )}
</Form>
```

### 2. Fields: State Without the Ceremony

Need just state management? Use `FieldsProvider`:

```tsx
import { FieldsProvider, useFields } from 'asasvirtuais/fields'

function ProfileEditor() {
  return (
    <FieldsProvider<ProfileFields> defaults={{ name: '', bio: '' }}>
      {({ fields, setField }) => (
        <div>
          <input
            value={fields.name}
            onChange={(e) => setField('name', e.target.value)}
          />
          <textarea
            value={fields.bio}
            onChange={(e) => setField('bio', e.target.value)}
          />
        </div>
      )}
    </FieldsProvider>
  )
}
```

### 3. Actions: Async Operations Made Simple

Need just action handling? Use `ActionProvider`:

```tsx
import { ActionProvider } from 'asasvirtuais/action'

function DeleteButton({ userId }: { userId: string }) {
  return (
    <ActionProvider
      params={{ userId }}
      action={deleteAccount}
      onResult={() => alert('Account deleted')}
    >
      {({ submit, loading }) => (
        <button onClick={submit} disabled={loading}>
          {loading ? 'Deleting...' : 'Delete Account'}
        </button>
      )}
    </ActionProvider>
  )
}
```

## React Interface: Data-Driven Applications

The `react-interface` package provides components and hooks for building data-driven React apps. Define your schema once, and use the components directly—no initialization needed.

### Complete Todo App Example

#### 1. Define Your Schema

```typescript
// app/database.ts
import { z } from 'zod';

export const todoSchema = {
  readable: z.object({
    id: z.string(),
    text: z.string(),
    completed: z.boolean(),
    createdAt: z.date(),
  }),
  writable: z.object({
    text: z.string(),
    completed: z.boolean().optional(),
  }),
}

// You can export multiple schemas
export const userSchema = {
  readable: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  writable: z.object({
    name: z.string(),
    email: z.string(),
  }),
}
```

#### 2. Provide the Interface Context

```tsx
// app/layout.tsx
import { FetchInterfaceProvider } from 'asasvirtuais/fetch-interface'
import { DatabaseProvider, TableProvider } from 'asasvirtuais/react-interface'
import { todoSchema } from './database'

export default function RootLayout({ children }) {
  return (
    <DatabaseProvider>
      <FetchInterfaceProvider schema={todoSchema} baseUrl='/api/v1'>
        <TodosProvider>
          {children}
        </TodosProvider>
      </FetchInterfaceProvider>
    </DatabaseProvider>
  )
}
```

#### 3. Create Your Table Provider

```tsx
// app/todos/provider.tsx
'use client'
import { TableProvider } from 'asasvirtuais/react-interface'
import { useInterface } from 'asasvirtuais/fetch-interface'
import { todoSchema } from './database'

export function TodosProvider({ children }) {
  const fetchInterface = useInterface()
  return (
    <TableProvider
      table='todos'
      schema={todoSchema}
      interface={fetchInterface}
    >
      {children}
    </TableProvider>
  )
}
```

#### 4. Build Your UI

```tsx
// app/todos/page.tsx
'use client'
import { useTable, CreateForm } from '@asasvirtuais/react-interface'
import { todoSchema } from '@/app/database'

function TodoList() {
  const { index, remove, update } = useTable('todos', todoSchema)
  const todos = Object.values(index.index)

  return (
    <>
      <CreateForm
        table="todos"
        schema={todoSchema}
        defaults={{ text: '' }}
      >
        {({ fields, setField, submit, loading }) => (
          <form onSubmit={submit}>
            <input
              value={fields.text}
              onChange={(e) => setField('text', e.target.value)}
              placeholder="What needs to be done?"
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Todo'}
            </button>
          </form>
        )}
      </CreateForm>

      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <span
              style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}
              onClick={() => update.trigger({ 
                id: todo.id, 
                data: { completed: !todo.completed } 
              })}
            >
              {todo.text}
            </span>
            <button onClick={() => remove.trigger({ id: todo.id })}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
```

#### 5. Multiple Tables with DatabaseProvider

For apps with multiple tables, wrap them all in a DatabaseProvider:

```tsx
// app/layout.tsx
import { DatabaseProvider, TableProvider } from '@asasvirtuais/react-interface'
import { todoSchema, userSchema } from './database'
import { todosInterface, usersInterface } from './interface'

export default async function RootLayout({ children }) {
  const [initialTodos, initialUsers] = await Promise.all([
    fetchTodos(),
    fetchUsers()
  ])
  
  return (
    <DatabaseProvider>
      <TableProvider table="todos" schema={todoSchema} interface={todosInterface} asAbove={initialTodos}>
        <TableProvider table="users" schema={userSchema} interface={usersInterface} asAbove={initialUsers}>
          {children}
        </TableProvider>
      </TableProvider>
    </DatabaseProvider>
  )
}

// Now any component can access tables:
function MyComponent() {
  const todos = useTable('todos', todoSchema)
  const users = useTable('users', userSchema)
  // ...
}
```

## Advanced Examples

### Multi-Step Address Validation

```tsx
// Complete checkout flow with async address lookup
<Form<AddressLookupFields, AddressLookupResult>
  defaults={{ zipCode: '' }}
  action={lookupAddress}
>
  {(zipForm) => (
    <div>
      <h3>Enter ZIP Code</h3>
      <input
        value={zipForm.fields.zipCode}
        onChange={(e) => zipForm.setField('zipCode', e.target.value)}
      />
      <button onClick={zipForm.submit}>Lookup Address</button>

      {zipForm.result && (
        <Form<FullAddressFields, OrderResult>
          defaults={{
            zipCode: zipForm.fields.zipCode,
            city: zipForm.result.city,
            state: zipForm.result.state,
            country: zipForm.result.country,
            street: '',
            number: ''
          }}
          action={createOrder}
          onResult={(result) => alert(`Order created: ${result.orderId}`)}
        >
          {(addressForm) => (
            <div>
              <h3>Complete Address</h3>
              <p>City: {addressForm.fields.city}</p>
              <p>State: {addressForm.fields.state}</p>
              <input
                value={addressForm.fields.street}
                onChange={(e) => addressForm.setField('street', e.target.value)}
                placeholder="Street"
              />
              <input
                value={addressForm.fields.number}
                onChange={(e) => addressForm.setField('number', e.target.value)}
                placeholder="Number"
              />
              <button onClick={addressForm.submit}>Place Order</button>
            </div>
          )}
        </Form>
      )}
    </div>
  )}
</Form>
```

## Effects and Side Effects

One of asasvirtuais's core strengths is making effects simple. No middleware arrays, no lifecycle hooks—just write code where it belongs.

### Frontend Effects (React)

In React, you control exactly when effects happen by writing code around form actions.

#### Pre-flight Effects

Run code before submission:

```tsx
import { CreateForm } from '@asasvirtuais/react-interface'
import { messageSchema } from '@/app/database'

<CreateForm
  table="messages"
  schema={messageSchema}
  defaults={{ content: '' }}
>
  {({ fields, setField, submit, loading }) => (
    <form onSubmit={submit}>
      <textarea
        value={fields.content}
        onChange={(e) => setField('content', e.target.value)}
      />
      <button
        onClick={() => {
          // Pre-flight effect - runs before submit
          trackEvent('message_submit_clicked')
          validateContent(fields.content)
          submit()
        }}
        disabled={loading}
      >
        Send
      </button>
    </form>
  )}
</CreateForm>
```

#### Post-flight Effects

Run code after successful submission:

```tsx
<CreateForm
  table="messages"
  schema={messageSchema}
  defaults={{ content: '' }}
  onSuccess={(message) => {
    // Post-flight effects - run after success
    notifyUser('Message sent!')
    scrollToBottom()
    trackAnalytics('message_created', { id: message.id })
  }}
>
  {({ fields, setField, submit }) => (
    <form onSubmit={submit}>
      {/* form fields */}
    </form>
  )}
</CreateForm>
```

#### Using Field Values Without Submitting

Sometimes you want to use the form's field values without calling the server action:

```tsx
<CreateForm
  table="messages"
  schema={messageSchema}
  defaults={{ content: '' }}
>
  {(form) => (
    <div>
      <textarea
        value={form.fields.content}
        onChange={(e) => form.setField('content', e.target.value)}
      />
      
      {/* This button calls the server action */}
      <button onClick={form.submit}>Send to Server</button>
      
      {/* This button uses field values without calling the action */}
      <button onClick={() => {
        // Just use the field values directly for local operations
        saveToLocalStorage(form.fields)
        showPreview(form.fields)
      }}>
        Save Draft Locally
      </button>
    </div>
  )}
</CreateForm>
```

### Backend Effects (API Routes)

On the backend, effects are just functions wrapping other functions. No framework magic.

#### Using tableInterface for Business Logic

```typescript
// app/api/v1/[...params]/route.ts
import { tableInterface } from '@asasvirtuais/interface'
import { firestoreInterface } from '@/lib/firestore'
import { messageSchema } from '@/app/database'

// Wrap your base interface with business logic
const messagesInterface = tableInterface(messageSchema, 'messages', {
  async create(props) {
    // Pre-flight validation
    await checkUserQuota(props.data.userId)
    await moderateContent(props.data.content)
    
    // The actual database operation
    const message = await firestoreInterface.create(props)
    
    // Post-flight side effects
    await updateConversationTimestamp(message.conversationId)
    await notifyParticipants(message.conversationId, message.id)
    await trackMessageCreated(message)
    
    return message
  },
  
  async update(props) {
    const existing = await firestoreInterface.find(props)
    
    // Business rule enforcement
    if (existing.role === 'assistant') {
      throw new Error("Cannot edit assistant messages")
    }
    
    if (existing.userId !== getCurrentUserId()) {
      throw new Error("Cannot edit other users' messages")
    }
    
    return firestoreInterface.update(props)
  },
  
  async remove(props) {
    const message = await firestoreInterface.find(props)
    
    // Cascade deletion
    await deleteMessageAttachments(message.id)
    await updateConversationCount(message.conversationId, -1)
    
    return firestoreInterface.remove(props)
  },
  
  // Pass through operations that don't need custom logic
  find: firestoreInterface.find,
  list: firestoreInterface.list,
})
```

### Key Principles

1. **Effects are just code** - No special lifecycle methods or middleware patterns
2. **Control flow is visible** - Reading the code tells you exactly what runs and when
3. **Composition over configuration** - Wrap functions to add behavior, don't configure hooks
4. **Backend and frontend mirror each other** - The same compositional patterns work everywhere

## API Reference

### `Form<Fields, Result>`

Combined fields and action management.

**Props:**
- `defaults?: Partial<Fields>` - Initial field values
- `action: (fields: Fields) => Promise<Result>` - Async action to perform
- `onResult?: (result: Result) => void` - Success callback
- `onError?: (error: Error) => void` - Error callback
- `autoTrigger?: boolean` - Auto-trigger action on mount
- `children: ReactNode | (props) => ReactNode` - Render prop or children

**Render Props:**
- `fields: Fields` - Current field values
- `setField: (name, value) => void` - Update single field
- `setFields: (fields) => void` - Update multiple fields
- `submit: (e?) => Promise<void>` - Trigger action
- `loading: boolean` - Action loading state
- `result: Result | null` - Action result
- `error: Error | null` - Action error

### `FieldsProvider<T>`

Field state management only.

**Props:**
- `defaults?: Partial<T>` - Initial field values
- `children: ReactNode | (props) => ReactNode` - Render prop or children

**Hook: `useFields<T>()`**
- `fields: T` - Current field values
- `setField: (name, value) => void` - Update single field
- `setFields: (fields) => void` - Update multiple fields

### `ActionProvider<Params, Result>`

Action management only.

**Props:**
- `params: Partial<Params>` - Action parameters
- `action: (params) => Promise<Result>` - Async action
- `onResult?: (result: Result) => void` - Success callback
- `onError?: (error: Error) => void` - Error callback
- `autoTrigger?: boolean` - Auto-trigger on mount
- `children: ReactNode | (props) => ReactNode` - Render prop or children

**Hook: `useAction<Params, Result>()`**
- `params: Partial<Params>` - Current parameters
- `submit: (e?) => Promise<void>` - Trigger action
- `loading: boolean` - Loading state
- `result: Result | null` - Action result
- `error: Error | null` - Action error

## Philosophy

### Code Maintainability Over Everything

The industry has normalized spreading code across dozens of files with dependency injection, decorators, and "clean architecture" patterns that make simple things complicated. asasvirtuais takes the opposite approach:

**Keep business logic in single, readable files.**

When you can see all the logic in one place, you can reason about it. When logic is scattered, every change becomes archaeology.

### Made for Humans and AI

The patterns in asasvirtuais are simple enough that:
- Junior developers can understand them in minutes
- Senior developers appreciate the lack of ceremony
- AI assistants can generate correct implementations on the first try

This isn't about dumbing down—it's about removing accidental complexity.

### Against "Babel Towering"

The AI trend seems focused on generating massive codebases quickly, stacking abstraction on abstraction. That's how you build towers that fall.

asasvirtuais is designed for the opposite: codebases that stay maintainable even as they grow.

## Real-World Use

I've used asasvirtuais with Airtable for data modeling on production projects. The combination of a simple frontend framework and a flexible backend lets you focus on solving actual problems instead of fighting your tools.

## AI Integration

Give AI the asasvirtuais documentation and watch it generate multi-step forms with async validation in a single file—something that would normally require multiple files, complex state management, and careful coordination.

Try it with [Google AI Studio](https://ai.studio/apps/drive/1-MwQzpbgMZhRqSbpqQYX1IRpvj61F_l8).


# Model Package Instructions

A model package is a self-contained module that defines a data model and provides React components for interacting with that data. Based on the chat example, here's how to structure a model package:

## File Structure

```
app/[model-name]/
├── index.ts          # Schema definitions and types
├── fields.tsx        # Individual form field components
├── forms.tsx         # Complete form components
└── table.tsx         # Provider and hooks for data access
```

## 1. Schema Definition (`index.ts`)

Define your data model using Zod schemas:

```typescript
import z from 'zod'

// Define the complete object structure (what comes from the database)
export const readable = z.object({
    id: z.string(),
    // ... other fields that can be read
})

// Define which fields can be written/modified
export const writable = readable.pick({
    // ... fields that can be created/updated
})

// Export the schema object
export const schema = { readable, writable }

// Export TypeScript types
export type Readable = z.infer<typeof readable>
export type Writable = z.infer<typeof writable>
```

**Key Points:**
- `readable`: Full object schema including `id` and all readable fields
- `writable`: Subset of fields that users can create/modify (typically excludes `id`)
- Use `.pick()` to select fields from readable for writable
- Export both the schema object and TypeScript types

## 2. Field Components (`fields.tsx`)

Create reusable field components for individual form inputs:

```typescript
import { Input, InputProps } from '@chakra-ui/react'
import { useFields } from 'asasvirtuais/fields'

export function [FieldName]Field(props: InputProps) {
    const { fields, setField } = useFields<{fieldName: type}>()
    
    return (
        <Input 
            name='fieldName' 
            value={fields.fieldName} 
            onChange={e => setField('fieldName', e.target.value)} 
            {...props} 
        />
    )
}
```

**Key Points:**
- Use `useFields` hook with type annotation matching your field
- Pass through additional props using spread operator
- Set appropriate `name` attribute
- Handle `onChange` with `setField`

## 3. Form Components (`forms.tsx`)

Create complete forms for creating and filtering data:

```typescript
import { CreateForm, FilterForm, useTableInterface } from 'asasvirtuais/react-interface'
import { schema } from '.'
import { [Field]Field } from './fields'
import { Stack, Button } from '@chakra-ui/react'

// Create form
export function Create[Model]() {
    return (
        <CreateForm table='tableName' schema={schema}>
            {form => (
                <Stack as='form' onSubmit={form.submit}>
                    <[Field]Field />
                    <Button type='submit'>Create [Model]</Button>
                </Stack>
            )}
        </CreateForm>
    )
}

// Filter/List form
export function Filter[Models]() {
    const { remove } = useTableInterface('tableName', schema)
    
    return (
        <FilterForm table='tableName' schema={schema}>
            {form => (
                <Stack>
                    {form.result?.map(item => (
                        <div key={item.id}>
                            {/* Display item data */}
                            <Button onClick={() => remove.trigger({id: item.id})}>
                                Delete
                            </Button>
                        </div>
                    ))}
                </Stack>
            )}
        </FilterForm>
    )
}
```

**Key Points:**
- `CreateForm` handles creation logic, provides `form.submit`
- `FilterForm` provides `form.result` with filtered data
- Use `useTableInterface` for operations like `remove`
- Always provide `table` name and `schema` to forms

## 4. Provider and Hooks (`table.tsx`)

Set up the data provider and custom hooks using `InterfaceProvider` and `useInterface`:

```typescript
'use client'
import { TableProvider, useTableInterface } from 'asasvirtuais/react-interface'
import { useInterface } from 'asasvirtuais/fetch-interface'
import { schema } from '.'

export function use[Models]() {
    return useTableInterface('tableName', schema)
}

export function [Models]Provider({ children }: { children: React.ReactNode }) {
    return (
        <TableProvider
            table='tableName'
            schema={schema}
            interface={useInterface()}
        >
            {children}
        </TableProvider>
    )
}
```

Then in your layout, wrap with `InterfaceProvider` to set up the context:

```tsx
import { InterfaceProvider } from 'asasvirtuais/fetch-interface'
import { DatabaseProvider } from 'asasvirtuais/react-interface'
import { [Models]Provider } from './table'
import { schema } from '.'

<DatabaseProvider>
  <InterfaceProvider schema={schema} baseUrl='/api/v1'>
    <[Models]Provider>
      {children}
    </[Models]Provider>
  </InterfaceProvider>
</DatabaseProvider>
```

**Key Points:**
- Mark table.tsx as `'use client'` for Next.js
- `InterfaceProvider` creates the fetch interface and provides it via context
- `useInterface()` retrieves the interface from context inside `TableProvider`
- Create a custom hook for easy access to table interface

## Naming Conventions

- **Model name**: Singular (e.g., `chat`, `user`, `product`)
- **Table name**: Plural (e.g., `chats`, `users`, `products`)
- **Field components**: `[Field]Field` (e.g., `TitleField`, `EmailField`)
- **Form components**: `Create[Model]`, `Filter[Models]` (e.g., `CreateChat`, `FilterChats`)
- **Provider**: `[Models]Provider` (e.g., `ChatsProvider`)
- **Hook**: `use[Models]` (e.g., `useChats`)

## Usage Example

```typescript
import { ChatsProvider } from './chat/table'
import { CreateChat, FilterChats } from './chat/forms'

function App() {
    return (
        <ChatsProvider>
            <CreateChat />
            <FilterChats />
        </ChatsProvider>
    )
}
```


---

# @asasvirtuais/card

A **model package** built on the `asasvirtuais` framework. This project is the canonical reference for how to create data-model packages that export reusable "lego blocks" — schema, fields, forms, display components, and a provider — all backend-agnostic and composable.

The included Next.js demo app shows a complete CRUD flow (List, Create, View/Edit, Delete) using IndexedDB for instant, serverless persistence.

---

## Architecture Overview

### Philosophy

A **model package** encapsulates everything about a data model (e.g. "Card") into a self-contained, reusable module. It does **not** choose a storage backend — the consuming app does. This means the same package works against IndexedDB for prototyping, a REST API for production, or in-memory for tests, with zero changes.

The framework provides **three categories of building blocks**:

```
┌─────────────────────────────────────┐
│           Consumer App              │
│  (Next.js, Vite, etc.)             │
│                                     │
│  ┌───────────────────────────────┐  │
│  │     Backend Provider          │  │
│  │  (IndexedDB / Fetch / Mem)    │  │
│  │                               │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │    Model Package        │  │  │
│  │  │  (schema, fields,       │  │  │
│  │  │   forms, components,    │  │  │
│  │  │   provider)             │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

1. **Primitives** (framework) — `Fields`, `Actions`, `Form`, context utilities
2. **Interface layer** (framework) — `TableInterface` contract, `TableProvider`, `SingleProvider`, CRUD forms
3. **Model package** (this project) — domain-specific schema, field components, forms, display components, provider

### Framework Packages (`asasvirtuais`)

| Import Path | Purpose |
|---|---|
| `asasvirtuais/interface` | Abstract `TableInterface<Readable, Writable>` contract with `find`, `create`, `update`, `remove`, `list` + query DSL (`$limit`, `$skip`, `$sort`, `$ne`, `$in`, `$gt`, etc.) |
| `asasvirtuais/interface-provider` | `InterfaceProvider` + `useInterface()` — makes a `TableInterface` available via React context |
| `asasvirtuais/react-interface` | `TableProvider`, `useTable`, `TableConsumer`, `SingleProvider`, `useSingle`, `CreateForm`, `UpdateForm`, `FilterForm` — the React layer that wires CRUD operations into reactive state |
| `asasvirtuais/fields` | `FieldsProvider` + `useFields()` — generic field state management (get/set per field) |
| `asasvirtuais/action` | `ActionProvider` + `useAction()` — wraps any async function with `loading`/`error`/`result`/`submit` state |
| `asasvirtuais/form` | `Form` — composes `FieldsProvider` + `ActionProvider` |
| `asasvirtuais/hooks` | `createContextFromHook`, `useAction`, `useIndex` — foundational utilities |
| `asasvirtuais/indexed-interface` | `IndexedInterfaceProvider` — IndexedDB via Dexie.js (client-side persistence) |
| `asasvirtuais/fetch-interface` | `FetchInterfaceProvider` — REST API backend |
| `asasvirtuais/mem-interface` | `MemInterfaceProvider` — in-memory backend |

---

## Project Structure

```
card/
├── src/                          # Package source (publishable)
│   ├── index.ts                  # Schema + types
│   ├── fields.tsx                # Field components (inputs bound to useFields)
│   ├── forms.tsx                 # Form components (CreateCard, UpdateCard, DeleteCard, FilterCards)
│   ├── components.tsx            # Display components (CardItem, SingleCard)
│   └── provider.tsx              # CardsProvider + useCards hook
│
├── app/                          # Demo app (not published)
│   ├── schema.ts                 # Database schema (assembles model schemas)
│   ├── providers.tsx             # App-level providers (backend + model)
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # List page
│   ├── new/page.tsx              # Create page
│   └── [id]/page.tsx             # View / Edit / Delete page
│
└── package.json                  # Exports map
```

### Package Exports

```json
{
  ".":            "./src/index.ts",
  "./fields":     "./src/fields.tsx",
  "./forms":      "./src/forms.tsx",
  "./components": "./src/components.tsx",
  "./provider":   "./src/provider.tsx"
}
```

---

## How the Pieces Fit Together

### 1. Schema (`src/index.ts`)

The schema defines two Zod objects:
- **`readable`** — the full record shape (includes `id` and computed/read-only fields)
- **`writable`** — the subset of fields that can be created or updated

```tsx
import z from 'zod'

export const readable = z.object({
    id: z.string(),
    Title: z.string().optional(),
    Text: z.string().optional(),
    Type: z.string().optional(),
})

export const writable = readable.pick({
    Title: true,
    Text: true,
    Type: true,
})

export const schema = { readable, writable }

export type Readable = z.infer<typeof readable>
export type Writable = z.infer<typeof writable>
```

> **Convention**: `readable` always has an `id: z.string()` field. `writable` is derived from `readable` via `.pick()` or `.omit()`. Export both individual schemas and a combined `schema` object, plus the inferred types.

### 2. Fields (`src/fields.tsx`)

Field components are **individual input controls** bound to the framework's `useFields()` hook. They read and write a single field from the parent `FieldsProvider` context.

```tsx
import { useFields } from 'asasvirtuais/fields'

export function TitleField(props: InputProps) {
    const { fields, setField } = useFields<{ Title: string }>()
    return (
        <Input
            name='Title'
            placeholder='Card title'
            value={fields.Title || ''}
            onChange={e => setField('Title', e.target.value)}
            {...props}
        />
    )
}
```

> **Convention**: Each field component is named `{FieldName}Field`, uses `useFields<{ FieldName: Type }>()` for type narrowing, and accepts passthrough props for customization. These are the smallest lego blocks — they can be composed into any form layout.

### 3. Provider (`src/provider.tsx`)

The provider wraps the framework's `TableProvider`, binding the model's table name, schema, and the current `TableInterface` (obtained from `useInterface()`).

```tsx
import { TableProvider, useTable } from 'asasvirtuais/react-interface'
import { useInterface } from 'asasvirtuais/interface-provider'
import { schema } from '.'

export function useCards() {
    return useTable('Cards', schema)
}

export function CardsProvider({ children }: { children: React.ReactNode }) {
    const cardsInterface = useInterface()
    return (
        <TableProvider table='Cards' schema={schema} interface={cardsInterface}>
            {children}
        </TableProvider>
    )
}
```

> **Convention**: The hook is named `use{Model}s()` (plural). The provider is `{Model}sProvider`. Both reference the table name string (e.g. `'Cards'`) and the model's `schema`. The provider gets its `TableInterface` from `useInterface()` — it never imports a specific backend.

#### TableProvider & TableConsumer

`TableProvider` creates a table-scoped context with reactive CRUD state. Descendants access it via:

- **`useTable(tableName, schema)`** — hook that returns the full table context (`index`, `array`, `find`, `create`, `update`, `remove`, `list`)
- **`TableConsumer`** — render-prop component that reads the same context. Useful when you want to access table data without creating a new component just for the hook:

```tsx
import { TableConsumer } from 'asasvirtuais/react-interface'

<TableConsumer>
    {({ array, remove }) => (
        <ul>
            {array.map(item => (
                <li key={item.id}>
                    {item.Title}
                    <button onClick={() => remove.trigger({ id: item.id })}>Delete</button>
                </li>
            ))}
        </ul>
    )}
</TableConsumer>
```

> **Note**: There is no `DatabaseProvider`. Each model gets its own `TableProvider` via its model provider (e.g. `CardsProvider`). For multi-model apps, simply nest the model providers.

### 4. Forms (`src/forms.tsx`)

Form components combine framework form primitives with the model's field components. There are four standard forms:

#### `CreateCard` — wraps `CreateForm`
Provides a `FieldsProvider` + `ActionProvider` that calls `create.trigger()`. Field components inside read/write to this context.

#### `UpdateCard` — wraps `UpdateForm`, uses `useSingle()`
Reads `id` and field defaults from `SingleProvider` context. Must be rendered inside a `SingleProvider`.

#### `DeleteCard` — uses `useSingle()` + `useTable()`
A button that calls `remove.trigger({ id })`. Must be rendered inside both a `SingleProvider` and a `TableProvider` (the model's provider).

#### `FilterCards` — wraps `FilterForm`
Provides a filterable list with the framework's query DSL.

> **Convention**: Forms that operate on a single record (`Update`, `Delete`) use `useSingle()` and must be rendered inside a `SingleProvider`. The `Create` form is standalone. All form components accept an `onSuccess` callback.

### 5. Display Components (`src/components.tsx`)

Display components render record data. They use `useSingle()` to read the current record from `SingleProvider` context.

#### `CardItem` — compact view for grids and lists
Shows a card preview (thumbnail, title, type badge, clamped text). Use it inside a `SingleProvider` within a list.

#### `SingleCard` — full detail view for a dedicated page
Shows all card data in full detail (large art, full text, etc.). Use it inside a `SingleProvider` on a detail page.

> **Convention**: Display components are named by their purpose:
> - `{Model}Item` — compact/summary view (for lists, grids, tables)
> - `Single{Model}` — full detail view (for dedicated single-record pages)
>
> Both **must** be rendered inside a `SingleProvider` and use `useSingle()` — they never receive record data as props.

---

## The SingleProvider Pattern

The `SingleProvider` is the key pattern for record-level context. It:
1. Takes `id`, `table`, and `schema` as props
2. Looks up the record in the table's reactive index (populated by prior `list` or `find` calls)
3. If not in the index, triggers a `find` call
4. Renders `null` until the record is available (built-in loading state)
5. Makes the record available via `useSingle()` to all descendants

### Usage in a List Page

```tsx
const { list, array } = useTable('Cards', schema)

useEffect(() => { list.trigger({}) }, [])

return (
    <SimpleGrid columns={4} gap={4}>
        {array.map((card: Readable) => (
            <SingleProvider key={card.id} id={card.id} table='Cards' schema={schema}>
                <Link href={`/${card.id}`}>
                    <CardItem />
                </Link>
            </SingleProvider>
        ))}
    </SimpleGrid>
)
```

### Usage in a Detail Page

```tsx
<SingleProvider id={id} table='Cards' schema={schema}>
    <SingleCard />            {/* View mode */}
    <UpdateCard />            {/* Edit mode */}
    <DeleteCard />            {/* Delete action */}
</SingleProvider>
```

> The `SingleProvider` is the **universal wrapper** for any component that operates on a single record. Routing (`Link`, navigation) is always handled at the app level, not inside the components.

---

## Demo App Wiring

### Database Schema (`app/schema.ts`)

Assembles all model schemas into a single database schema. Each key is a table name.

```tsx
import * as CardModule from '@/src/index'

export const schema = {
    'Cards': CardModule.schema
}
```

> For multi-model apps, import each model and add its schema: `{ 'Cards': CardModule.schema, 'Decks': DeckModule.schema }`.

### Providers (`app/providers.tsx`)

Nests the backend provider and all model providers. No `DatabaseProvider` — just the interface provider and the model providers:

```tsx
<IndexedInterfaceProvider dbName='grimoire' schema={schema}>
    <CardsProvider>
        {children}
    </CardsProvider>
</IndexedInterfaceProvider>
```

For multi-model apps, nest additional model providers:

```tsx
<IndexedInterfaceProvider dbName='grimoire' schema={schema}>
    <CardsProvider>
        <DecksProvider>
            {children}
        </DecksProvider>
    </CardsProvider>
</IndexedInterfaceProvider>
```

> **Backend swap**: Replace `IndexedInterfaceProvider` with `FetchInterfaceProvider` (REST API) or `MemInterfaceProvider` (in-memory) — no other changes needed.

### Page Pattern

Every page follows the same structure:

| Route | Components Used | Pattern |
|---|---|---|
| `/` (List) | `useTable` → `SingleProvider` → `CardItem` | Fetch list, render items in `SingleProvider` grid |
| `/new` (Create) | `CreateCard` | Standalone form, navigate on success |
| `/[id]` (View/Edit/Delete) | `SingleProvider` → `SingleCard` / `UpdateCard` / `DeleteCard` | All inside one `SingleProvider`, toggle between view and edit |

---

## Creating a New Model Package

Follow this step-by-step to scaffold a new model package (e.g. `@asasvirtuais/deck`):

### 1. Define the Schema (`src/index.ts`)

```tsx
import z from 'zod'

export const readable = z.object({
    id: z.string(),
    Name: z.string().optional(),
    Description: z.string().optional(),
    CardCount: z.number().optional(),
})

export const writable = readable.pick({
    Name: true,
    Description: true,
})

export const schema = { readable, writable }

export type Readable = z.infer<typeof readable>
export type Writable = z.infer<typeof writable>
```

### 2. Create Field Components (`src/fields.tsx`)

One component per writable field:

```tsx
import { useFields } from 'asasvirtuais/fields'

export function NameField(props) {
    const { fields, setField } = useFields<{ Name: string }>()
    return <Input name='Name' value={fields.Name || ''} onChange={e => setField('Name', e.target.value)} {...props} />
}

export function DescriptionField(props) {
    const { fields, setField } = useFields<{ Description: string }>()
    return <Textarea name='Description' value={fields.Description || ''} onChange={e => setField('Description', e.target.value)} {...props} />
}
```

### 3. Create the Provider (`src/provider.tsx`)

```tsx
import { TableProvider, useTable } from 'asasvirtuais/react-interface'
import { useInterface } from 'asasvirtuais/interface-provider'
import { schema } from '.'

export function useDecks() { return useTable('Decks', schema) }

export function DecksProvider({ children }) {
    const iface = useInterface()
    return <TableProvider table='Decks' schema={schema} interface={iface}>{children}</TableProvider>
}
```

### 4. Create Forms (`src/forms.tsx`)

```tsx
import { CreateForm, UpdateForm, useTable, useSingle } from 'asasvirtuais/react-interface'
import { schema } from '.'
import { NameField, DescriptionField } from './fields'

export function CreateDeck({ onSuccess }) {
    return (
        <CreateForm table='Decks' schema={schema} onSuccess={onSuccess}>
            {form => (
                <Stack as='form' onSubmit={form.submit} gap={4}>
                    <NameField />
                    <DescriptionField />
                    <Button type='submit' loading={form.loading}>Create</Button>
                </Stack>
            )}
        </CreateForm>
    )
}

export function UpdateDeck({ onSuccess }) {
    const { single, id } = useSingle<typeof schema>()
    return (
        <UpdateForm table='Decks' schema={schema} id={id} defaults={{ Name: single.Name, Description: single.Description }} onSuccess={onSuccess}>
            {form => (
                <Stack as='form' onSubmit={form.submit} gap={4}>
                    <NameField />
                    <DescriptionField />
                    <Button type='submit' loading={form.loading}>Save</Button>
                </Stack>
            )}
        </UpdateForm>
    )
}

export function DeleteDeck({ onSuccess }) {
    const { id } = useSingle<typeof schema>()
    const { remove } = useTable('Decks', schema)
    return <Button colorPalette='red' onClick={async () => { await remove.trigger({ id }); onSuccess?.() }} loading={remove.loading}>Delete</Button>
}
```

### 5. Create Display Components (`src/components.tsx`)

```tsx
import { useSingle } from 'asasvirtuais/react-interface'
import { schema, type Readable } from '.'

/** Compact view for lists. Must be inside SingleProvider. */
export function DeckItem() {
    const { single } = useSingle<typeof schema>()
    const deck = single as Readable
    return (
        <Card.Root variant='outline'>
            <Card.Body>
                <Card.Title>{deck.Name || 'Untitled'}</Card.Title>
                <Text>{deck.Description}</Text>
            </Card.Body>
        </Card.Root>
    )
}

/** Full detail view. Must be inside SingleProvider. */
export function SingleDeck() {
    const { single } = useSingle<typeof schema>()
    const deck = single as Readable
    return (
        <Stack gap={4}>
            <Heading>{deck.Name || 'Untitled'}</Heading>
            <Text>{deck.Description}</Text>
        </Stack>
    )
}
```

### 6. Set Up Exports (`package.json`)

```json
{
  "exports": {
    ".":            { "types": "./src/index.ts",      "default": "./src/index.ts" },
    "./fields":     { "types": "./src/fields.tsx",     "default": "./src/fields.tsx" },
    "./forms":      { "types": "./src/forms.tsx",      "default": "./src/forms.tsx" },
    "./components": { "types": "./src/components.tsx", "default": "./src/components.tsx" },
    "./provider":   { "types": "./src/provider.tsx",   "default": "./src/provider.tsx" }
  }
}
```

### 7. Wire the Demo App

1. Create `app/schema.ts` — `{ 'Decks': DeckModule.schema }`
2. Create `app/providers.tsx` — `IndexedInterfaceProvider` → `DecksProvider` (no `DatabaseProvider` needed)
3. Create `app/page.tsx` — List with `SingleProvider` → `DeckItem`
4. Create `app/new/page.tsx` — `CreateDeck` form
5. Create `app/[id]/page.tsx` — `SingleProvider` → `SingleDeck` / `UpdateDeck` / `DeleteDeck`

---

## Naming Conventions Quick Reference

| Thing | Naming Pattern | Example |
|---|---|---|
| Table name | PascalCase plural | `'Cards'` |
| Schema export | `{ readable, writable, schema }` | `schema = { readable, writable }` |
| Type exports | `Readable`, `Writable` | `type Readable = z.infer<...>` |
| Field component | `{FieldName}Field` | `TitleField`, `TextField` |
| Provider | `{Model}sProvider` | `CardsProvider` |
| Hook | `use{Model}s()` | `useCards()` |
| Create form | `Create{Model}` | `CreateCard` |
| Update form | `Update{Model}` | `UpdateCard` |
| Delete action | `Delete{Model}` | `DeleteCard` |
| Filter form | `Filter{Model}s` | `FilterCards` |
| Item component | `{Model}Item` | `CardItem` |
| Single component | `Single{Model}` | `SingleCard` |

---

## Key Principles

1. **Schema first** — Zod defines the contract. Everything flows from `readable` and `writable`.
2. **Backend-agnostic** — The `src/` package never imports a storage backend. The app wires the backend.
3. **No DatabaseProvider** — Each model gets its own `TableProvider` via its model provider. For multi-model apps, nest model providers. Access table data via `useTable()` hook or `TableConsumer` render-prop.
4. **SingleProvider is king** — Any component for a single record lives inside a `SingleProvider` and calls `useSingle()`. No prop drilling.
5. **Fields are atoms** — Field components are the smallest units. Forms compose them. Different forms can reuse the same fields in different layouts.
6. **Routing is app-level** — Components never contain `Link` or navigation logic. The app wraps them in `Link` or calls `router.push()` in `onSuccess` callbacks.
