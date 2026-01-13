'use client'
import { Box, Container, Heading, Stack } from '@chakra-ui/react'
import { CreateChat, FilterChats } from './chat/forms'

export default function Home() {
  return (
    <Container py={12}>
      <Stack>
        <Heading>Demo</Heading>
        <FilterChats/>
        <CreateChat/>
      </Stack>
    </Container>
  )
}
