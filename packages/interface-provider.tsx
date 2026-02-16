'use client'
import { createContextFromHook } from './hooks'
import type { TableInterface } from './interface'

function useInterfaceProvider({ interface: tableInterface }: {
    interface: TableInterface<any, any>
}) {
    return tableInterface
}

export const [InterfaceProvider, useInterface] = createContextFromHook(useInterfaceProvider)
