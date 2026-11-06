import {
  FormEvent,
  ReactNode,
  SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  deleteActivityLocally,
  getActivities,
  getPendingChanges,
  getSavedValue,
  initializeDatabase,
  saveActivityLocally,
  saveProfile,
  setCollectionItem,
  setSavedValue,
} from "./lib/db"

import { isSupabaseConfigured, supabase } from "./lib/supabase"

import {
  hydrateRemoteData,
  keepLocalActivityVersion,
  RemoteActivityConflictError,
  synchronizeLocalChanges,
  useServerActivityVersion,
} from "./lib/sync"

import type { Activity, Category, SyncStatus, UserProfile } from "./types"

import type { User } from "@supabase/supabase-js"

type Screen = "welcome" | "login" | "signup" | "forgot" | "reset" | "home" | "saved" | "downloaded" | "mine" | "profile" | "create" | "edit" | "detail"

const activities: Activity[] = [
  {
    id: "1",

    title: "Build a Bottle Rocket",

    category: "Engineering",

    ages: "8–12 years",

    duration: "45 min",

    difficulty: "Beginner",

    description:
      "Explore propulsion, pressure, and aerodynamics by designing and launching a water-powered rocket.",

    image:
      "https://images.unsplash.com/photo-1598389118600-9a83ceb4ebe6?auto=format&fit=crop&w=1200&q=85",

    accent: "bg-orange-100 text-orange-700",

    materials: [
      "Empty 2L plastic bottle",

      "Cardboard and tape",

      "Cork and bicycle pump",

      "Water and safety goggles",
    ],

    steps: [
      "Create fins from cardboard and tape them evenly around the bottle.",

      "Decorate your rocket and add a lightweight paper nose cone.",

      "Fill the bottle one-third with water, then securely fit the cork.",

      "Take the rocket outside, connect the pump, stand back, and launch.",
    ],
  },

  {
    id: "2",

    title: "Code a Tiny Maze",

    category: "Technology",

    ages: "10–14 years",

    duration: "60 min",

    difficulty: "Intermediate",

    description:
      "Turn directions into algorithms and guide a character through a handmade maze using block-based coding.",

    image:
      "https://images.unsplash.com/photo-1771765764892-91f2ed4ddbf4?auto=format&fit=crop&w=1200&q=85",

    accent: "bg-violet-100 text-violet-700",

    materials: [
      "Laptop or tablet",

      "Scratch account",

      "Grid paper",

      "Pencils and markers",
    ],

    steps: [
      "Sketch a simple maze on grid paper and mark a start and finish.",

      "Recreate the maze as a backdrop in Scratch.",

      "Use motion and sensing blocks to move a sprite through the maze.",

      "Test, debug, and swap mazes with another team.",
    ],
  },

  {
    id: "3",

    title: "Rainbow Density Lab",

    category: "Science",

    ages: "6–10 years",

    duration: "30 min",

    difficulty: "Beginner",

    description:
      "Layer colorful liquids to discover why different densities stack instead of mixing together.",

    image:
      "https://images.unsplash.com/photo-1758685734034-54e1da4ac7c2?auto=format&fit=crop&w=1200&q=85",

    accent: "bg-cyan-100 text-cyan-700",

    materials: [
      "Clear tall glass",

      "Honey, oil, and water",

      "Food coloring",

      "Spoon or dropper",
    ],

    steps: [
      "Color the water and pour honey into the bottom of the glass.",

      "Slowly add the colored water over the back of a spoon.",

      "Pour oil on top and observe the three distinct layers.",

      "Predict where small objects will settle, then test your ideas.",
    ],
  },

  {
    id: "4",

    title: "Marshmallow Towers",

    category: "Engineering",

    ages: "7–12 years",

    duration: "40 min",

    difficulty: "Beginner",

    description:
      "Work in teams to build the tallest free-standing structure while learning what makes a design stable.",

    image:
      "https://images.unsplash.com/photo-1770096679844-57ca92c2b64b?auto=format&fit=crop&w=1200&q=85",

    accent: "bg-orange-100 text-orange-700",

    materials: [
      "20 sticks of spaghetti",

      "1 metre of tape",

      "1 metre of string",

      "One large marshmallow",
    ],

    steps: [
      "Divide materials evenly and discuss possible tower shapes.",

      "Build a strong base before adding height.",

      "Place the marshmallow at the very top of the structure.",

      "Measure each tower and reflect on what made it stable.",
    ],
  },

  {
    id: "5",

    title: "Maths in Motion",

    category: "Mathematics",

    ages: "9–13 years",

    duration: "50 min",

    difficulty: "Intermediate",

    description:
      "Measure movement, chart results, and use averages to compare how objects travel down a ramp.",

    image:
      "https://images.unsplash.com/photo-1788882681164-dbb55962857d?auto=format&fit=crop&w=1200&q=85",

    accent: "bg-emerald-100 text-emerald-700",

    materials: [
      "Toy cars",

      "Cardboard ramp",

      "Tape measure",

      "Stopwatch and worksheet",
    ],

    steps: [
      "Build a ramp and mark a clear starting line.",

      "Predict which car will travel farthest and explain why.",

      "Run three trials per car and record time and distance.",

      "Calculate averages and make a bar chart of the results.",
    ],
  },

  {
    id: "6",

    title: "Make a Scribble Bot",

    category: "Technology",

    ages: "9–14 years",

    duration: "75 min",

    difficulty: "Advanced",

    description:
      "Build a simple vibrating robot that creates surprising geometric art as it travels across paper.",

    image:
      "https://images.unsplash.com/photo-1680634658502-78e57b1eec50?auto=format&fit=crop&w=1200&q=85",

    accent: "bg-violet-100 text-violet-700",

    materials: [
      "Small hobby motor",

      "Battery and tape",

      "Paper cup",

      "Three felt-tip markers",
    ],

    steps: [
      "Tape three markers evenly around the outside of the cup.",

      "Attach the motor to the top and add an off-centre weight.",

      "Connect the battery, place the bot on paper, and let it move.",

      "Adjust the legs and weight to create different patterns.",
    ],
  },
]

const photos = [
  "https://images.unsplash.com/photo-1788882681164-dbb55962857d?auto=format&fit=crop&w=1100&q=85",

  "https://images.unsplash.com/photo-1758685734034-54e1da4ac7c2?auto=format&fit=crop&w=900&q=85",
]

function handleImageFallback(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null
  event.currentTarget.src = "/activity-placeholder.svg"
}

function Icon({
  name,

  className = "size-5",
}: {
  name: string

  className?: string
}) {
  const paths: Record<string, ReactNode> = {
    spark: (
      <path d="M12 2l1.45 5.15L18 9l-4.55 1.85L12 16l-1.45-5.15L6 9l4.55-1.85L12 2Zm6 13 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" />
    ),

    arrow: <path d="m9 18 6-6-6-6" />,

    back: <path d="m15 18-6-6 6-6" />,

    bookmark: <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17l-6-4-6 4V4Z" />,

    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),

    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),

    filter: <path d="M4 6h16M7 12h10M10 18h4" />,

    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),

    check: <path d="m5 12 4 4L19 6" />,

    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),

    close: <path d="m6 6 12 12M18 6 6 18" />,

    menu: <path d="M4 7h16M4 12h16M4 17h16" />,

    download: (
      <>
        <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
        <path d="M4 17v3h16v-3" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill={name === "spark" || name === "bookmark" ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <button
      className="flex items-center gap-2.5"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <span className="grid size-9 place-items-center rounded-xl bg-teal-400 text-navy-950 shadow-sm">
        <Icon name="spark" className="size-5" />
      </span>
      <span
        className={`text-xl font-extrabold tracking-tight ${
          dark ? "text-white" : "text-navy-950"
        }`}
      >
        STEM<span className="text-teal-600">mate</span>
      </span>
    </button>
  )
}

function PrimaryButton({
  children,

  onClick,

  className = "",

  type = "button",

  disabled = false,
}: {
  children: ReactNode

  onClick?: () => void

  className?: string

  type?: "button" | "submit"

  disabled?: boolean
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-navy-950 px-6 font-bold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}

function Header({
  screen,

  setScreen,
}: {
  screen: Screen

  setScreen: (screen: Screen) => void
}) {
  const appScreen = !["welcome", "login", "signup", "forgot", "reset"].includes(
    screen,
  )

  return (
    <header className="relative z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <div onClick={() => setScreen(appScreen ? "home" : "welcome")}>
          <Logo />
        </div>
        {appScreen ? (
          <>
            <nav className="hidden items-center gap-8 md:flex">
              <button
                onClick={() => setScreen("home")}
                className={`text-sm font-bold ${
                  screen === "home" || screen === "detail"
                    ? "text-navy-950"
                    : "text-slate-500 hover:text-navy-950"
                }`}
              >
                Explore
              </button>
              <button
                onClick={() => setScreen("saved")}
                className={`text-sm font-bold ${
                  screen === "saved"
                    ? "text-navy-950"
                    : "text-slate-500 hover:text-navy-950"
                }`}
              >
                Saved
              </button>
              <button
                onClick={() => setScreen("mine")}
                className="text-sm font-bold text-slate-500 hover:text-navy-950"
              >
                My activities
              </button>
              <button
                onClick={() => setScreen("profile")}
                className="text-sm font-bold text-slate-500 hover:text-navy-950"
              >
                Profile
              </button>
            </nav>
            <button
              onClick={() => setScreen("create")}
              className="hidden rounded-full bg-navy-950 px-4 py-2.5 text-sm font-bold text-white sm:block"
            >
              Create activity
            </button>
            <button
              onClick={() => setScreen("profile")}
              aria-label="Open profile"
              className="grid size-11 place-items-center rounded-full bg-teal-50 text-teal-800"
            >
              <Icon name="user" />
            </button>
          </>
        ) : isSupabaseConfigured ? (
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setScreen("login")}
              className="hidden px-3 py-2 text-sm font-bold text-navy-950 sm:block"
            >
              Log in
            </button>
            <PrimaryButton
              onClick={() => setScreen("signup")}
              className="min-h-10 px-5 text-sm shadow-none"
            >
              Join for free
            </PrimaryButton>
          </div>
        ) : (
          <PrimaryButton
            onClick={() => setScreen("home")}
            className="min-h-10 px-5 text-sm shadow-none"
          >
            Explore activities
          </PrimaryButton>
        )}
      </div>
    </header>
  )
}

function Welcome({ setScreen }: { setScreen: (screen: Screen) => void }) {
  return (
    <main className="overflow-hidden">
      <section className="relative bg-cream">
        <div className="pointer-events-none absolute -left-24 top-20 size-72 rounded-full border-[42px] border-teal-100/70" />
        <div className="pointer-events-none absolute right-[44%] top-20 size-4 rounded-full bg-orange-400" />
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-[1.02fr_.98fr] lg:px-8 lg:py-20">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-4 py-2 text-sm font-bold text-teal-800 shadow-sm">
              <Icon name="spark" className="size-4 text-orange-500" />
              Big ideas start with curious minds
            </div>
            <h1 className="text-balance text-5xl font-extrabold leading-[1.02] tracking-[-0.045em] text-navy-950 sm:text-6xl lg:text-7xl">
              Make every STEM session{" "}
              <span className="relative text-teal-700">
                unforgettable.
                <svg
                  className="absolute -bottom-3 left-0 w-full text-orange-400"
                  viewBox="0 0 310 14"
                  fill="none"
                >
                  <path
                    d="M3 10C88 2 203 2 307 8"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>
            <p className="mt-9 max-w-xl text-lg leading-8 text-slate-600">
              Discover hands-on activities, save your favourites, and prepare
              brilliant STEM experiences—all in one place.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <PrimaryButton
                onClick={() =>
                  setScreen(isSupabaseConfigured ? "signup" : "home")
                }
                className="px-8"
              >
                Start exploring <Icon name="arrow" />
              </PrimaryButton>
              <button
                onClick={() => setScreen("home")}
                className="min-h-12 rounded-full px-7 font-bold text-navy-950 transition hover:bg-white"
              >
                Browse activities
              </button>
            </div>
            <div className="mt-12 flex items-center gap-6 text-sm font-semibold text-slate-500">
              <div className="flex -space-x-3">
                {[0, 1, 2].map((item) => (
                  <span
                    key={item}
                    className={`grid size-10 place-items-center rounded-full border-2 border-cream text-xs font-extrabold text-white ${
                      ["bg-teal-700", "bg-orange-500", "bg-violet-500"][item]
                    }`}
                  >
                    {["AJ", "LM", "RK"][item]}
                  </span>
                ))}
              </div>
              <span>
                Built for curious learners and busy facilitators
              </span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -right-6 -top-8 size-32 rounded-full bg-teal-300" />
            <div className="relative rotate-2 overflow-hidden rounded-[2.5rem] border-[10px] border-white bg-white shadow-2xl shadow-slate-950/15">
              <img
                className="aspect-[4/5] w-full object-cover"
                src={photos[0]}
                alt="Facilitator leading a hands-on STEM activity"
                onError={handleImageFallback}
              />
              <div className="absolute inset-x-5 bottom-5 rounded-3xl bg-white/95 p-5 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-widest text-teal-700">
                      This week’s pick
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-navy-950">
                      Creative science labs
                    </p>
                  </div>
                  <span className="grid size-12 place-items-center rounded-full bg-orange-400 text-navy-950">
                    <Icon name="arrow" />
                  </span>
                </div>
              </div>
            </div>
            <div className="absolute -left-8 top-14 rounded-2xl bg-navy-950 p-4 text-white shadow-xl sm:-left-16">
              <Icon name="spark" className="mb-2 size-6 text-teal-300" />
              <p className="text-lg font-extrabold">Hands-on STEM</p>
              <p className="text-xs text-slate-300">Activity ideas</p>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-navy-950 py-8 text-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 sm:grid-cols-3 lg:px-8">
          {[
            ["01", "Find", "Activities matched to your group"],

            ["02", "Plan", "Clear materials and step-by-step guides"],

            ["03", "Inspire", "Bring big ideas to life"],
          ].map(([number, title, copy]) => (
            <div
              key={number}
              className="flex items-center gap-4 border-white/10 px-3 py-2 sm:border-r last:border-0"
            >
              <span className="text-sm font-extrabold text-teal-300">
                {number}
              </span>
              <div>
                <p className="font-extrabold">{title}</p>
                <p className="text-sm text-slate-400">{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function Auth({
  mode,

  setScreen,

  onSubmit,
}: {
  mode: "login" | "signup" | "forgot" | "reset"

  setScreen: (screen: Screen) => void

  onSubmit: (
    mode: "login" | "signup" | "forgot" | "reset",

    email: string,

    password: string,

    name: string,
  ) => Promise<string | void>
}) {
  const signup = mode === "signup"

  const forgot = mode === "forgot"

  const resetting = mode === "reset"

  const [message, setMessage] = useState("")

  const [busy, setBusy] = useState(false)

  const [name, setName] = useState("")

  const [email, setEmail] = useState("")

  const [password, setPassword] = useState("")

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    setMessage("")

    setBusy(true)

    try {
      const response = await onSubmit(mode, email, password, name)

      if (response) setMessage(response)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The account request failed.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-5rem)] bg-white lg:grid-cols-2">
      <section className="hidden overflow-hidden bg-navy-950 p-8 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <p className="max-w-md text-4xl font-extrabold leading-tight tracking-tight text-white xl:text-5xl">
          Curiosity is the spark. You make it catch fire.
        </p>
        <div className="relative mt-10 overflow-hidden rounded-[2rem]">
          <img
            src={photos[1]}
            alt="Science activity in a learning lab"
            className="aspect-[5/4] w-full object-cover opacity-90"
            onError={handleImageFallback}
          />
          <div className="absolute inset-0 bg-navy-950/10" />
          <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white p-5">
            <p className="text-sm leading-6 text-slate-600">
              “STEMmate takes the stress out of planning, so I can focus on the
              magic that happens in the room.”
            </p>
            <p className="mt-3 text-sm font-extrabold text-navy-950">
              Samira, youth programme facilitator
            </p>
          </div>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <button
            onClick={() => setScreen("welcome")}
            className="mb-10 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-navy-950"
          >
            <Icon name="back" className="size-4" /> Back to home
          </button>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-teal-700">
            {signup
              ? "Join STEMmate"
              : forgot
                ? "Account recovery"
                : resetting
                  ? "Secure your account"
                  : "Welcome back"}
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-navy-950">
            {signup
              ? "Create your account"
              : forgot
                ? "Reset your password"
                : resetting
                  ? "Choose a new password"
                  : "Log in to keep exploring"}
          </h1>
          <p className="mt-3 text-slate-500">
            {signup
              ? "Start discovering activities your learners will love."
              : forgot
                ? "We’ll email you a secure password reset link."
                : resetting
                  ? "Use at least eight characters for your new password."
                  : "Your saved activities are waiting."}
          </p>
          <form onSubmit={submit} className="mt-9 space-y-5">
            {!isSupabaseConfigured && (
              <p className="rounded-2xl bg-orange-50 p-4 text-sm leading-6 text-orange-900">
                Secure accounts need Supabase setup. Browse and manage
                activities on this device in local mode meanwhile.
              </p>
            )}
            {signup && (
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-navy-950">
                  Full name
                </span>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  placeholder="Alex Morgan"
                />
              </label>
            )}
            {!resetting && (
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-navy-950">
                  Email address
                </span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  placeholder="you@example.com"
                />
              </label>
            )}
            {!forgot && (
              <label className="block">
                <span className="mb-2 flex justify-between text-sm font-bold text-navy-950">
                  {resetting ? "New password" : "Password"}
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setScreen("forgot")}
                      className="text-teal-700"
                    >
                      Forgot password?
                    </button>
                  )}
                </span>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  placeholder="At least 8 characters"
                />
              </label>
            )}
            <PrimaryButton
              type="submit"
              className="w-full"
              disabled={busy || !isSupabaseConfigured}
            >
              {busy
                ? "Please wait…"
                : forgot
                  ? "Send reset link"
                  : signup
                    ? "Create account"
                    : resetting
                      ? "Update password"
                      : "Log in"}{" "}
              <Icon name="arrow" />
            </PrimaryButton>
            {message && (
              <p
                role="status"
                className="rounded-2xl bg-orange-50 p-4 text-sm leading-6 text-orange-900"
              >
                {message}
              </p>
            )}
          </form>
          <p className="mt-7 text-center text-sm text-slate-500">
            {forgot || resetting
              ? resetting
                ? "Password updated?"
                : "Remembered your password?"
              : signup
                ? "Already have an account?"
                : "New to STEMmate?"}{" "}
            <button
              onClick={() =>
                setScreen(forgot || resetting || signup ? "login" : "signup")
              }
              className="font-extrabold text-teal-700 hover:text-teal-900"
            >
              {forgot || resetting || signup
                ? "Log in"
                : "Create an account"}
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}

function ActivityCard({
  activity,

  saved,

  downloaded,

  onSave,

  onDownload,

  onOpen,
}: {
  activity: Activity

  saved: boolean

  downloaded: boolean

  onSave: () => void

  onDownload: () => void

  onOpen: () => void
}) {
  return (
    <article
      onClick={onOpen}
      className="group cursor-pointer overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-950/10"
    >
      <div className="relative overflow-hidden">
        <img
          src={activity.image}
          alt=""
          className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-105"
          onError={handleImageFallback}
        />
        <button
          onClick={(event) => {
            event.stopPropagation()

            onSave()
          }}
          aria-label={saved ? "Remove from saved" : "Save activity"}
          className={`absolute right-4 top-4 grid size-11 place-items-center rounded-full shadow-lg transition ${
            saved
              ? "bg-teal-500 text-navy-950"
              : "bg-white text-navy-950 hover:bg-teal-50"
          }`}
        >
          <Icon name="bookmark" className="size-5" />
        </button>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-extrabold ${activity.accent}`}
          >
            {activity.category}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <Icon name="clock" className="size-4" /> {activity.duration}
          </span>
        </div>
        <h2 className="mt-4 text-xl font-extrabold tracking-tight text-navy-950">
          {activity.title}
        </h2>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
          {activity.description}
        </p>
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs font-bold text-slate-500">
            Ages {activity.ages}
          </span>
          <span className="flex items-center gap-1 text-sm font-extrabold text-teal-700">
            View activity <Icon name="arrow" className="size-4" />
          </span>
        </div>
        <button
          onClick={(event) => {
            event.stopPropagation()

            onDownload()
          }}
          className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-teal-800 hover:text-teal-950"
        >
          <Icon name="download" className="size-4" />
          {downloaded ? "Available offline" : "Save for offline"}
        </button>
      </div>
    </article>
  )
}

function matchesAgeGroup(activityAges: string, selectedGroup: string) {
  if (!selectedGroup) return true

  const selectedAges = selectedGroup.split("-").map(Number)
  const activityAgesParsed = activityAges.match(/\d+/g)?.map(Number) ?? []

  if (selectedAges.length !== 2 || activityAgesParsed.length === 0) {
    return true
  }

  const [selectedMinimum, selectedMaximum] = selectedAges
  const activityMinimum = activityAgesParsed[0]
  const activityMaximum =
    activityAgesParsed.length > 1 ? activityAgesParsed[1] : activityMinimum

  return (
    activityMinimum <= selectedMaximum && activityMaximum >= selectedMinimum
  )
}

function Browse({
  screen,

  activities,

  savedIds,

  downloadedIds,

  userId,

  setSavedIds,

  onDownload,

  onOpen,
}: {
  screen: Screen

  activities: Activity[]

  savedIds: string[]

  downloadedIds: string[]

  userId: string

  setSavedIds: (id: string) => void

  onDownload: (id: string) => void

  onOpen: (activity: Activity) => void
}) {
  const [category, setCategory] = useState<Category | "All">("All")

  const [ageGroup, setAgeGroup] = useState("")

  const [difficulty, setDifficulty] = useState("")

  const [query, setQuery] = useState("")

  const [filtersOpen, setFiltersOpen] = useState(false)

  const isSaved = screen === "saved"

  const isDownloaded = screen === "downloaded"

  const isMine = screen === "mine"

  const filtered = useMemo(
    () =>
      activities.filter(
        (activity) =>
          (!isSaved || savedIds.includes(activity.id)) &&
          (!isDownloaded || downloadedIds.includes(activity.id)) &&
          (!isMine || activity.createdBy === userId) &&
          (category === "All" || activity.category === category) &&
          matchesAgeGroup(activity.ages, ageGroup) &&
          (!difficulty || activity.difficulty === difficulty) &&
          `${activity.title} ${activity.description} ${activity.category}`

            .toLowerCase()

            .includes(query.toLowerCase()),
      ),

    [
      activities,
      category,
      ageGroup,
      difficulty,
      query,
      isSaved,
      isDownloaded,
      isMine,
      savedIds,
      downloadedIds,
      userId,
    ],
  )

  const toggleSave = (id: string) => setSavedIds(id)

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="mb-3 text-sm font-extrabold uppercase tracking-[0.18em] text-teal-700">
                {isSaved
                  ? "Your collection"
                  : isDownloaded
                    ? "Ready without internet"
                    : isMine
                      ? "Your creations"
                      : "Explore & discover"}
              </p>
              <h1 className="text-4xl font-extrabold tracking-tight text-navy-950 sm:text-5xl">
                {isSaved
                  ? "Saved activities"
                  : isDownloaded
                    ? "Offline activities"
                    : isMine
                      ? "My activities"
                      : "What will you spark today?"}
              </h1>
              <p className="mt-3 max-w-xl text-slate-500">
                {isSaved
                  ? "All your favourites, ready when you are."
                  : isDownloaded
                    ? "These activities are stored on this device for offline access."
                    : isMine
                      ? "Activities you create are stored on this device."
                      : "Curated, facilitator-friendly activities for every kind of curious mind."}
              </p>
            </div>
            <div className="flex w-full gap-3 lg:max-w-lg">
              <label className="relative flex-1">
                <span className="sr-only">Search activities</span>
                <Icon
                  name="search"
                  className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-13 w-full rounded-full border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                  placeholder="Search activities"
                />
              </label>
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`flex h-13 items-center gap-2 rounded-full border px-5 text-sm font-extrabold transition ${
                  filtersOpen || category !== "All"
                    ? "border-navy-950 bg-navy-950 text-white"
                    : "border-slate-200 bg-white text-navy-950 hover:border-slate-400"
                }`}
              >
                <Icon name="filter" />{" "}
                <span className="hidden sm:inline">Filter</span>
              </button>
            </div>
          </div>
          {filtersOpen && (
            <div className="mt-8 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-3">
              <span className="mr-2 px-2 text-sm font-bold text-slate-500">
                Subject
              </span>
              {([
                "All",

                "Science",

                "Technology",

                "Engineering",

                "Mathematics",

                "Integrated STEM",
              ] as (Category | "All")[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    category === item
                      ? "bg-teal-500 text-navy-950"
                      : "bg-white text-slate-600 hover:text-navy-950"
                  }`}
                >
                  {item}
                </button>
              ))}
              <label className="ml-1 text-sm font-bold text-slate-600">
                Age
                <select
                  value={ageGroup}
                  onChange={(event) => setAgeGroup(event.target.value)}
                  className="ml-2 min-h-10 rounded-full border border-slate-200 bg-white px-3"
                >
                  <option value="">Any age</option>
                  <option value="6-10">6–10 years</option>
                  <option value="8-12">8–12 years</option>
                  <option value="10-14">10–14 years</option>
                </select>
              </label>
              <label className="ml-1 text-sm font-bold text-slate-600">
                Level
                <select
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                  className="ml-2 min-h-10 rounded-full border border-slate-200 bg-white px-3"
                >
                  <option value="">Any level</option>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </label>
            </div>
          )}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="mb-7 flex items-center justify-between">
          <p className="font-bold text-navy-950">
            {filtered.length}{" "}
            {filtered.length === 1 ? "activity" : "activities"}
          </p>
          <p className="hidden text-sm text-slate-500 sm:block">
            Designed for real groups, tested by facilitators
          </p>
        </div>
        {filtered.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                saved={savedIds.includes(activity.id)}
                downloaded={downloadedIds.includes(activity.id)}
                onSave={() => toggleSave(activity.id)}
                onDownload={() => onDownload(activity.id)}
                onOpen={() => onOpen(activity)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-teal-50 text-teal-700">
              <Icon name={isSaved ? "bookmark" : "search"} />
            </span>
            <h2 className="mt-5 text-xl font-extrabold text-navy-950">
              {isSaved
                ? "No saved activities yet"
                : isDownloaded
                  ? "No offline activities yet"
                  : isMine
                    ? "You haven’t created any activities"
                    : "No activities found"}
            </h2>
            <p className="mt-2 text-slate-500">
              {isSaved
                ? "Tap the bookmark on an activity to keep it here."
                : isDownloaded
                  ? "Use “Save for offline” on an activity to keep it on this device."
                  : isMine
                    ? "Create your first activity for your learners."
                    : "Try another search or change your filters."}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}

function Detail({
  activity,

  saved,

  completed,

  canEdit,

  onBack,

  onSave,

  onBook,

  onEdit,

  onDelete,
}: {
  activity: Activity

  saved: boolean

  completed: boolean

  canEdit: boolean

  onBack: () => void

  onSave: () => void

  onBook: () => void

  onEdit: () => void

  onDelete: () => void
}) {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-5 pb-20 pt-8 lg:px-8">
        <button
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-sm font-extrabold text-slate-500 transition hover:text-navy-950"
        >
          <Icon name="back" className="size-4" /> Back to activities
        </button>
        <div className="grid gap-10 lg:grid-cols-[1.08fr_.92fr] lg:items-center">
          <div className="overflow-hidden rounded-[2rem] bg-slate-100">
            <img
              src={activity.image}
              alt={`Participants trying ${activity.title}`}
              className="aspect-[4/3] w-full object-cover"
              onError={handleImageFallback}
            />
          </div>
          <div>
            <span
              className={`inline-flex rounded-full px-4 py-2 text-xs font-extrabold ${activity.accent}`}
            >
              {activity.category}
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-[-0.035em] text-navy-950 sm:text-5xl">
              {activity.title}
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              {activity.description}
            </p>
            <div className="mt-7 grid grid-cols-3 gap-3">
              {[
                ["Time", activity.duration],

                ["Age group", activity.ages],

                ["Level", activity.difficulty],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-400">{label}</p>
                  <p className="mt-1 text-sm font-extrabold text-navy-950">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryButton
                onClick={onBook}
                className={completed ? "bg-teal-700" : ""}
              >
                <Icon name={completed ? "check" : "calendar"} />
                {completed ? "Completed" : "Mark as completed"}
              </PrimaryButton>
              <button
                onClick={onSave}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-6 font-extrabold transition ${
                  saved
                    ? "border-teal-500 bg-teal-50 text-teal-800"
                    : "border-slate-200 text-navy-950 hover:border-slate-400"
                }`}
              >
                <Icon name="bookmark" /> {saved ? "Saved" : "Save for later"}
              </button>
              {canEdit && (
                <>
                  <button
                    onClick={onEdit}
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 px-5 font-bold text-navy-950 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={onDelete}
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-red-200 px-5 font-bold text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-10 border-t border-slate-200 pt-12 lg:grid-cols-[.72fr_1.28fr]">
          <section>
            <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-teal-700">
              Get prepared
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-950">
              What you’ll need
            </h2>
            <ul className="mt-6 space-y-3">
              {activity.materials.map((material) => (
                <li
                  key={material}
                  className="flex items-center gap-3 text-slate-600"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-700">
                    <Icon name="check" className="size-3.5" />
                  </span>
                  {material}
                </li>
              ))}
            </ul>
            {activity.learningObjectives?.length ? (
              <div className="mt-8">
                <h3 className="font-extrabold text-navy-950">
                  Learning objectives
                </h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
                  {activity.learningObjectives.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {activity.safety && (
              <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-5">
                <p className="font-extrabold text-orange-900">
                  Safety considerations
                </p>
                <p className="mt-2 text-sm leading-6 text-orange-800">
                  {activity.safety}
                </p>
              </div>
            )}
            <div className="mt-8 rounded-2xl bg-orange-50 p-5">
              <p className="font-extrabold text-orange-900">Facilitator tip</p>
              <p className="mt-2 text-sm leading-6 text-orange-800">
                Ask learners to make a prediction before starting. Revisit it
                afterwards and celebrate ideas that changed along the way.
              </p>
            </div>
          </section>
          <section>
            <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-teal-700">
              Step by step
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-950">
              Let’s make it happen
            </h2>
            <ol className="mt-7 space-y-4">
              {activity.steps.map((step, index) => (
                <li
                  key={step}
                  className="flex gap-5 rounded-2xl border border-slate-200 p-5 transition hover:border-teal-300 hover:bg-teal-50/40"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-navy-950 font-extrabold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-extrabold text-navy-950">
                      Step {index + 1}
                    </p>
                    <p className="mt-1 leading-7 text-slate-600">{step}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </main>
  )
}

function ActivityEditor({
  initial,

  onCancel,

  onSave,
}: {
  initial?: Activity

  onCancel: () => void

  onSave: (activity: Omit<Activity, "id">) => void
}) {
  const [error, setError] = useState("")

  const [title, setTitle] = useState(initial?.title ?? "")

  const [description, setDescription] = useState(initial?.description ?? "")

  const [category, setCategory] = useState<Category>(
    initial?.category ?? "Science",
  )

  const [ages, setAges] = useState(initial?.ages ?? "")

  const [duration, setDuration] = useState(
    initial?.duration.replace(/\D/g, "") ?? "",
  )

  const [difficulty, setDifficulty] = useState<Activity["difficulty"]>(
    initial?.difficulty ?? "Beginner",
  )

  const [materials, setMaterials] = useState(
    initial?.materials.join("\n") ?? "",
  )

  const [steps, setSteps] = useState(initial?.steps.join("\n") ?? "")

  const [objectives, setObjectives] = useState(
    initial?.learningObjectives?.join("\n") ?? "",
  )

  const [safety, setSafety] = useState(initial?.safety ?? "")

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!title.trim() || !description.trim() || !duration || !ages.trim()) {
      setError("Complete the title, description, duration, and age group.")

      return
    }

    onSave({
      title: title.trim(),

      description: description.trim(),

      category,

      ages: ages.trim(),

      duration: `${duration} min`,

      difficulty,

      image:
        initial?.image ??
        "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=85",

      accent: initial?.accent ?? "bg-cyan-100 text-cyan-700",

      materials: materials

        .split("\n")

        .map((item) => item.trim())

        .filter(Boolean),

      steps: steps

        .split("\n")

        .map((item) => item.trim())

        .filter(Boolean),

      learningObjectives: objectives

        .split("\n")

        .map((item) => item.trim())

        .filter(Boolean),

      safety: safety.trim(),

      participants: initial?.participants ?? "",

      outcomes: initial?.outcomes ?? [],

      createdBy: initial?.createdBy ?? "local-user",

      createdAt: initial?.createdAt ?? new Date().toISOString(),

      updatedAt: new Date().toISOString(),

      isPublic: false,
    })
  }

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-slate-50 px-5 py-10">
      <form
        onSubmit={submit}
        className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9"
      >
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-bold text-slate-500 hover:text-navy-950"
        >
          ← Back
        </button>
        <div>
          <p className="mt-5 text-sm font-extrabold uppercase tracking-widest text-teal-700">
            Activity workspace · saved locally
          </p>
          <h1 className="mt-2 text-3xl font-extrabold text-navy-950">
            {initial ? "Edit activity" : "Create an activity"}
          </h1>
        </div>
        <label className="block text-sm font-bold">
          Activity title
          <input
            required
            maxLength={100}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
          />
        </label>
        <label className="block text-sm font-bold">
          Description
          <textarea
            required
            maxLength={1000}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold">
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as Category)}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3"
            >
              {[
                "Science",

                "Technology",

                "Engineering",

                "Mathematics",

                "Integrated STEM",
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold">
            Difficulty
            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(event.target.value as Activity["difficulty"])
              }
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3"
            >
              {["Beginner", "Intermediate", "Advanced"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold">
            Recommended age group
            <input
              required
              value={ages}
              onChange={(event) => setAges(event.target.value)}
              placeholder="8–12 years"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-normal"
            />
          </label>
          <label className="block text-sm font-bold">
            Duration (minutes)
            <input
              required
              type="number"
              min="1"
              max="1440"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-normal"
            />
          </label>
        </div>
        <label className="block text-sm font-bold">
          Materials (one per line)
          <textarea
            rows={3}
            value={materials}
            onChange={(event) => setMaterials(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-4 font-normal"
          />
        </label>
        <label className="block text-sm font-bold">
          Instructions (one step per line)
          <textarea
            rows={5}
            value={steps}
            onChange={(event) => setSteps(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-4 font-normal"
          />
        </label>
        <label className="block text-sm font-bold">
          Learning objectives (one per line)
          <textarea
            rows={3}
            value={objectives}
            onChange={(event) => setObjectives(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-4 font-normal"
          />
        </label>
        <label className="block text-sm font-bold">
          Safety considerations
          <textarea
            rows={2}
            value={safety}
            onChange={(event) => setSafety(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-4 font-normal"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <PrimaryButton type="submit">
          {initial ? "Save changes" : "Save activity to this device"}
        </PrimaryButton>
      </form>
    </main>
  )
}

function ProfilePage({
  profile,

  userId,

  authenticated,

  onSave,

  onLogout,
}: {
  profile: UserProfile | null

  userId: string

  authenticated: boolean

  onSave: (profile: UserProfile) => Promise<void>

  onLogout: () => void
}) {
  const [name, setName] = useState(profile?.name ?? "")

  const [email, setEmail] = useState(profile?.email ?? "")

  const [institution, setInstitution] = useState(profile?.institution ?? "")

  const [location, setLocation] = useState(profile?.location ?? "")

  const [message, setMessage] = useState("")

  const [saving, setSaving] = useState(false)

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-slate-50 px-5 py-10">
      <form
        className="mx-auto max-w-2xl space-y-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-9"
        onSubmit={async (event) => {
          event.preventDefault()
          setMessage("")
          setSaving(true)

          try {
            await onSave({
              id: userId,
              name: name.trim(),
              email: email.trim(),
              institution: institution.trim(),
              location: location.trim(),
              role: profile?.role ?? "facilitator",
              createdAt: profile?.createdAt ?? new Date().toISOString(),
            })
            setMessage(
              authenticated
                ? "Your profile was saved."
                : "Your profile was saved on this device.",
            )
          } catch {
            setMessage("Your profile could not be saved. Please try again.")
          } finally {
            setSaving(false)
          }
        }}
      >
        <p className="text-sm font-extrabold uppercase tracking-widest text-teal-700">
          Local workspace
        </p>
        <h1 className="text-3xl font-extrabold text-navy-950">Your profile</h1>
        <p className="text-sm leading-6 text-slate-600">
          {authenticated
            ? "Your profile is linked to your signed-in account."
            : "This profile is stored only in this browser. Secure sign-in and cross-device profiles require Supabase."}
        </p>
        <label className="block text-sm font-bold">
          Full name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-normal"
          />
        </label>
        <label className="block text-sm font-bold">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-normal"
          />
        </label>
        <label className="block text-sm font-bold">
          Institution or school
          <input
            value={institution}
            onChange={(event) => setInstitution(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-normal"
          />
        </label>
        <label className="block text-sm font-bold">
          Location
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-normal"
          />
        </label>
        {message && (
          <p role="status" className="text-sm font-semibold text-teal-800">
            {message}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </PrimaryButton>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full border border-slate-200 px-6 font-bold text-navy-950"
          >
            {authenticated ? "Sign out" : "Clear local profile"}
          </button>
        </div>
      </form>
    </main>
  )
}

function LocalStatus({
  online,

  pendingCount,

  status,

  canSync,

  onSync,
}: {
  online: boolean

  pendingCount: number

  status: SyncStatus

  canSync: boolean

  onSync: () => void
}) {
  return (
    <div
      role="status"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 z-30 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-xs font-bold text-slate-700 shadow-lg backdrop-blur md:bottom-4"
    >
      <span
        className={`mr-2 inline-block size-2 rounded-full ${
          status === "synced"
            ? "bg-teal-500"
            : status === "failed" || !online
              ? "bg-orange-500"
              : status === "syncing"
                ? "animate-pulse bg-blue-500"
                : "bg-slate-400"
        }`}
      />
      <span>
        {status === "syncing"
          ? "Synchronising your activities…"
          : status === "synced"
            ? "All changes synchronised successfully."
            : status === "failed"
              ? "Sync failed. Changes remain safely on this device."
              : !online
                ? "Offline · saved on this device"
                : !isSupabaseConfigured
                  ? "Local-only · remote sync not configured"
                  : "Saved on this device"}
        {pendingCount > 0 && ` · ${pendingCount} pending`}
      </span>
      {(status === "failed" || (pendingCount > 0 && online)) &&
        isSupabaseConfigured &&
        canSync && (
          <button
            type="button"
            onClick={onSync}
            className="shrink-0 rounded-full bg-navy-950 px-3 py-1.5 text-white hover:bg-teal-800"
          >
            Retry
          </button>
        )}
    </div>
  )
}

export default function App() {
  const localUserId = "local-user"

  const [screen, setScreen] = useState<Screen>("welcome")

  const [selected, setSelected] = useState<Activity>(activities[0])

  const [activityList, setActivityList] = useState<Activity[]>([])

  const [savedIds, setSavedIds] = useState<string[]>([])

  const [downloadedIds, setDownloadedIds] = useState<string[]>([])

  const [completedIds, setCompletedIds] = useState<string[]>([])

  const [profile, setProfile] = useState<UserProfile | null>(null)

  const [dataReady, setDataReady] = useState(false)

  const [errorMessage, setErrorMessage] = useState("")

  const [pendingCount, setPendingCount] = useState(0)

  const [online, setOnline] = useState(navigator.onLine)

  const [editingActivity, setEditingActivity] = useState<Activity | undefined>()

  const [authUser, setAuthUser] = useState<User | null>(null)

  const [syncConflict, setSyncConflict] =
    useState<RemoteActivityConflictError | null>(null)

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    navigator.onLine ? "local" : "offline",
  )

  const syncingRef = useRef(false)

  const syncRequestedRef = useRef(false)

  const activeUserId = authUser?.id ?? localUserId

  const refreshLocalData = async () => {
    const [storedActivities, pending] = await Promise.all([
      getActivities(),

      getPendingChanges(),
    ])

    setActivityList(storedActivities)

    setPendingCount(
      pending.filter(
        (change) => (change.ownerId ?? localUserId) === activeUserId,
      ).length,
    )
  }

  useEffect(() => {
    let active = true

    const initialize = async () => {
      try {
        await initializeDatabase(
          activities.map((activity) => ({
            ...activity,

            createdAt: new Date().toISOString(),

            updatedAt: new Date().toISOString(),

            isPublic: true,
          })),
        )

        const [
          storedActivities,
          favorites,
          downloads,
          completed,
          user,
          pending,
        ] = await Promise.all([
          getActivities(),

          getSavedValue<string[]>("favorites:local-user", []),

          getSavedValue<string[]>("downloads:local-user", []),

          getSavedValue<string[]>("completed", []),

          getSavedValue<UserProfile | null>("profile", null),

          getPendingChanges(),
        ])

        if (!active) return

        setActivityList(storedActivities)

        setSavedIds(favorites)

        setDownloadedIds(downloads)

        setCompletedIds(completed)

        setProfile(user)

        setPendingCount(
          pending.filter(
            (change) => (change.ownerId ?? localUserId) === localUserId,
          ).length,
        )

        setDataReady(true)
      } catch (error) {
        console.error("Unable to initialize local STEMmate storage.", error)

        if (active) {
          setErrorMessage(
            "Local storage could not be opened. Check your browser storage settings and reload.",
          )
        }
      }
    }

    void initialize()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!supabase) return

    let active = true

    void supabase.auth

      .getSession()

      .then(({ data, error }) => {
        if (error) throw error

        if (active) setAuthUser(data.session?.user ?? null)
      })

      .catch((error: unknown) => {
        console.error("Unable to restore the authentication session.", error)

        if (active)
          setErrorMessage("Your sign-in session could not be restored.")
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null
      setAuthUser(user)
      if (event === "PASSWORD_RECOVERY") {
        setScreen("reset")
      }
      if (user) {
        setProfile((current) => ({
          id: user.id,

          name:
            user.user_metadata.full_name ??
            user.email?.split("@")[0] ??
            current?.name ??
            "Facilitator",

          email: user.email ?? current?.email ?? "",

          institution: undefined,

          location: undefined,

          role: "facilitator",

          createdAt: user.created_at,
        }))

        if (event !== "PASSWORD_RECOVERY") setScreen("home")
      }
    })

    return () => {
      active = false

      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const client = supabase

    if (!client || !authUser) return

    let active = true

    const loadProfile = async () => {
      try {
        const { data, error } = await client

          .from("profiles")

          .select(
            "id, full_name, email, avatar_url, institution, location, role, created_at",
          )

          .eq("id", authUser.id)

          .maybeSingle()

        if (error) throw error

        if (!active || !data) return

        setProfile({
          id: data.id,

          name: data.full_name,

          email: data.email,

          avatar: data.avatar_url ?? undefined,

          institution: data.institution ?? undefined,

          location: data.location ?? undefined,

          role: data.role,

          createdAt: data.created_at,
        })
      } catch (error) {
        console.error("Unable to load the signed-in profile.", error)

        if (active) {
          setErrorMessage("Your account profile could not be loaded.")
        }
      }
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [authUser])

  useEffect(() => {
    const onOnline = () => setOnline(true)

    const onOffline = () => setOnline(false)

    window.addEventListener("online", onOnline)

    window.addEventListener("offline", onOffline)

    return () => {
      window.removeEventListener("online", onOnline)

      window.removeEventListener("offline", onOffline)
    }
  }, [])

  const syncNow = async () => {
    if (!online) {
      setSyncStatus("offline")

      return
    }

    if (!supabase || !authUser) {
      setSyncStatus("local")

      return
    }

    if (syncingRef.current) {
      syncRequestedRef.current = true
      return
    }

    syncingRef.current = true

    setSyncStatus("syncing")

    try {
      await hydrateRemoteData(authUser.id)

      await synchronizeLocalChanges(authUser.id)

      await hydrateRemoteData(authUser.id)

      const pending = await getPendingChanges()

      const [favorites, downloads] = await Promise.all([
        getSavedValue<string[]>(`favorites:${authUser.id}`, []),

        getSavedValue<string[]>(`downloads:${authUser.id}`, []),
      ])

      setPendingCount(
        pending.filter(
          (change) => (change.ownerId ?? localUserId) === authUser.id,
        ).length,
      )

      setSavedIds(favorites)

      setDownloadedIds(downloads)

      setSyncStatus("synced")

      await refreshLocalData()
    } catch (error) {
      console.error(
        "Activity synchronization failed; local changes were retained.",
        error,
      )

      const pending = await getPendingChanges()

      setPendingCount(
        pending.filter(
          (change) => (change.ownerId ?? localUserId) === authUser.id,
        ).length,
      )

      setSyncStatus("failed")

      if (error instanceof RemoteActivityConflictError) {
        setSyncConflict(error)

        setErrorMessage("")
      }

      setErrorMessage(
        error instanceof RemoteActivityConflictError
          ? ""
          : "Unable to synchronise your activities. Your changes are safely stored on this device. Review your connection and retry.",
      )
    } finally {
      syncingRef.current = false
      if (syncRequestedRef.current) {
        syncRequestedRef.current = false
        if (online && authUser) {
          queueMicrotask(() => void syncNow())
        }
      }
    }
  }

  useEffect(() => {
    if (!dataReady) return

    if (authUser && online) {
      void syncNow()
    } else {
      setSyncStatus(online ? "local" : "offline")
    }
  }, [authUser, online, dataReady])

  useEffect(() => {
    if (!dataReady) return

    let active = true

    void Promise.all([
      getSavedValue<string[]>(`favorites:${activeUserId}`, []),

      getSavedValue<string[]>(`downloads:${activeUserId}`, []),
    ])

      .then(([favorites, downloads]) => {
        if (!active) return

        setSavedIds(favorites)

        setDownloadedIds(downloads)
      })

      .catch((error: unknown) => {
        console.error("Unable to load account-specific collections.", error)

        setErrorMessage("Saved activity lists could not be loaded.")
      })

    return () => {
      active = false
    }
  }, [activeUserId, dataReady])

  const go = (next: Screen) => {
    setScreen(next)

    setErrorMessage("")

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const openActivity = (activity: Activity) => {
    setSelected(activity)

    go("detail")
  }

  const toggleFavorite = async (id: string) => {
    const next = savedIds.includes(id)
      ? savedIds.filter((savedId) => savedId !== id)
      : [...savedIds, id]

    try {
      await setCollectionItem(
        "favorites",

        id,

        !savedIds.includes(id),

        activeUserId,
      )

      setSavedIds(next)

      const pending = await getPendingChanges()

      setPendingCount(
        pending.filter(
          (change) => (change.ownerId ?? localUserId) === activeUserId,
        ).length,
      )

      if (authUser) void syncNow()
    } catch (error) {
      console.error("Unable to save favourite.", error)

      setErrorMessage("Could not save this favourite to the device.")
    }
  }

  const toggleDownload = async (id: string) => {
    const next = downloadedIds.includes(id)
      ? downloadedIds.filter((downloadId) => downloadId !== id)
      : [...downloadedIds, id]

    try {
      await setCollectionItem(
        "downloads",

        id,

        !downloadedIds.includes(id),

        activeUserId,
      )

      setDownloadedIds(next)

      const pending = await getPendingChanges()

      setPendingCount(
        pending.filter(
          (change) => (change.ownerId ?? localUserId) === activeUserId,
        ).length,
      )

      if (authUser) void syncNow()
    } catch (error) {
      console.error("Unable to update offline activities.", error)

      setErrorMessage("Could not update offline access for this activity.")
    }
  }

  const persistActivity = async (
    content: Omit<Activity, "id">,

    existing?: Activity,
  ) => {
    const timestamp = new Date().toISOString()

    const keepId = existing?.createdBy === activeUserId

    const activity: Activity = {
      ...content,

      id: keepId ? existing.id : crypto.randomUUID(),

      createdBy: activeUserId,

      createdAt: existing?.createdAt ?? timestamp,

      updatedAt: timestamp,

      isPublic: false,
    }

    try {
      await saveActivityLocally(activity, activeUserId)

      await refreshLocalData()

      setSelected(activity)

      setEditingActivity(undefined)

      if (authUser) void syncNow()

      go("detail")
    } catch (error) {
      console.error("Unable to store activity locally.", error)

      setErrorMessage(
        "The activity could not be saved. Your existing activities are unchanged.",
      )
    }
  }

  const deleteSelectedActivity = async () => {
    if (
      selected.createdBy !== activeUserId ||
      !window.confirm(`Delete “${selected.title}” from this device?`)
    ) {
      return
    }

    try {
      await deleteActivityLocally(selected.id, activeUserId)

      await refreshLocalData()

      if (savedIds.includes(selected.id)) {
        await setCollectionItem("favorites", selected.id, false, activeUserId)
      }

      if (downloadedIds.includes(selected.id)) {
        await setCollectionItem("downloads", selected.id, false, activeUserId)
      }
      await refreshLocalData()
      setSavedIds((current) => current.filter((id) => id !== selected.id))

      setDownloadedIds((current) => current.filter((id) => id !== selected.id))

      if (authUser) void syncNow()

      go("mine")
    } catch (error) {
      console.error("Unable to delete activity.", error)

      setErrorMessage("The activity could not be deleted.")
    }
  }

  const saveUserProfile = async (newProfile: UserProfile) => {
    try {
      await saveProfile(newProfile, activeUserId)
      setProfile(newProfile)
      await refreshLocalData()
      if (authUser) void syncNow()
    } catch (error) {
      console.error("Unable to save profile.", error)

      setErrorMessage("The profile could not be saved on this device.")
      throw error
    }
  }

  const clearProfile = async () => {
    try {
      if (authUser && supabase) {
        const { error } = await supabase.auth.signOut()

        if (error) throw error
      }

      await saveProfile(null)

      setProfile(null)

      setAuthUser(null)

      go("welcome")
    } catch (error) {
      console.error("Unable to clear local profile.", error)

      setErrorMessage("The local profile could not be cleared.")
    }
  }

  const completeSelectedActivity = async () => {
    const next = completedIds.includes(selected.id)
      ? completedIds
      : [...completedIds, selected.id]

    try {
      await setSavedValue("completed", next)

      setCompletedIds(next)
    } catch (error) {
      console.error("Unable to save activity progress.", error)

      setErrorMessage("Could not save activity completion.")
    }
  }

  const resolveConflict = async (choice: "local" | "server") => {
    if (!syncConflict) return

    try {
      if (choice === "local") {
        await keepLocalActivityVersion(
          syncConflict.localActivity.id,

          syncConflict.serverUpdatedAt,
        )
      } else {
        await useServerActivityVersion(syncConflict.serverActivity)

        setSelected(syncConflict.serverActivity)

        await refreshLocalData()
      }

      setSyncConflict(null)

      void syncNow()
    } catch (error) {
      console.error("Unable to resolve the activity conflict.", error)

      setErrorMessage(
        "The conflict could not be resolved. Both versions remain safe.",
      )
    }
  }

  const reviewConflictLocally = async () => {
    if (!syncConflict) return

    try {
      await keepLocalActivityVersion(
        syncConflict.localActivity.id,

        syncConflict.serverUpdatedAt,
      )

      setSelected(syncConflict.localActivity)

      setEditingActivity(syncConflict.localActivity)

      setSyncConflict(null)

      go("edit")
    } catch (error) {
      console.error("Unable to open the activity conflict for review.", error)

      setErrorMessage("The activity could not be opened for conflict review.")
    }
  }

  const submitAuth = async (
    mode: "login" | "signup" | "forgot" | "reset",

    email: string,

    password: string,

    name: string,
  ) => {
    if (!supabase) {
      throw new Error(
        "Secure accounts are unavailable until Supabase is configured. Continue in local mode.",
      )
    }

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })

      if (error) {
        console.error("Password reset request failed.", error)

        throw new Error(
          "We couldn't send a reset email. Check the address and try again.",
        )
      }

      return "If an account exists for that email, a password reset link is on its way."
    }

    if (mode === "reset") {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        console.error("Password update failed.", error)
        throw new Error("We couldn't update your password. Choose a stronger password and retry.")
      }
      go("home")
      return "Your password was updated."
    }

    const response =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,

            password,

            options: { data: { full_name: name.trim() } },
          })
        : await supabase.auth.signInWithPassword({ email, password })

    if (response.error) {
      console.error("Authentication request failed.", response.error)

      const message = response.error.message.toLowerCase()

      if (
        message.includes("already registered") ||
        message.includes("already exists")
      ) {
        throw new Error(
          "An account already uses this email. Try logging in instead.",
        )
      }

      if (message.includes("password") && message.includes("weak")) {
        throw new Error(
          "Choose a stronger password with at least 8 characters.",
        )
      }

      if (mode === "login") {
        throw new Error(
          "Email or password is incorrect. Check your details and retry.",
        )
      }

      throw new Error(
        "We couldn't create your account. Check your details and retry.",
      )
    }

    if (mode === "signup" && !response.data.session) {
      return "Account created. Check your email to confirm it, then log in."
    }

    if (!response.data.session) {
      throw new Error(
        "Your sign-in needs another step. Check your email and try again.",
      )
    }

    go("home")
  }

  const isAppScreen = !["welcome", "login", "signup", "forgot", "reset"].includes(screen)

  const visibleActivities = activityList.filter(
    (activity) => activity.isPublic || activity.createdBy === activeUserId,
  )

  const navItems: { screen: Screen; label: string; icon: string }[] = [
    { screen: "home", label: "Explore", icon: "search" },

    { screen: "saved", label: "Saved", icon: "bookmark" },

    { screen: "downloaded", label: "Offline", icon: "download" },

    { screen: "mine", label: "My activities", icon: "spark" },

    { screen: "profile", label: "Profile", icon: "user" },
  ]

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header screen={screen} setScreen={go} />
      {syncConflict && (
        <section
          role="alert"
          className="fixed left-1/2 top-24 z-50 max-h-[75vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 overflow-y-auto rounded-3xl border border-orange-200 bg-white p-5 shadow-2xl sm:p-7"
        >
          <p className="text-sm font-extrabold uppercase tracking-widest text-orange-800">
            Activity conflict
          </p>
          <h2 className="mt-2 text-xl font-extrabold text-navy-950">
            The server and this device both have edits
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Nothing was overwritten. Choose a version or review and edit your
            local copy before syncing.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              {
                label: "This device",

                activity: syncConflict.localActivity,
              },

              { label: "Server", activity: syncConflict.serverActivity },
            ].map(({ label, activity }) => (
              <article
                key={String(label)}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-xs font-extrabold uppercase tracking-wider text-teal-800">
                  {label}
                </p>
                <h3 className="mt-2 font-extrabold text-navy-950">
                  {activity.title}
                </h3>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">
                  {activity.description}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => void resolveConflict("local")}
              className="min-h-11 rounded-full bg-navy-950 px-4 text-sm font-bold text-white"
            >
              Keep this device's version
            </button>
            <button
              onClick={() => void resolveConflict("server")}
              className="min-h-11 rounded-full border border-slate-300 px-4 text-sm font-bold text-navy-950"
            >
              Use server version
            </button>
            <button
              onClick={() => void reviewConflictLocally()}
              className="min-h-11 rounded-full border border-teal-300 px-4 text-sm font-bold text-teal-900"
            >
              Review and edit
            </button>
          </div>
        </section>
      )}
      {errorMessage && (
        <div
          role="alert"
          className="fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-red-200 bg-white p-4 text-sm font-semibold text-red-800 shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            {errorMessage}
            <button
              onClick={() => setErrorMessage("")}
              aria-label="Dismiss error"
              className="font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {!dataReady && screen !== "welcome" && (
        <p className="mx-auto max-w-7xl px-5 py-4 text-sm text-slate-500">
          Opening your on-device STEMmate workspace…
        </p>
      )}
      {screen === "welcome" && <Welcome setScreen={go} />}
      {(screen === "login" || screen === "signup" || screen === "forgot" || screen === "reset") && (
        <Auth mode={screen} setScreen={go} onSubmit={submitAuth} />
      )}
      {["home", "saved", "downloaded", "mine"].includes(screen) && (
        <>
        {screen === "home" && (
          <section className="bg-cream">
            <div className="mx-auto max-w-7xl px-5 pb-2 pt-8 lg:px-8">
              <div className="flex flex-col justify-between gap-5 rounded-3xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-7">
                <div>
                  <p className="text-sm font-bold text-teal-800">
                    Your STEMmate dashboard
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold text-navy-950">
                    Welcome, {profile?.name || "facilitator"}
                  </h2>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:gap-5">
                  {[
                    ["Activities", activityList.filter((item) => item.isPublic || item.createdBy === activeUserId).length],
                    ["Favourites", savedIds.length],
                    ["Offline", downloadedIds.length],
                  ].map(([label, count]) => (
                    <div key={String(label)} className="min-w-[4.5rem] text-center">
                      <p className="text-xl font-extrabold text-teal-800">
                        {count}
                      </p>
                      <p className="text-xs font-semibold text-slate-500">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => go("create")}
                  className="min-h-11 shrink-0 rounded-full bg-navy-950 px-5 text-sm font-bold text-white"
                >
                  Create activity
                </button>
              </div>
            </div>
          </section>
        )}
        <Browse
          screen={screen}
          activities={visibleActivities}
          savedIds={savedIds}
          downloadedIds={downloadedIds}
          userId={activeUserId}
          setSavedIds={toggleFavorite}
          onDownload={toggleDownload}
          onOpen={openActivity}
        />
        </>
      )}
      {screen === "create" && (
        <ActivityEditor
          onCancel={() => go("mine")}
          onSave={(content) => void persistActivity(content)}
        />
      )}
      {screen === "edit" && editingActivity && (
        <ActivityEditor
          initial={editingActivity}
          onCancel={() => go("detail")}
          onSave={(content) => void persistActivity(content, editingActivity)}
        />
      )}
      {screen === "profile" && (
        <ProfilePage
          profile={profile}
          userId={activeUserId}
          authenticated={Boolean(authUser)}
          onSave={saveUserProfile}
          onLogout={() => void clearProfile()}
        />
      )}
      {screen === "detail" && (
        <Detail
          activity={selected}
          saved={savedIds.includes(selected.id)}
          completed={completedIds.includes(selected.id)}
          canEdit={selected.createdBy === activeUserId}
          onBack={() => go("home")}
          onSave={() => void toggleFavorite(selected.id)}
          onBook={() => void completeSelectedActivity()}
          onEdit={() => {
            setEditingActivity(selected)

            go("edit")
          }}
          onDelete={() => void deleteSelectedActivity()}
        />
      )}
      {isAppScreen && (
        <LocalStatus
          online={online}
          pendingCount={pendingCount}
          status={syncStatus}
          canSync={Boolean(authUser)}
          onSync={() => void syncNow()}
        />
      )}
      {isAppScreen && (
        <nav
          aria-label="Main navigation"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_24px_rgba(16,44,53,0.08)] backdrop-blur md:hidden"
        >
          <div className="mx-auto flex max-w-xl items-stretch justify-around">
            {navItems.map((item) => (
              <button
                key={item.screen}
                onClick={() => go(item.screen)}
                aria-current={screen === item.screen ? "page" : undefined}
                className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${
                  screen === item.screen ? "text-teal-800" : "text-slate-500"
                }`}
              >
                <Icon name={item.icon} className="size-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
