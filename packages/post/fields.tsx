import { Post } from './schema'
import { useField } from '@/packages/fields'
import { useTable } from '@/packages/providers'
import { schema } from './schema'
import { schema as categorySchema } from '../category/schema'

export const NameInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Post>('name')
    
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const TitleInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Post>('title')

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
    const {value, setValue} = useField<Post>('slug')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const DescriptionInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Post>('description')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const DefinitionTextarea = (props: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>) => {
    const {value, setValue} = useField<Post>('definition')
    return (
        <textarea
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const DescriptionTextarea = (props: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>) => {
    const {value, setValue} = useField<Post>('description')
    return (
        <textarea
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const TypeInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Post>('type')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const ContentTextarea = (props: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>) => {
    const {value, setValue} = useField<Post>('content')
    return (
        <textarea
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const ThumbnailInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Post>('thumbnail')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const CoverInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Post>('cover')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const TagsInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Post>('tags')
    return (
        <input
            type='text'
            value={value ? value.join(', ') : ''}
            onChange={(e) => setValue(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
            {...props}
        />
    )
}

export const StatusInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Post>('status')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const AuthorInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Post>('author')
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
    const {value, setValue} = useField<Post>('created')
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
    const {value, setValue} = useField<Post>('updated')
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
    const {value, setValue} = useField<Post>('parent')
    const {array} = useTable('posts', schema)
    
    return (
        <select
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value || null)}
            {...props}
        >
            <option value="">No Parent</option>
            {array.map(post => (
                <option key={post.id} value={post.id}>
                    {post.title || post.name || post.id}
                </option>
            ))}
        </select>
    )
}

export const CategorySelect = (props: React.DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>) => {
    const {value, setValue} = useField<Post>('category')
    const {array} = useTable('categories', categorySchema)
    
    return (
        <select
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value || null)}
            {...props}
        >
            <option value="">No Category</option>
            {array.map(c => (
                <option key={c.id} value={c.id}>
                    {c.name || c.id}
                </option>
            ))}
        </select>
    )
}



