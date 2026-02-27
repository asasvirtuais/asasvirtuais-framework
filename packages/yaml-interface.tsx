import fs from 'fs'
import { writeFile } from 'fs/promises'
import YAML from 'yaml'
import { generateId } from 'ai'
import { DatabaseInterface, TableInterface } from '@asasvirtuais/interface'
import z from 'zod'

export class Mutex {
  private promise : Promise<any> = Promise.resolve()
  
  async run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.promise.then(fn)
    this.promise = result.catch(() => {}) // Don't break chain on errors
    return result
  }
}

export const fileMutex = new Mutex()

export function yamlInterface<Schema extends DatabaseInterface, T extends keyof Schema & string>(defaultTable: string, databasePath = 'database'): TableInterface<z.infer<Schema[T]['readable']>, z.infer<Schema[T]['writable']>>{
    type Readable = z.infer<Schema[T]['readable']>
    type Writable = z.infer<Schema[T]['writable']>
    const tablePath = (name: string) => `${databasePath}/${name}`
    const recordPath = (table: string, id: string) => `${tablePath(table)}/${id}.yaml`
    const readRecord = (table: string, id: string) => {
        const path = recordPath(table, id)
        if ( ! fs.existsSync(path) )
            throw new Error(`Record not found: ${path}`)
        const file = fs.readFileSync(path, 'utf8')
        return YAML.parse(file) as Readable
    }
    return {
        async find({ table = defaultTable, id }) {
            return readRecord(table as string, id)
        },
        async list({ table = defaultTable, query }) {
            const path = tablePath(table as string)
            if (!fs.existsSync(path)) {
                // If the table directory doesn't exist, return an empty array.
                return []
            }
            const files = fs.readdirSync(path)
            let records: Readable[] = []
            for (const file of files) {
                if (file.endsWith('.yaml')) {
                    const id = file.slice(0, -5)
                    try {
                        const record = readRecord(table, id)
                        records.push(record)
                    } catch (error) {
                        console.error(`Error reading record ${id} from table ${table}:`, error)
                    }
                }
            }

            if (query) {
                const { $limit, $skip, $sort, $select, ...filters } = query

                // Apply filters
                if (Object.keys(filters).length > 0) {
                    records = records.filter(record => {
                    return Object.entries(filters).every(([key, value]) => {
                        const recordValue = record[key as keyof typeof record]
                        if (typeof value === 'object' && value !== null) {
                            // Handle operators within a field
                            return Object.entries(value).every(([op, opValue]) => {
                                switch (op) {
                                    case '$ne':
                                        return recordValue != opValue
                                    case '$in':
                                        return Array.isArray(opValue) && opValue.includes(recordValue)
                                    case '$nin':
                                        return Array.isArray(opValue) && !opValue.includes(recordValue)
                                    case '$lt':
                                        // @ts-expect-error
                                        return recordValue < opValue
                                    case '$lte':
                                        // @ts-expect-error
                                        return recordValue <= opValue
                                    case '$gt':
                                        // @ts-expect-error
                                        return recordValue > opValue
                                    case '$gte':
                                        // @ts-expect-error
                                        return recordValue >= opValue
                                    case '$search':
                                        return typeof recordValue === 'string' && recordValue.toLowerCase().includes(String(opValue).toLowerCase())
                                    default:
                                        return true // Unknown operators are ignored
                                }
                            })
                        }
                        return recordValue === value
                    })
                })
                }
                
                // Apply sorting
                if ($sort) {
                    const sortKeys = Object.keys($sort) as (keyof Readable)[]
                    if (sortKeys.length > 0) {
                        const key = sortKeys[0]
                        const direction = $sort[key] === 1 ? 1 : -1
                        records.sort((a, b) => {
                            if (a[key] < b[key]) return -1 * direction
                            if (a[key] > b[key]) return 1 * direction
                            return 0
                        })
                    }
                }

                // Apply pagination
                const skip = $skip || 0
                const limit = $limit || records.length
                records = records.slice(skip, skip + limit)

                // Apply projection
                if ($select) {
                    records = records.map(record => {
                        // @ts-expect-error
                        const selectedRecord: Partial<Readable> = { id: (record).id }
                        // @ts-expect-error
                        ($select as (keyof Readable)[]).forEach(key => {
                            // @ts-expect-error
                            selectedRecord[key] = record[key]
                        })
                        return selectedRecord as Readable
                    })
                }
            }

            return records
        },
        async create({table = defaultTable, ...props}) {
            props.data
            const path = tablePath(table as string)
            if ( ! fs.existsSync(path ) )
                fs.mkdirSync(path, { recursive: true })
            const id = generateId()
            const record = { id, ...props.data }
            const filePath = recordPath(table as string, id)
            await fileMutex.run(() => writeFile(filePath, YAML.stringify(record), 'utf8'))
            return record as Readable
        },
        async update({table = defaultTable, id, ...props}) {
            const record = readRecord(table as string, id)
            const updatedRecord = { ...record, ...props.data }
            await fileMutex.run(() => writeFile(recordPath(table as string, id), YAML.stringify(updatedRecord), 'utf8'))
            return updatedRecord as Readable
        },
        async remove({table = defaultTable, id}) {
            const path = recordPath(table as string, id)
            const data = readRecord(table as string, id)
            if ( ! fs.existsSync(path) )
                throw new Error(`Record not found: ${path}`)
            fs.unlinkSync(path)
            return {
                id,
                ...data
            }
        },
    }
}
