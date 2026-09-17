/**
 * Action: an async function that receives (props/params/attributes) and returns the promise of a result.
 * It can error but doesn't hold an internal error state.
 * It receives params but doesn't manage a internal state of params.
 */
import React, { createContext, useEffect } from 'react'
import { useCallback, useState } from 'react'

export type ActionProps<Params, Result> = {
  params: Partial<Params>
  action: (params: Params) => Promise<Result>
  onResult?: (result: Result) => any
  onError?: (error: Error) => any
  autoTrigger?: boolean
}

export function useActionProvider<Params, Result>(props: React.PropsWithChildren<ActionProps<Params, Result>>) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const callback = useCallback(async (params: Params): Promise<Result> => {

    setLoading(true)

    try {
      const result = await props.action(params)
      if (props.onResult)
        props.onResult(result)
      setResult(result)
      return result
    } catch (error) {
      if (props.onError)
        props.onError(error as Error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [props.action, props.onResult, props.onError])

  const submit = useCallback(
    (e?: any) => {
      e?.preventDefault?.()
      callback(props.params as Params)
      return false
    },
    [callback, props.params]
  )


  useEffect(() => {
    if (props.autoTrigger)
      callback(props.params as Params)
  }, [])


  return {
    loading,
    result,
    submit,
    callback,
    params: props.params,
  }
}

const Context = createContext<ReturnType<typeof useActionProvider<any, any>> | undefined>(undefined)

export function ActionProvider<Params, Result>({ children, ...params }: ActionProps<Params, Result> & {
  children: React.ReactNode | ((props: ReturnType<typeof useActionProvider<Params, Result>>) => React.ReactNode)
}) {
  const context = useActionProvider<Params, Result>(params)
  return (
    <Context.Provider value={context}>
      {typeof children === 'function' ? children(context) : children}
    </Context.Provider>
  )
}

export function useAction<Params, Result>() {
  return React.useContext(Context) as ReturnType<typeof useActionProvider<Params, Result>>
}
