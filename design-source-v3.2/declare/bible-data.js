/* Declare — The Word: book library + a few real public-domain passages
   (KJV/WEB/ASV are public domain). Full chapter text wires to the Worker/
   Bible API at merge; this powers the browse + a working parallel reader. */
window.DECLARE_BIBLE = {
  groups: {
    OT: [
      { title:'The Law', sub:'5 books', books:[
        ['Genesis','In the beginning — creation, covenant, and a chosen family',50],
        ['Exodus','Rescue from slavery and the giving of the Law',40],
        ['Leviticus','Holiness and the way to draw near to God',27],
        ['Numbers','Wandering, testing, and God’s faithfulness',36],
        ['Deuteronomy','Remember, and choose life',34],
      ]},
      { title:'History', sub:'12 books', books:[
        ['Joshua','Into the promise — courage and conquest',24],
        ['Judges','When everyone did what was right in their own eyes',21],
        ['Ruth','Loyalty, redemption, and a quiet providence',4],
        ['1 Samuel','From Samuel to Saul to David',31],
        ['2 Samuel','David’s reign — triumph and failure',24],
        ['1 Kings','Solomon’s glory and a kingdom divided',22],
        ['2 Kings','Decline, exile, and the prophets’ warnings',25],
        ['1 Chronicles','David’s line and the heart of worship',29],
        ['2 Chronicles','The temple, the kings, and the call to return',36],
        ['Ezra','Coming home to rebuild',10],
        ['Nehemiah','Rebuilding the walls, renewing the people',13],
        ['Esther','Hidden providence for such a time as this',10],
      ]},
      { title:'Wisdom & Poetry', sub:'5 books', books:[
        ['Job','Suffering, honesty, and the God who answers',42],
        ['Psalms','Prayers and songs for every season of the soul',150],
        ['Proverbs','Wisdom for everyday living',31],
        ['Ecclesiastes','Meaning under the sun',12],
        ['Song of Solomon','A song of covenant love',8],
      ]},
      { title:'Major Prophets', sub:'5 books', books:[
        ['Isaiah','Comfort, judgment, and the coming Servant',66],
        ['Jeremiah','Weeping prophet, faithful God',52],
        ['Lamentations','Grief that still hopes',5],
        ['Ezekiel','Visions of glory and dry bones made alive',48],
        ['Daniel','Faithful in exile, sovereign over kingdoms',12],
      ]},
      { title:'Minor Prophets', sub:'12 books', books:[
        ['Hosea','Relentless love for a wandering people',14],
        ['Joel','Return to the Lord with all your heart',3],
        ['Amos','Justice roll down like waters',9],
        ['Obadiah','Pride brought low',1],
        ['Jonah','Mercy chases the runaway',4],
        ['Micah','Do justly, love mercy, walk humbly',7],
        ['Nahum','The Lord is a refuge in trouble',3],
        ['Habakkuk','Faith that wrestles and trusts',3],
        ['Zephaniah','He will rejoice over you with singing',3],
        ['Haggai','Consider your ways — build His house',2],
        ['Zechariah','Visions of a coming King',14],
        ['Malachi','Return, and be made new',4],
      ]},
    ],
    NT: [
      { title:'The Gospels', sub:'4 books', books:[
        ['Matthew','The promised Messiah and King',28],
        ['Mark','The Servant who gave everything',16],
        ['Luke','Good news for the lost',24],
        ['John','The Word made flesh',21],
      ]},
      { title:'Church History', sub:'1 book', books:[
        ['Acts','The Spirit empowers believers',28],
      ]},
      { title:'Paul’s Letters', sub:'13 books', books:[
        ['Romans','The gospel laid out in full',16],
        ['1 Corinthians','Order, love, and resurrection hope',16],
        ['2 Corinthians','Strength made perfect in weakness',13],
        ['Galatians','Free in Christ — live by the Spirit',6],
        ['Ephesians','Who you are in Christ',6],
        ['Philippians','Joy in every circumstance',4],
        ['Colossians','Christ above all',4],
        ['1 Thessalonians','Living ready for His return',5],
        ['2 Thessalonians','Stand firm, keep working',3],
        ['1 Timothy','Shepherding the church',6],
        ['2 Timothy','Finish the race, keep the faith',4],
        ['Titus','Sound doctrine, good works',3],
        ['Philemon','Grace between brothers',1],
      ]},
      { title:'General Letters', sub:'8 books', books:[
        ['Hebrews','Jesus is better — hold fast',13],
        ['James','Faith that works',5],
        ['1 Peter','Hope through suffering',5],
        ['2 Peter','Grow in grace and truth',3],
        ['1 John','That you may know you have life',5],
        ['2 John','Walking in truth and love',1],
        ['3 John','Faithfulness in the small things',1],
        ['Jude','Contend for the faith',1],
      ]},
      { title:'Prophecy', sub:'1 book', books:[
        ['Revelation','The Lamb wins — every tear wiped away',22],
      ]},
    ],
  },

  /* a phrase → reference map standing in for semantic search */
  search: [
    { q:['water into wine','wedding','cana','first miracle'], ref:'John 2', label:'Water into wine' },
    { q:['fear not','do not fear','afraid','anxiety','anxious'], ref:'Isaiah 41', label:'Fear not, I am with you' },
    { q:['shepherd','valley','green pastures','psalm 23'], ref:'Psalm 23', label:'The Lord is my shepherd' },
    { q:['in the beginning','creation','let there be light'], ref:'Genesis 1', label:'In the beginning' },
    { q:['word made flesh','in the beginning was the word','logos'], ref:'John 1', label:'The Word made flesh' },
    { q:['love','more than conquerors','nothing can separate'], ref:'Romans 8', label:'Nothing can separate us' },
    { q:['be anxious for nothing','peace','do not worry','rejoice'], ref:'Philippians 4', label:'The peace of God' },
    { q:['come to me','rest','weary','burdened'], ref:'Matthew 11', label:'Come to me, and rest' },
  ],

  /* real public-domain text for showcase passages (full chapter streams at merge) */
  lib: {
    'Psalm 23': {
      heading:'A Psalm of David',
      verses:[
        { n:1, KJV:'The LORD is my shepherd; I shall not want.', WEB:'Yahweh is my shepherd; I shall lack nothing.', ASV:'Jehovah is my shepherd; I shall not want.' },
        { n:2, KJV:'He maketh me to lie down in green pastures: he leadeth me beside the still waters.', WEB:'He makes me lie down in green pastures. He leads me beside still waters.', ASV:'He maketh me to lie down in green pastures; He leadeth me beside still waters.' },
        { n:3, KJV:'He restoreth my soul: he leadeth me in the paths of righteousness for his name’s sake.', WEB:'He restores my soul. He guides me in the paths of righteousness for his name’s sake.', ASV:'He restoreth my soul: He guideth me in the paths of righteousness for his name’s sake.' },
        { n:4, KJV:'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.', WEB:'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.', ASV:'Yea, though I walk through the valley of the shadow of death, I will fear no evil; for thou art with me; Thy rod and thy staff, they comfort me.' },
        { n:5, KJV:'Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.', WEB:'You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup runs over.', ASV:'Thou preparest a table before me in the presence of mine enemies: Thou hast anointed my head with oil; My cup runneth over.' },
        { n:6, KJV:'Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.', WEB:'Surely goodness and loving kindness shall follow me all the days of my life, and I will dwell in Yahweh’s house forever.', ASV:'Surely goodness and lovingkindness shall follow me all the days of my life; And I shall dwell in the house of Jehovah for ever.' },
      ]
    },
    'John 1': {
      heading:'The Word became flesh',
      verses:[
        { n:1, KJV:'In the beginning was the Word, and the Word was with God, and the Word was God.', WEB:'In the beginning was the Word, and the Word was with God, and the Word was God.', ASV:'In the beginning was the Word, and the Word was with God, and the Word was God.' },
        { n:2, KJV:'The same was in the beginning with God.', WEB:'The same was in the beginning with God.', ASV:'The same was in the beginning with God.' },
        { n:3, KJV:'All things were made by him; and without him was not any thing made that was made.', WEB:'All things were made through him. Without him, nothing was made that has been made.', ASV:'All things were made through him; and without him was not anything made that hath been made.' },
        { n:4, KJV:'In him was life; and the life was the light of men.', WEB:'In him was life, and the life was the light of men.', ASV:'In him was life; and the life was the light of men.' },
        { n:5, KJV:'And the light shineth in darkness; and the darkness comprehended it not.', WEB:'The light shines in the darkness, and the darkness hasn’t overcome it.', ASV:'And the light shineth in the darkness; and the darkness apprehended it not.' },
        { n:14, KJV:'And the Word was made flesh, and dwelt among us, (and we beheld his glory, the glory as of the only begotten of the Father,) full of grace and truth.', WEB:'The Word became flesh and lived among us. We saw his glory, such glory as of the one and only Son of the Father, full of grace and truth.', ASV:'And the Word became flesh, and dwelt among us (and we beheld his glory, glory as of the only begotten from the Father), full of grace and truth.' },
      ]
    },
    'John 2': {
      heading:'Water into wine',
      verses:[
        { n:1, KJV:'And the third day there was a marriage in Cana of Galilee; and the mother of Jesus was there:', WEB:'The third day, there was a wedding in Cana of Galilee. Jesus’ mother was there.', ASV:'And the third day there was a marriage in Cana of Galilee; and the mother of Jesus was there:' },
        { n:7, KJV:'Jesus saith unto them, Fill the waterpots with water. And they filled them up to the brim.', WEB:'Jesus said to them, “Fill the water pots with water.” So they filled them up to the brim.', ASV:'Jesus saith unto them, Fill the waterpots with water. And they filled them up to the brim.' },
        { n:11, KJV:'This beginning of miracles did Jesus in Cana of Galilee, and manifested forth his glory; and his disciples believed on him.', WEB:'This beginning of his signs Jesus did in Cana of Galilee, and revealed his glory; and his disciples believed in him.', ASV:'This beginning of his signs did Jesus in Cana of Galilee, and manifested his glory; and his disciples believed on him.' },
      ]
    },
    'Genesis 1': {
      heading:'In the beginning',
      verses:[
        { n:1, KJV:'In the beginning God created the heaven and the earth.', WEB:'In the beginning, God created the heavens and the earth.', ASV:'In the beginning God created the heavens and the earth.' },
        { n:2, KJV:'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.', WEB:'The earth was formless and empty. Darkness was on the surface of the deep and God’s Spirit was hovering over the surface of the waters.', ASV:'And the earth was waste and void; and darkness was upon the face of the deep: and the Spirit of God moved upon the face of the waters.' },
        { n:3, KJV:'And God said, Let there be light: and there was light.', WEB:'God said, “Let there be light,” and there was light.', ASV:'And God said, Let there be light: and there was light.' },
      ]
    },
    'Isaiah 41': {
      heading:'Fear not, for I am with you',
      verses:[
        { n:10, KJV:'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.', WEB:'Don’t you be afraid, for I am with you. Don’t be dismayed, for I am your God. I will strengthen you. Yes, I will help you. Yes, I will uphold you with the right hand of my righteousness.', ASV:'Fear thou not, for I am with thee; be not dismayed, for I am thy God; I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.' },
        { n:13, KJV:'For I the LORD thy God will hold thy right hand, saying unto thee, Fear not; I will help thee.', WEB:'For I, Yahweh your God, will hold your right hand, saying to you, ‘Don’t be afraid. I will help you.’', ASV:'For I, Jehovah thy God, will hold thy right hand, saying unto thee, Fear not; I will help thee.' },
      ]
    },
    'Romans 8': {
      heading:'More than conquerors',
      verses:[
        { n:38, KJV:'For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,', WEB:'For I am persuaded that neither death, nor life, nor angels, nor principalities, nor things present, nor things to come, nor powers,', ASV:'For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor things present, nor things to come, nor powers,' },
        { n:39, KJV:'Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.', WEB:'nor height, nor depth, nor any other created thing, will be able to separate us from God’s love which is in Christ Jesus our Lord.', ASV:'nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.' },
      ]
    },
    'Philippians 4': {
      heading:'The peace of God',
      verses:[
        { n:6, KJV:'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.', WEB:'In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God.', ASV:'In nothing be anxious; but in everything by prayer and supplication with thanksgiving let your requests be made known unto God.' },
        { n:7, KJV:'And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.', WEB:'And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.', ASV:'And the peace of God, which passeth all understanding, shall guard your hearts and your thoughts in Christ Jesus.' },
      ]
    },
    'Matthew 11': {
      heading:'Come to me, and rest',
      verses:[
        { n:28, KJV:'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', WEB:'Come to me, all you who labor and are heavily burdened, and I will give you rest.', ASV:'Come unto me, all ye that labor and are heavy laden, and I will give you rest.' },
        { n:29, KJV:'Take my yoke upon you, and learn of me; for I am meek and lowly in heart: and ye shall find rest unto your souls.', WEB:'Take my yoke upon you and learn from me, for I am gentle and lowly in heart; and you will find rest for your souls.', ASV:'Take my yoke upon you, and learn of me; for I am meek and lowly in heart: and ye shall find rest unto your souls.' },
        { n:30, KJV:'For my yoke is easy, and my burden is light.', WEB:'For my yoke is easy, and my burden is light.', ASV:'For my yoke is easy, and my burden is light.' },
      ]
    },
  }
};
