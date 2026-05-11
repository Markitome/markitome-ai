import { MARKITOME_EMAIL_DOMAIN, type AppRole } from "@markitome/shared";

export const roleRank: Record<AppRole, number> = {
  INTERN: 1,
  TEAM_MEMBER: 2,
  MANAGER: 3,
  ADMIN: 4
};

export function isMarkitomeEmail(email?: string | null) {
  return Boolean(email?.toLowerCase().endsWith(`@${MARKITOME_EMAIL_DOMAIN}`));
}

export function canAccessRole(userRoles: AppRole[], allowedRoles: AppRole[]) {
  return userRoles.some((role) => allowedRoles.includes(role));
}

export function hasMinimumRole(userRoles: AppRole[], minimumRole: AppRole) {
  const requiredRank = roleRank[minimumRole];
  return userRoles.some((role) => roleRank[role] >= requiredRank);
}
