// Ambient globals.
//
// Some routes reach for `global.db` (a lazily-attached pool) rather than
// importing the connection module. Untyped, that read is an implicit-any error
// and those files did not compile. Declared here so the pattern typechecks;
// prefer importing from src/database/connection in new code.

declare global {
  // eslint-disable-next-line no-var
  var db:
    | {
        query?: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number }>;
      }
    | undefined;
}

export {};
