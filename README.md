This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Phone tunnel testing

For localtunnel phone testing, set the public app URL before starting dev:

```bash
NEXT_PUBLIC_APP_URL=https://your-tunnel.loca.lt bun run dev
```

`next.config.ts` reads that host for Next.js dev origin and Server Action origin allow-lists.

## Production demo setup

Before deploying the judge demo:

1. Create a Supabase Storage bucket named `exam-assets`.
2. Make the bucket public for hackathon demo simplicity.
3. Add these env vars in Vercel: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_APP_URL`, and `SUPABASE_STORAGE_BUCKET`.
4. Set `NEXT_PUBLIC_APP_URL` to the deployed Vercel URL, for example `https://your-app.vercel.app`.
5. Run/apply Prisma migrations against the production Supabase Postgres DB.
6. Keep phone images small by using the existing client compression; Vercel Functions reject oversized request bodies.

## Supabase Realtime

Exam auto-refresh uses Broadcast first, so capture success can refresh the teacher page even if Postgres Changes is not configured. Postgres Changes is still useful as a secondary signal.

Check whether `public."Submission"` is in the realtime publication:

```sql
select *
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'Submission';
```

If it is missing, add it:

```sql
alter publication supabase_realtime add table public."Submission";
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
