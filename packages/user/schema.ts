import z from 'zod'

export const readable = z.object({
    id: z.string(),
    oauthId: z.string(),
    name: z.string(),
    username: z.string(),
    email: z.email(),
    role: z.string().default('subscriber'),
    status: z.string().default('active'),
    meta: z.any().nullable().optional(),
    created: z.string().optional(),
    updated: z.string().optional(),
})

export const writable = readable.pick({
    oauthId: true,
    name: true,
    username: true,
    email: true,
    role: true,
    status: true,
    meta: true,
    created: true,
    updated: true,
})

export const schema = {
    readable,
    writable,
}

export type User = z.infer<typeof schema.readable>
