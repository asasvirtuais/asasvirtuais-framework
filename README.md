# Asas Virtuais Framework

This is a framework of architectural decisions for software (web) development that takes an unorthodoxical approach to lay-out the necessary foundations for full-stack web development.

Through the use of this framework I have successfully facilitated the development of full-stack apps of small and medium complexity and I would argue that it should work for large applications as well.

**Key Concepts**

**Front-end and back-end unity**: PHP has proved that the principle of single responsibility is better applied when it focuses on the responsibility of features/functionality instead of the traditional separation between front-end and back-end. Despite much criticism it's evident by how it took over the internet decades ago and now we see the same happening with React, Next.js and JSX as it finally unifies HTML, JavaScript and back-end code into a single integrated architecture, we'll leverage these technological advances to build full-stack application where the code is separated by what it does in the app-specific logic (or business logic) instead of what it does in the programming executation, prioritizing the development of fully operational and app-features. This is why we will use React and "server actions" instead of traditional API routes.

**End-to-end CRUD integration**: the main problem this framework solves is keeping an app-level client-side database with all CRUD operations, providing utility hooks and helpful components to compose CRUD operations forms erradicating the need to code state changes and track the data across the steps of the CRUD operations, all of that is solved through the intelligent use of helpful components and context provider.

**Zero-Config**: Asasvirtuais is against configuration-based coding, which makes it unorthodoxical, here everything is constructed by coding it into the files, it gives you the helpful tools to assemble your project, but doesn't do it for you, you have to code the forms and the effects or side-effects yourself, there will never be a hook to configure an effect or side-effect into the application, if you want something to happen somewhere in the application you have to embed that into the code, there is no dependency injection strategies in here.

## Core Packages

**asasvirtuais/action**

Provides access to asynchronous actions state and execution (loading, result, error).
```tsx
import { ActionProvider, useAction } from 'asasvirtuais/action'

const example =
    <ActionProvider<Fields,Result> action={sumAB} params={{a:1, b: 2}} onResult={handle3} onError={handleError} autoTrigger>
        {({
            loading,
            result,
            error,
            submit, // submit receives an optional event and calls callback passing the params, returns false
            callback, // callback receives params and returns a promise
            params,
        }) => (
            //  Your UI for the action state
        )}
    </ActionProvider>
```
Very simple, I didn't think much to make this, I know there are a ton of libraries that do this, but I don't see any reason to overthink it. I'm not trying to be a genius here, just solve a problem in the simplest way without blocking anything. The only thing I emphasize is the use of function in the children prop which helps a lot with composability of the front-end.

**asasvirtuais/fields**

Provides the hooks expected to exist in the process of managing the state of fields in a form.

```tsx
import { FieldsProvider, useFields, useField } from 'asasvirtuais/fields'

const example = (
    <FieldsProvider<Fields> defaults={{a:1, b:2}}>
        {({
            defaults,
            fields,
            setField, // setField(key, value)
            setFields, // setField({...fields})
        }) => (
            // Your fields UI goes here 
            // useField(key).value
            // useField(key).setValue
        )}
    </FieldsProvider>
)

useFields<Fields>()
useField<Fields>('some key of fields')
```
Again, simple state management withtin the context of an object that holds the fields of a form, very basic stuff. The goal is just to avoid manually coding useState, state and setState, because that is repetitive and bloats the codebase distracting us from focusing on what matters: the feature.

**asasvirtuais/form**

Combines the action and fields packages into a context provider that lets you manage and operate the form action and fields.

```tsx
import { Form, useForm } from 'asasvirtuais/form'

const example = (
    <Form<Fields,Result>
        action={asyncAction}
        defaults={{...}}
        onResult={handleResult}
        onError={handleError}
        autoTrigger={true/false}
    >
        {({
            loading, result, error, submit, callback, params, defaults, fields, setField, setFields
        }) => (
            // Form UI goes here
        )}
    </Form>
)
```

**asasvirtuais/interface**
Has the interface for CRUD operations to be shared across front-end and back-end of your application.

**asasvirtuais/providers**
Has the React context-providers for the CRUD operations to occur on the client-side of your application.

**asasvirtuais/form**
Also has the utility components (forms) for the composition of the CRUD operation in your app.