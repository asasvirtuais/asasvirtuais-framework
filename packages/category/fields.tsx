import React from 'react'
import { Category } from './schema'
import { useField } from '@/packages/fields'
import { useTable } from '@/packages/providers'
import { schema } from './schema'

export const TypeInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Category>('type')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const NameInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Category>('name')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const SlugInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Category>('slug')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const DescriptionTextarea = (props: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>) => {
    const {value, setValue} = useField<Category>('description')
    return (
        <textarea
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const CreatedInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Category>('created')
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
    const {value, setValue} = useField<Category>('updated')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const ParentSelect = (props: React.DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>) => {
    const {value, setValue} = useField<Category>('parent')
    const {array} = useTable('categories', schema)
    
    return (
        <select
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value || null)}
            {...props}
        >
            <option value="">No Parent</option>
            {array.map(cat => (
                <option key={cat.id} value={cat.id}>
                    {cat.name || cat.id}
                </option>
            ))}
        </select>
    )
}
