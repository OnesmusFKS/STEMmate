import {
  acknowledgePendingChange,
  database,
  getPendingChanges,
} from "./db"

import { supabase } from "./supabase"

import type { Activity, PendingChange } from "../types"

export class RemoteActivityConflictError extends Error {
  constructor(
    readonly localActivity: Activity,

    readonly serverActivity: Activity,

    readonly serverUpdatedAt: string,
  ) {
    super("This activity was also changed on the server.")

    this.name = "RemoteActivityConflictError"
  }
}

function activityRow(activity: Activity, userId: string) {
  const durationMinutes = Number.parseInt(activity.duration, 10)

  return {
    id: activity.id,

    title: activity.title,

    description: activity.description,

    category: activity.category.toLowerCase().replace(/\s+/g, "-"),

    age_group: activity.ages,

    duration_minutes: Number.isFinite(durationMinutes) ? durationMinutes : null,

    difficulty: activity.difficulty,

    participants: activity.participants ?? "",

    learning_objectives: activity.learningObjectives ?? [],

    materials: activity.materials,

    instructions: activity.steps,

    safety_considerations: activity.safety ?? "",

    expected_outcomes: activity.outcomes ?? [],

    image_url: activity.image,

    created_by: userId,

    is_public: false,

    updated_at: activity.updatedAt ?? new Date().toISOString(),
  }
}

function remoteActivity(row: Record<string, unknown>): Activity | null {
  if (typeof row.id !== "string" || typeof row.title !== "string") return null

  const category = String(row.category ?? "")

  const categories: Record<string, Activity["category"]> = {
    science: "Science",

    technology: "Technology",

    engineering: "Engineering",

    mathematics: "Mathematics",

    "integrated-stem": "Integrated STEM",
  }

  const difficulty = String(row.difficulty ?? "Beginner")

  const allowedDifficulty: Activity["difficulty"][] = [
    "Beginner",

    "Intermediate",

    "Advanced",
  ]

  const list = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : []

  if (!categories[category]) return null

  return {
    id: row.id,

    title: row.title,

    category: categories[category],

    ages: String(row.age_group ?? ""),

    duration: row.duration_minutes ? `${row.duration_minutes} min` : "",

    difficulty: allowedDifficulty.includes(
      difficulty as Activity["difficulty"],
    )
      ? difficulty as Activity["difficulty"]
      : "Beginner",

    description: String(row.description ?? ""),

    image: String(row.image_url ?? ""),

    accent:
      category === "engineering"
        ? "bg-orange-100 text-orange-700"
        : category === "technology"
          ? "bg-violet-100 text-violet-700"
          : category === "mathematics"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-cyan-100 text-cyan-700",

    materials: list(row.materials),

    steps: list(row.instructions),

    learningObjectives: list(row.learning_objectives),

    participants: String(row.participants ?? ""),

    safety: String(row.safety_considerations ?? ""),

    outcomes: list(row.expected_outcomes),

    createdBy: typeof row.created_by === "string" ? row.created_by : undefined,

    createdAt: String(row.created_at ?? ""),

    updatedAt: String(row.updated_at ?? ""),

    isPublic: row.is_public === true,
  }
}

export async function hydrateRemoteData(userId: string) {
  if (!supabase) throw new Error("Supabase is not configured.")

  const [activityResult, favoriteResult, downloadResult] = await Promise.all([
    supabase.from("activities").select("*"),

    supabase.from("favorites").select("activity_id").eq("user_id", userId),

    supabase

      .from("downloaded_activities")

      .select("activity_id")

      .eq("user_id", userId),

  ])

  if (activityResult.error) throw activityResult.error

  if (favoriteResult.error) throw favoriteResult.error

  if (downloadResult.error) throw downloadResult.error

  const updates = (activityResult.data ?? [])

    .map((row) => remoteActivity(row as Record<string, unknown>))

    .filter((activity): activity is Activity => Boolean(activity))

  await database.transaction(
    "rw",
    database.activities,
    database.pendingChanges,
    async () => {
      const currentPending = await database.pendingChanges.toArray()
      const blockedActivityIds = new Set(
        currentPending
          .filter(
            (change) => change.kind === "upsert" || change.kind === "delete",
          )
          .map((change) => change.activityId),
      )
      const unblockedUpdates = updates.filter(
        (activity) => !blockedActivityIds.has(activity.id),
      )

      if (unblockedUpdates.length) {
        await database.activities.bulkPut(unblockedUpdates)
      }
    },
  )

  const remoteFavorites = new Set(
    (favoriteResult.data ?? []).map((item) => item.activity_id),
  )

  const remoteDownloads = new Set(
    (downloadResult.data ?? []).map((item) => item.activity_id),
  )

  const mergeCollection = (
    remote: Set<string>,

    current: string[],

    pendingCollection: Map<string, boolean>,
  ) => {
    const allIds = new Set([...remote, ...current, ...pendingCollection.keys()])

    return Array.from(allIds).filter((id) =>
      pendingCollection.has(id)
        ? pendingCollection.get(id) === true
        : remote.has(id),
    )
  }

  await database.transaction(
    "rw",
    database.values,
    database.pendingChanges,
    async () => {
      const [currentPending, favoritesValue, downloadsValue] =
        await Promise.all([
          database.pendingChanges.toArray(),
          database.values.get(`favorites:${userId}`),
          database.values.get(`downloads:${userId}`),
        ])
      const accountPending = currentPending.filter(
        (change) => (change.ownerId ?? "local-user") === userId,
      )
      const pendingFavorites = new Map(
        accountPending
          .filter((change) => change.kind === "favorite")
          .map((change) => [change.activityId, change.active === true]),
      )
      const pendingDownloads = new Map(
        accountPending
          .filter((change) => change.kind === "download")
          .map((change) => [change.activityId, change.active === true]),
      )
      const currentFavorites =
        (favoritesValue?.value as string[] | undefined) ?? []
      const currentDownloads =
        (downloadsValue?.value as string[] | undefined) ?? []

      await Promise.all([
        database.values.put({
          key: `favorites:${userId}`,
          value: mergeCollection(
            remoteFavorites,
            currentFavorites,
            pendingFavorites,
          ),
        }),
        database.values.put({
          key: `downloads:${userId}`,
          value: mergeCollection(
            remoteDownloads,
            currentDownloads,
            pendingDownloads,
          ),
        }),
      ])
    },
  )
}

async function syncActivityChange(change: PendingChange, userId: string) {
  if (!supabase) throw new Error("Supabase is not configured.")

  if (change.kind === "profile" && change.profile) {
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: change.profile.name,
      email: change.profile.email,
      avatar_url: change.profile.avatar ?? null,
      institution: change.profile.institution ?? "",
      location: change.profile.location ?? "",
    })
    if (error) throw error
    return
  }

  if (change.kind === "upsert" || change.kind === "delete") {
    const { data: existing, error: readError } = await supabase

      .from("activities")

      .select("created_by, updated_at")

      .eq("id", change.activityId)

      .maybeSingle()

    if (readError) throw readError

    if (existing && existing.created_by !== userId) {
      throw new Error(
        `Conflict: activity ${change.activityId} belongs to another account. The local change was kept.`,
      )
    }

    if (
      existing &&
      change.baseUpdatedAt &&
      new Date(existing.updated_at).getTime() >
        new Date(change.baseUpdatedAt).getTime()
    ) {
      const { data: row, error } = await supabase

        .from("activities")

        .select("*")

        .eq("id", change.activityId)

        .single()

      if (error) throw error

      const serverActivity = remoteActivity(
        row as Record<string, unknown>,
      )

      if (!serverActivity || !change.activity) {
        throw new Error("The conflicting activity could not be reviewed.")
      }

      throw new RemoteActivityConflictError(
        change.activity,

        serverActivity,

        existing.updated_at,
      )
    }

    if (change.kind === "delete") {
      if (existing) {
        const { error } = await supabase

          .from("activities")

          .delete()

          .eq("id", change.activityId)

          .eq("created_by", userId)

        if (error) throw error
      }

      return
    }
  }

  if (change.kind === "upsert" && change.activity) {
    const { error } = await supabase

      .from("activities")

      .upsert(activityRow(change.activity, userId), { onConflict: "id" })

    if (error) throw error

    return
  }

  const table =
    change.kind === "favorite" ? "favorites" : "downloaded_activities"

  if (change.active) {
    const { error } = await supabase

      .from(table)

      .upsert(
        { user_id: userId, activity_id: change.activityId },

        { onConflict: "user_id,activity_id" },
      )

    if (error) throw error
  } else {
    const { error } = await supabase

      .from(table)

      .delete()

      .eq("user_id", userId)

      .eq("activity_id", change.activityId)

    if (error) throw error
  }
}

export async function keepLocalActivityVersion(
  activityId: string,

  serverUpdatedAt: string,
) {
  await database.pendingChanges.update(`activity:${activityId}`, {
    baseUpdatedAt: serverUpdatedAt,
  })
}

export async function useServerActivityVersion(activity: Activity) {
  await database.transaction(
    "rw",

    database.activities,

    database.pendingChanges,

    async () => {
      await database.activities.put(activity)

      await database.pendingChanges.delete(`activity:${activity.id}`)
    },
  )
}

export async function synchronizeLocalChanges(userId: string) {
  if (!supabase) throw new Error("Remote sync is not configured.")

  const pending = (await getPendingChanges()).filter(
    (change) => (change.ownerId ?? "local-user") === userId,
  )

  for (const change of pending) {
    await syncActivityChange(change, userId)

    await acknowledgePendingChange(change)
  }

  const { error } = await supabase.from("sync_metadata").upsert(
    {
      user_id: userId,

      last_synced_at: new Date().toISOString(),

      pending_count: 0,
    },

    { onConflict: "user_id" },
  )

  if (error) throw error

  return { synchronized: pending.length }
}
