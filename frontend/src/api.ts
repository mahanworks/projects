const API = "http://localhost:4000";
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(API + path, {
    ...options, credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error?.message || body.error || `Request failed (${response.status})`);
  }
  return response.json();
}
export const api = {
  me: () => request<User | null>("/auth/me"),
  demo: () => request<User>("/auth/demo", { method: "POST" }),
  logout: () => request("/auth/logout", { method: "POST" }),
  emails: (status: string) => request<Email[]>(`/api/emails?status=${status}`),
  schedule: (payload: SchedulePayload) => request<{count:number}>("/api/emails/schedule", { method:"POST", body:JSON.stringify(payload) })
};
export type User = { id:string; name:string; email:string; avatar?:string|null };
export type Email = { id:string; recipient:string; subject:string; scheduledAt:string; sentAt?:string|null; status:string; error?:string|null };
export type SchedulePayload = { subject:string; body:string; startAt:string; delayBetweenMs:number; hourlyLimit:number; senderEmail:string; recipients:string[] };
