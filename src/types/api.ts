export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardMetrics {
  totalCandidates: number;
  shortlisted: number;
  rejected: number;
  inVisa: number;
  placed: number;
  pendingInterviews: number;
  pendingContracts: number;
  pendingSTI: number;
  monthlyPlacements: { month: string; count: number }[];
  candidatesByStatus: { status: string; count: number }[];
  topPrograms: { program: string; count: number }[];
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  actor: string;
  timestamp: string;
  entityType?: string;
  entityId?: string;
}

export interface FilterParams {
  status?: string;
  program?: string;
  source?: string;
  agency?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  scoreMin?: number;
  scoreMax?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
