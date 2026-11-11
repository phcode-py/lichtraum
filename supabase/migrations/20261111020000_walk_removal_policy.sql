-- Enables the explicit, confirmed removal of the owner's finished walk only.
-- Applying this policy does not delete records. No photographs or files are affected.
grant delete on public.walks to authenticated;
create policy "Remove own finished walks" on public.walks
 for delete to authenticated
 using (owner = (select auth.uid()) and status = 'ended');
