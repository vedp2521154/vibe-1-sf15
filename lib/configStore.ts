import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { DEFAULT_LOCATIONS, DEFAULT_PASSENGER_CAPACITY, DEFAULT_ROLES, DEFAULT_VEHICLE_NAME } from "@/lib/configDefaults";
import type { RoleCategory } from "@/lib/types";

interface RoleDocument {
  name: string;
  nameKey: string;
  slug: string;
  category: RoleCategory;
  active: boolean;
  builtIn: boolean;
  createdAt: Date;
}

interface LocationDocument {
  name: string;
  nameKey: string;
  active: boolean;
  builtIn: boolean;
  createdAt: Date;
}

interface SettingsDocument {
  key: "mobility";
  vehicleName: string;
  passengerCapacity: number;
  updatedAt: Date;
}

export interface RoleConfig {
  _id: string;
  name: string;
  slug: string;
  category: RoleCategory;
  active: boolean;
  builtIn: boolean;
  createdAt: string;
}

export interface LocationConfig {
  _id: string;
  name: string;
  active: boolean;
  builtIn: boolean;
  createdAt: string;
}

export interface MobilitySettings {
  vehicleName: string;
  passengerCapacity: number;
}

function normalizedName(name: string): string {
  return name.trim().toLocaleLowerCase("en-US");
}

function serializeRole(role: RoleDocument & { _id: ObjectId }): RoleConfig {
  return {
    _id: role._id.toString(),
    name: role.name,
    slug: role.slug,
    category: role.category,
    active: role.active,
    builtIn: role.builtIn,
    createdAt: role.createdAt.toISOString(),
  };
}

function serializeLocation(location: LocationDocument & { _id: ObjectId }): LocationConfig {
  return {
    _id: location._id.toString(),
    name: location.name,
    active: location.active,
    builtIn: location.builtIn,
    createdAt: location.createdAt.toISOString(),
  };
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function ensureConfigSeeded(): Promise<void> {
  const database = await getDatabase();
  const roles = database.collection<RoleDocument>("roles");
  const locations = database.collection<LocationDocument>("locations");
  const settings = database.collection<SettingsDocument>("settings");

  await Promise.all([
    roles.createIndex({ slug: 1 }, { unique: true }),
    roles.createIndex({ nameKey: 1 }, { unique: true }),
    locations.createIndex({ nameKey: 1 }, { unique: true }),
    settings.createIndex({ key: 1 }, { unique: true }),
  ]);

  for (const role of DEFAULT_ROLES) {
    try {
      await roles.updateOne(
        { slug: role.slug },
        {
          $setOnInsert: {
            ...role,
            nameKey: normalizedName(role.name),
            active: true,
            builtIn: true,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }

  for (const name of DEFAULT_LOCATIONS) {
    try {
      await locations.updateOne(
        { nameKey: normalizedName(name) },
        { $setOnInsert: { name, nameKey: normalizedName(name), active: true, builtIn: true, createdAt: new Date() } },
        { upsert: true },
      );
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }

  await settings.updateOne(
    { key: "mobility" },
    {
      $setOnInsert: {
        key: "mobility",
        vehicleName: DEFAULT_VEHICLE_NAME,
        passengerCapacity: DEFAULT_PASSENGER_CAPACITY,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function listRoles(includeInactive = false): Promise<RoleConfig[]> {
  await ensureConfigSeeded();
  const roles = await (await getDatabase()).collection<RoleDocument>("roles").find(
    includeInactive ? {} : { active: true },
  ).toArray();
  const builtinOrder = new Map(DEFAULT_ROLES.map((role, index) => [role.slug, index]));
  roles.sort((left, right) => {
    if (left.builtIn !== right.builtIn) return left.builtIn ? -1 : 1;
    return left.builtIn
      ? (builtinOrder.get(left.slug) ?? 99) - (builtinOrder.get(right.slug) ?? 99)
      : left.nameKey.localeCompare(right.nameKey);
  });
  return roles.map(serializeRole);
}

export async function findRoleBySlug(slug: string, includeInactive = true): Promise<RoleConfig | null> {
  await ensureConfigSeeded();
  const role = await (await getDatabase()).collection<RoleDocument>("roles").findOne({
    slug,
    ...(includeInactive ? {} : { active: true }),
  });
  return role ? serializeRole(role) : null;
}

export async function addRequesterRole(name: string): Promise<RoleConfig> {
  await ensureConfigSeeded();
  const database = await getDatabase();
  const roles = database.collection<RoleDocument>("roles");
  const cleanName = name.trim();
  const nameKey = normalizedName(cleanName);
  const existing = await roles.findOne({ nameKey });
  if (existing) throw new Error("A role with this name already exists.");

  const baseSlug = cleanName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "role";
  let slug = baseSlug;
  let suffix = 2;
  while (await roles.findOne({ slug })) slug = `${baseSlug}-${suffix++}`;

  try {
    const role: RoleDocument = {
      name: cleanName,
      nameKey,
      slug,
      category: "requester",
      active: true,
      builtIn: false,
      createdAt: new Date(),
    };
    const result = await roles.insertOne(role);
    return serializeRole({ ...role, _id: result.insertedId });
  } catch (error) {
    if (isDuplicateKey(error)) throw new Error("A role with this name already exists.");
    throw error;
  }
}

export async function setRoleActive(id: string, active: boolean): Promise<RoleConfig | null> {
  await ensureConfigSeeded();
  if (!ObjectId.isValid(id)) return null;
  const roles = (await getDatabase()).collection<RoleDocument>("roles");
  const objectId = new ObjectId(id);
  const role = await roles.findOne({ _id: objectId });
  if (!role || role.builtIn || role.category !== "requester") return null;
  await roles.updateOne({ _id: objectId, builtIn: false }, { $set: { active } });
  const updated = await roles.findOne({ _id: objectId });
  return updated ? serializeRole(updated) : null;
}

export async function listLocations(includeInactive = false): Promise<LocationConfig[]> {
  await ensureConfigSeeded();
  const locations = await (await getDatabase()).collection<LocationDocument>("locations").find(
    includeInactive ? {} : { active: true },
  ).sort({ builtIn: -1, nameKey: 1 }).toArray();
  return locations.map(serializeLocation);
}

export async function addLocation(name: string): Promise<LocationConfig> {
  await ensureConfigSeeded();
  const locations = (await getDatabase()).collection<LocationDocument>("locations");
  const cleanName = name.trim();
  const nameKey = normalizedName(cleanName);
  if (await locations.findOne({ nameKey })) throw new Error("A location with this name already exists.");

  const location: LocationDocument = { name: cleanName, nameKey, active: true, builtIn: false, createdAt: new Date() };
  try {
    const result = await locations.insertOne(location);
    return serializeLocation({ ...location, _id: result.insertedId });
  } catch (error) {
    if (isDuplicateKey(error)) throw new Error("A location with this name already exists.");
    throw error;
  }
}

export async function setLocationActive(id: string, active: boolean): Promise<LocationConfig | null> {
  await ensureConfigSeeded();
  if (!ObjectId.isValid(id)) return null;
  const locations = (await getDatabase()).collection<LocationDocument>("locations");
  const objectId = new ObjectId(id);
  if (!(await locations.findOne({ _id: objectId }))) return null;
  await locations.updateOne({ _id: objectId }, { $set: { active } });
  const updated = await locations.findOne({ _id: objectId });
  return updated ? serializeLocation(updated) : null;
}

export async function getMobilitySettings(): Promise<MobilitySettings> {
  await ensureConfigSeeded();
  const settings = await (await getDatabase()).collection<SettingsDocument>("settings").findOne({ key: "mobility" });
  return {
    vehicleName: settings?.vehicleName ?? DEFAULT_VEHICLE_NAME,
    passengerCapacity: settings?.passengerCapacity ?? DEFAULT_PASSENGER_CAPACITY,
  };
}

export async function saveMobilitySettings(vehicleName: string, passengerCapacity: number): Promise<MobilitySettings> {
  await ensureConfigSeeded();
  await (await getDatabase()).collection<SettingsDocument>("settings").updateOne(
    { key: "mobility" },
    { $set: { vehicleName: vehicleName.trim(), passengerCapacity, updatedAt: new Date() } },
    { upsert: true },
  );
  return getMobilitySettings();
}
