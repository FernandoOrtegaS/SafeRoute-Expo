// utils/textFilter.ts

const BAD_WORDS = [
  // --- Modismos locales y variaciones comunes ---
  'weon', 'weona', 'aweonao', 'aweona', 'wn', 'wna', 'weón',
  'conchetumare', 'conchatumare', 'ctm', 'chuchatumare',
  'culiao', 'culeao', 'culia', 'culea', 'ql', 'qlo', 'qliao', 'qlia',
  'chucha', 'xuxa', 'chuchas',
  'saco wea', 'sacowea', 'sacowb',
  'maraca', 'maraco', 'maricon', 'fleto', 'tortillera',
  
  // --- Groserías generales y ofensas ---
  'puta', 'puto', 'putas', 'putos', 'pto', 'pta',
  'mierda', 'mrda',
  'perra', 'perro',
  'cabron', 'cabrona',
  'malparido', 'malparida',
  'pendejo', 'pendeja',
  'idiota', 'estupido', 'estupida', 'imbecil', 'retardado', 'bastardo',
  'concha', 'conchuda', 'conchudo',
  
  // --- Términos sexuales / Anatómicos inapropiados ---
  'pico', 'pichula', 'tula', 'chuto',
  'zorra', 'sapo', 'raja', 'culo', 'ano',
  'tetas', 'pechos', 'vagina', 'pene', 'testiculos', 'huevos', 'cocos',
  'semen', 'moco', 'esperma',
  'porno', 'pornografia', 'sexo', 'xxx',
  'prostituta', 'ramera', 'putiferio',
  'pedofilo', 'violador', 'acoso', 'violacion',

  // --- Palabras de odio / Discriminación extrema ---
  'nazi', 'racista', 'esclavo',
  
  // --- Leetspeak básico (cambiando vocales por números) ---
  'pvt@', 'p0ta', 'm1erda', 'w3on', 'w30n', 'c7m', 'c0ncha'
];

/**
 * Convierte una palabra base en una regla que atrapa tildes automáticamente.
 * Ejemplo: "estupido" se transforma en "est[uúùüû]p[iíìïî]d[oóòöô]"
 */
const createFlexibleRegex = (word: string, isAggressive: boolean) => {
  const flexibleWord = word
    .replace(/a/g, '[aáàäâAÁÀÄÂ]')
    .replace(/e/g, '[eéèëêEÉÈËÊ]')
    .replace(/i/g, '[iíìïîIÍÌÏÎ]')
    .replace(/o/g, '[oóòöôOÓÒÖÔ]')
    .replace(/u/g, '[uúùüûUÚÙÜÛ]');

  if (isAggressive) {
    // Modo Nombre de Usuario: Búsqueda sin límites.
    // Atrapa la grosería aunque tenga números o letras pegadas (ej: "pene123", "xXputaXx")
    return new RegExp(flexibleWord, 'gi');
  } else {
    // Modo Reportes: Mantiene los límites de palabra (\b) para evitar censurar 
    // palabras legítimas que contengan una sílaba mala por casualidad.
    return new RegExp(`\\b${flexibleWord}\\b`, 'gi');
  }
};

export const censorText = (text: string): string => {
  if (!text) return text;
  
  let censored = text;
  BAD_WORDS.forEach(word => {
    // Usamos el modo NO agresivo para los reportes
    const regex = createFlexibleRegex(word, false);
    
    // Reemplaza la grosería por la cantidad exacta de asteriscos
    censored = censored.replace(regex, (match) => '*'.repeat(match.length));
  });
  
  return censored;
};

export const containsProfanity = (text: string): boolean => {
  if (!text) return false;
  
  return BAD_WORDS.some(word => {
    // Usamos el modo AGRESIVO para los nombres de usuario
    const regex = createFlexibleRegex(word, true);
    return regex.test(text);
  });
};