declare module "@neondatabase/serverless" {
  export interface NeonSql {
    (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<Array<Record<string, unknown>>>;
  }

  export function neon(connectionString: string): NeonSql;
}
