import React, { createContext, useEffect, useMemo } from 'react'
import { useCallback, useState } from 'react'

export type ActionProps<Params, Result> = {
  params: Partial<Params>
  action: (fields: Params) => Promise<Result>
  onResult?: (result: Result) => any
  onError?: (error: Error) => any
  autoTrigger?: boolean
}

export function useActionProvider<Fields, Result>(props: React.PropsWithChildren<ActionProps<Fields, Result>>) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  /** receives an event (optional) and processes the form submission using the fields state as props, stores the result or error in the respective states */
  const submit = useCallback(
    async (e?: any) => {
      e?.preventDefault?.()
      setLoading(true)
      setError(null)
      try {
        const result = await props.action(props.params as Fields)
        if (props.onResult)
          props.onResult(result)
        setResult(result)
      } catch (error) {
        console.error(error)
        if (props.onError)
          props.onError(error as Error)
        setError(error as Error)
        throw error
      } finally {
        setLoading(false)
      }
      return false
    },
    [props.params, props.action, props.onError]
  )

  const callback = useCallback(async (fields: Fields) => {
    setLoading(true)
    setError(null)
    try {
      const result = await props.action(fields)
      if (props.onResult)
        props.onResult(result)
      setResult(result)
    } catch (error) {
      console.error(error)
      if (props.onError)
        props.onError(error as Error)
      setError(error as Error)
      throw error
    } finally {
      setLoading(false)
    }
    return false
  }, [props.action])

  useEffect(() => {
    if (props.autoTrigger)
      callback(props.params as Fields)
  }, [])


  return {
    loading,
    result,
    error,
    submit,
    callback,
    params: props.params,
  }
}

export const ActionContext = createContext<ReturnType<typeof useActionProvider<any, any>> | undefined>(undefined)

export function ActionProvider<Fields, Result>({ children, ...params }: ActionProps<Fields, Result> & {
  children: React.ReactNode | ((props: ReturnType<typeof useActionProvider<Fields, Result>>) => React.ReactNode)
}) {
  const context = useActionProvider<Fields, Result>(params)
  return (
    <ActionContext.Provider value={context}>{typeof children === 'function' ? children(context) : children}</ActionContext.Provider>
  )
}

export function useAction<Fields, Result>() {
  return React.useContext(ActionContext) as ReturnType<typeof useActionProvider<Fields, Result>>
}
