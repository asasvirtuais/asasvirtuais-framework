import z from 'zod'

export const readable = z.object({
    id: z.string(),
    type: z.string().default('post'),
    name: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    title: z.string(),
    content: z.string(),
    definition: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    thumbnail: z.string().nullable().optional(),
    cover: z.string().nullable().optional(),
    tags: z.string().array().default([]),
    category: z.string().nullable().optional(),
    status: z.string().default('draft'),
    author: z.string().nullable().optional(),
    parent: z.string().nullable().optional(),
    meta: z.any().nullable().optional(),
    attachments: z.any().nullable().optional(),
    created: z.string().optional(),
    updated: z.string().optional(),
})

export const writable = readable.pick({
    type: true,
    name: true,
    slug: true,
    title: true,
    content: true,
    definition: true,
    description: true,
    thumbnail: true,
    cover: true,
    tags: true,
    category: true,
    status: true,
    author: true,
    parent: true,
    meta: true,
    attachments: true,
    created: true,
    updated: true,
})

export const schema = {
    readable,
    writable,
}

export type Post = z.infer<typeof schema.readable>

