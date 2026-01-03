import { NextRequest } from 'next/server'
import { TableInterface } from './interface'

export function routes(implementation: TableInterface<any, any>) {
  return {
    // GET /api/v1/[table]/[id]
    find: (
      request: NextRequest,
      { params }: { params: Promise<{ table: string; id: string} >} 
    ) => handleRoute(request, params, ({ table, id }) => implementation.find({ table, id })
    ),

    // GET /api/v1/[table]
    list: (
      request: NextRequest,
      { params }: { params: Promise<{ table: string} >} 
    ) => handleRoute(request, params, ({ table }) => {
      const url = new URL(request.url)
      const query = Object.fromEntries(url.searchParams)
      return implementation.list({ table, query })
    }),

    // POST /api/v1/[table]
    create: (
      request: NextRequest,
      { params }: { params: Promise<{ table: string} >} 
    ) => handleRoute(request, params, async ({ table }) => {
      const data = await request.json()
      return implementation.create({ table, data })
    }),

    // PATCH /api/v1/[table]/[id]
    update: (
      request: NextRequest,
      { params }: { params: Promise<{ table: string; id: string} >} 
    ) => handleRoute(request, params, async ({ table, id }) => {
      const data = await request.json()
      return implementation.update({ table, id, data })
    }),

    // DELETE /api/v1/[table]/[id]
    remove: (
      request: NextRequest,
      { params }: { params: Promise<{ table: string; id: string} >} 
    ) => handleRoute(request, params, ({ table, id }) => implementation.remove({ table, id })
    ),
  }
}

export async function handleRoute<P, R>(
  request: NextRequest,
  params: Promise<P>,
  handler: (resolvedParams: any) => Promise<R>
) {
  try {
    const resolvedParams = await params
    const result = await handler(resolvedParams)
    return Response.json(result)
  } catch (error) {
    console.error("Route error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
// Utility for creating a single dynamic route handler

export function createDynamicRoute(implementation: TableInterface<any, any>) {
  const routeHandlers = routes(implementation)

  return async function dynamicRoute(
    request: NextRequest,
    { params: promise }: { params: Promise<{ params: string[]} >} 
  ) {
    const { params } = await promise
    const [table, id] = params

    const method = request.method

    try {
      switch (method) {
        case "GET":
          if (id) {
            return routeHandlers.find(request, {
              params: Promise.resolve({ table, id }),
            })
          } else {
            return routeHandlers.list(request, {
              params: Promise.resolve({
                table,
                ...Object.fromEntries(request.nextUrl.searchParams.entries()),
              }),
            })
          }
        case "POST":
          return routeHandlers.create(request, {
            params: Promise.resolve({ table }),
          })
        case "PATCH":
          if (!id) throw new Error("ID required for PATCH")
          return routeHandlers.update(request, {
            params: Promise.resolve({ table, id }),
          })
        case "DELETE":
          if (!id) throw new Error("ID required for DELETE")
          return routeHandlers.remove(request, {
            params: Promise.resolve({ table, id }),
          })
        default:
          return Response.json({ error: "Method not allowed" }, { status: 405 })
      }
    } catch (error) {
      console.error(error)
      return Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      )
    }
  }
}
