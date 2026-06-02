/* Declare & Believe — the 66 books of the Bible, grouped into the eight
   classical categories across the Old and New Testaments.
   Each book: name, chapter count, and (where helpful) a short tagline. */

export const DB_BIBLE = {
  OT: {
    label: 'Old Testament',
    blurb: 'Creation, the history of Israel, and God’s foundational promises.',
    groups: [
      {
        title: 'The Law',
        sub: 'Pentateuch · 5 books',
        note: 'The origins of the world and God’s law for Israel.',
        books: [
          { name: 'Genesis', chapters: 50, tag: 'In the beginning' },
          { name: 'Exodus', chapters: 40, tag: 'Out of bondage' },
          { name: 'Leviticus', chapters: 27, tag: 'Be holy' },
          { name: 'Numbers', chapters: 36, tag: 'Wilderness years' },
          { name: 'Deuteronomy', chapters: 34, tag: 'Remember and obey' },
        ],
      },
      {
        title: 'Historical Books',
        sub: '12 books',
        note: 'The rise, fall, exile, and return of the nation of Israel.',
        books: [
          { name: 'Joshua', chapters: 24 },
          { name: 'Judges', chapters: 21 },
          { name: 'Ruth', chapters: 4 },
          { name: '1 Samuel', chapters: 31 },
          { name: '2 Samuel', chapters: 24 },
          { name: '1 Kings', chapters: 22 },
          { name: '2 Kings', chapters: 25 },
          { name: '1 Chronicles', chapters: 29 },
          { name: '2 Chronicles', chapters: 36 },
          { name: 'Ezra', chapters: 10 },
          { name: 'Nehemiah', chapters: 13 },
          { name: 'Esther', chapters: 10 },
        ],
      },
      {
        title: 'Wisdom & Poetry',
        sub: '5 books',
        note: 'Worship, prayer, suffering, and wisdom for daily life.',
        books: [
          { name: 'Job', chapters: 42, tag: 'Faith through suffering' },
          { name: 'Psalms', chapters: 150, tag: 'Songs of the heart' },
          { name: 'Proverbs', chapters: 31, tag: 'Wisdom for living' },
          { name: 'Ecclesiastes', chapters: 12, tag: 'Meaning under the sun' },
          { name: 'Song of Solomon', chapters: 8, tag: 'A song of love' },
        ],
      },
      {
        title: 'Major Prophets',
        sub: 'Prophetic · 5 books',
        note: 'The longer messages and warnings from God.',
        books: [
          { name: 'Isaiah', chapters: 66 },
          { name: 'Jeremiah', chapters: 52 },
          { name: 'Lamentations', chapters: 5 },
          { name: 'Ezekiel', chapters: 48 },
          { name: 'Daniel', chapters: 12 },
        ],
      },
      {
        title: 'Minor Prophets',
        sub: 'Prophetic · 12 books',
        note: 'The shorter prophetic works.',
        books: [
          { name: 'Hosea', chapters: 14 },
          { name: 'Joel', chapters: 3 },
          { name: 'Amos', chapters: 9 },
          { name: 'Obadiah', chapters: 1 },
          { name: 'Jonah', chapters: 4 },
          { name: 'Micah', chapters: 7 },
          { name: 'Nahum', chapters: 3 },
          { name: 'Habakkuk', chapters: 3 },
          { name: 'Zephaniah', chapters: 3 },
          { name: 'Haggai', chapters: 2 },
          { name: 'Zechariah', chapters: 14 },
          { name: 'Malachi', chapters: 4 },
        ],
      },
    ],
  },
  NT: {
    label: 'New Testament',
    blurb: 'The life of Jesus, the early Church, and the Christian hope.',
    groups: [
      {
        title: 'The Gospels',
        sub: '4 books',
        note: 'The life, death, resurrection, and teachings of Jesus Christ.',
        books: [
          { name: 'Matthew', chapters: 28 },
          { name: 'Mark', chapters: 16 },
          { name: 'Luke', chapters: 24 },
          { name: 'John', chapters: 21 },
        ],
      },
      {
        title: 'Church History',
        sub: '1 book',
        note: 'The birth of the early Church and the spread of the gospel.',
        books: [
          { name: 'Acts', chapters: 28, tag: 'The Spirit empowers believers' },
        ],
      },
      {
        title: 'Pauline Epistles',
        sub: 'Letters · 13 books',
        note: 'Letters from Paul to guide and encourage the Church.',
        books: [
          { name: 'Romans', chapters: 16 },
          { name: '1 Corinthians', chapters: 16 },
          { name: '2 Corinthians', chapters: 13 },
          { name: 'Galatians', chapters: 6 },
          { name: 'Ephesians', chapters: 6 },
          { name: 'Philippians', chapters: 4 },
          { name: 'Colossians', chapters: 4 },
          { name: '1 Thessalonians', chapters: 5 },
          { name: '2 Thessalonians', chapters: 3 },
          { name: '1 Timothy', chapters: 6 },
          { name: '2 Timothy', chapters: 4 },
          { name: 'Titus', chapters: 3 },
          { name: 'Philemon', chapters: 1 },
        ],
      },
      {
        title: 'General Epistles',
        sub: 'Letters · 8 books',
        note: 'Letters written to the wider Church.',
        books: [
          { name: 'Hebrews', chapters: 13 },
          { name: 'James', chapters: 5 },
          { name: '1 Peter', chapters: 5 },
          { name: '2 Peter', chapters: 3 },
          { name: '1 John', chapters: 5 },
          { name: '2 John', chapters: 1 },
          { name: '3 John', chapters: 1 },
          { name: 'Jude', chapters: 1 },
        ],
      },
      {
        title: 'Prophecy',
        sub: 'Apocalyptic · 1 book',
        note: 'The end of the age and the promise of a new creation.',
        books: [
          { name: 'Revelation', chapters: 22, tag: 'A new heaven and earth' },
        ],
      },
    ],
  },
};

/* Translations, in the popular order (ECPA bestseller ranking; The Message #10).
   `free: true` = public domain, so we can show the full text in good conscience
   (loaded live from bible-api.com). The licensed modern translations need a paid
   Bible-API key before their full text can be displayed. */
export const DB_BIBLE_TRANSLATIONS = [
  { id: 'niv',  label: 'NIV',  name: 'New International Version',        type: 'Balanced',  why: 'The world’s most-read modern English Bible — clear and natural for everyday reading.' },
  { id: 'kjv',  label: 'KJV',  name: 'King James Version',              type: 'Classic',   why: 'The historic 1611 translation, loved for its timeless, poetic English.', free: true, api: 'kjv' },
  { id: 'nlt',  label: 'NLT',  name: 'New Living Translation',          type: 'Readable',  why: 'Warm, plain English that’s easy to read and ideal for devotions.' },
  { id: 'esv',  label: 'ESV',  name: 'English Standard Version',        type: 'Literal',   why: 'A precise, literary translation widely used for study.' },
  { id: 'nkjv', label: 'NKJV', name: 'New King James Version',          type: 'Classic',   why: 'Keeps the beauty of the KJV in updated, modern English.' },
  { id: 'csb',  label: 'CSB',  name: 'Christian Standard Bible',        type: 'Balanced',  why: 'Balances accuracy and readability for everyday use.' },
  { id: 'rvr',  label: 'RVR',  name: 'Reina-Valera 1960 (Español)',     type: 'Español',   why: 'The most widely used Spanish-language Bible.' },
  { id: 'nirv', label: 'NIrV', name: 'New International Reader’s Version', type: 'Simple', why: 'Plain, simple English for new readers and children.' },
  { id: 'nasb', label: 'NASB', name: 'New American Standard Bible',     type: 'Literal',   why: 'One of the most literal English translations, prized for study.' },
  { id: 'msg',  label: 'MSG',  name: 'The Message',                     type: 'Paraphrase', why: 'Eugene Peterson’s modern, informal rendering for a fresh take on familiar verses.' },
  { id: 'web',  label: 'WEB',  name: 'World English Bible',             type: 'Modern',    why: 'A free, modern-English update of the classic ASV — no license needed.', free: true, api: 'web' },
];

