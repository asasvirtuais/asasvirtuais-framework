'use client'
import { TableProvider, useTableInterface } from 'asasvirtuais/react-interface'
import { fetchInterface } from 'asasvirtuais/fetch-interface'
import { schema } from '.'

export function useChats() {
    return useTableInterface('chats', schema)
}

export function ChatsProvider({ children }: { children: React.ReactNode }) {
    return (
        <TableProvider table='chats' schema={schema} interface={fetchInterface({ schema, 'baseUrl': '/api/v1', defaultTable: 'chats' })}>
            {children}
        </TableProvider>
    )
}