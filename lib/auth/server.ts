import { createHash, randomBytes } from "node:crypto";
import { ObjectId, type Collection } from "mongodb";
import { ensureConfigSeeded, findRoleBySlug, listRoles } from "@/lib/configStore";
import { getDatabase } from "@/lib/mongodb";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { RoleCategory, SessionUser } from "@/lib/types";

export const SESSION_COOKIE_NAME = "mobility_session";
export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 10;

interface UserDocument {
  _id: ObjectId;
  username: string;
  displayName: string;
  passwordHash: string;
  roleSlug: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionDocument {
  _id?: ObjectId;
  tokenHash: string;
  userId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

export interface AuthenticatedUser extends SessionUser {
  id: string;
  username: string;
}

let indexesReady: Promise<void> | null = null;

async function collections(): Promise<{ users: Collection<UserDocument>; sessions: Collection<SessionDocument> }> {
  const database = await getDatabase();
  if (!indexesReady) {
    indexesReady = Promise.all([
      database.collection<UserDocument>("users").createIndex({ username: 1 }, { unique: true, name: "users_username_unique" }),
      database.collection<SessionDocument>("sessions").createIndex({ tokenHash: 1 }, { unique: true, name: "sessions_token_hash_unique" }),
      database.collection<SessionDocument>("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "sessions_expiry_ttl" }),
      database.collection<SessionDocument>("sessions").createIndex({ userId: 1 }, { name: "sessions_user_id" }),
    ]).then(() => undefined).catch((error: unknown) => {
      indexesReady = null;
      throw error;
    });
  }
  await indexesReady;
  return { users: database.collection<UserDocument>("users"), sessions: database.collection<SessionDocument>("sessions") };
}

export function normalizeUsername(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function isValidUsername(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()) || null; }
    catch { return null; }
  }
  return null;
}

function toPublicUser(user: UserDocument, role: { name: string; category: RoleCategory }): AuthenticatedUser {
  return {
    id: user._id.toString(),
    username: user.username,
    name: user.displayName,
    role: user.roleSlug,
    category: role.category,
    roleName: role.name,
  };
}

export function safeUser(user: AuthenticatedUser): SessionUser & { id: string; username: string } {
  return { id: user.id, username: user.username, name: user.name, role: user.role, category: user.category, roleName: user.roleName };
}

export async function createUser(input: { username: string; displayName: string; password: string; roleSlug: string }): Promise<AuthenticatedUser> {
  await ensureConfigSeeded();
  const { users } = await collections();
  const role = await findRoleBySlug(input.roleSlug, false);
  if (!role) throw new Error("The selected role is unavailable.");
  const user: Omit<UserDocument, "_id"> = {
    username: normalizeUsername(input.username),
    displayName: input.displayName.trim(),
    passwordHash: await hashPassword(input.password),
    roleSlug: role.slug,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await users.insertOne(user as UserDocument);
  return toPublicUser({ ...user, _id: result.insertedId }, role);
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const { users, sessions } = await collections();
  if (!ObjectId.isValid(userId)) throw new Error("Account not found.");
  const user = await users.findOne({ _id: new ObjectId(userId), active: true });
  if (!user) throw new Error("This account is disabled.");
  const role = await findRoleBySlug(user.roleSlug, false);
  if (!role) throw new Error("Your role is currently disabled.");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await sessions.insertOne({ tokenHash: hashToken(token), userId: user._id, createdAt: new Date(), expiresAt });
  return { token, expiresAt };
}

export async function getCurrentUser(request: Request): Promise<AuthenticatedUser | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const { users, sessions } = await collections();
  const session = await sessions.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const user = await users.findOne({ _id: session.userId, active: true });
  if (!user) throw new AuthError("Your account is disabled.", 403);
  const role = await findRoleBySlug(user.roleSlug, false);
  if (!role) throw new AuthError("Your role is currently disabled.", 403);
  return toPublicUser(user, role);
}

export async function invalidateSession(request: Request): Promise<void> {
  const token = readSessionToken(request);
  if (!token) return;
  const { sessions } = await collections();
  await sessions.deleteOne({ tokenHash: hashToken(token) });
}

export async function authenticateUser(username: string, password: string): Promise<AuthenticatedUser> {
  await ensureConfigSeeded();
  await ensureBootstrapAdmin();
  const { users } = await collections();
  const normalized = normalizeUsername(username);
  const user = await users.findOne({ username: normalized });
  if (!user) throw new AuthError("Invalid username or password.", 401);
  if (!user.active) throw new AuthError("Your account is disabled.", 403);
  if (!(await verifyPassword(password, user.passwordHash))) throw new AuthError("Invalid username or password.", 401);
  const role = await findRoleBySlug(user.roleSlug, false);
  if (!role) throw new AuthError("Your role is currently disabled.", 403);
  return toPublicUser(user, role);
}

export class AuthError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "AuthError"; }
}

export async function ensureBootstrapAdmin(): Promise<void> {
  const usernameValue = process.env.BOOTSTRAP_ADMIN_USERNAME;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const displayName = process.env.BOOTSTRAP_ADMIN_NAME;
  if (!usernameValue || !password || !displayName) return;
  const username = normalizeUsername(usernameValue);
  if (!isValidUsername(username) || password.length < MIN_PASSWORD_LENGTH || !displayName.trim()) return;
  await ensureConfigSeeded();
  const role = await findRoleBySlug("admin", false);
  if (!role || role.category !== "admin") return;
  const { users } = await collections();
  if (await users.countDocuments({ active: true, roleSlug: role.slug }) > 0) return;
  const existing = await users.findOne({ username });
  if (existing) return;
  const document = {
    username,
    displayName: displayName.trim(),
    passwordHash: await hashPassword(password),
    roleSlug: role.slug,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  try { await users.insertOne(document as UserDocument); }
  catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) return;
    throw error;
  }
}

export async function listSafeUsers(): Promise<Array<{ id: string; username: string; displayName: string; roleSlug: string; roleName: string; roleCategory: RoleCategory; active: boolean; createdAt: string }>> {
  const { users } = await collections();
  const records = await users.find({}).sort({ username: 1 }).toArray();
  const roles = new Map((await listRoles(true)).map((role) => [role.slug, role]));
  return records.map((user) => {
    const role = roles.get(user.roleSlug);
    return {
      id: user._id.toString(), username: user.username, displayName: user.displayName,
      roleSlug: user.roleSlug, roleName: role?.name ?? user.roleSlug, roleCategory: role?.category ?? "requester",
      active: user.active, createdAt: user.createdAt.toISOString(),
    };
  });
}

export async function updateManagedUser(id: string, changes: { active?: boolean; roleSlug?: string; password?: string }): Promise<void> {
  if (!ObjectId.isValid(id)) throw new AuthError("User not found.", 404);
  const { users, sessions } = await collections();
  const targetId = new ObjectId(id);
  const target = await users.findOne({ _id: targetId });
  if (!target) throw new AuthError("User not found.", 404);

  let nextRole = target.roleSlug;
  if (changes.roleSlug !== undefined) {
    const role = await findRoleBySlug(changes.roleSlug, false);
    if (!role) throw new AuthError("Choose an active role.", 400);
    nextRole = role.slug;
  }

  const currentRole = await findRoleBySlug(target.roleSlug, true);
  const nextRoleConfig = await findRoleBySlug(nextRole, false);
  const isRemovingActiveAdmin = target.active && currentRole?.category === "admin" &&
    (changes.active === false || nextRoleConfig?.category !== "admin");
  if (isRemovingActiveAdmin) {
    const activeAdmins = await users.countDocuments({ active: true, roleSlug: { $in: (await listRoles(false)).filter((role) => role.category === "admin").map((role) => role.slug) } });
    if (activeAdmins <= 1) throw new AuthError("You cannot disable or change the role of the last active Admin.", 409);
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (changes.active !== undefined) update.active = changes.active;
  if (changes.roleSlug !== undefined) update.roleSlug = nextRole;
  if (changes.password !== undefined) update.passwordHash = await hashPassword(changes.password);
  await users.updateOne({ _id: targetId }, { $set: update });
  if (changes.active === false || changes.password !== undefined || (changes.roleSlug !== undefined && currentRole?.category !== nextRoleConfig?.category)) {
    await sessions.deleteMany({ userId: targetId });
  }
}

export type ApiAuthResult = { user: AuthenticatedUser; response?: never } | { user?: never; response: Response };

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return false;
  return request.headers.get("sec-fetch-site") !== "cross-site";
}

export async function requireApiUser(request: Request, categories?: RoleCategory[]): Promise<ApiAuthResult> {
  if (!/^(GET|HEAD|OPTIONS)$/i.test(request.method) && !isSameOriginRequest(request)) {
    return { response: Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 }) };
  }
  let user: AuthenticatedUser | null;
  try { user = await getCurrentUser(request); }
  catch (error) {
    if (error instanceof AuthError) return { response: Response.json({ error: error.message }, { status: error.status }) };
    console.error("Authentication lookup failed:", error);
    return { response: Response.json({ error: "Could not verify your session." }, { status: 503 }) };
  }
  if (!user) return { response: Response.json({ error: "Please sign in to continue." }, { status: 401 }) };
  if (categories && !categories.includes(user.category)) return { response: Response.json({ error: "You do not have permission to perform this action." }, { status: 403 }) };
  return { user };
}

export function sessionCookie(token: string, expiresAt: Date): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
