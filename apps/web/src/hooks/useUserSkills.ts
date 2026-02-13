import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userSkillsApi } from '../lib/api';

/**
 * Hook to fetch user's skill preferences
 */
export function useUserSkills() {
  return useQuery({
    queryKey: ['user-skills'],
    queryFn: () => userSkillsApi.list(),
  });
}

/**
 * Hook to update user's skill preferences (bulk update)
 */
export function useUpdateUserSkills() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (skills: { canonicalId: string; enabled: boolean }[]) =>
      userSkillsApi.update(skills),
    onSuccess: () => {
      // Invalidate to refetch fresh state
      queryClient.invalidateQueries({ queryKey: ['user-skills'] });
    },
  });
}
