'use client'
import React from 'react'
import { TableProvider, useTable } from '@/packages/providers'
import { useInterface } from '@/packages/providers'
import { schema } from './schema'

export function useComments() {
    return useTable('comments', schema)
}

export function CommentsProvider({ children }: React.PropsWithChildren) {
    const iface = useInterface()
    return (
        <TableProvider table='comments' schema={schema} interface={iface}>
            {children}
        </TableProvider>
    )
}
