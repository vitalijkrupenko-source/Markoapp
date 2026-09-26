import { NextResponse } from 'next/server';

export class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Wraps a route handler so thrown UserErrors become friendly JSON responses. */
export function handle(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof UserError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: 'Nekaj je šlo narobe. Poskusite znova.' }, 500);
    }
  };
}

export async function body(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
