/* Declare & Believe — USFM 3-character book codes for API.Bible.
   API.Bible addresses chapters/verses by USFM code (Genesis = GEN, John = JHN,
   Revelation = REV); a chapter ID looks like "JHN.3". The reader joins this map
   with src/data/bible.js (DB_BIBLE — names, chapter counts, taglines) to build
   each book's request. Keys MUST match the book names in DB_BIBLE exactly.
   Built once, static. (Kept separate from bible.js so the live v1 reader's data
   file stays untouched.) */

export const USFM = {
  // Old Testament — The Law
  'Genesis': 'GEN', 'Exodus': 'EXO', 'Leviticus': 'LEV', 'Numbers': 'NUM', 'Deuteronomy': 'DEU',
  // Historical
  'Joshua': 'JOS', 'Judges': 'JDG', 'Ruth': 'RUT', '1 Samuel': '1SA', '2 Samuel': '2SA',
  '1 Kings': '1KI', '2 Kings': '2KI', '1 Chronicles': '1CH', '2 Chronicles': '2CH',
  'Ezra': 'EZR', 'Nehemiah': 'NEH', 'Esther': 'EST',
  // Wisdom & Poetry
  'Job': 'JOB', 'Psalms': 'PSA', 'Proverbs': 'PRO', 'Ecclesiastes': 'ECC', 'Song of Solomon': 'SNG',
  // Major Prophets
  'Isaiah': 'ISA', 'Jeremiah': 'JER', 'Lamentations': 'LAM', 'Ezekiel': 'EZK', 'Daniel': 'DAN',
  // Minor Prophets
  'Hosea': 'HOS', 'Joel': 'JOL', 'Amos': 'AMO', 'Obadiah': 'OBA', 'Jonah': 'JON', 'Micah': 'MIC',
  'Nahum': 'NAM', 'Habakkuk': 'HAB', 'Zephaniah': 'ZEP', 'Haggai': 'HAG', 'Zechariah': 'ZEC', 'Malachi': 'MAL',
  // New Testament — Gospels
  'Matthew': 'MAT', 'Mark': 'MRK', 'Luke': 'LUK', 'John': 'JHN',
  // Church History
  'Acts': 'ACT',
  // The Apostle Paul
  'Romans': 'ROM', '1 Corinthians': '1CO', '2 Corinthians': '2CO', 'Galatians': 'GAL', 'Ephesians': 'EPH',
  'Philippians': 'PHP', 'Colossians': 'COL', '1 Thessalonians': '1TH', '2 Thessalonians': '2TH',
  '1 Timothy': '1TI', '2 Timothy': '2TI', 'Titus': 'TIT', 'Philemon': 'PHM',
  // General Epistles
  'Hebrews': 'HEB', 'James': 'JAS', '1 Peter': '1PE', '2 Peter': '2PE', '1 John': '1JN',
  '2 John': '2JN', '3 John': '3JN', 'Jude': 'JUD',
  // Prophecy
  'Revelation': 'REV',
};

export function usfmFor(name) {
  return USFM[name] || null;
}
