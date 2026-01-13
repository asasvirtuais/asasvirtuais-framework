'use client'
import { Box, Container, Heading, Stack } from '@chakra-ui/react'
import { CreateChat } from './chat/forms'
import { useTable } from '@/packages/react-interface'
import { schema } from './chat'

export default function Home() {
  const array = useTable<typeof schema>().array
  return (
    <Container py={12}>
      <Stack>
        <Heading>Demo</Heading>
        <CreateChat/>
        <Stack mt={8}>
          <Box><b>Chat List</b></Box>
          {array.map(chat => (
            <Box>{chat.title}</Box>
          ))}
        </Stack>
      </Stack>
    </Container>
  )
}
