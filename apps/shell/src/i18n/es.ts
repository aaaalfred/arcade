/** Todas las cadenas visibles de la app. Para añadir un idioma, crear otro archivo con las mismas claves. */
export const es = {
  "app.name": "Arcade",

  "tabs.games": "Juegos",
  "tabs.ranking": "Ranking",
  "tabs.profile": "Perfil",

  "common.close": "Cerrar",
  "common.cancel": "Cancelar",
  "common.retry": "Reintentar",
  "common.offline": "Sin conexión",

  "home.title": "Juegos",
  "home.empty": "Todavía no hay juegos instalados.",
  "home.continue": "Continuar",
  "home.play": "Jugar",
  "state.new": "Nuevo",
  "state.complete": "Completado",
  "state.progress": "{done} de {total} {unit}",
  "tile.rank": "Puesto {rank}",

  "play.back": "Volver a Juegos",
  "play.menu": "Menú",
  "play.ranking": "Ranking",
  "play.resume": "Reanudar",
  "play.exit": "Salir a Juegos",
  "play.loading": "Cargando {name}",
  "play.loadError": "No se pudo cargar el juego.",
  "play.sound": "Sonido",
  "play.haptics": "Vibración",

  "ranking.title": "Ranking",
  "ranking.global": "Global",
  "ranking.weekly": "Semanal",
  "ranking.empty": "Todavía nadie ha puntuado. Sé el primero.",
  "ranking.error": "No se pudo cargar el ranking.",
  "ranking.offline": "Sin conexión. Mostrando el último ranking guardado.",
  "ranking.unavailable": "El ranking no está disponible por ahora.",
  "ranking.noBoards": "Este juego todavía no tiene ranking.",
  "ranking.noGames": "Cuando haya juegos aparecerán aquí.",
  "ranking.you": "Tú",
  "ranking.myPosition": "Tu posición",
  "ranking.noScore": "Aún no tienes puntaje en este ranking.",
  "ranking.report": "Reportar nombre",
  "ranking.reportTitle": "¿Reportar a {name}?",
  "ranking.reportBody": "Revisaremos si el nombre incumple las normas.",
  "ranking.reportSend": "Enviar reporte",
  "ranking.reported": "Reporte enviado.",
  "ranking.reportFailed": "No se pudo enviar el reporte.",

  "profile.title": "Perfil",
  "profile.nickname": "Tu nombre",
  "profile.noPlayer": "Se creará tu perfil cuando haya conexión.",
  "profile.change": "Cambiar nombre",
  "profile.save": "Guardar",
  "profile.nicknameSaved": "Nombre actualizado.",
  "profile.progress": "Tu progreso",
  "profile.settings": "Ajustes",
  "profile.privacy": "Política de privacidad",
  "profile.delete": "Borrar mis datos",
  "profile.deleteTitle": "¿Borrar tus datos?",
  "profile.deleteBody":
    "Se eliminan tu perfil, tu progreso guardado y tus puntajes, en este dispositivo y en el servidor. No se puede deshacer.",
  "profile.deleteConfirm": "Borrar todo",
  "profile.deleted": "Tus datos se borraron.",
  "profile.deleteOffline": "Necesitas conexión para borrar tu cuenta.",
  "profile.deleteFailed": "No se pudieron borrar los datos. Inténtalo de nuevo.",

  "nick.nickname_too_short": "Usa al menos 3 caracteres.",
  "nick.nickname_too_long": "Usa 16 caracteres como máximo.",
  "nick.nickname_invalid_chars": "Solo letras, números, espacios y . _ -",
  "nick.nickname_not_allowed": "Ese nombre no está permitido.",
  "nick.nickname_taken": "Ese nombre ya está en uso.",
  "nick.network": "Sin conexión. Inténtalo de nuevo.",
  "nick.other": "No se pudo guardar el nombre.",

  "ad.title": "Anuncio de prueba",
  "ad.wait": "Espera {s} s",
  "ad.close": "Cerrar anuncio",
  "ad.skip": "Saltar sin recompensa",
  "ad.claim": "Recibir recompensa",
} as const;

export type StringKey = keyof typeof es;

export function hasString(key: string): key is StringKey {
  return Object.hasOwn(es, key);
}

export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  return es[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
