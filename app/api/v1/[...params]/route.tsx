import { FindProps, UpdateProps, RemoveProps, ListProps } from '@/packages/interface'
import { createDynamicRoute } from '@/packages/next-interface'

export const POST = createDynamicRoute({
    async create(props) {
        return {
            id: `${Math.random()}`.slice(2),
            ...props.data
        }
    },
    find: function (props: FindProps): Promise<any> {
        throw new Error('Function not implemented.')
    },
    update: function (props: UpdateProps<any>): Promise<any> {
        throw new Error('Function not implemented.')
    },
    remove: function (props: RemoveProps): Promise<any> {
        throw new Error('Function not implemented.')
    },
    list: function (props: ListProps<any>): Promise<any[]> {
        throw new Error('Function not implemented.')
    }
})