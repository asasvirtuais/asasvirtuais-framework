# asasvirtuais

React form and action management utilities for building complex forms with async validation and multi-step workflows.

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

## Basic Usage

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

### Using Fields Only

```tsx
import { FieldsProvider, useFields } from 'asasvirtuais/fields'

type ProfileFields = {
  name: string
  bio: string
}

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

### Using Actions Only

```tsx
import { ActionProvider, useAction } from 'asasvirtuais/action'

async function deleteAccount(params: { userId: string }) {
  await fetch(`/api/users/${params.userId}`, { method: 'DELETE' })
}

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

## `react-interface` for Data-Driven Applications

The `react-interface` package provides a powerful, high-level abstraction for building data-driven React applications. It's designed to work with a standardized `TableInterface` to provide a consistent, type-safe, and efficient way to interact with your data backend. It gives you React hooks and components that are automatically wired up to your API, handling data fetching, caching, and state management for you.

### Todo App Example

Let's walk through building a simple Todo app to demonstrate how to use `react-interface`.

#### 1. Define Your Schema

First, define the schema for your `todos` table using `zod`. This is the single source of truth for your data shapes.

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

#### 2. Initialize the React Interface

Create an `interface.ts` file in your `app` directory to initialize the `reactInterface` and export the hooks and components.

```typescript
// app/interface.ts
import { reactInterface } from '@asasvirtuais/interface';
import { schema } from './database';

// This would typically be a fetch or other data source implementation
const yourDataInterface = {
  find: async (props) => { /* ... */ },
  create: async (props) => { /* ... */ },
  update: async (props) => { /* ... */ },
  remove: async (props) => { /* ... */ },
  list: async (props) => { /* ... */ },
};

export const {
  DatabaseProvider,
  useTable,
  CreateForm,
  UpdateForm,
  FilterForm, // Or ListForm
  SingleProvider,
  useSingle,
} = reactInterface<typeof schema>(schema, yourDataInterface);
```

#### 3. Provide the Data Context

Wrap your application (or the relevant part of it) with the `DatabaseProvider` to make the data available to all child components.

```tsx
// app/layout.tsx
import { DatabaseProvider } from '@/app/interface';
import { fetchTodos } from '@/app/api'; // Example API call

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialTodos = await fetchTodos(); // Fetch initial data on the server
  return (
    <html lang="en">
      <body>
        <DatabaseProvider todos={initialTodos}>
          {children}
        </DatabaseProvider>
      </body>
    </html>
  );
}
```

#### 4. Listing Todos and Using `useTable`

The `useTable` hook is the primary way to interact with your table's data. It gives you access to the data index (a key-value store of your items) and the CRUD methods.

```tsx
// app/todos/page.tsx
'use client';

import { useTable } from '@/app/interface';

function TodoList() {
  const { array: todos, remove, update } = useTable('todos');

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          <span
            style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}
            onClick={() => update.trigger({ id: todo.id, data: { completed: !todo.completed } })}
          >
            {todo.text}
          </span>
          <button onClick={() => remove.trigger({ id: todo.id })}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

#### 5. Creating Todos with `CreateForm`

The `CreateForm` component provides a ready-to-use form for creating new items. It handles form state, submission, and updates the local data index on success.

```tsx
// app/todos/page.tsx (continued)
import { CreateForm, useTable } from '@/app/interface';
import { z } from 'zod';
import { schema } from '@/app/database';

function AddTodoForm() {
  return (
    <CreateForm<typeof schema, 'todos'>
      table="todos"
      defaults={{ text: '' }}
      onSuccess={(newTodo) => {
        console.log('Successfully created:', newTodo.text);
      }}
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
  );
}
```

#### 6. Updating Todos with `UpdateForm`

Similarly, `UpdateForm` is used for editing existing items. It's often used in combination with `SingleProvider` and `useSingle` to work with a specific item.

```tsx
// app/todos/[id]/edit/page.tsx
'use client';

import { UpdateForm, useSingle } from '@/app/interface';
import { z } from 'zod';
import { schema } from '@/app/database';

function EditTodoForm() {
  const { single: todo } = useSingle('todos');

  if (!todo) return <div>Loading...</div>;

  return (
    <UpdateForm<typeof schema, 'todos'>
      table="todos"
      id={todo.id}
      defaults={{ text: todo.text }}
      onSuccess={() => {
        // Redirect or show a success message
      }}
    >
      {({ fields, setField, submit, loading }) => (
        <form onSubmit={submit}>
          <input
            value={fields.text}
            onChange={(e) => setField('text', e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      )}
    </UpdateForm>
  );
}
```

#### 7. Filtering Todos with `FilterForm` (ListForm)

`FilterForm` allows you to build UIs for filtering and searching your data. It works just like other forms, but its action triggers the `list` method of your `TableInterface`.

```tsx
// app/todos/page.tsx (continued)
import { FilterForm, useTable } from '@/app/interface';
import { z } from 'zod';
import { schema } from '@/app/database';

function TodoFilter() {
  const { list } = useTable('todos');

  return (
    <FilterForm<typeof schema, 'todos'>
      table="todos"
      defaults={{ query: { completed: false } }}
      onSuccess={(results) => {
        console.log(`Found ${results.length} matching todos.`);
      }}
    >
      {({ fields, setField, submit }) => (
        <div>
          <label>
            <input
              type="checkbox"
              checked={fields.query.completed}
              onChange={(e) => setField('query.completed', e.target.checked)}
            />
            Show completed
          </label>
          <button onClick={submit}>Apply Filter</button>
        </div>
      )}
    </FilterForm>
  );
}
```

## Advanced Usage

### Nested Forms: Multi-Step Async Validation

Use nested forms to validate intermediate steps and populate parent form fields based on child form results.

```tsx
import { Form } from 'asasvirtuais/form'

type EmailFields = { email: string }
type EmailResult = { userId: string; exists: boolean }

type PasswordFields = { userId: string; password: string }
type PasswordResult = { token: string }

async function checkEmail(fields: EmailFields): Promise<EmailResult> {
  const response = await fetch('/api/check-email', {
    method: 'POST',
    body: JSON.stringify(fields)
  })
  return response.json()
}

async function verifyPassword(fields: PasswordFields): Promise<PasswordResult> {
  const response = await fetch('/api/verify-password', {
    method: 'POST',
    body: JSON.stringify(fields)
  })
  return response.json()
}

function MultiStepLogin() {
  return (
    <Form<EmailFields, EmailResult>
      defaults={{ email: '' }}
      action={checkEmail}
    >
      {(emailForm) => (
        <div>
          <h2>Step 1: Enter Email</h2>
          <input
            type="email"
            value={emailForm.fields.email}
            onChange={(e) => emailForm.setField('email', e.target.value)}
          />
          <button onClick={emailForm.submit} disabled={emailForm.loading}>
            {emailForm.loading ? 'Checking...' : 'Next'}
          </button>
          {emailForm.error && <p>Error: {emailForm.error.message}</p>}

          {emailForm.result && emailForm.result.exists && (
            <Form<PasswordFields, PasswordResult>
              defaults={{
                userId: emailForm.result.userId,
                password: ''
              }}
              action={verifyPassword}
              onResult={(result) => {
                localStorage.setItem('token', result.token)
                window.location.href = '/dashboard'
              }}
            >
              {(passwordForm) => (
                <div>
                  <h2>Step 2: Enter Password</h2>
                  <input
                    type="password"
                    value={passwordForm.fields.password}
                    onChange={(e) => passwordForm.setField('password', e.target.value)}
                  />
                  <button onClick={passwordForm.submit} disabled={passwordForm.loading}>
                    {passwordForm.loading ? 'Verifying...' : 'Login'}
                  </button>
                  {passwordForm.error && <p>Error: {passwordForm.error.message}</p>}
                </div>
              )}
            </Form>
          )}
        </div>
      )}
    </Form>
  )
}
```

### Complex Multi-Step: Address Validation

```tsx
type AddressLookupFields = { zipCode: string }
type AddressLookupResult = {
  city: string
  state: string
  country: string
}

type FullAddressFields = {
  zipCode: string
  city: string
  state: string
  country: string
  street: string
  number: string
}

type OrderResult = { orderId: string }

async function lookupAddress(fields: AddressLookupFields): Promise<AddressLookupResult> {
  const response = await fetch(`/api/address/lookup?zip=${fields.zipCode}`)
  return response.json()
}

async function createOrder(fields: FullAddressFields): Promise<OrderResult> {
  const response = await fetch('/api/orders', {
    method: 'POST',
    body: JSON.stringify(fields)
  })
  return response.json()
}

function CheckoutForm() {
  return (
    <Form<AddressLookupFields, AddressLookupResult>
      defaults={{ zipCode: '' }}
      action={lookupAddress}
    >
      {(zipForm) => (
        <div>
          <h3>Enter ZIP Code</h3>
          <input
            type="text"
            value={zipForm.fields.zipCode}
            onChange={(e) => zipForm.setField('zipCode', e.target.value)}
            placeholder="ZIP Code"
          />
          <button onClick={zipForm.submit} disabled={zipForm.loading}>
            {zipForm.loading ? 'Looking up...' : 'Lookup Address'}
          </button>

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
                  <button onClick={addressForm.submit} disabled={addressForm.loading}>
                    {addressForm.loading ? 'Creating Order...' : 'Place Order'}
                  </button>
                  {addressForm.error && <p>Error: {addressForm.error.message}</p>}
                </div>
              )}
            </Form>
          )}
        </div>
      )}
    </Form>
  )
}
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

## License

MIT
