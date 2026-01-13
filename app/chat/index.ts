import z from 'zod'

export const readable = z.object({
    id: z.string(),
    title: z.string().optional(),
})

export const writable = readable.pick({
    title: true,
})

export const schema = { readable, writable }

export type Readable = z.infer<typeof readable>
export type Writable = z.infer<typeof writable>
