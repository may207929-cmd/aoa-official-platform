# Supabase Setup (Admin Content Platform)

## 1. Apply database schema
Run in Supabase SQL Editor:

- `supabase/admin_setup.sql`

## 2. Deploy edge function
From project root:

```bash
supabase functions deploy content-admin --project-ref hudhglmitjwikhnfvckh
```

## 3. Ensure required secrets/env are present
The function reads:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Set (if missing):

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY --project-ref hudhglmitjwikhnfvckh
```

## 4. Grant admin role to account
Run in SQL Editor:

```sql
insert into public.profiles (id, email, role)
select id, email, 'admin'
from auth.users
where email = 'you@example.com'
on conflict (id)
do update set role = 'admin', email = excluded.email;
```

## 5. Admin workflow
Use `admin.html`:

1. Login as admin.
2. Load cloud draft.
3. Save draft to cloud.
4. Publish to website.
5. Roll back from revision list if needed.
