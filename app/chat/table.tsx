'use client'
import { TableProvider, useDatabaseTable } from 'asasvirtuais/react-interface'
import { fetchInterface } from 'asasvirtuais/fetch-interface'
import { schema } from '.'

export function useChats() {
    return useDatabaseTable<typeof schema>('chats')
}

export function ChatsProvider({ children }: { children: React.ReactNode }) {
    return (
        <TableProvider table='chats' schema={schema} interface={fetchInterface({schema, 'baseUrl': '/api/v1', defaultTable: 'chats'})}>
            {children}
        </TableProvider>
    )
}