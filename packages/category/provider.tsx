'use client'
import React from 'react'
import { TableProvider, useTable } from '@/packages/providers'
import { useInterface } from '@/packages/providers'
import { schema } from './schema'

export function useCategories() {
    return useTable('categories', schema)
}

export function CategoriesProvider({ children }: React.PropsWithChildren) {
    const iface = useInterface()
    return (
        <TableProvider table='categories' schema={schema} interface={iface}>
            {children}
        </TableProvider>
    )
}
