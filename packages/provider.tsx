'use client'
import { TableInterface } from './interface'
import { createContextFromHook } from './hooks'

export function useInterfaceProvider(tableInterface: TableInterface<any, any>) {
    return tableInterface
}

export const [InterfaceProvider, useInterface] = createContextFromHook(useInterfaceProvider)
