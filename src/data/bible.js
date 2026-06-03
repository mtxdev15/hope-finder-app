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
          { name: 'Joshua', chapters: 24, tag: 'Into the promised land' },
          { name: 'Judges', chapters: 21, tag: 'Everyone did as they pleased' },
          { name: 'Ruth', chapters: 4, tag: 'Loyalty and redemption' },
          { name: '1 Samuel', chapters: 31, tag: 'Israel asks for a king' },
          { name: '2 Samuel', chapters: 24, tag: 'The reign of David' },
          { name: '1 Kings', chapters: 22, tag: 'A kingdom divided' },
          { name: '2 Kings', chapters: 25, tag: 'Exile draws near' },
          { name: '1 Chronicles', chapters: 29, tag: 'David’s royal line' },
          { name: '2 Chronicles', chapters: 36, tag: 'The temple and the kings' },
          { name: 'Ezra', chapters: 10, tag: 'Return and rebuild' },
          { name: 'Nehemiah', chapters: 13, tag: 'Rebuilding the walls' },
          { name: 'Esther', chapters: 10, tag: 'For such a time as this' },
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
          { name: 'Isaiah', chapters: 66, tag: 'Comfort and a coming King' },
          { name: 'Jeremiah', chapters: 52, tag: 'Warnings and a new covenant' },
          { name: 'Lamentations', chapters: 5, tag: 'Mercy in mourning' },
          { name: 'Ezekiel', chapters: 48, tag: 'A new heart and spirit' },
          { name: 'Daniel', chapters: 12, tag: 'Faithful in a foreign land' },
        ],
      },
      {
        title: 'Minor Prophets',
        sub: 'Prophetic · 12 books',
        note: 'The shorter prophetic works.',
        books: [
          { name: 'Hosea', chapters: 14, tag: 'Relentless love' },
          { name: 'Joel', chapters: 3, tag: 'The day of the Lord' },
          { name: 'Amos', chapters: 9, tag: 'Let justice roll' },
          { name: 'Obadiah', chapters: 1, tag: 'Pride brought low' },
          { name: 'Jonah', chapters: 4, tag: 'Mercy for all' },
          { name: 'Micah', chapters: 7, tag: 'Act justly, love mercy' },
          { name: 'Nahum', chapters: 3, tag: 'God is a refuge' },
          { name: 'Habakkuk', chapters: 3, tag: 'The righteous live by faith' },
          { name: 'Zephaniah', chapters: 3, tag: 'The Lord is with you' },
          { name: 'Haggai', chapters: 2, tag: 'Rebuild what matters' },
          { name: 'Zechariah', chapters: 14, tag: 'Your King is coming' },
          { name: 'Malachi', chapters: 4, tag: 'Return to me' },
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
          { name: 'Matthew', chapters: 28, tag: 'The promised Messiah and King' },
          { name: 'Mark', chapters: 16, tag: 'The Servant who gave everything' },
          { name: 'Luke', chapters: 24, tag: 'Good news for the lost' },
          { name: 'John', chapters: 21, tag: 'The Word made flesh' },
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
        title: 'The Apostle Paul',
        sub: 'Letters · 13 books',
        note: 'Letters from Paul to guide and encourage the Church.',
        books: [
          { name: 'Romans', chapters: 16, tag: 'Righteous by faith' },
          { name: '1 Corinthians', chapters: 16, tag: 'The greatest of these is love' },
          { name: '2 Corinthians', chapters: 13, tag: 'Strength made perfect in weakness' },
          { name: 'Galatians', chapters: 6, tag: 'Free in Christ, not the law' },
          { name: 'Ephesians', chapters: 6, tag: 'Seated with Christ' },
          { name: 'Philippians', chapters: 4, tag: 'Joy in every circumstance' },
          { name: 'Colossians', chapters: 4, tag: 'Christ above all' },
          { name: '1 Thessalonians', chapters: 5, tag: 'Living for His return' },
          { name: '2 Thessalonians', chapters: 3, tag: 'Stand firm' },
          { name: '1 Timothy', chapters: 6, tag: 'Lead the church well' },
          { name: '2 Timothy', chapters: 4, tag: 'Finish the race' },
          { name: 'Titus', chapters: 3, tag: 'Faith that shows in works' },
          { name: 'Philemon', chapters: 1, tag: 'Welcome him as a brother' },
        ],
      },
      {
        title: 'General Epistles',
        sub: 'Letters · 8 books',
        note: 'Letters written to the wider Church.',
        books: [
          { name: 'Hebrews', chapters: 13, tag: 'Christ, our great high priest' },
          { name: 'James', chapters: 5, tag: 'Faith that acts' },
          { name: '1 Peter', chapters: 5, tag: 'Hope through suffering' },
          { name: '2 Peter', chapters: 3, tag: 'Beware false teachers' },
          { name: '1 John', chapters: 5, tag: 'Walk in love and truth' },
          { name: '2 John', chapters: 1, tag: 'Love and truth' },
          { name: '3 John', chapters: 1, tag: 'Faithful hospitality' },
          { name: 'Jude', chapters: 1, tag: 'Contend for the faith' },
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

/* Translations available via the API.Bible (scripture.api.bible) service.
   `free: true` = public domain, no paid API key needed.
   `bibleId` = the unique ID used by the API.Bible endpoint. */
export const DB_BIBLE_TRANSLATIONS = [
  { id: 'niv',  label: 'NIV',  name: 'New International Version',  type: 'Balanced', why: 'The world’s most-read modern English Bible — clear and natural for everyday reading.',        bibleId: '78a9f6124f344018-01' },
  { id: 'nkjv', label: 'NKJV', name: 'New King James Version',     type: 'Classic',  why: 'Keeps the beauty of the KJV in updated, modern English.',                                             bibleId: '63097d2a0a2f7db3-01' },
  { id: 'nlt',  label: 'NLT',  name: 'New Living Translation',     type: 'Readable', why: 'Warm, plain English that’s easy to read and ideal for devotions.',                               bibleId: 'd6e14a625393b4da-01' },
  { id: 'kjv',  label: 'KJV',  name: 'King James Version',         type: 'Classic',  why: 'The historic 1611 translation, loved for its timeless, poetic English.',         free: true,          bibleId: 'de4e12af7f28f599-01' },
  { id: 'web',  label: 'WEB',  name: 'World English Bible',        type: 'Modern',   why: 'A clear, modern-English update of the classic ASV.',                             free: true,          bibleId: '9879dbb7cfe39e4d-01' },
  { id: 'asv',  label: 'ASV',  name: 'American Standard Version',  type: 'Literal',  why: 'A precise, literal classic from 1901, prized for study.',                       free: true,          bibleId: '06125adad2d5898a-01' },
];
