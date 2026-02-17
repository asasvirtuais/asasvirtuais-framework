'use client'
import React from 'react'
import { TableProvider, useTable } from 'asasvirtuais/react-interface'
import { fetchInterface } from '@/packages/fetch-interface'
import { schema } from '.'

export function useChats() {
    return useTable('chats', schema)
}

export function ChatsProvider({ children }: React.PropsWithChildren) {
    return (
        <TableProvider table='chats' schema={schema} interface={fetchInterface({ schema, 'baseUrl': '/api/v1', defaultTable: 'chats' })}>
            {children}
        </TableProvider>
    )
}