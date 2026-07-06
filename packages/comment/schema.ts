import z from 'zod'

export const readable = z.object({
    id: z.string(),
    post: z.string(),
    parent: z.string().nullable().optional(),
    author: z.string(),
    content: z.string(),
    status: z.string().default('approved'),
    type: z.string().default('comment'),
    meta: z.any().nullable().optional(),
    attachments: z.any().nullable().optional(),
    created: z.string().optional(),
    updated: z.string().optional(),
})

export const writable = readable.pick({
    post: true,
    parent: true,
    author: true,
    content: true,
    status: true,
    type: true,
    meta: true,
    attachments: true,
    created: true,
    updated: true,
})

export const schema = {
    readable,
    writable,
}

export type Comment = z.infer<typeof schema.readable>
