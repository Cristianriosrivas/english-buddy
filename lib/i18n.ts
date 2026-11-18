// Textos de la interfaz. Para agregar otro idioma de explicación,
// copia `es`, tradúcelo y regístralo en `dictionaries`.
const es = {
  nav: {
    home: "Inicio",
    topics: "Temas",
    free: "Libre",
    lessons: "Lecciones",
    progress: "Progreso",
    logout: "Salir",
  },
  home: {
    greeting: (name?: string | null) => (name ? `¡Hola, ${name}!` : "¡Hola!"),
    subtitle: "¿Qué quieres practicar hoy?",
    level: "Tu nivel",
    noLevel: "Elige tu nivel para empezar",
    noLevelHint:
      "Más adelante podrás hacer una prueba corta para que la app lo calcule por ti.",
    changeLevel: "Cambiar nivel",
    progressTitle: "Tu progreso",
    progressEmpty: "Aún no hay actividad. ¡Empieza una conversación o una lección!",
    setupMissing:
      "No encontré tu perfil. ¿Ya ejecutaste el SQL de supabase/migrations en tu proyecto?",
  },
  sections: {
    topics: {
      title: "Temas guiados",
      description: "Conversaciones sobre situaciones cotidianas: restaurante, viajes, trabajo...",
    },
    free: {
      title: "Conversación libre",
      description: "Charla de lo que quieras, adaptada a tu nivel.",
    },
    lessons: {
      title: "Lecciones",
      description: "Gramática y vocabulario con ejercicios y corrección automática.",
    },
    progress: {
      title: "Progreso",
      description: "Tus errores frecuentes y las lecciones completadas.",
    },
  },
};

export type Dictionary = typeof es;

const dictionaries = { es } satisfies Record<string, Dictionary>;

export type Locale = keyof typeof dictionaries;

export function getDictionary(locale: string = "es"): Dictionary {
  return dictionaries[locale as Locale] ?? es;
}
