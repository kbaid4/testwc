-- Migration: Allow insertion & selection on planners by any authenticated user

ALTER TABLE planners ENABLE ROW LEVEL SECURITY;

-- Drop old policies if exist
drop policy if exists "All planners access" on planners;

drop policy if exists "All planners insert" on planners;

-- Allow authenticated users to read planners belonging to them (user_id matches admin) OR anything (for simplicity now) but safer: only admin own.
-- We'll still need supplier to insert a row with user_id of organiser (not its own), so SELECT by admin will work; Insert by supplier allowed for any values.

create policy "All planners insert" on planners
for insert to authenticated
with check (true);

create policy "All planners access" on planners
for select to authenticated
using (true); 