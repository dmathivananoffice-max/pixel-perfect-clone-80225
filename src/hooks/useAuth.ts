import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  const { user, token, isAuthenticated, isLoading, showMFA, login, logout, verifyMFA } =
    useAuthStore();

  const hasRole = (roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const isAdmin = user?.role === "super_admin" || user?.role === "managing_director";

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    showMFA,
    login,
    logout,
    verifyMFA,
    hasRole,
    isAdmin,
  };
}
