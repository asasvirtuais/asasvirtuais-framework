import React from 'react'
import { FieldsProvider, FieldsProps, useFieldsProvider } from './fields'
import { ActionProvider, ActionProps, useActionProvider } from './action'

export type FormProps<Fields, Result> = FieldsProps<Fields> & Omit<ActionProps<Fields, Result>, 'params'> & {
    children?: React.ReactNode | ((props: ReturnType<typeof useFieldsProvider<Fields>> & ReturnType<typeof useActionProvider<Fields, Result>>) => React.ReactNode)
}

export function Form<Fields, Result>({children, ...params}: FormProps<Fields, Result>) {

    return (
        <FieldsProvider<Fields> defaults={params.defaults}>
            {fields => (
                <ActionProvider<Fields, Result> params={fields.fields} action={params.action} autoTrigger={params.autoTrigger} onError={params.onError}>
                    {form => (
                        typeof children === 'function' ? children({...fields, ...form}) : children
                    )}
                </ActionProvider>
            )}
        </FieldsProvider>
    )
}
