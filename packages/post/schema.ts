import z from 'zod'

export const readable = z.object({
    id: z.string(),
    type: z.string().default('post'),
    name: z.string(),
    slug: z.string(),
    title: z.string(),
    content: z.string(),
    definition: z.string(),
    description: z.string(),
    thumbnail: z.string(),
    cover: z.string(),
    tags: z.string().array(),
})

export const writable = readable.pick({
    name: true,
    type: true,
    slug: true,
    title: true,
    content: true,
    definition: true,
    description: true,
    thumbnail: true,
    cover: true,
    tags: true,
})

export const schema = {
    readable,
    writable,
}

export type Post = z.infer<typeof schema.readable>
