'use client'
import { TableProvider, useTable } from '@/packages/providers'
import { useInterface } from '@/packages/providers'
import { schema } from './schema'

export function usePosts() {
    return useTable('posts', schema)
}

export function PostsProvider({ children }: React.PropsWithChildren) {
    const iface = useInterface()
    return (
        <TableProvider table='posts' schema={schema} interface={iface}>
            {children}
        </TableProvider>
    )
}