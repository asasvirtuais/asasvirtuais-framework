import React, { createContext, useCallback, useMemo, useState } from 'react'

export type FieldsProps<T> = { defaults?: Partial<T> }

export function useFieldsProvider<T>(props: FieldsProps<T>) {

    const [fields, setFields] = useState(props.defaults as T ?? {} as T)

    const setField = useCallback(
        <K extends keyof T>(name: K, value: T[K]) => {
            setFields(prev => ({ ...prev, [name]: value }))
        },
        [setFields, fields]
    )

    return {
        defaults: props.defaults,
        fields,
        setField,
        setFields,
    }
}

export const Context = createContext<ReturnType<typeof useFieldsProvider<any>> | undefined>(undefined)

export function FieldsProvider<T>({children, ...props}: FieldsProps<T> & {
    children: React.ReactNode | ((value: ReturnType<typeof useFieldsProvider<T>>) => React.ReactNode)
}) {

    const value = useFieldsProvider<T>(props)

    return (
        <Context.Provider value={value}>
            {typeof children === 'function' ? children(value) : children}
        </Context.Provider>
    )
}

export const useFields = <T,>() => {

    const context = React.useContext(Context)

    if (context === undefined)
        throw new Error('useFields must be used within a FieldsProvider')

    return context as ReturnType<typeof useFieldsProvider<T>>
}

export const useField = <T,>(fieldName: keyof T) => {
    const { fields } = useFields<T>()

    const value = useMemo(() => fields[fieldName], [fields, fieldName])
    const setValue = useCallback(
        (newValue: T[keyof T]) => {
            const { setField } = useFields<T>()
            setField(fieldName, newValue)
        },
        [fieldName]
    )

    return {
        value,
        setValue
    }
}
