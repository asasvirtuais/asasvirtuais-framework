import React from 'react'
import { User } from './schema'
import { useField } from '@/packages/fields'

export const OauthIdInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<User>('oauthId')
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
    const {value, setValue} = useField<User>('name')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const UsernameInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<User>('username')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const EmailInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<User>('email')
    return (
        <input
            type='email'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}

export const RoleInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
    const {value, setValue} = useField<User>('role')
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
    const {value, setValue} = useField<User>('status')
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
    const {value, setValue} = useField<User>('created')
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
    const {value, setValue} = useField<User>('updated')
    return (
        <input
            type='text'
            value={value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    )
}
