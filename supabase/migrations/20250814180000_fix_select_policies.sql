-- Grant SELECT access to team members for runners and legs

-- Allow team members to SELECT runners in their team
CREATE POLICY "team_members_can_select_runners" ON public.runners
FOR SELECT TO authenticated
USING (
  team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  )
);

-- Allow team members to SELECT legs in their team
CREATE POLICY "team_members_can_select_legs" ON public.legs
FOR SELECT TO authenticated
USING (
  team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  )
);
