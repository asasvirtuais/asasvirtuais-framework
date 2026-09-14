import { useIndex, createContextFromHook } from './hooks'


export type StoreProps<T> = {
    [table: string]: (T & { id: string} )[]
}
export function useStoreProvider<T>(props: StoreProps<T>) {
    return Object.fromEntries(
        Object.entries(props).map(
            ([table, initial]) => [table, useIndex<T>({ initial: initial as T & { id: string} [] })]
        )
    ) as {
        [table: string]: ReturnType<typeof useIndex<T>>
    }
}

export const [StoreProvider, useStore] = createContextFromHook((useStoreProvider<any>))
