# AGENTS.md — asasvirtuais app

> Copy this file to the root of an app as `AGENTS.md`
> (`cp node_modules/asasvirtuais/AGENTS.example.md AGENTS.md`), then fill in the **Project** section at the end.
> Everything above **Project** describes how every asasvirtuais app is built. It is not a menu of options. When this
> file and your instinct disagree, this file wins.

---

## How to work

1. **Grounded.** Before you change anything, name the tables, schemas, forms and CRUD rules that already exist for the
   task. Read `app/schema.ts` and `app/actions.ts` first.
2. **Ruly.** Say which rule in this file the change follows and where the code goes.
3. **Consistent.** Do not invent exceptions, patches or "just this once" server actions. If the task seems to need
   one, stop and go back to step 1. Something was misread.
4. **Careful.** When something is unclear, take the step that removes the most ambiguity. Do not guess a solution.
5. **Clear.** Say what you are doing and what you expect to happen. If that contradicts this file, do not push
   through. Re-ground.
6. **Ask about UI.** Always ask before deciding screens, routes, what is shown where, navigation, or where controls
   go, unless the user already specified it.

---

## The one idea

**The client writes rows. The CRUD file decides whether it may.**

Every mutation a user makes is one call to the generic CRUD interface (`create`, `update`, `remove`) on one row of
one table. The row it returns lands in the reactive index, and every list, `FilterForm` and `SingleProvider` showing
that table updates itself. There is nothing to revalidate, refetch or `set` by hand.

`app/actions.ts` is the single place that holds the rules: who may create, update or remove what, which values the
server fills in, and what happens automatically after a write. Reading that file tells you every mutation rule in the
app.

If you are about to write a server action named after a verb (`approveX`, `startX`, `toggleX`, `setXStatus`,
`markXAsRead`, `joinX`), you are about to break the app. Read **Deciding how to implement a write** below.

---

## Rules

These are numbered so they can be cited ("this breaks rule 4").

### Writes

1. **Every user write is a CRUD write.** Create a row with `CreateForm`, change a row with `UpdateForm`, and delete
   one with `useTable(...).remove`. This holds for every write, however small.
2. **Single-column updates are `UpdateForm`.** Toggling `done`, approving (`status: 'approved'`), renaming, archiving,
   or setting a flag is an `UpdateForm` with that one field. This is where the framework works best. Never write a
   server action for it.
3. **One user action is one CRUD write.** If an operation touches several rows, decide which of two cases it is
   (rule 4 or rule 5). There is no third case.
4. **Steps the user takes are client steps.** When the user triggers each write (join → approve → start), each step
   is its own form. The result of one step (`onSuccess` / `onResult` / `await form.callback(...)`) opens the next.
5. **Automatic consequences belong in the server handler.** When a second write must happen and the user should not
   trigger it (buying a card debits the wallet), the user's write records their intent, and the consequences run as
   `after` effects in the same CRUD handler and the same database transaction. Never chain them on the client.
6. **Server actions that are not CRUD may not write rows.** LLM drafts, previews, lookups and calculations are plain
   async functions called through `Form` or `ActionProvider`. If a draft should be saved, its result goes into a
   `CreateForm` or `UpdateForm`.

### Rules and the CRUD file

7. **All mutation rules live in `app/actions.ts`**, in one `mutations` map with an entry per table:
   `{ create, update, remove }`. An operation that is missing from the map is forbidden.
8. **Checks and writes share a transaction.** A rule that counts or reads ("under the cap", "not already in
   another mission") runs inside the same transaction as the write, so two users can't both pass it at once.
9. **The server decides what is stored.** `prepare` may fill in fields (`author`, `createdAt`) or change what was
   asked for (`status: 'start'` is stored as `'preparing'`). The client index always takes the row the handler
   returns, not what the client sent.

### State

10. **Never manage table state by hand.** No `table.set(...)`, `setIndex`, `useState` copies of rows, `router.refresh()`
    or `revalidatePath` to show a write's result. If the UI doesn't update after a CRUD write, a provider is missing.
    Look for that first.
11. **Rows created as consequences are refetched, not set.** A rule-5 handler writes rows the client did not ask for,
    and CRUD returns only the intent row. Views that show the consequence tables refetch them with
    `list.trigger(...)` (or `submit()` on their `FilterForm`) in the intent form's `onSuccess`.
12. **One record, one `SingleProvider`.** Components that show or edit a record read it with `useSingle`. Do not pass
    rows down as props to child components that can read them from the provider.
13. **Mount only the tables a route needs**, with one `TablesProvider` per layout.

### Forms

14. **Name render props after what they represent** (`order`, `zip`, `join`, `approve`), not `{ fields, submit }`,
    whenever forms nest or steps chain.
15. **`onResult` works on `Form` and `ActionProvider`; `onSuccess` works on `CreateForm`, `UpdateForm` and
    `FilterForm`.** Each one runs after the action resolves, with the result. Use whichever the component provides.
    Do not use workarounds like `.then` on `callback`.
16. **One-click writes use `callback(data)`.** `submit()` sends the current fields. A button that writes a fixed value
    calls `form.callback({ done: true })` instead of `setField` followed by `submit`.

---

## Deciding how to implement a write

Answer the questions in order and stop at the first "yes".

```
Does it write nothing to the database? (draft, preview, LLM call, lookup)
  └─ yes → plain async function + Form / ActionProvider.                         (rule 6)

Does it write exactly one row the user asked for?
  └─ yes → CreateForm / UpdateForm / remove. Its rule goes in `mutations`.     (rules 1, 2, 7)

Does it write several rows, each one triggered by the user?
  └─ yes → one form per step; each step's result opens the next.                 (rule 4)

Does it write several rows where only the first one is what the user asked for,
and the rest must happen automatically and atomically?
  └─ yes → CRUD write of the intent row + `after` effects in the same
           transaction; affected views refetch in onSuccess.                     (rules 5, 11)
```

If none fits, you have misread the task. Re-ground, then ask the user.

### Why consequences may not be chained on the client

Chaining `create card` → `onSuccess` → `create wallet debit` on the client fails in three ways:

1. **Trust.** Each step is a public endpoint. A client can call the first and skip the second, and get the card
   without paying.
2. **Atomicity.** A closed tab or a network failure between the steps leaves the work half done.
3. **Races.** A check in one request and a write in another can both pass for two users at once.

Client chaining is correct only when each step is a complete operation on its own: an LLM draft followed by a
`CreateForm`, or join followed by a separate approval.

---

## Project layout

```
app/
├── schema.ts            # all table schemas assembled
├── actions.ts           # 'use server' — the CRUD interface + the `mutations` map
├── providers.tsx        # InterfaceProvider
├── layout.tsx
└── [feature]/
    ├── schema.ts        # readable / writable + types
    ├── hooks.tsx        # use{Model}s(), use{Model}()
    ├── providers.tsx    # {Model}Provider (SingleProvider), {Model}sProvider (TablesProvider)
    ├── fields.tsx       # {Field}Field input components
    ├── forms.tsx        # Create{Model}, Update{Model}, Delete{Model}, Filter{Model}s
    ├── components.tsx   # {Model}Item, Single{Model}
    └── page.tsx
```

There is no `[feature]/actions.ts` that writes rows. A feature folder may have `drafts.ts` for rule-6 functions
(LLM calls, previews) that write nothing.

---

## Schema

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

// only what a user may send; server-filled fields (author, createdAt) stay out
export const writable = readable.pick({ title: true, done: true })

export const schema = { readable, writable }
export type Readable = z.infer<typeof readable>
export type Writable = z.infer<typeof writable>
```

```ts
// app/schema.ts
import { schema as todos } from './todos/schema'
import { schema as tags } from './tags/schema'

export const schema = { todos, tags }
```

---

## The CRUD file

`app/actions.ts` is the backend. Its five handlers are generic: they look up the table's entry in `mutations` and
run it. The `mutations` map is the app's list of mutation rules.

```ts
// app/actions.ts
'use server'
import { makeSchemaTableInterface } from 'asasvirtuais/interface'
import { schema } from './schema'
import { db, type Tx } from './db'           // any database adapter
import { currentUser, type User } from './auth'

class Forbidden extends Error { constructor(m = 'Forbidden') { super(m) } }

type Ctx = { user: User, tx: Tx }
type Mutation<Row = any, Data = any> = {
  /** throw Forbidden (or return false) to refuse. Sees the new data and, on update/remove, the current row. */
  allow: (ctx: Ctx & { data: Data, current?: Row }) => boolean | Promise<boolean>
  /** optional: returns what is actually stored (server-filled fields, normalised status) */
  prepare?: (ctx: Ctx & { data: Data, current?: Row }) => Data | Promise<Data>
  /** optional: automatic consequences, same transaction (rule 5) */
  after?: (ctx: Ctx & { row: Row, current?: Row }) => void | Promise<void>
}
type Mutations = { [T in keyof typeof schema]?: { create?: Mutation, update?: Mutation, remove?: Mutation } }

// ─── Every mutation rule in the app ───────────────────────────────────────────
const mutations: Mutations = {
  todos: {
    create: {
      allow: ({ user }) => !!user,
      prepare: ({ user, data }) => ({ ...data, author: user.id, createdAt: new Date().toISOString() }),
    },
    // rules can be per field: inspect `data`
    update: { allow: ({ user, current }) => current?.author === user.id },
    remove: { allow: ({ user, current }) => current?.author === user.id },
  },

  participants: {
    // rule 8: the count and the write share the transaction
    update: {
      allow: async ({ user, tx, current, data }) => {
        if (data.status !== 'approved') return false
        const mission = await tx.find({ table: 'missions', id: current.mission })
        if (mission.emissary !== user.id || mission.status !== 'open') return false
        const approved = await tx.list({ table: 'participants', query: { mission: mission.id, status: 'approved' } })
        return approved.length < mission.cap
      },
    },
  },

  cards: {
    // rule 5: the intent is "create a card"; the debit is its consequence
    create: {
      allow: async ({ user, tx, data }) => (await tx.find({ table: 'characters', id: data.character })).owner === user.id,
      after: async ({ tx, row }) => {
        const sku = await tx.find({ table: 'skus', id: row.sku })
        await tx.create({ table: 'wallets', data: { character: row.character, amount: -sku.price, reason: row.id } })
      },
    },
  },
}

// ─── Generic handlers: no table-specific code below this line ────────────────
function rule(table: string, op: 'create' | 'update' | 'remove') {
  const m = mutations[table as keyof Mutations]?.[op]
  if (!m) throw new Forbidden(`${op} ${table} is not allowed`)
  return m
}

export const { find, list, create, update, remove } = makeSchemaTableInterface(schema, null, {
  find: async (props) => db.find(props),
  list: async (props) => db.list(props),

  create: async ({ table, data }) => db.transaction(async (tx) => {
    const user = await currentUser(), m = rule(table!, 'create')
    if (!(await m.allow({ user, tx, data }))) throw new Forbidden()
    const row = await tx.create({ table, data: m.prepare ? await m.prepare({ user, tx, data }) : data })
    await m.after?.({ user, tx, row })
    return row
  }),

  update: async ({ table, id, data }) => db.transaction(async (tx) => {
    const user = await currentUser(), m = rule(table!, 'update')
    const current = await tx.find({ table, id })
    if (!(await m.allow({ user, tx, data, current }))) throw new Forbidden()
    const row = await tx.update({ table, id, data: m.prepare ? await m.prepare({ user, tx, data, current }) : data })
    await m.after?.({ user, tx, row, current })
    return row
  }),

  remove: async ({ table, id }) => db.transaction(async (tx) => {
    const user = await currentUser(), m = rule(table!, 'remove')
    const current = await tx.find({ table, id })
    if (!(await m.allow({ user, tx, data: {}, current }))) throw new Forbidden()
    const row = await tx.remove({ table, id })
    await m.after?.({ user, tx, row, current })
    return row
  }),
})!
```

Adding a feature means adding an entry to `mutations`, never a new exported server action.

`find` and `list` apply read permissions (for example, filtering by `user`) in the same file.

---

## Providers

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
// app/todos/layout.tsx — mount only what the route needs
'use client'
import { TablesProvider } from 'asasvirtuais/context'
import { schema as todos } from './schema'
import { schema as tags } from '../tags/schema'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <TablesProvider tables={{ todos, tags }}>{children}</TablesProvider>
}
```

```tsx
// app/todos/hooks.tsx
'use client'
import { useTable } from 'asasvirtuais/context'
import { useSingle } from 'asasvirtuais/registry'
import { schema } from './schema'

export const useTodos = () => useTable('todos', schema)
export const useTodo = () => useSingle(schema, 'todos')
```

```tsx
// app/todos/providers.tsx
'use client'
import { SingleProvider } from 'asasvirtuais/registry'
import { schema } from './schema'

export function TodoProvider({ id, children }: { id: string, children: React.ReactNode }) {
  return <SingleProvider id={id} table='todos' schema={schema}>{children}</SingleProvider>
}
```

---

## Forms

### Create

```tsx
// app/todos/forms.tsx
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
          <button type='submit' disabled={todo.loading}>Create</button>
          {todo.error && <p>{todo.error.message}</p>}
        </form>
      )}
    </CreateForm>
  )
}
```

### Update: editing several fields

`UpdateForm` sends only the fields in its state, `defaults` plus whatever `setField` changed.

```tsx
export function UpdateTodo() {
  const { single } = useTodo()
  return (
    <UpdateForm table='todos' schema={schema} id={single.id} defaults={{ title: single.title }}>
      {todo => (
        <form onSubmit={todo.submit}>
          <TitleField />
          <button type='submit' disabled={todo.loading}>Save</button>
        </form>
      )}
    </UpdateForm>
  )
}
```

### Update: one column, one click (rule 2, rule 16)

This replaces every `toggleX` / `approveX` / `archiveX` server action.

```tsx
export function ToggleTodo() {
  const { single } = useTodo()
  return (
    <UpdateForm table='todos' schema={schema} id={single.id}>
      {toggle => (
        <input
          type='checkbox'
          checked={single.done}
          disabled={toggle.loading}
          onChange={() => toggle.callback({ done: !single.done })}
        />
      )}
    </UpdateForm>
  )
}
```

The checkbox reads `single.done` from the index. When the update resolves, the index updates and the checkbox
follows. There is no local state.

### Remove

```tsx
export function DeleteTodo({ onSuccess }: { onSuccess?: () => void }) {
  const { single } = useTodo()
  const { remove } = useTodos()
  return (
    <ActionProvider action={remove.trigger} params={{ id: single.id }} onResult={onSuccess}>
      {del => <button onClick={del.submit} disabled={del.loading}>Delete</button>}
    </ActionProvider>
  )
}
```

### Filter / list

```tsx
export function FilterTodos({ children, ...props }: Omit<React.ComponentProps<typeof FilterForm<typeof schema>>, 'table' | 'schema'>) {
  return <FilterForm table='todos' schema={schema} {...props}>{children}</FilterForm>
}

// page
<FilterTodos autoTrigger defaults={{ query: { done: false } }}>
  {todos => todos.result?.map(t => (
    <TodoProvider key={t.id} id={t.id}><TodoItem /></TodoProvider>
  ))}
</FilterTodos>
```

To show a table that other writes can add to, read `useTodos().array` (after `list.trigger(...)`) instead of a
`FilterForm`'s local `result`.

---

## Multi-step workflows (rule 4)

Each step is one CRUD write by the user. Its rule is in `mutations`, and its result opens the next step.

| Step | Who | CRUD write | Rule in `mutations` |
|---|---|---|---|
| Join | player | `create participants { mission, character }` | owns the character, not in another mission, not full |
| Approve | emissary | `update participants { status: 'approved' }` | is the emissary, mission open, under the cap |
| Start | emissary | `update missions { status: 'active' }` | is the emissary, at least one approved participant |

Each step is a separate component on whatever screen the user's UI decision puts it. Because each row lives in the
index, the next step's UI shows up as soon as the previous write resolves:

```tsx
function MissionActions() {
  const { single: mission } = useMission()
  const { single: me } = useMyParticipant()   // undefined until joined

  if (isEmissary(mission)) return <><ApproveParticipants /><StartMission /></>  // update participants, update missions
  if (!me) return <JoinMission mission={mission.id} />                          // create participants
  if (me.status === 'pending') return <p>Waiting for approval</p>
  return null
}

function StartMission() {
  const { single: mission } = useMission()
  return (
    <UpdateForm table='missions' schema={missionsSchema} id={mission.id}>
      {start => (
        <button disabled={start.loading} onClick={() => start.callback({ status: 'active' })}>
          Start mission
        </button>
      )}
    </UpdateForm>
  )
}
```

When steps are a wizard inside one screen, chain them through the result with namespaced render props:

```tsx
<CreateForm table='characters' schema={characters} defaults={{ name: '' }}>
  {character => (
    character.result ? (
      // step 2 opens with step 1's row
      <CreateForm table='participants' schema={participants} defaults={{ character: character.result.id, mission }}>
        {join => <button onClick={join.submit} disabled={join.loading}>Join mission</button>}
      </CreateForm>
    ) : (
      <form onSubmit={character.submit}>
        <NameField />
        <button type='submit' disabled={character.loading}>Create character</button>
      </form>
    )
  )}
</CreateForm>
```

A draft followed by a save also counts as steps: a rule-6 function fills the fields, and a CRUD form saves them.

```tsx
<CreateForm table='characters' schema={characters} defaults={{ name: '', backstory: '' }}>
  {character => (
    <form onSubmit={character.submit}>
      <Form defaults={{ prompt: '' }} action={draftCharacter} onResult={draft => character.setFields(f => ({ ...f, ...draft }))}>
        {draft => (
          <button type='button' disabled={draft.loading} onClick={draft.submit}>Draft with AI</button>
        )}
      </Form>
      <NameField />
      <BackstoryField />
      <button type='submit' disabled={character.loading}>Save</button>
    </form>
  )}
</CreateForm>
```

---

## Automatic consequences (rule 5, rule 11)

| User intent (CRUD write) | Consequences (`after`, same transaction) |
|---|---|
| `create cards { sku, character }` | wallet debit |
| `update cards { status: 'sold' }` | wallet credit |
| `create logs { activity, character }` | outcome, payment, wallet rows, cards |

The client makes only the intent write. Views that show the consequence tables refetch:

```tsx
function BuySku({ sku, character }: { sku: string, character: string }) {
  const wallets = useWallets()
  return (
    <CreateForm
      table='cards' schema={cardsSchema}
      defaults={{ sku, character }}
      onSuccess={() => wallets.list.trigger({ query: { character } })}   // rule 11: refetch, never set
    >
      {buy => <button onClick={buy.submit} disabled={buy.loading}>Buy</button>}
    </CreateForm>
  )
}
```

---

## Smells → corrections

| You wrote | Write this instead | Rule |
|---|---|---|
| `'use server' export async function toggleDone(id)` | `UpdateForm` + `callback({ done: !single.done })` | 2 |
| `export async function approveParticipant(id)` | `UpdateForm` on `participants` + `update` rule in `mutations` | 2, 7 |
| a server action that writes rows in two tables the user triggers separately | one form per step | 4 |
| `create card` then `onSuccess` → `create wallet` on the client | `after` on `cards.create` | 5 |
| `logs.set(outcome.log); outcome.wallets.forEach(w => wallets.set(w))` | intent write + `list.trigger` for the consequence tables | 10, 11 |
| `const [todo, setTodo] = useState(props.todo)` | `useTodo()` inside a `TodoProvider` | 10, 12 |
| `revalidatePath(...)` / `router.refresh()` after a write | nothing: the index updates itself | 10 |
| permission check inside a component's server action | an `allow` in `mutations` | 7 |
| count in one request, write in another | both inside the handler's transaction | 8 |
| `form.callback(form.fields).then(onResult)` | `onResult` / `onSuccess` prop | 15 |
| `setField('done', true); submit()` | `callback({ done: true })` | 16 |

---

## API reference

| Import | Exports |
|---|---|
| `asasvirtuais/fields` | `FieldsProvider`, `useFields`, `useField` |
| `asasvirtuais/action` | `ActionProvider` (`params`, `action`, `onResult`, `onError`, `autoTrigger`), `useAction` |
| `asasvirtuais/form` | `Form` (fields + action; `defaults`, `action`, `onResult`, `onError`, `autoTrigger`), `useForm` |
| `asasvirtuais/forms` | `CreateForm`, `UpdateForm`, `FilterForm` (`table`, `schema`, `defaults`, `onSuccess`; `id` on update; `autoTrigger` on filter) |
| `asasvirtuais/context` | `InterfaceProvider`, `TablesProvider`, `useTable(table, schema)` |
| `asasvirtuais/registry` | `SingleProvider` (`id`, `table`, `schema`, `nullIfNotFound`), `useSingle(schema, table)` |
| `asasvirtuais/interface` | `makeSchemaTableInterface`, types `TableInterface`, `Query`, `TableSchema` |

Render props of every form and action: `fields`, `setField`, `setFields`, `submit`, `callback(params)`, `loading`,
`result`, `error`, `errors`.

`useTable(table, schema)` returns `index`, `array`, and `find` / `list` / `create` / `update` / `remove`, each as
`{ trigger, loading, result }`. Calls through these update the index.

`Query` operators: `$ne $lt $lte $gt $gte $in $nin $or $and`, and `$limit $skip $sort $select`.

### Naming

| Concept | Pattern | Example |
|---|---|---|
| Table | lowercase plural | `'todos'` |
| Types | `Readable`, `Writable` | |
| Field component | `{Field}Field` | `TitleField` |
| Hooks | `use{Model}s()`, `use{Model}()` | `useTodos()`, `useTodo()` |
| Forms | `Create{Model}`, `Update{Model}`, `Delete{Model}`, `Filter{Model}s` | `UpdateTodo` |
| One-column update | `{Verb}{Model}` wrapping `UpdateForm` | `ToggleTodo`, `ApproveParticipant` |
| Components | `{Model}Item`, `Single{Model}` | `TodoItem` |

A component may be named after a verb (`ApproveParticipant`). A server action may not.

---

## Prototyping

New apps and demos start on the framework from day one, never on `useState` mock arrays. With no backend, use
`asasvirtuais-dexie` (IndexedDB) as the interface:

```tsx
'use client'
import { dexieInterface } from 'asasvirtuais-dexie'
import { InterfaceProvider } from 'asasvirtuais/context'
import { schema } from './schema'

const db = dexieInterface(schema)
export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <InterfaceProvider {...db}>{children}</InterfaceProvider>
}
```

To go to production, replace `dexieInterface` with `app/actions.ts`. No UI changes.

---

## Project

<!-- Fill in per app. Examples: -->

- **Workflow:** <!-- e.g. push to `main` at the end of every session; `main` deploys to Vercel. -->
- **Database adapter:** <!-- e.g. Prisma + Postgres, Firestore, Dexie -->
- **Auth:** <!-- where `currentUser()` comes from -->
- **Tables:** <!-- list them, one line each -->
- **Not yet migrated:** <!-- legacy named server actions that still exist, so they are not copied as examples -->
