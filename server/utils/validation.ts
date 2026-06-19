import type { ZodSchema } from 'zod'

/**
 * Read + validate a request body against a zod schema. Throws a clean 400 with
 * the field errors instead of letting a ZodError become a 500.
 */
export async function validateBody<T>(event: any, schema: ZodSchema<T>): Promise<T> {
  const body = await readBody(event).catch(() => ({}))
  const result = schema.safeParse(body)
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ')
    throw createError({ statusCode: 400, statusMessage: msg || 'Invalid request body' })
  }
  return result.data
}
