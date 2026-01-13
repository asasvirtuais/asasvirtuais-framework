import { CreateForm, FilterForm, useDatabaseTable } from 'asasvirtuais/react-interface'
import { schema } from '.'
import { TitleField } from './fields'
import { Box, Button, HStack, Stack } from '@chakra-ui/react'
import { BiTrash } from 'react-icons/bi'

export function CreateChat() {
    return (
        <CreateForm table='chats' schema={schema}>
            {form => (
                <Stack as='form' onSubmit={form.submit}>
                    <TitleField />
                    <Button type='submit'>Create Chat</Button>
                </Stack>
            )}
        </CreateForm>
    )
}

export function FilterChats() {

    const { remove } = useDatabaseTable('chats')

    return (
        <FilterForm table='chats' schema={schema}>
            {form => (
                <Stack>
                    {form.result?.map(chat => (
                        <HStack>
                            <Box key={chat.id}>{chat.title || 'No Title'}</Box>
                            <Button
                                onClick={() => remove.trigger({id: chat.id})}
                            ><BiTrash/></Button>
                        </HStack>
                    ))}
                </Stack>
            )}
        </FilterForm>
    )
}
