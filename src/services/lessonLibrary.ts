import type { TeachingListDocument, TeachingListItem } from "../domain/teachingList";

export const LESSON_LIBRARY_STORAGE_KEY = "hkele-lessons-v1";

export interface SavedLesson {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  items: TeachingListItem[];
}

export interface LessonLibrary {
  schemaVersion: "1.0.0";
  activeLessonId: string;
  lessons: SavedLesson[];
}

export function activeLesson(library: LessonLibrary): SavedLesson {
  const lesson = library.lessons.find((item) => item.id === library.activeLessonId);
  if (!lesson) throw new Error("Saved lesson is missing.");
  return lesson;
}

export function lessonLabel(lesson: SavedLesson, index: number): string {
  return lesson.title.trim() || `Lesson ${index + 1}`;
}

export function migrateLessonLibrary(document: TeachingListDocument, now: string): LessonLibrary {
  return {
    schemaVersion: "1.0.0",
    activeLessonId: "imported-current-lesson",
    lessons: [
      {
        id: "imported-current-lesson",
        title: document.lessonTitle ?? "",
        createdAt: now,
        updatedAt: now,
        items: document.items.map((item) => ({ ...item, selectedForms: [...item.selectedForms] })),
      },
    ],
  };
}

export function parseLessonLibrary(raw: string): LessonLibrary {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("Invalid lesson library.");
  const document = value as Partial<LessonLibrary>;
  if (
    document.schemaVersion !== "1.0.0" ||
    !Array.isArray(document.lessons) ||
    !document.lessons.length ||
    typeof document.activeLessonId !== "string"
  )
    throw new Error("Unsupported lesson library.");
  const ids = new Set<string>();
  for (const lesson of document.lessons) {
    if (
      !lesson ||
      typeof lesson.id !== "string" ||
      !lesson.id ||
      ids.has(lesson.id) ||
      typeof lesson.title !== "string" ||
      typeof lesson.createdAt !== "string" ||
      typeof lesson.updatedAt !== "string" ||
      !Array.isArray(lesson.items)
    )
      throw new Error("Invalid saved lesson.");
    ids.add(lesson.id);
    const families = new Set<string>();
    for (const item of lesson.items) {
      if (
        !item ||
        typeof item.basewordKey !== "string" ||
        !item.basewordKey ||
        families.has(item.basewordKey) ||
        typeof item.displayFamily !== "string" ||
        !Array.isArray(item.selectedForms) ||
        !item.selectedForms.every((form) => typeof form === "string") ||
        typeof item.notes !== "string" ||
        typeof item.connections !== "string" ||
        !Number.isFinite(item.customOrder)
      )
        throw new Error("Invalid saved word.");
      families.add(item.basewordKey);
    }
  }
  if (!ids.has(document.activeLessonId)) throw new Error("Active saved lesson is missing.");
  return document as LessonLibrary;
}

export function replaceLessonItems(
  library: LessonLibrary,
  items: TeachingListItem[],
  now: string,
): LessonLibrary {
  return {
    ...library,
    lessons: library.lessons.map((lesson) =>
      lesson.id === library.activeLessonId ? { ...lesson, updatedAt: now, items } : lesson,
    ),
  };
}

export function renameActiveLesson(
  library: LessonLibrary,
  title: string,
  now: string,
): LessonLibrary {
  return {
    ...library,
    lessons: library.lessons.map((lesson) =>
      lesson.id === library.activeLessonId ? { ...lesson, title, updatedAt: now } : lesson,
    ),
  };
}

export function addSavedLesson(
  library: LessonLibrary,
  title: string,
  id: string,
  now: string,
): LessonLibrary {
  if (!id || library.lessons.some((lesson) => lesson.id === id))
    throw new Error("Duplicate saved lesson.");
  return {
    ...library,
    activeLessonId: id,
    lessons: [
      ...library.lessons,
      {
        id,
        title: title.trim() || `Lesson ${library.lessons.length + 1}`,
        createdAt: now,
        updatedAt: now,
        items: [],
      },
    ],
  };
}

export function selectSavedLesson(library: LessonLibrary, id: string): LessonLibrary {
  if (!library.lessons.some((lesson) => lesson.id === id))
    throw new Error("Saved lesson is missing.");
  return { ...library, activeLessonId: id };
}

// A delayed evidence refresh can update evidence only, including when the teacher edited notes meanwhile.
export function mergeRefreshedLessonItems(
  current: TeachingListItem[],
  refreshed: TeachingListItem[],
): TeachingListItem[] {
  const byKey = new Map(refreshed.map((item) => [item.basewordKey, item]));
  return current.map((item) => {
    const fresh = byKey.get(item.basewordKey);
    return fresh
      ? {
          ...item,
          displayFamily: fresh.displayFamily,
          derived: fresh.derived,
          dataVersion: fresh.dataVersion,
          dataReviewStatus: fresh.dataReviewStatus,
          previousEvidence: fresh.previousEvidence,
        }
      : item;
  });
}
