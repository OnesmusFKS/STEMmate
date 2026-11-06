import Dexie, { type Table } from "dexie"

import type { Activity, PendingChange, UserProfile } from "../types"

type StoredValue = {
  key: string

  value: unknown
}

class StemmateDatabase extends Dexie {
  activities!: Table<Activity, string>

  pendingChanges!: Table<PendingChange, string>

  values!: Table<StoredValue, string>

  constructor() {
    super("stemmate")

    this.version(1).stores({
      activities: "id, category, createdBy, updatedAt",
      pendingChanges: "id, activityId, createdAt",
      values: "key",
    })
    this.version(2).stores({
      activities: "id, category, createdBy, updatedAt",
      pendingChanges: "id, ownerId, activityId, createdAt",
      values: "key",
    })
  }
}

export const database = new StemmateDatabase()

export async function initializeDatabase(seedActivities: Activity[]) {
  await database.transaction(
    "rw",

    database.activities,

    database.values,

    async () => {
      if ((await database.activities.count()) === 0) {
        await database.activities.bulkPut(seedActivities)
      }

      const defaults: Record<string, unknown> = {
        favorites: [],

        downloads: [],

        completed: [],

        profile: null,
      }

      for (const [key, value] of Object.entries(defaults)) {
        if (!(await database.values.get(key))) {
          await database.values.add({ key, value })
        }
      }
    },
  )
}

export async function getSavedValue<T>(key: string, fallback: T): Promise<T> {
  const record = await database.values.get(key)

  return record?.value as T | undefined ?? fallback
}

export async function setSavedValue(key: string, value: unknown) {
  await database.values.put({ key, value })
}

export async function saveActivityLocally(activity: Activity, ownerId: string) {
  await database.transaction(
    "rw",

    database.activities,

    database.pendingChanges,

    async () => {
      const previous = await database.activities.get(activity.id)

      const previousChange = await database.pendingChanges.get(
        `activity:${activity.id}`,
      )

      await database.activities.put(activity)

      await database.pendingChanges.put({
        id: `activity:${activity.id}`,

        ownerId,

        kind: "upsert",

        activityId: activity.id,

        activity,

        baseUpdatedAt: previousChange?.baseUpdatedAt ?? previous?.updatedAt,

        createdAt: new Date().toISOString(),
      })
    },
  )
}

export async function deleteActivityLocally(
  activityId: string,
  ownerId: string,
) {
  await database.transaction(
    "rw",

    database.activities,

    database.pendingChanges,

    async () => {
      const previous = await database.activities.get(activityId)

      const previousChange = await database.pendingChanges.get(
        `activity:${activityId}`,
      )

      await database.activities.delete(activityId)

      if (previousChange?.kind === "upsert" && !previousChange.baseUpdatedAt) {
        await database.pendingChanges.delete(`activity:${activityId}`)
        return
      }

      await database.pendingChanges.put({
        id: `activity:${activityId}`,

        ownerId,

        kind: "delete",

        activityId,

        activity: previous,

        baseUpdatedAt: previousChange?.baseUpdatedAt ?? previous?.updatedAt,

        createdAt: new Date().toISOString(),
      })
    },
  )
}

export async function getActivities() {
  return database.activities.toArray()
}

export async function getPendingChanges() {
  return database.pendingChanges.toArray()
}

export async function acknowledgePendingChange(change: PendingChange) {
  await database.transaction("rw", database.pendingChanges, async () => {
    const current = await database.pendingChanges.get(change.id)

    if (current && JSON.stringify(current) === JSON.stringify(change)) {
      await database.pendingChanges.delete(change.id)
    }
  })
}

export async function saveProfile(
  profile: UserProfile | null,
  ownerId = "local-user",
) {
  await database.transaction(
    "rw",
    database.values,
    database.pendingChanges,
    async () => {
      await database.values.put({ key: "profile", value: profile })
      if (profile) {
        await database.pendingChanges.put({
          id: `profile:${ownerId}`,
          ownerId,
          kind: "profile",
          activityId: ownerId,
          profile,
          createdAt: new Date().toISOString(),
        })
      }
    },
  )
}

export async function setCollectionItem(
  collection: "favorites" | "downloads",

  activityId: string,

  active: boolean,

  ownerId: string,
) {
  const collectionKey = `${collection}:${ownerId}`

  const pendingId = `${collection}:${ownerId}:${activityId}`

  await database.transaction(
    "rw",

    database.values,

    database.pendingChanges,

    async () => {
      const current = (await database.values.get(collectionKey))
        ?.value as string[] | undefined

      const ids = current ?? []

      const next = active
        ? Array.from(new Set([...ids, activityId]))
        : ids.filter((id) => id !== activityId)

      await database.values.put({ key: collectionKey, value: next })

      await database.pendingChanges.put({
        id: pendingId,

        ownerId,

        kind: collection === "favorites" ? "favorite" : "download",

        activityId,

        active,

        createdAt: new Date().toISOString(),
      })
    },
  )
}
