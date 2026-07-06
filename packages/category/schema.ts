import z from 'zod'

export const readable = z.object({
    id: z.string(),
    type: z.string().default('category'),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable().optional(),
    parent: z.string().nullable().optional(),
    meta: z.any().nullable().optional(),
    created: z.string().optional(),
    updated: z.string().optional(),
})

export const writable = readable.pick({
    type: true,
    name: true,
    slug: true,
    description: true,
    parent: true,
    meta: true,
    created: true,
    updated: true,
})

export const schema = {
    readable,
    writable,
}

export type Category = z.infer<typeof schema.readable>
