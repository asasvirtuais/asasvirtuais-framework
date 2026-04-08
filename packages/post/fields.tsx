import { Post } from './schema'
import { useField } from '@/packages/fields'

export const NameInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<Post>('name')
    
    return (
        <input
            type='text'
            value={value}
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
            value={value}
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
            value={value}
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
            value={value}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const DefinitionTextarea = (props: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>) => {
    const {value, setValue} = useField<Post>('definition')
    return (
        <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const DescriptionTextarea = (props: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>) => {
    const {value, setValue} = useField<Post>('description')
    return (
        <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}
