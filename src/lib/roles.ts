export type UserRole = "Customer" | "Staff" | "Admin" | "SuperAdmin";

export function isStaffRole(role: UserRole) {
  return role === "Staff" || role === "Admin" || role === "SuperAdmin";
}

export function isAdminRole(role: UserRole) {
  return role === "Admin" || role === "SuperAdmin";
}

export function hasRole(role: UserRole, allowed: UserRole[]) {
  return allowed.includes(role);
}
