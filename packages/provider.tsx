import { createContext, useContext } from 'react'
import { TableInterface } from './interface'

export function useInterfaceProvider(tableInterface: TableInterface<any, any>) {
    return tableInterface
}

const Context = createContext<TableInterface<any, any> | undefined>(undefined)

export function InterfaceProvider({ children, ...props }: React.PropsWithChildren<{ interface: TableInterface<any, any> }>) {
    const context = useInterfaceProvider(props.interface)
    return (
        <Context.Provider value={context}>
            {children}
        </Context.Provider>
    )
}

export function useInterface() {
    const context = useContext(Context)
    if (!context)
        throw new Error('useInterface must be used within an InterfaceProvider')
    return context
}

