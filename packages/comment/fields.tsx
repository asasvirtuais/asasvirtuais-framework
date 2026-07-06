import React from 'react'
import { Comment } from './schema'
import { useField } from '@/packages/fields'
import { useTable } from '@/packages/providers'
import { schema } from './schema'
import { schema as postSchema } from '../post/schema'

export const ContentTextarea = (props: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>) => {
    const {value, setValue} = useField<Comment>('content')
    return (
        <textarea
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const AuthorInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Comment>('author')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const StatusInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Comment>('status')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const TypeInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Comment>('type')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const CreatedInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Comment>('created')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const UpdatedInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Comment>('updated')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const PostSelect = (props: React.DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>) => {
    const {value, setValue} = useField<Comment>('post')
    const {array} = useTable('posts', postSchema)
    
    return (
        <select
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        >
            <option value="" disabled>Select a Post</option>
            {array.map(p => (
                <option key={p.id} value={p.id}>
                    {p.title || p.name || p.id}
                </option>
            ))}
        </select>
    )
}

export const ParentSelect = (props: React.DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>) => {
    const {value, setValue} = useField<Comment>('parent')
    const {array} = useTable('comments', schema)
    
    return (
        <select
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value || null)}
            {...props}
        >
            <option value="">No Parent</option>
            {array.map(c => (
                <option key={c.id} value={c.id}>
                    {c.author ? `${c.author}: ` : ''}{c.content.slice(0, 30)}
                </option>
            ))}
        </select>
    )
}
