export type Category = "Science" | "Technology" | "Engineering" | "Mathematics" | "Integrated STEM"

export type Activity = {
  id: string

  title: string

  category: Category

  ages: string

  duration: string

  difficulty: "Beginner" | "Intermediate" | "Advanced"

  description: string

  image: string

  accent: string

  materials: string[]

  steps: string[]

  learningObjectives?: string[]

  participants?: string

  safety?: string

  outcomes?: string[]

  createdBy?: string

  createdAt?: string

  updatedAt?: string

  isPublic?: boolean
}

export type UserProfile = {
  id: string

  name: string

  email: string

  institution?: string

  location?: string

  avatar?: string

  role: "facilitator" | "administrator"

  createdAt: string
}

export type PendingChange = {
  id: string

  ownerId: string

  kind: "upsert" | "delete" | "favorite" | "download" | "profile"
  activityId: string
  activity?: Activity
  profile?: UserProfile

  active?: boolean

  baseUpdatedAt?: string

  createdAt: string
}

export type SyncStatus = "local" | "offline" | "syncing" | "synced" | "failed"
