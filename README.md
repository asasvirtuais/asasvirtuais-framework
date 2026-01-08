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

1. **Nested forms that actually make sense** - Build multi-step async validation workflows without reinventing the wheel
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

The `react-interface` package provides a complete abstraction for building data-driven React apps. Define your schema once, and get type-safe hooks and components automatically wired to your API.

### Complete Todo App Example

#### 1. Define Your Schema

```typescript
// app/database.ts
import { z } from 'zod';

export const schema = {
  todos: {
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
  },
};
```

#### 2. Initialize the Interface

```typescript
// app/interface.ts
import { reactInterface } from '@asasvirtuais/interface';
import { schema } from './database';

export const {
  DatabaseProvider,
  useTable,
  CreateForm,
  UpdateForm,
  FilterForm,
  SingleProvider,
  useSingle,
} = reactInterface<typeof schema>(schema, yourDataInterface);
```

#### 3. Provide Data Context

```tsx
// app/layout.tsx
import { DatabaseProvider } from '@/app/interface';

export default async function RootLayout({ children }) {
  const initialTodos = await fetchTodos();
  return (
    <DatabaseProvider todos={initialTodos}>
      {children}
    </DatabaseProvider>
  );
}
```

#### 4. Build Your UI

```tsx
// app/todos/page.tsx
'use client';
import { useTable, CreateForm } from '@/app/interface';

function TodoList() {
  const { array: todos, remove, update } = useTable('todos');

  return (
    <>
      <CreateForm<typeof schema, 'todos'>
        table="todos"
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
  );
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


## Contributing

This is the result of years of meditation on overengineering. If you see ways to make it simpler (not more feature-rich, simpler), I'm interested.

## License

MIT

---

*Built by someone who spent 7 years learning that the hard way is usually the wrong way.*