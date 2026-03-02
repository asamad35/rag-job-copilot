import { AutofillProfile, FieldType } from "~src/content/autofill/types"

const STORAGE_KEY = "autofill_profile"

const RESUME_SKILL_LIST = [
  "JavaScript",
  "TypeScript",
  "React.js",
  "Next.js",
  "Tailwind CSS",
  "Redux",
  "Recoil",
  "Zustand",
  "Node.js",
  "Express.js",
  "Nest.js",
  "GraphQL",
  "MongoDB",
  "Prisma",
  "Redis",
  "Kafka",
  "Docker",
  "Kubernetes",
  "AWS"
]

const toPointText = (points: readonly string[]): string =>
  points.map((point) => `- ${point}`).join("\n")

const RESUME_TECH_STACK_POINTS = [
  "Frontend: React.js, Next.js, TypeScript, Redux, Tailwind CSS",
  "Backend: Node.js, Nest.js, GraphQL, REST APIs, MongoDB, Prisma, Redis, Kafka",
  "DevOps/Cloud: Docker, Kubernetes, AWS (EC2, ECS, S3, CloudWatch)"
]

const RESUME_SCALE_EXPERIENCE_POINTS = [
  "Built and maintained high-performance systems serving 6 million users.",
  "Migrated 40 million user records and 10,000+ media entries to optimized services with minimal disruption."
]

const RESUME_PROFESSIONAL_SUMMARY_POINTS = [
  "Full Stack Developer with 4+ years of experience.",
  "Built production web applications using React/Next.js and Node.js/Nest.js.",
  "Focused on scalability, performance, and reliable backend architecture."
]

const RESUME_PROJECT_SUMMARY_POINTS = [
  "Doodle-It: Collaborative Excalidraw-inspired drawing app with undo/redo and multiple tools.",
  "Socio Plus: MERN social app with real-time messaging, video calling, and file sharing.",
  "Kanban Pro+: Task/board management app inspired by Trello/Notion with drag-and-drop and Firebase."
]

const RESUME_TECH_STACK = toPointText(RESUME_TECH_STACK_POINTS)
const RESUME_SCALE_EXPERIENCE = toPointText(RESUME_SCALE_EXPERIENCE_POINTS)
const RESUME_PROFESSIONAL_SUMMARY = toPointText(
  RESUME_PROFESSIONAL_SUMMARY_POINTS
)
const RESUME_PROJECT_SUMMARY = toPointText(RESUME_PROJECT_SUMMARY_POINTS)

export const DEFAULT_AUTOFILL_PROFILE: AutofillProfile = {
  [FieldType.FirstName]: "Abdus",
  [FieldType.LastName]: "Samad",
  [FieldType.FullName]: "Abdus Samad",
  [FieldType.Email]: "samad.abdus3535@gmail.com",
  [FieldType.Phone]: "+919654405340",
  [FieldType.AddressLine1]: "4137, Urdu Bazar, Jama Masjid, 110006",
  [FieldType.AddressLine2]: "4137, Urdu Bazar, Jama Masjid, 110006",
  [FieldType.City]: "Delhi",
  [FieldType.State]: "Delhi",
  [FieldType.PostalCode]: "110006",
  [FieldType.Country]: "India",
  [FieldType.Gender]: "Male",
  [FieldType.Company]: "Caw Studios",
  [FieldType.JobTitle]: "Full Stack Developer",
  [FieldType.TotalExperience]: "4 years 7 months",
  [FieldType.RelevantExperience]:
    "4+ years in Full Stack Development (React/Next.js, Node.js/Nest.js)",
  [FieldType.Skills]: RESUME_SKILL_LIST,
  [FieldType.TechStack]: RESUME_TECH_STACK,
  [FieldType.ScaleExperience]: RESUME_SCALE_EXPERIENCE,
  [FieldType.ProfessionalSummary]: RESUME_PROFESSIONAL_SUMMARY,
  [FieldType.ProjectSummary]: RESUME_PROJECT_SUMMARY,
  [FieldType.HighestEducation]:
    "Bachelor of Computer Applications, Ambedkar Institute of Technology, Delhi, 8.7 CGPA",
  [FieldType.GraduationYear]: "2023",
  [FieldType.CurrentCtc]: "2300000",
  [FieldType.ExpectedCtc]: "3200000",
  [FieldType.NoticePeriod]: "23rd March 2026",
  [FieldType.LinkedIn]: "https://www.linkedin.com/in/asamad35/",
  [FieldType.GitHub]: "https://github.com/asamad35",
  [FieldType.LeetCode]: "https://leetcode.com/user5730HH/",
  [FieldType.Website]: "https://asamad.vercel.app/",
  [FieldType.WorkAuthorization]: "Yes",
  [FieldType.ReferralSource]: "LinkedIn",
  [FieldType.Relocation]: "Yes",
  [FieldType.Pronouns]: "He/Him",
  [FieldType.PreferredName]: "Abdus",
  [FieldType.EeoGender]: "Decline to self-identify",
  [FieldType.EeoRace]: "Decline to self-identify",
  [FieldType.EeoVeteran]: "I am not a protected veteran",
  [FieldType.EeoDisability]: "I don't wish to answer"
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const toAutofillProfile = (value: unknown): AutofillProfile => {
  if (!isObject(value)) {
    return {}
  }

  const profile: AutofillProfile = {}

  for (const fieldType of Object.values(FieldType)) {
    if (fieldType === FieldType.Unknown) {
      continue
    }

    const rawValue = value[fieldType]
    if (typeof rawValue === "string" || typeof rawValue === "boolean") {
      profile[fieldType] = rawValue
      continue
    }

    if (
      Array.isArray(rawValue) &&
      rawValue.every((item) => typeof item === "string")
    ) {
      const normalizedValues = rawValue.map((item) => item.trim()).filter(Boolean)
      if (normalizedValues.length > 0) {
        profile[fieldType] = normalizedValues
      }
    }
  }

  for (const dobKey of ["date_of_birth", "dateOfBirth", "dob"] as const) {
    const rawDob = value[dobKey]
    if (typeof rawDob === "string") {
      const normalizedDob = rawDob.trim()
      if (normalizedDob) {
        profile[FieldType.DateOfBirth] = normalizedDob
      }
    }
  }

  return profile
}

export const loadAutofillProfile = async (): Promise<AutofillProfile> => {
  try {
    const storageData = await new Promise<Record<string, unknown>>(
      (resolve) => {
        chrome.storage.local.get(STORAGE_KEY, (items) => {
          resolve(items as Record<string, unknown>)
        })
      }
    )

    const storedProfile = toAutofillProfile(storageData[STORAGE_KEY])
    return {
      ...DEFAULT_AUTOFILL_PROFILE,
      ...storedProfile
    }
  } catch (error) {
    console.warn("Unable to read autofill profile from storage:", error)
    return { ...DEFAULT_AUTOFILL_PROFILE }
  }
}
