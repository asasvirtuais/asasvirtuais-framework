'use client'
import { createContextFromHook } from './hooks'
import type { TableInterface } from './interface'

function useInterfaceProvider(tableInterface: TableInterface<any, any>) {
    return tableInterface
}

export const [InterfaceProvider, useInterface] = createContextFromHook(useInterfaceProvider)
