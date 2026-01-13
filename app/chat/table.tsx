'use client'
import { TableProvider } from 'asasvirtuais/react-interface'
import { fetchInterface } from 'asasvirtuais/fetch-interface'
import { schema } from '.'

export function ChatsProvider({ children }: { children: React.ReactNode }) {
    return (
        <TableProvider table='chats' schema={schema} interface={fetchInterface({schema, 'baseUrl': '/api', defaultTable: 'chats'})}>
            {children}
        </TableProvider>
    )
}