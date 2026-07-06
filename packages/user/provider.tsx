'use client'
import React from 'react'
import { TableProvider, useTable } from '@/packages/providers'
import { useInterface } from '@/packages/providers'
import { schema } from './schema'

export function useUsers() {
    return useTable('users', schema)
}

export function UsersProvider({ children }: React.PropsWithChildren) {
    const iface = useInterface()
    return (
        <TableProvider table='users' schema={schema} interface={iface}>
            {children}
        </TableProvider>
    )
}
