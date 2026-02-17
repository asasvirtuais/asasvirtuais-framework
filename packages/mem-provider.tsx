import { useMemo } from "react";
import type { TableSchema } from "./interface";
import { InterfaceProvider } from "./interface-provider";
import { memInterface } from "./mem-interface";

export function MemInterfaceProvider<TSchema extends TableSchema>({ children }: { children: React.ReactNode} ) {
    const memo = useMemo(() => memInterface<TSchema>(), [])
    return (
        <InterfaceProvider {...memo}>
            {children}
        </InterfaceProvider>
    )
}
