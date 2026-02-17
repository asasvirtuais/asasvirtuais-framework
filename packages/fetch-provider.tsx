'use client'
import { useMemo } from 'react'
import { TableSchema } from './interface'
import { fetchInterface } from './fetch-interface'
import { InterfaceProvider } from './interface-provider'

export function FetchInterfaceProvider<Schema extends TableSchema>({ schema, defaultTable, baseUrl, headers, children }: { schema: Schema, defaultTable?: string, baseUrl?: string, headers?: Record<string, string>, children: React.ReactNode }) {
    const memo = useMemo(() => fetchInterface({ schema, defaultTable, baseUrl, headers }), [schema, defaultTable, baseUrl, headers])
    return (
        <InterfaceProvider {...memo}>
          {children}
        </InterfaceProvider>
    )
}