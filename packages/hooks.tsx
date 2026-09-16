import { useState, useCallback, useEffect, useMemo } from 'react'

export function useAction<Props, Result, Defaults = Partial<Props>>(action: (props: Props) => Promise<Result>, {
    onSuccess, autoTrigger, ...props
}: {
    defaults?: Defaults
    onSuccess?: (result: Result, props?: Props) => void
    autoTrigger?: boolean
} = {}) {
    const [loading, setLoading] = useState<boolean>(false)
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
