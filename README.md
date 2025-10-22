# asasvirtuais

React form and action management utilities for building complex forms with async validation and multi-step workflows.

## Installation

### From npm
```bash
npm install asasvirtuais
```

### From esm.sh
```typescript
import { Form } from 'https://esm.sh/asasvirtuais@1.0.1/form'
import { useFields } from 'https://esm.sh/asasvirtuais@1.0.1/fields'
import { useAction } from 'https://esm.sh/asasvirtuais@1.0.1/action'
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