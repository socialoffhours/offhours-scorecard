-- OFFHOURS Scorecard V1: additional policies for the TEST EVENT.
-- Run ONCE in Supabase > SQL Editor.
create policy "Test players can update player status" on public.players for update to anon using (true) with check (true);
create policy "Test dashboard can read players" on public.players for select to anon using (true);
create policy "Test dashboard can read scores" on public.scores for select to anon using (true);
