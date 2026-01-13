import { Input, InputProps } from '@chakra-ui/react'
import { useFields } from 'asasvirtuais/fields'

export function TitleField(props: InputProps) {

    const { fields, setField } = useFields<{title: string}>()

    return (
        <Input name='title' value={fields.title} onChange={e => setField('title', e.target.value)} {...props} />
    )
}
