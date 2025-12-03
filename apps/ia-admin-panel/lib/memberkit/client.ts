/**
 * Memberkit API Client
 * 
 * Cliente HTTP para integração com a API Memberkit.
 * Documentação: https://ajuda.memberkit.com.br/referencia-api
 * 
 * Autenticação: API Key via query parameter `api_key`
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MemberkitAcademy {
  id: number;
  name: string;
  subdomain: string;
  custom_domain: string | null;
  email: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface MemberkitCourse {
  id: number;
  name: string;
  description: string | null;
  position: number;
  image_url: string | null;
  page_checkout_url: string | null;
  created_at: string;
  updated_at: string;
  category?: {
    id: number;
    name: string;
    position: number;
  };
  modules?: MemberkitModule[];
}

export interface MemberkitModule {
  id: number;
  name: string;
  position: number;
  lessons?: MemberkitLesson[];
}

export interface MemberkitLesson {
  id: number;
  name: string;
  description: string | null;
  position: number;
  duration: number | null;
  video_url: string | null;
  attachments?: MemberkitAttachment[];
}

export interface MemberkitAttachment {
  id: number;
  name: string;
  url: string;
  size: number;
}

export interface MemberkitClassroom {
  id: number;
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  students_count?: number;
}

export interface MemberkitMembershipLevel {
  id: number;
  name: string;
  description: string | null;
  price: number;
  period_type: string;
  created_at: string;
  updated_at: string;
}

export interface MemberkitMembership {
  id: number;
  user_id: number;
  membership_level_id: number;
  status: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  user?: MemberkitUser;
  membership_level?: MemberkitMembershipLevel;
}

export interface MemberkitUser {
  id: number;
  email: string;
  name: string | null;
  status: string;
  blocked: boolean;
  created_at: string;
  updated_at: string;
  last_access_at: string | null;
  total_points?: number;
  memberships?: MemberkitMembership[];
  custom_fields?: Record<string, unknown>;
}

export interface MemberkitActivity {
  id: number;
  user_id: number;
  activity_type: string;
  resource_type: string;
  resource_id: number;
  resource_name: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface MemberkitRanking {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  entries?: MemberkitRankingEntry[];
}

export interface MemberkitRankingEntry {
  position: number;
  user_id: number;
  user_name: string;
  user_email: string;
  points: number;
}

export interface MemberkitScore {
  id: number;
  user_id: number;
  points: number;
  description: string | null;
  ranking_id: number | null;
  created_at: string;
}

export interface MemberkitQuizSubmission {
  id: number;
  user_id: number;
  quiz_id: number;
  score: number;
  passed: boolean;
  answers: Record<string, unknown>;
  created_at: string;
}

export interface MemberkitComment {
  id: number;
  user_id: number;
  lesson_id: number;
  content: string;
  status: string;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
  replies?: MemberkitComment[];
}

export interface MemberkitMagicLink {
  url: string;
  expires_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════════════════════

const MEMBERKIT_API_KEY = process.env.MEMBERKIT_API_KEY ?? '';
const MEMBERKIT_API_BASE_URL = process.env.MEMBERKIT_API_BASE_URL ?? 'https://memberkit.com.br/api/v1';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Make authenticated request to Memberkit API
 */
async function memberkitRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, params = {} } = options;

  if (!MEMBERKIT_API_KEY) {
    throw new Error('MEMBERKIT_API_KEY não configurada. Configure a variável de ambiente.');
  }

  // Build URL with query params
  const url = new URL(`${MEMBERKIT_API_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', MEMBERKIT_API_KEY);

  // Add additional params
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    fetchOptions.body = JSON.stringify(body);
  }

  console.log(`[Memberkit] ${method} ${endpoint}`);

  const response = await fetch(url.toString(), fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Memberkit] Error ${response.status}:`, errorText);
    throw new Error(`Memberkit API error (${response.status}): ${errorText}`);
  }

  // Handle empty responses (DELETE operations)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ═══════════════════════════════════════════════════════════════════════════
// ACADEMY
// ═══════════════════════════════════════════════════════════════════════════

export async function getAcademy(): Promise<MemberkitAcademy> {
  return memberkitRequest<MemberkitAcademy>('/academy');
}

// ═══════════════════════════════════════════════════════════════════════════
// COURSES
// ═══════════════════════════════════════════════════════════════════════════

export async function listCourses(page: number = 1): Promise<MemberkitCourse[]> {
  return memberkitRequest<MemberkitCourse[]>('/courses', {
    params: { page }
  });
}

export async function getCourse(courseId: number): Promise<MemberkitCourse> {
  return memberkitRequest<MemberkitCourse>(`/courses/${courseId}`);
}

export async function getLesson(courseId: number, lessonId: number): Promise<MemberkitLesson> {
  return memberkitRequest<MemberkitLesson>(`/courses/${courseId}/lessons/${lessonId}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASSROOMS
// ═══════════════════════════════════════════════════════════════════════════

export async function listClassrooms(page: number = 1): Promise<MemberkitClassroom[]> {
  return memberkitRequest<MemberkitClassroom[]>('/classrooms', {
    params: { page }
  });
}

export async function getClassroom(classroomId: number): Promise<MemberkitClassroom> {
  return memberkitRequest<MemberkitClassroom>(`/classrooms/${classroomId}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMBERSHIPS
// ═══════════════════════════════════════════════════════════════════════════

export async function listMembershipLevels(page: number = 1): Promise<MemberkitMembershipLevel[]> {
  return memberkitRequest<MemberkitMembershipLevel[]>('/membership_levels', {
    params: { page }
  });
}

export async function listMemberships(params: {
  user_id?: number;
  membership_level_id?: number;
  status?: string;
  page?: number;
} = {}): Promise<MemberkitMembership[]> {
  return memberkitRequest<MemberkitMembership[]>('/memberships', {
    params: params as Record<string, string | number | boolean | undefined>
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════

export async function listUsers(params: {
  email?: string;
  name?: string;
  status?: string;
  membership_level_id?: number;
  classroom_id?: number;
  page?: number;
} = {}): Promise<MemberkitUser[]> {
  return memberkitRequest<MemberkitUser[]>('/users', {
    params: params as Record<string, string | number | boolean | undefined>
  });
}

export async function getUser(userId: number): Promise<MemberkitUser> {
  return memberkitRequest<MemberkitUser>(`/users/${userId}`);
}

export async function createUser(data: {
  email: string;
  name?: string;
  password?: string;
  membership_level_id?: number;
  classroom_id?: number;
  expires_at?: string;
  custom_fields?: Record<string, unknown>;
}): Promise<MemberkitUser> {
  return memberkitRequest<MemberkitUser>('/users', {
    method: 'POST',
    body: data
  });
}

export async function updateUser(userId: number, data: {
  email?: string;
  name?: string;
  membership_level_id?: number;
  classroom_id?: number;
  expires_at?: string;
  blocked?: boolean;
  custom_fields?: Record<string, unknown>;
}): Promise<MemberkitUser> {
  return memberkitRequest<MemberkitUser>(`/users/${userId}`, {
    method: 'PUT',
    body: data
  });
}

export async function archiveUser(userId: number): Promise<void> {
  await memberkitRequest<void>(`/users/${userId}`, {
    method: 'DELETE'
  });
}

export async function getUserActivities(userId: number, params: {
  page?: number;
  per_page?: number;
} = {}): Promise<MemberkitActivity[]> {
  return memberkitRequest<MemberkitActivity[]>(`/users/${userId}/activities`, {
    params: params as Record<string, string | number | boolean | undefined>
  });
}

export async function generateMagicLink(userId: number, expiresIn: number = 3600): Promise<MemberkitMagicLink> {
  return memberkitRequest<MemberkitMagicLink>(`/users/${userId}/tokens`, {
    method: 'POST',
    body: { expires_in: expiresIn }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RANKINGS
// ═══════════════════════════════════════════════════════════════════════════

export async function listRankings(page: number = 1): Promise<MemberkitRanking[]> {
  return memberkitRequest<MemberkitRanking[]>('/rankings', {
    params: { page }
  });
}

export async function getUserRanking(rankingId: number, userId?: number): Promise<MemberkitRanking> {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (userId) {
    params.user_id = userId;
  }
  return memberkitRequest<MemberkitRanking>(`/rankings/${rankingId}`, { params });
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORES
// ═══════════════════════════════════════════════════════════════════════════

export async function createScore(data: {
  user_id: number;
  points: number;
  description?: string;
  ranking_id?: number;
}): Promise<MemberkitScore> {
  return memberkitRequest<MemberkitScore>('/scores', {
    method: 'POST',
    body: data
  });
}

export async function deleteScore(scoreId: number): Promise<void> {
  await memberkitRequest<void>(`/scores/${scoreId}`, {
    method: 'DELETE'
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// QUIZZES
// ═══════════════════════════════════════════════════════════════════════════

export async function listQuizSubmissions(params: {
  user_id?: number;
  quiz_id?: number;
  page?: number;
} = {}): Promise<MemberkitQuizSubmission[]> {
  return memberkitRequest<MemberkitQuizSubmission[]>('/quizzes/submissions', {
    params: params as Record<string, string | number | boolean | undefined>
  });
}

export async function getQuizSubmission(submissionId: number): Promise<MemberkitQuizSubmission> {
  return memberkitRequest<MemberkitQuizSubmission>(`/quizzes/submissions/${submissionId}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function listComments(params: {
  lesson_id?: number;
  user_id?: number;
  status?: string;
  page?: number;
} = {}): Promise<MemberkitComment[]> {
  return memberkitRequest<MemberkitComment[]>('/comments', {
    params: params as Record<string, string | number | boolean | undefined>
  });
}

export async function getComment(commentId: number): Promise<MemberkitComment> {
  return memberkitRequest<MemberkitComment>(`/comments/${commentId}`);
}

export async function createComment(data: {
  lesson_id: number;
  user_id: number;
  content: string;
  parent_id?: number;
}): Promise<MemberkitComment> {
  return memberkitRequest<MemberkitComment>('/comments', {
    method: 'POST',
    body: data
  });
}

export async function deleteComment(commentId: number): Promise<void> {
  await memberkitRequest<void>(`/comments/${commentId}`, {
    method: 'DELETE'
  });
}

export async function approveComment(commentId: number): Promise<MemberkitComment> {
  return memberkitRequest<MemberkitComment>(`/comments/${commentId}/approve`, {
    method: 'PUT'
  });
}

export async function rejectComment(commentId: number): Promise<MemberkitComment> {
  return memberkitRequest<MemberkitComment>(`/comments/${commentId}/reject`, {
    method: 'PUT'
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS FOR TOOL EXECUTOR
// ═══════════════════════════════════════════════════════════════════════════

export const MemberkitClient = {
  // Academy
  getAcademy,
  
  // Courses
  listCourses,
  getCourse,
  getLesson,
  
  // Classrooms
  listClassrooms,
  getClassroom,
  
  // Memberships
  listMembershipLevels,
  listMemberships,
  
  // Users
  listUsers,
  getUser,
  createUser,
  updateUser,
  archiveUser,
  getUserActivities,
  generateMagicLink,
  
  // Rankings
  listRankings,
  getUserRanking,
  
  // Scores
  createScore,
  deleteScore,
  
  // Quizzes
  listQuizSubmissions,
  getQuizSubmission,
  
  // Comments
  listComments,
  getComment,
  createComment,
  deleteComment,
  approveComment,
  rejectComment,
};

export default MemberkitClient;

