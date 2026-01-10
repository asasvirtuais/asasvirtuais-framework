import React from 'react'
import { useState, useCallback, useEffect, useMemo } from 'react'

type StoreProps<T> = {
    [table: string]: (T & { id: string} )[]
}
function useStoreProvider<T>(props: StoreProps<T>) {
    return Object.fromEntries(
        Object.entries(props).map(
            ([table, initial]) => [table, useIndex<T>({ initial: initial as T & { id: string} [] })]
        )
    ) as {
        [table: string]: ReturnType<typeof useIndex<T>>
    }
}

export const [StoreProvider, useStore] = createContextFromHook((useStoreProvider<any>))

export function useAction<Props, Result, Defaults = Partial<Props>>(action: (props: Props) => Promise<Result>, {
    onSuccess, autoTrigger, ...props
}: {
    defaults?: Defaults
    onSuccess?: (result: Result, props?: Props) => void
    autoTrigger?: boolean
} = {}) {
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState()
    const [result, setResult] = useState<Result>()
    const [defaults, setDefaults] = useState<Defaults>(props.defaults ?? {} as Defaults)

    const trigger = useCallback(async (props: Omit<Props, keyof Defaults>): Promise<Result> => {
        try {
            setLoading(true)
            const result = await action({
                ...props,
                ...defaults,
            } as Props)

            setResult(result)
            if (onSuccess)
                onSuccess(result)
            return result

        } catch (error) {
            // @ts-expect-error
            setError(error)
            throw error
        } finally {
            setLoading(false)
        }
    }, [defaults, onSuccess, loading, setLoading])

    useEffect(() => {
        if (autoTrigger)
            trigger(props as Omit<Props, keyof Defaults>)
    }, [])

    return {
        trigger,
        loading,
        error,
        result,
        defaults,
        setDefaults,
    }
}

export function useIndex<T>(value: Record<string, any>) {

    type readable = T

    const [index, setIndex] = useState<Record<string, T>>(() => value)

    const array = useMemo(() => Object.values(index) as readable[], [index])

    const set = useCallback((...params: readable[]) => {
        setIndex(prev => ({
            ...prev,
            ...Object.fromEntries(params.map(data => ([(data as readable & { id: string} ).id, data])))
        }))
    }, [])

    const unset = useCallback((...params: readable[]) => {
        setIndex(prev => {
            const newState = { ...prev }
            for (const data of params) {
                const id = (data as readable & { id: string} ).id
                if (newState[id])
                    delete newState[id]
            }
            return newState
        })
    }, [])

    return {
        index,
        array,
        set,
        setIndex,
        unset,
    }
}

export function createContextFromHook<Props, Result>(useHook: (props: Props) => Result) {

    const Context = React.createContext<Result | undefined>(undefined)

    function Provider({ children, ...props }: React.PropsWithChildren<Props>) {

        const value = useHook(props as Props) as Result

        return <Context.Provider value={value}>{children}</Context.Provider>
    }

    function useContext() {
        return React.useContext(Context) as Result
    }

    return [Provider, useContext] as const
}
