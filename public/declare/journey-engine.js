/* =========================================================================
   JOURNEY ENGINE  —  Declare & Believe
   Generates a fresh, never-the-same 5-day deliverance plan, one day at a time.
   Voice: Jesus gently listening and helping. Gets to the root. Transformation.

   Hybrid: tries the app's Cloudflare Worker (live AI). If it is unavailable, slow,
   rate-limited, or returns anything unparseable, it returns null and the app
   falls back to its authored bank. Scripture is kept trustworthy by having the
   model choose from a vetted ESV verse bank and quote it exactly.

   window.JourneyEngine
     .arc(struggleId)            -> array of 5 theme strings (shuffled middle)
     .generateDay(opts)          -> Promise<dayObj|null>
        opts = { struggleId, dayIndex(0-4), theme, seed }
   ========================================================================= */
(function(){
  // ---- vetted ESV verse banks (quoted exactly) ----
  var VERSES={
    shame:[
      {ref:'Romans 8:1', ver:'ESV', text:'There is therefore now no condemnation for those who are in Christ Jesus.'},
      {ref:'Isaiah 1:18', ver:'ESV', text:'Though your sins are like scarlet, they shall be as white as snow; though they are red like crimson, they shall become like wool.'},
      {ref:'Psalm 103:12', ver:'ESV', text:'As far as the east is from the west, so far does he remove our transgressions from us.'},
      {ref:'1 John 1:9', ver:'ESV', text:'If we confess our sins, he is faithful and just to forgive us our sins and to cleanse us from all unrighteousness.'},
      {ref:'2 Corinthians 5:17', ver:'ESV', text:'If anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come.'},
      {ref:'Psalm 34:5', ver:'ESV', text:'Those who look to him are radiant, and their faces shall never be ashamed.'},
      {ref:'Romans 8:15', ver:'ESV', text:'You have received the Spirit of adoption as sons, by whom we cry, \u201cAbba! Father!\u201d'},
      {ref:'Micah 7:19', ver:'ESV', text:'He will again have compassion on us; he will tread our iniquities underfoot. You will cast all our sins into the depths of the sea.'},
      {ref:'Psalm 103:4', ver:'ESV', text:'Who redeems your life from the pit, who crowns you with steadfast love and mercy.'},
      {ref:'Genesis 3:9', ver:'ESV', text:'But the LORD God called to the man and said to him, \u201cWhere are you?\u201d'},
      {ref:'Hebrews 10:22', ver:'ESV', text:'Let us draw near with a true heart in full assurance of faith, with our hearts sprinkled clean from an evil conscience.'},
      {ref:'Zephaniah 3:17', ver:'ESV', text:'The LORD your God is in your midst, a mighty one who will save; he will rejoice over you with gladness; he will quiet you by his love.'}
    ],
    anxiety:[
      {ref:'Philippians 4:6\u20137', ver:'ESV', text:'Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.'},
      {ref:'1 Peter 5:7', ver:'ESV', text:'Casting all your anxieties on him, because he cares for you.'},
      {ref:'Isaiah 26:3', ver:'ESV', text:'You keep him in perfect peace whose mind is stayed on you, because he trusts in you.'},
      {ref:'Matthew 6:34', ver:'ESV', text:'Do not be anxious about tomorrow, for tomorrow will be anxious for itself. Sufficient for the day is its own trouble.'},
      {ref:'John 14:27', ver:'ESV', text:'Peace I leave with you; my peace I give to you. Not as the world gives do I give to you. Let not your hearts be troubled, neither let them be afraid.'},
      {ref:'Psalm 94:19', ver:'ESV', text:'When the cares of my heart are many, your consolations cheer my soul.'},
      {ref:'Matthew 11:28', ver:'ESV', text:'Come to me, all who labor and are heavy laden, and I will give you rest.'},
      {ref:'Isaiah 41:10', ver:'ESV', text:'Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you, I will uphold you with my righteous right hand.'}
    ],
    fear:[
      {ref:'2 Timothy 1:7', ver:'ESV', text:'God gave us a spirit not of fear but of power and love and self-control.'},
      {ref:'Isaiah 41:10', ver:'ESV', text:'Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you, I will uphold you with my righteous right hand.'},
      {ref:'Psalm 91:4', ver:'ESV', text:'He will cover you with his pinions, and under his wings you will find refuge; his faithfulness is a shield and buckler.'},
      {ref:'1 John 4:18', ver:'ESV', text:'There is no fear in love, but perfect love casts out fear. For fear has to do with punishment.'},
      {ref:'Joshua 1:9', ver:'ESV', text:'Be strong and courageous. Do not be frightened, and do not be dismayed, for the LORD your God is with you wherever you go.'},
      {ref:'Psalm 27:1', ver:'ESV', text:'The LORD is my light and my salvation; whom shall I fear? The LORD is the stronghold of my life; of whom shall I be afraid?'},
      {ref:'Deuteronomy 31:6', ver:'ESV', text:'Be strong and courageous. Do not fear or be in dread of them, for it is the LORD your God who goes with you. He will not leave you or forsake you.'},
      {ref:'Psalm 56:3', ver:'ESV', text:'When I am afraid, I put my trust in you.'}
    ],
    rejection:[
      {ref:'Ephesians 1:6', ver:'ESV', text:'To the praise of his glorious grace, with which he has blessed us in the Beloved.'},
      {ref:'John 6:37', ver:'ESV', text:'All that the Father gives me will come to me, and whoever comes to me I will never cast out.'},
      {ref:'Jeremiah 1:5', ver:'ESV', text:'Before I formed you in the womb I knew you, and before you were born I consecrated you.'},
      {ref:'John 15:15', ver:'ESV', text:'No longer do I call you servants\u2026 but I have called you friends.'},
      {ref:'Psalm 27:10', ver:'ESV', text:'For my father and my mother have forsaken me, but the LORD will take me in.'},
      {ref:'1 Peter 2:9', ver:'ESV', text:'You are a chosen race, a royal priesthood, a holy nation, a people for his own possession.'},
      {ref:'Isaiah 43:1', ver:'ESV', text:'Fear not, for I have redeemed you; I have called you by name, you are mine.'},
      {ref:'Romans 8:38\u201339', ver:'ESV', text:'Neither death nor life\u2026 nor anything else in all creation, will be able to separate us from the love of God in Christ Jesus our Lord.'}
    ],
    loneliness:[
      {ref:'Hebrews 13:5', ver:'ESV', text:'I will never leave you nor forsake you.'},
      {ref:'Matthew 28:20', ver:'ESV', text:'Behold, I am with you always, to the end of the age.'},
      {ref:'Psalm 68:6', ver:'ESV', text:'God settles the solitary in a home.'},
      {ref:'John 14:18', ver:'ESV', text:'I will not leave you as orphans; I will come to you.'},
      {ref:'Psalm 25:16', ver:'ESV', text:'Turn to me and be gracious to me, for I am lonely and afflicted.'},
      {ref:'Psalm 139:7', ver:'ESV', text:'Where shall I go from your Spirit? Or where shall I flee from your presence?'},
      {ref:'Deuteronomy 31:6', ver:'ESV', text:'It is the LORD your God who goes with you. He will not leave you or forsake you.'},
      {ref:'Zephaniah 3:17', ver:'ESV', text:'The LORD your God is in your midst, a mighty one who will save; he will rejoice over you with gladness.'}
    ],
    anger:[
      {ref:'Ephesians 4:26', ver:'ESV', text:'Be angry and do not sin; do not let the sun go down on your anger.'},
      {ref:'James 1:19\u201320', ver:'ESV', text:'Let every person be quick to hear, slow to speak, slow to anger; for the anger of man does not produce the righteousness of God.'},
      {ref:'Proverbs 15:1', ver:'ESV', text:'A soft answer turns away wrath, but a harsh word stirs up anger.'},
      {ref:'Ephesians 4:31\u201332', ver:'ESV', text:'Let all bitterness and wrath and anger\u2026 be put away from you\u2026 forgiving one another, as God in Christ forgave you.'},
      {ref:'Romans 12:19', ver:'ESV', text:'Beloved, never avenge yourselves\u2026 \u201cVengeance is mine, I will repay, says the Lord.\u201d'},
      {ref:'Proverbs 19:11', ver:'ESV', text:'Good sense makes one slow to anger, and it is his glory to overlook an offense.'},
      {ref:'Psalm 37:8', ver:'ESV', text:'Refrain from anger, and forsake wrath! Fret not yourself; it tends only to evil.'},
      {ref:'Colossians 3:8', ver:'ESV', text:'But now you must put them all away: anger, wrath, malice, slander.'}
    ],
    doubt:[
      {ref:'Mark 9:24', ver:'ESV', text:'I believe; help my unbelief!'},
      {ref:'Hebrews 11:1', ver:'ESV', text:'Now faith is the assurance of things hoped for, the conviction of things not seen.'},
      {ref:'2 Timothy 2:13', ver:'ESV', text:'If we are faithless, he remains faithful\u2014for he cannot deny himself.'},
      {ref:'James 1:6', ver:'ESV', text:'But let him ask in faith, with no doubting, for the one who doubts is like a wave of the sea.'},
      {ref:'John 20:27', ver:'ESV', text:'Do not disbelieve, but believe.'},
      {ref:'Romans 10:17', ver:'ESV', text:'So faith comes from hearing, and hearing through the word of Christ.'},
      {ref:'Isaiah 40:31', ver:'ESV', text:'But they who wait for the LORD shall renew their strength; they shall mount up with wings like eagles.'},
      {ref:'Jude 1:22', ver:'ESV', text:'And have mercy on those who doubt.'}
    ],
    grief:[
      {ref:'Psalm 34:18', ver:'ESV', text:'The LORD is near to the brokenhearted and saves the crushed in spirit.'},
      {ref:'Matthew 5:4', ver:'ESV', text:'Blessed are those who mourn, for they shall be comforted.'},
      {ref:'Revelation 21:4', ver:'ESV', text:'He will wipe away every tear from their eyes, and death shall be no more, neither shall there be mourning, nor crying, nor pain anymore.'},
      {ref:'Psalm 147:3', ver:'ESV', text:'He heals the brokenhearted and binds up their wounds.'},
      {ref:'John 11:35', ver:'ESV', text:'Jesus wept.'},
      {ref:'2 Corinthians 1:3\u20134', ver:'ESV', text:'The God of all comfort, who comforts us in all our affliction.'},
      {ref:'Psalm 30:5', ver:'ESV', text:'Weeping may tarry for the night, but joy comes with the morning.'},
      {ref:'1 Thessalonians 4:13', ver:'ESV', text:'That you may not grieve as others do who have no hope.'}
    ],
    depression:[
      {ref:'Psalm 42:11', ver:'ESV', text:'Why are you cast down, O my soul\u2026 Hope in God; for I shall again praise him, my salvation and my God.'},
      {ref:'Psalm 40:2', ver:'ESV', text:'He drew me up from the pit of destruction\u2026 and set my feet upon a rock, making my steps secure.'},
      {ref:'Psalm 3:3', ver:'ESV', text:'But you, O LORD, are a shield about me, my glory, and the lifter of my head.'},
      {ref:'Lamentations 3:22\u201323', ver:'ESV', text:'His mercies\u2026 are new every morning; great is your faithfulness.'},
      {ref:'Matthew 11:28', ver:'ESV', text:'Come to me, all who labor and are heavy laden, and I will give you rest.'},
      {ref:'Psalm 34:18', ver:'ESV', text:'The LORD is near to the brokenhearted and saves the crushed in spirit.'},
      {ref:'Isaiah 41:10', ver:'ESV', text:'Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you.'},
      {ref:'2 Corinthians 4:8\u20139', ver:'ESV', text:'We are afflicted in every way, but not crushed; perplexed, but not driven to despair.'}
    ],
    addiction:[
      {ref:'1 Corinthians 10:13', ver:'ESV', text:'God is faithful, and he will not let you be tempted beyond your ability, but with the temptation he will also provide the way of escape.'},
      {ref:'John 8:36', ver:'ESV', text:'So if the Son sets you free, you will be free indeed.'},
      {ref:'Romans 6:6', ver:'ESV', text:'We know that our old self was crucified with him\u2026 so that we would no longer be enslaved to sin.'},
      {ref:'Galatians 5:1', ver:'ESV', text:'For freedom Christ has set us free; stand firm therefore, and do not submit again to a yoke of slavery.'},
      {ref:'Romans 6:14', ver:'ESV', text:'For sin will have no dominion over you, since you are not under law but under grace.'},
      {ref:'Philippians 4:13', ver:'ESV', text:'I can do all things through him who strengthens me.'},
      {ref:'2 Corinthians 5:17', ver:'ESV', text:'If anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come.'},
      {ref:'Psalm 40:2', ver:'ESV', text:'He drew me up from the pit of destruction\u2026 and set my feet upon a rock.'}
    ],
    marriage:[
      {ref:'1 Corinthians 13:4\u20135', ver:'ESV', text:'Love is patient and kind\u2026 it is not irritable or resentful.'},
      {ref:'Colossians 3:13\u201314', ver:'ESV', text:'Bearing with one another and\u2026 forgiving each other\u2026 And above all these put on love, which binds everything together in perfect harmony.'},
      {ref:'Ephesians 4:2\u20133', ver:'ESV', text:'With all humility and gentleness, with patience, bearing with one another in love.'},
      {ref:'Ecclesiastes 4:12', ver:'ESV', text:'A threefold cord is not quickly broken.'},
      {ref:'Mark 10:9', ver:'ESV', text:'What therefore God has joined together, let not man separate.'},
      {ref:'1 Peter 4:8', ver:'ESV', text:'Above all, keep loving one another earnestly, since love covers a multitude of sins.'},
      {ref:'Romans 12:18', ver:'ESV', text:'If possible, so far as it depends on you, live peaceably with all.'},
      {ref:'Philippians 2:3', ver:'ESV', text:'In humility count others more significant than yourselves.'}
    ],
    unforgiveness:[
      {ref:'Ephesians 4:32', ver:'ESV', text:'Be kind to one another, tenderhearted, forgiving one another, as God in Christ forgave you.'},
      {ref:'Colossians 3:13', ver:'ESV', text:'Forgiving each other; as the Lord has forgiven you, so you also must forgive.'},
      {ref:'Mark 11:25', ver:'ESV', text:'And whenever you stand praying, forgive, if you have anything against anyone.'},
      {ref:'Matthew 6:14', ver:'ESV', text:'For if you forgive others their trespasses, your heavenly Father will also forgive you.'},
      {ref:'Matthew 18:21\u201322', ver:'ESV', text:'I do not say to you seven times, but seventy-seven times.'},
      {ref:'Hebrews 12:15', ver:'ESV', text:'See to it\u2026 that no root of bitterness springs up and causes trouble.'},
      {ref:'Luke 6:37', ver:'ESV', text:'Forgive, and you will be forgiven.'},
      {ref:'1 Peter 3:9', ver:'ESV', text:'Do not repay evil for evil or reviling for reviling, but on the contrary, bless.'}
    ],
    sexual:[
      {ref:'1 Corinthians 6:19–20', ver:'ESV', text:'Your body is a temple of the Holy Spirit within you… You are not your own, for you were bought with a price. So glorify God in your body.'},
      {ref:'1 Corinthians 10:13', ver:'ESV', text:'God is faithful, and he will not let you be tempted beyond your ability, but with the temptation he will also provide the way of escape, that you may be able to endure it.'},
      {ref:'2 Timothy 2:22', ver:'ESV', text:'So flee youthful passions and pursue righteousness, faith, love, and peace, along with those who call on the Lord from a pure heart.'},
      {ref:'Psalm 51:10', ver:'ESV', text:'Create in me a clean heart, O God, and renew a right spirit within me.'},
      {ref:'Galatians 5:16', ver:'ESV', text:'But I say, walk by the Spirit, and you will not gratify the desires of the flesh.'},
      {ref:'Romans 13:14', ver:'ESV', text:'But put on the Lord Jesus Christ, and make no provision for the flesh, to gratify its desires.'},
      {ref:'Matthew 5:8', ver:'ESV', text:'Blessed are the pure in heart, for they shall see God.'},
      {ref:'Hebrews 4:16', ver:'ESV', text:'Let us then with confidence draw near to the throne of grace, that we may receive mercy and find grace to help in time of need.'}
    ],
    abuse:[
      {ref:'Isaiah 54:17', ver:'ESV', text:'No weapon that is fashioned against you shall succeed, and you shall refute every tongue that rises against you in judgment.'},
      {ref:'Psalm 139:14', ver:'ESV', text:'I praise you, for I am fearfully and wonderfully made. Wonderful are your works; my soul knows it very well.'},
      {ref:'Psalm 147:3', ver:'ESV', text:'He heals the brokenhearted and binds up their wounds.'},
      {ref:'Psalm 34:18', ver:'ESV', text:'The LORD is near to the brokenhearted and saves the crushed in spirit.'},
      {ref:'Psalm 31:20', ver:'ESV', text:'In the cover of your presence you hide them from the plots of men; you store them in your shelter from the strife of tongues.'},
      {ref:'1 Peter 2:9', ver:'ESV', text:'You are a chosen race, a royal priesthood, a holy nation, a people for his own possession.'},
      {ref:'Romans 8:1', ver:'ESV', text:'There is therefore now no condemnation for those who are in Christ Jesus.'},
      {ref:'Zephaniah 3:17', ver:'ESV', text:'The LORD your God is in your midst, a mighty one who will save; he will rejoice over you with gladness; he will quiet you by his love.'}
    ],
    divorce:[
      {ref:'Psalm 34:18', ver:'ESV', text:'The LORD is near to the brokenhearted and saves the crushed in spirit.'},
      {ref:'Deuteronomy 31:6', ver:'ESV', text:'It is the LORD your God who goes with you. He will not leave you or forsake you.'},
      {ref:'Psalm 73:26', ver:'ESV', text:'My flesh and my heart may fail, but God is the strength of my heart and my portion forever.'},
      {ref:'Isaiah 43:18–19', ver:'ESV', text:'Remember not the former things… Behold, I am doing a new thing; now it springs forth, do you not perceive it?'},
      {ref:'Jeremiah 29:11', ver:'ESV', text:'For I know the plans I have for you, declares the LORD, plans for welfare and not for evil, to give you a future and a hope.'},
      {ref:'Psalm 27:10', ver:'ESV', text:'For my father and my mother have forsaken me, but the LORD will take me in.'},
      {ref:'Psalm 46:1', ver:'ESV', text:'God is our refuge and strength, a very present help in trouble.'},
      {ref:'Isaiah 41:10', ver:'ESV', text:'Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you.'}
    ],
    faithcrisis:[
      {ref:'Hebrews 6:19', ver:'ESV', text:'We have this as a sure and steadfast anchor of the soul, a hope that enters into the inner place behind the curtain.'},
      {ref:'2 Timothy 2:13', ver:'ESV', text:'If we are faithless, he remains faithful—for he cannot deny himself.'},
      {ref:'Mark 9:24', ver:'ESV', text:'I believe; help my unbelief!'},
      {ref:'John 6:68', ver:'ESV', text:'Lord, to whom shall we go? You have the words of eternal life.'},
      {ref:'Jude 1:24', ver:'ESV', text:'Now to him who is able to keep you from stumbling and to present you blameless before the presence of his glory with great joy.'},
      {ref:'Lamentations 3:22–23', ver:'ESV', text:'His mercies… are new every morning; great is your faithfulness.'},
      {ref:'Psalm 42:11', ver:'ESV', text:'Why are you cast down, O my soul… Hope in God; for I shall again praise him, my salvation and my God.'},
      {ref:'Isaiah 40:31', ver:'ESV', text:'But they who wait for the LORD shall renew their strength; they shall mount up with wings like eagles.'}
    ],
    spiritualattack:[
      {ref:'Ephesians 6:11', ver:'ESV', text:'Put on the whole armor of God, that you may be able to stand against the schemes of the devil.'},
      {ref:'1 John 4:4', ver:'ESV', text:'Little children, you are from God and have overcome them, for he who is in you is greater than he who is in the world.'},
      {ref:'James 4:7', ver:'ESV', text:'Submit yourselves therefore to God. Resist the devil, and he will flee from you.'},
      {ref:'Isaiah 54:17', ver:'ESV', text:'No weapon that is fashioned against you shall succeed, and you shall refute every tongue that rises against you in judgment.'},
      {ref:'Luke 10:19', ver:'ESV', text:'Behold, I have given you authority… over all the power of the enemy, and nothing shall hurt you.'},
      {ref:'Romans 8:37', ver:'ESV', text:'In all these things we are more than conquerors through him who loved us.'},
      {ref:'Colossians 2:15', ver:'ESV', text:'He disarmed the rulers and authorities and put them to open shame, by triumphing over them in him.'},
      {ref:'Psalm 91:1–2', ver:'ESV', text:'He who dwells in the shelter of the Most High will abide in the shadow of the Almighty. I will say to the LORD, My refuge and my fortress, my God, in whom I trust.'}
    ],
    failure:[
      {ref:'2 Corinthians 12:9', ver:'ESV', text:'My grace is sufficient for you, for my power is made perfect in weakness.'},
      {ref:'Philippians 1:6', ver:'ESV', text:'He who began a good work in you will bring it to completion at the day of Jesus Christ.'},
      {ref:'Micah 7:8', ver:'ESV', text:'When I fall, I shall rise; when I sit in darkness, the LORD will be a light to me.'},
      {ref:'Proverbs 24:16', ver:'ESV', text:'The righteous falls seven times and rises again, but the wicked stumble in times of calamity.'},
      {ref:'Psalm 37:24', ver:'ESV', text:'Though he fall, he shall not be cast headlong, for the LORD upholds his hand.'},
      {ref:'Romans 8:1', ver:'ESV', text:'There is therefore now no condemnation for those who are in Christ Jesus.'}
    ],
    comparison:[
      {ref:'Galatians 6:4', ver:'ESV', text:'Let each one test his own work, and then his reason to boast will be in himself alone and not in his neighbor.'},
      {ref:'2 Corinthians 10:12', ver:'ESV', text:'When they measure themselves by one another and compare themselves with one another, they are without understanding.'},
      {ref:'Psalm 139:14', ver:'ESV', text:'I praise you, for I am fearfully and wonderfully made.'},
      {ref:'Ephesians 2:10', ver:'ESV', text:'We are his workmanship, created in Christ Jesus for good works, which God prepared beforehand.'},
      {ref:'1 Corinthians 12:18', ver:'ESV', text:'God arranged the members in the body, each one of them, as he chose.'},
      {ref:'Jeremiah 1:5', ver:'ESV', text:'Before I formed you in the womb I knew you, and before you were born I consecrated you.'}
    ],
    unworthy:[
      {ref:'Isaiah 43:4', ver:'ESV', text:'You are precious in my eyes, and honored, and I love you.'},
      {ref:'Ephesians 2:10', ver:'ESV', text:'We are his workmanship, created in Christ Jesus for good works.'},
      {ref:'1 Peter 2:9', ver:'ESV', text:'You are a chosen race, a royal priesthood, a holy nation, a people for his own possession.'},
      {ref:'Romans 5:8', ver:'ESV', text:'God shows his love for us in that while we were still sinners, Christ died for us.'},
      {ref:'Luke 12:7', ver:'ESV', text:'Even the hairs of your head are all numbered. Fear not; you are of more value than many sparrows.'},
      {ref:'Ephesians 1:4', ver:'ESV', text:'He chose us in him before the foundation of the world, that we should be holy and blameless before him.'}
    ],
    identity:[
      {ref:'2 Corinthians 5:17', ver:'ESV', text:'If anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come.'},
      {ref:'John 1:12', ver:'ESV', text:'But to all who did receive him… he gave the right to become children of God.'},
      {ref:'Galatians 2:20', ver:'ESV', text:'It is no longer I who live, but Christ who lives in me.'},
      {ref:'Ephesians 1:5', ver:'ESV', text:'He predestined us for adoption to himself as sons through Jesus Christ.'},
      {ref:'Colossians 3:3', ver:'ESV', text:'For you have died, and your life is hidden with Christ in God.'},
      {ref:'Isaiah 43:1', ver:'ESV', text:'Fear not, for I have redeemed you; I have called you by name, you are mine.'}
    ],
    lost:[
      {ref:'Psalm 23:3', ver:'ESV', text:'He restores my soul. He leads me in paths of righteousness for his name’s sake.'},
      {ref:'Proverbs 3:5–6', ver:'ESV', text:'Trust in the LORD with all your heart… and he will make straight your paths.'},
      {ref:'John 10:27', ver:'ESV', text:'My sheep hear my voice, and I know them, and they follow me.'},
      {ref:'Psalm 32:8', ver:'ESV', text:'I will instruct you and teach you in the way you should go; I will counsel you with my eye upon you.'},
      {ref:'Isaiah 30:21', ver:'ESV', text:'Your ears shall hear a word behind you, saying, This is the way, walk in it.'},
      {ref:'Psalm 119:105', ver:'ESV', text:'Your word is a lamp to my feet and a light to my path.'}
    ],
    peoplepleasing:[
      {ref:'Galatians 1:10', ver:'ESV', text:'If I were still trying to please man, I would not be a servant of Christ.'},
      {ref:'Proverbs 29:25', ver:'ESV', text:'The fear of man lays a snare, but whoever trusts in the LORD is safe.'},
      {ref:'Colossians 3:23', ver:'ESV', text:'Whatever you do, work heartily, as for the Lord and not for men.'},
      {ref:'John 12:43', ver:'ESV', text:'For they loved the glory that comes from man more than the glory that comes from God.'},
      {ref:'1 Thessalonians 2:4', ver:'ESV', text:'We speak, not to please man, but to please God who tests our hearts.'},
      {ref:'Psalm 118:6', ver:'ESV', text:'The LORD is on my side; I will not fear. What can man do to me?'}
    ],
    betrayal:[
      {ref:'Psalm 55:12–14', ver:'ESV', text:'It is not an enemy who taunts me… but it is you, a man, my equal, my companion, my familiar friend.'},
      {ref:'Psalm 41:9', ver:'ESV', text:'Even my close friend in whom I trusted, who ate my bread, has lifted his heel against me.'},
      {ref:'Genesis 50:20', ver:'ESV', text:'As for you, you meant evil against me, but God meant it for good.'},
      {ref:'Psalm 27:10', ver:'ESV', text:'For my father and my mother have forsaken me, but the LORD will take me in.'},
      {ref:'Psalm 56:8', ver:'ESV', text:'You have kept count of my tossings; put my tears in your bottle. Are they not in your book?'},
      {ref:'Isaiah 61:7', ver:'ESV', text:'Instead of your shame there shall be a double portion… they shall have everlasting joy.'}
    ],
    selfsabotage:[
      {ref:'Romans 7:15', ver:'ESV', text:'For I do not understand my own actions. For I do not do what I want, but I do the very thing I hate.'},
      {ref:'Romans 8:1', ver:'ESV', text:'There is therefore now no condemnation for those who are in Christ Jesus.'},
      {ref:'Philippians 1:6', ver:'ESV', text:'He who began a good work in you will bring it to completion at the day of Jesus Christ.'},
      {ref:'Psalm 37:23–24', ver:'ESV', text:'The steps of a man are established by the LORD… though he fall, he shall not be cast headlong.'},
      {ref:'Galatians 5:1', ver:'ESV', text:'For freedom Christ has set us free; stand firm therefore.'},
      {ref:'Romans 6:14', ver:'ESV', text:'For sin will have no dominion over you, since you are not under law but under grace.'}
    ],
    family:[
      {ref:'Romans 12:18', ver:'ESV', text:'If possible, so far as it depends on you, live peaceably with all.'},
      {ref:'Matthew 5:9', ver:'ESV', text:'Blessed are the peacemakers, for they shall be called sons of God.'},
      {ref:'Ephesians 4:2–3', ver:'ESV', text:'With all humility and gentleness, with patience, bearing with one another in love.'},
      {ref:'Colossians 3:13', ver:'ESV', text:'Bearing with one another and… forgiving each other; as the Lord has forgiven you, so you also must forgive.'},
      {ref:'Proverbs 15:1', ver:'ESV', text:'A soft answer turns away wrath, but a harsh word stirs up anger.'},
      {ref:'James 3:18', ver:'ESV', text:'And a harvest of righteousness is sown in peace by those who make peace.'}
    ],
    overthinking:[
      {ref:'Isaiah 26:3', ver:'ESV', text:'You keep him in perfect peace whose mind is stayed on you, because he trusts in you.'},
      {ref:'2 Corinthians 10:5', ver:'ESV', text:'We destroy arguments… and take every thought captive to obey Christ.'},
      {ref:'Philippians 4:8', ver:'ESV', text:'Whatever is true… honorable… lovely… think about these things.'},
      {ref:'Psalm 94:19', ver:'ESV', text:'When the cares of my heart are many, your consolations cheer my soul.'},
      {ref:'Romans 12:2', ver:'ESV', text:'Be transformed by the renewal of your mind.'},
      {ref:'Colossians 3:2', ver:'ESV', text:'Set your minds on things that are above, not on things that are on earth.'}
    ],
    control:[
      {ref:'Proverbs 3:5–6', ver:'ESV', text:'Trust in the LORD with all your heart, and do not lean on your own understanding.'},
      {ref:'Psalm 46:10', ver:'ESV', text:'Be still, and know that I am God.'},
      {ref:'Proverbs 16:9', ver:'ESV', text:'The heart of man plans his way, but the LORD establishes his steps.'},
      {ref:'James 4:13–14', ver:'ESV', text:'You do not know what tomorrow will bring… you are a mist that appears for a little time.'},
      {ref:'1 Peter 5:7', ver:'ESV', text:'Casting all your anxieties on him, because he cares for you.'},
      {ref:'Matthew 6:34', ver:'ESV', text:'Do not be anxious about tomorrow, for tomorrow will be anxious for itself.'}
    ],
    perfectionism:[
      {ref:'2 Corinthians 12:9', ver:'ESV', text:'My grace is sufficient for you, for my power is made perfect in weakness.'},
      {ref:'Ephesians 2:8–9', ver:'ESV', text:'By grace you have been saved through faith… not a result of works, so that no one may boast.'},
      {ref:'Philippians 1:6', ver:'ESV', text:'He who began a good work in you will bring it to completion.'},
      {ref:'Zechariah 4:10', ver:'ESV', text:'For who has despised the day of small things?'},
      {ref:'Colossians 2:10', ver:'ESV', text:'And you have been filled in him, who is the head of all rule and authority.'},
      {ref:'Psalm 103:14', ver:'ESV', text:'For he knows our frame; he remembers that we are dust.'}
    ],
    burnout:[
      {ref:'Matthew 11:28–29', ver:'ESV', text:'Come to me, all who labor and are heavy laden, and I will give you rest… and you will find rest for your souls.'},
      {ref:'Psalm 23:2–3', ver:'ESV', text:'He makes me lie down in green pastures. He leads me beside still waters. He restores my soul.'},
      {ref:'Exodus 33:14', ver:'ESV', text:'My presence will go with you, and I will give you rest.'},
      {ref:'Isaiah 40:31', ver:'ESV', text:'They who wait for the LORD shall renew their strength… they shall run and not be weary.'},
      {ref:'Psalm 127:2', ver:'ESV', text:'It is in vain that you rise up early… for he gives to his beloved sleep.'},
      {ref:'Mark 6:31', ver:'ESV', text:'Come away by yourselves to a desolate place and rest a while.'}
    ],
    dryness:[
      {ref:'Psalm 42:1–2', ver:'ESV', text:'As a deer pants for flowing streams, so pants my soul for you, O God. My soul thirsts for God.'},
      {ref:'John 7:37–38', ver:'ESV', text:'If anyone thirsts, let him come to me and drink… Out of his heart will flow rivers of living water.'},
      {ref:'Isaiah 44:3', ver:'ESV', text:'I will pour water on the thirsty land… I will pour my Spirit upon your offspring.'},
      {ref:'Psalm 63:1', ver:'ESV', text:'O God, you are my God; earnestly I seek you; my soul thirsts for you… in a dry and weary land.'},
      {ref:'John 4:14', ver:'ESV', text:'The water that I will give him will become in him a spring of water welling up to eternal life.'},
      {ref:'Jeremiah 17:8', ver:'ESV', text:'He is like a tree planted by water… it does not cease to bear fruit.'}
    ],
    waiting:[
      {ref:'Isaiah 40:31', ver:'ESV', text:'They who wait for the LORD shall renew their strength; they shall mount up with wings like eagles.'},
      {ref:'Psalm 27:14', ver:'ESV', text:'Wait for the LORD; be strong, and let your heart take courage; wait for the LORD!'},
      {ref:'Psalm 130:5', ver:'ESV', text:'I wait for the LORD, my soul waits, and in his word I hope.'},
      {ref:'Lamentations 3:25', ver:'ESV', text:'The LORD is good to those who wait for him, to the soul who seeks him.'},
      {ref:'Habakkuk 2:3', ver:'ESV', text:'If it seems slow, wait for it; it will surely come; it will not delay.'},
      {ref:'Psalm 37:7', ver:'ESV', text:'Be still before the LORD and wait patiently for him.'}
    ],
    financial:[
      {ref:'Philippians 4:19', ver:'ESV', text:'And my God will supply every need of yours according to his riches in glory in Christ Jesus.'},
      {ref:'Matthew 6:31–33', ver:'ESV', text:'Do not be anxious… seek first the kingdom of God… and all these things will be added to you.'},
      {ref:'Proverbs 3:9–10', ver:'ESV', text:'Honor the LORD with your wealth… then your barns will be filled with plenty.'},
      {ref:'Hebrews 13:5', ver:'ESV', text:'Keep your life free from love of money, and be content… I will never leave you nor forsake you.'},
      {ref:'Matthew 6:26', ver:'ESV', text:'Look at the birds of the air… your heavenly Father feeds them. Are you not of more value than they?'},
      {ref:'2 Corinthians 9:8', ver:'ESV', text:'God is able to make all grace abound to you, so that… you may abound in every good work.'}
    ],
    drifting:[
      {ref:'James 4:8', ver:'ESV', text:'Draw near to God, and he will draw near to you.'},
      {ref:'Hebrews 2:1', ver:'ESV', text:'We must pay much closer attention to what we have heard, lest we drift away from it.'},
      {ref:'Luke 15:20', ver:'ESV', text:'While he was still a long way off, his father saw him and felt compassion, and ran and embraced him.'},
      {ref:'Hosea 6:1', ver:'ESV', text:'Come, let us return to the LORD… that he may heal us; he has struck down, and he will bind us up.'},
      {ref:'Revelation 2:4–5', ver:'ESV', text:'You have abandoned the love you had at first. Remember therefore… and repent, and do the works you did at first.'},
      {ref:'Jeremiah 31:3', ver:'ESV', text:'I have loved you with an everlasting love; therefore I have continued my faithfulness to you.'}
    ]
  };

  // ---- per-struggle "brief" the model reasons from ----
  var BRIEF={
    shame:'This person carries BOTH shame and guilt, and they are different. Shame is the lie about identity: \u201cI am bad, defective, unworthy, beyond repair.\u201d Guilt is the lie about a debt: \u201cI did bad, I owe, I must pay it back to be loved.\u201d The world keeps score, the enemy whispers you are what you did, pride agrees that this is just who you are, and so they hide and sometimes blame others. The truth: in Christ there is no condemnation, the debt is paid (not owed), and they are washed clean, fully known, deeply loved, and made new \u2014 a beloved child of God.',
    anxiety:'This person believes it is all on them to hold everything together, that the future is a threat they must control, and that if they stop bracing, disaster comes. The truth: God is near, He invites them to hand it over, and His peace guards a mind stayed on Him \u2014 they are held.',
    fear:'This person feels exposed, alone, and unsafe, pulling back from what God is calling them to. The truth: God has not given a spirit of fear but of power, love, and a sound mind; He is with them and goes before them \u2014 they are safe and can step forward.',
    rejection:'This person believes they must perform to be accepted and that they will be cast out if the real them is seen. The truth: they are chosen and accepted in the Beloved, known before birth, called friend, and God will never cast them out \u2014 they belong.',
    loneliness:'This person feels unseen, forgotten, and fundamentally alone \u2014 as if no one is truly with them and no one would notice if they disappeared. The truth: God is always present, He settles the solitary into family, He never leaves nor forsakes, and in Christ they are companioned, seen, and held.',
    anger:'This person carries a heat that feels justified, often masking a deeper hurt or fear underneath; bitterness keeps the record and the world says vent it, pride says they have every right. The truth: God sees the wound beneath the wrath, invites them to surrender the offense and the right to repay, and grows real peace \u2014 they can be slow to anger and free of bitterness.',
    doubt:'This person\u2019s faith feels thin and they fear God may not be real, good, or coming through; the enemy whispers that honest questions disqualify them. The truth: Jesus welcomes honest doubt, faith is trust rather than certainty, and God stays faithful even when they waver \u2014 \u201cI believe; help my unbelief.\u201d',
    grief:'This person carries a heavy sorrow over loss and often feels alone in it, as if the weight will never lift and joy is gone for good. The truth: God is near the brokenhearted, Jesus wept too, He keeps every tear and is the God of all comfort \u2014 they grieve, but with hope.',
    depression:'This person feels a deadening heaviness and the lie that it will always be dark, that they are a burden, that even God feels distant. The truth: God is near in the very pit, He lifts the head, His mercies are new every morning, and hope rests in Him rather than in how they feel right now.',
    addiction:'This person feels enslaved to a craving that promises comfort and quietly steals their freedom; shame says they are too far gone to change. The truth: in Christ they are no longer a slave to sin, the Son sets free indeed, and God always provides a way of escape \u2014 they are being set free one honest day at a time.',
    marriage:'This person is carrying hurt, distance, or resentment in their marriage, tempted to believe it is beyond repair or entirely the other person\u2019s fault. The truth: God restores, He calls them to love as Christ loved \u2014 patient, forgiving, bearing with \u2014 and a cord bound with Him is not quickly broken.',
    unforgiveness:'This person is holding an offense, and a root of bitterness has grown; it feels like releasing it would let the other person off the hook. The truth: forgiveness hands the debt to God who repays, mirrors the mercy they have received, and frees the one held captive \u2014 them \u2014 without excusing the wrong.',
    sexual:'This person is caught in a cycle of sexual temptation — lust or pornography — that promises intimacy or relief and leaves shame, secrecy, and isolation. The lies: this is harmless and just meets a need; I’m too dirty now to be wanted by God; I’ll never be free; I have to hide this. The truth: their body is a temple, bought at a price; God always provides a way of escape; in Christ they are made clean, and grace draws near in the very moment of temptation; they can walk by the Spirit, pure and free. Speak with zero condemnation, deep compassion, and honest hope.',
    abuse:'This person has absorbed cruel, controlling, or demeaning words and now wears them as their identity, believing the lies an abuser spoke: you’re worthless, too much, the problem, unlovable, it’s your fault. The truth: those are tongues that rise against them in judgment, and God says they shall refute every one; they are fearfully and wonderfully made, chosen, God’s own possession; the Lord is near the brokenhearted, is against the abuse, and is a shelter from the strife of tongues. Be tender and protective, never blame them, affirm their God-given worth, and honor that seeking safety and help is wise and godly — never counsel them to remain in danger.',
    divorce:'This person is walking through the breaking of a marriage — divorce or separation — carrying grief, a sense of failure, rejection, and fear of the future all at once. The lies: I am a failure, no one will want me, I am alone now, God is disappointed in me, my future is ruined. The truth: God is near the brokenhearted, He has not forsaken them, He is their portion when everything else falls away, and He can make a new thing even here — they are held through the breaking and their future is still in His hands. Be gentle; never assign blame or pressure any outcome.',
    faithcrisis:'This person’s faith is in crisis — God feels absent, prayers feel unanswered, and they wonder if any of it is real or whether they’ve lost their faith for good. The lies: God has left me, my faith is gone and won’t return, my doubts have disqualified me, I am falling away. The truth: their hope is an anchor for the soul, sure and steadfast; God remains faithful when they cannot; He keeps them from falling; and even in the dark night He is holding on to them. Speak honestly and tenderly, without pat answers.',
    spiritualattack:'This person feels spiritually attacked — oppressed, harassed by fear or accusation, sensing darkness pressing in. The lies: the enemy is winning, I’m defenseless, this darkness is stronger than me, I’m on my own in this. The truth: greater is He who is in them than he who is in the world; they are clothed in the armor of God; the enemy was already disarmed and defeated at the cross; when they resist in Jesus’ name the enemy flees, and no weapon formed against them shall prosper. Speak with calm authority and assurance, never fear.',
    failure:'This person feels defined by their failures and setbacks — the lie that they are a failure, that they always mess things up, that God is disappointed and the future is more of the same. The truth: God’s power is perfected in weakness, He finishes what He starts in them, and the righteous fall and rise again — a fall is an event, not their identity.',
    comparison:'This person measures themselves against everyone else and always comes up short — the lie that others are ahead, more gifted, more loved, and they are behind and less-than. The truth: God made them on purpose, uniquely, and assigned them their own portion; their worth and calling were never meant to be weighed against another’s.',
    unworthy:'This person feels fundamentally unworthy of love, attention, or good things — the lie that they don’t deserve to be wanted and must stay small. The truth: they are God’s workmanship, precious and honored in His eyes, chosen before the foundation of the world; their worth was set by God’s love, not earned.',
    identity:'This person has a fractured sense of self — the lie that they don’t know who they are, that they’re broken at the core, a patchwork of other people’s definitions. The truth: in Christ they are a new creation, a child of God, hidden with Christ, called by name — their truest identity is given by God, whole and secure.',
    lost:'This person feels directionless and lost — the lie that there’s no path, no purpose, and no one leading them. The truth: the Good Shepherd restores their soul, guides their steps, and speaks the way to walk in; they are not wandering alone — they are led.',
    peoplepleasing:'This person is ruled by the fear of man, shaping themselves to win approval and terrified of disappointing anyone — the lie that their safety and worth depend on everyone being pleased with them. The truth: trusting the Lord is the safe place, they live for an audience of One, and they are freed from the snare of needing every person’s approval.',
    betrayal:'This person was betrayed by someone close, and trust feels shattered — the lie that no one is safe, they were a fool to trust, and the wound will define them. The truth: God sees the betrayal, keeps every tear, can turn what was meant for evil into good, and takes them in when others fall away — they can heal and trust again, anchored in Him.',
    selfsabotage:'This person keeps undermining their own good — the lie that they are their own worst enemy, hopelessly stuck doing the very things they hate. The truth: like Paul, the war within is real, but there is no condemnation in Christ, sin has no dominion, and the One who began a good work will finish it — they can walk in freedom, step by step.',
    family:'This person is caught in painful family conflict — the lie that the tension is unfixable and it’s all on them, or all on the others. The truth: God calls them a peacemaker, asks only for the part that depends on them — humility, patience, forgiveness — and sows a harvest of righteousness through those who make peace.',
    overthinking:'This person’s mind races and loops, replaying conversations and spinning worst-case scenarios — the lie that if they just think hard enough they can control the outcome, and that the spinning is keeping them safe. The truth: God keeps in perfect peace the mind stayed on Him, they can take each thought captive to Christ, and a renewed mind finds rest it cannot think its way into.',
    control:'This person grips tightly to control every outcome, exhausted by carrying what was never theirs to hold — the lie that if they let go, everything falls apart. The truth: they can trust the Lord rather than lean on their own understanding, be still and know He is God, and cast the weight on the One who actually holds tomorrow.',
    perfectionism:'This person is driven by perfectionism, never enough, terrified of mistakes and of being found lacking — the lie that their worth rides on flawless performance. The truth: God’s power is perfected in weakness, grace is a gift not a wage, He does not despise small beginnings, and He who started the good work will finish it — they are free to be faithful, not flawless.',
    burnout:'This person is running on empty, stretched thin, burned out and unable to stop — the lie that rest is laziness and everything depends on them keeping going. The truth: Jesus invites the weary to come and find rest for their souls, His presence goes with them and gives rest, and He gives to His beloved even sleep — they are allowed to stop and be restored.',
    dryness:'This person feels spiritually dry — prayer feels empty, God feels distant, the joy has gone out of faith. The lie says the dryness means God has withdrawn or their faith has died. The truth: their thirst itself is a sign of life, Jesus invites the thirsty to come and drink, and He pours water on dry ground — rivers of living water are promised to the one who keeps coming to Him.',
    waiting:'This person is worn down by a long season of waiting on God — the lie that the delay means no, that they’ve been forgotten, that nothing is happening. The truth: those who wait on the Lord renew their strength, He is good to those who wait, and the promise will surely come and not delay — waiting is not wasted; it is where strength and hope are renewed.',
    financial:'This person is under heavy financial stress, anxious about provision and the future — the lie that it all rests on them and that lack defines their security and worth. The truth: God supplies every need according to His riches, He feeds the birds and values them far more, and He has promised never to leave them — they can seek first His kingdom and trust their Provider.',
    drifting:'This person has drifted from God — prayer faded, the first love cooled, and now distance and guilt keep them away. The lie says they’ve wandered too far to return and God is done with them. The truth: the Father runs to the returning child, He loves with an everlasting love, and the moment they draw near He draws near to them — it is never too late to come home.'
  };

  // ---- theme arcs: day 1 + day 5 fixed, middle 3 shuffled from a pool ----
  var ARC={
    shame:{
      first:'Name the two voices and bring both to Jesus: shame says \u201cI am bad,\u201d guilt says \u201cI did bad.\u201d He is listening.',
      last:'A new name and a new creation \u2014 beloved, forgiven, and free.',
      pool:[
        'No condemnation \u2014 the accusation has no standing over you',
        'Guilt\u2019s debt is paid in full \u2014 you owe nothing to earn love',
        'Shame\u2019s label peeled off \u2014 you are not your worst moment',
        'Out of hiding \u2014 confessed, cleansed, and unashamed',
        'Self-contempt is not humility \u2014 He lifts your head',
        'Mercy remembers your sin no more \u2014 as far as east from west',
        'Adopted, not on trial \u2014 you cry \u201cAbba, Father\u201d',
        'The blame ends \u2014 you stop hiding and stop accusing'
      ]
    },
    anxiety:{
      first:'Bring the racing mind to Jesus and name what you are bracing against.',
      last:'A mind at rest, kept in His peace \u2014 you are held.',
      pool:['Hand it over \u2014 the great exchange of worry for peace','Cast the weight \u2014 He cares for you','Fix your focus \u2014 a mind stayed on Him','Just today \u2014 grace for this hour only','Come and rest \u2014 the unforced rhythm of grace','His peace, not the world\u2019s \u2014 untroubled hearts']
    },
    fear:{
      first:'Bring the fear into the open before Jesus \u2014 name what you have been avoiding.',
      last:'A step forward in courage \u2014 He goes with you.',
      pool:['Not fear, but power, love, and a sound mind','You are not alone \u2014 His companion presence','Under His shelter \u2014 His faithfulness your shield','Perfect love casts out fear','Drop the defenses \u2014 rest in His safety','Be strong \u2014 He goes before you']
    },
    rejection:{
      first:'Bring the ache of rejection to Jesus \u2014 whose approval have you been chasing?',
      last:'Taken in for good \u2014 you belong.',
      pool:['Accepted in the Beloved \u2014 chosen, not earning','He will never cast you out','Known before you were born \u2014 by design','Called friend, not outsider','A chosen people \u2014 you have a place','Called by name \u2014 you are His']
    },
    loneliness:{
      first:'Bring the loneliness to Jesus and name where you have felt unseen.',
      last:'Companioned and held \u2014 you were never truly alone.',
      pool:['He will never leave you \u2014 a constant presence','Settled into family \u2014 you have a home','Seen and named \u2014 not forgotten','He is with you always, to the end','Nowhere is apart from His presence','An adopted heart \u2014 not an orphan']
    },
    anger:{
      first:'Bring the anger honestly to Jesus \u2014 and the hurt or fear hiding under it.',
      last:'A heart at peace \u2014 the offense surrendered, bitterness released.',
      pool:['Slow to anger \u2014 quick to hear','Hand Him the right to repay \u2014 vengeance is His','Tear out the root of bitterness','A soft answer over a harsh one','Put it away \u2014 wrath laid down','Overlook the offense \u2014 it is your glory']
    },
    doubt:{
      first:'Bring your honest questions to Jesus \u2014 He is not afraid of them.',
      last:'Steadied in trust \u2014 He is faithful even when you waver.',
      pool:['\u201cI believe; help my unbelief\u201d','Faith is trust, not certainty','He remains faithful when you are faithless','Feed faith on His Word','Wait on the LORD \u2014 strength renewed','Mercy meets the doubter']
    },
    grief:{
      first:'Bring your sorrow to Jesus \u2014 He weeps with you, He does not rush you.',
      last:'Comforted and carried \u2014 grief held in hope.',
      pool:['He is near the brokenhearted','Every tear kept \u2014 none wasted','Comforted to comfort others','Mourning will turn to morning','He binds up the wounds','Grief, but not without hope']
    },
    depression:{
      first:'Bring the heaviness to Jesus \u2014 He is near in the dark, not distant.',
      last:'Head lifted \u2014 hope set on Him, not on the feeling.',
      pool:['He is the lifter of your head','Drawn up from the pit, feet on rock','Mercies new every morning','Come and rest \u2014 the burden shared','Near to the crushed in spirit','Afflicted, but not crushed']
    },
    addiction:{
      first:'Bring the craving and the shame to Jesus \u2014 honestly, into the light.',
      last:'Free indeed \u2014 no longer a slave, standing in grace.',
      pool:['A way of escape always provided','No longer enslaved \u2014 the old self crucified','For freedom you were set free','Sin has no dominion over you','Strength to stand in Him','Drawn up from the pit']
    },
    marriage:{
      first:'Bring the hurt and distance to Jesus \u2014 not your case against them.',
      last:'Covenant love restored \u2014 a cord bound with Him.',
      pool:['Love is patient, not resentful','Bear with \u2014 and forgive as you were forgiven','Love covers a multitude','Count the other as significant','Live at peace as far as you can','What God joined, let none separate']
    },
    unforgiveness:{
      first:'Bring the offense to Jesus \u2014 name what was taken and how it hurt.',
      last:'Released and free \u2014 the debt handed to God.',
      pool:['Forgive as you were forgiven','Hand the debt to God \u2014 He repays','Pull the root of bitterness','Seventy-seven times \u2014 mercy unmeasured','Bless instead of repay','Forgive, and you are freed']
    },
    sexual:{
      first:'Bring it honestly into the light with Jesus — no more secret shame.',
      last:'Pure in heart and free — walking by the Spirit.',
      pool:['Your body is a temple — bought at a price','A way of escape is always there','Flee the passion, pursue the good','A clean heart — grace after the fall','Make no provision for the flesh','Draw near to grace in the moment of need']
    },
    abuse:{
      first:'Bring the words that wounded to Jesus — He calls them lies, not your name.',
      last:'Safe and beloved — your worth restored by God, not their voice.',
      pool:['You will refute every tongue against you','Fearfully and wonderfully made','He is near the brokenhearted and heals','A shelter from the strife of tongues','Chosen — God’s own possession','No condemnation — it was never your fault']
    },
    divorce:{
      first:'Bring the grief and the sense of failure to Jesus — He is near the brokenhearted.',
      last:'Held through the breaking — your future still in His hands.',
      pool:['He has not forsaken you','He is your portion when all else fails','Not a failure — held by grace','A new thing, even here','The LORD takes you in','A very present help in trouble']
    },
    faithcrisis:{
      first:'Bring your honest crisis to Jesus — He is not afraid of it.',
      last:'Anchored — held even in the dark.',
      pool:['An anchor for the soul, sure and steadfast','He remains faithful when you can’t','Where else would you go? He has the words of life','He keeps you from falling','Mercies new even now','Hope in God again']
    },
    spiritualattack:{
      first:'Stand and bring the battle to Jesus — the victory is already His.',
      last:'Covered and victorious — the enemy is under His feet.',
      pool:['Greater is He who is in you','Resist, and the enemy flees','No weapon against you will prosper','Clothed in the armor of God','Disarmed and defeated at the cross','More than a conqueror']
    },
    failure:{ first:'Bring your failures honestly to Jesus — He is not disappointed in you.', last:'Held in grace — you rise again, not defined by the fall.', pool:['No condemnation over the failure','His power perfected in your weakness','The righteous fall and rise again','He finishes what He started in you','He upholds your hand when you fall'] },
    comparison:{ first:'Bring the comparing to Jesus — name who you’ve measured yourself against.', last:'Secure in Christ — your worth no longer weighed against another.', pool:['Made fearfully and wonderfully, on purpose','Your own portion — not your neighbor’s','His workmanship, with your own good works','Set in the body exactly as He chose','Known and consecrated before birth'] },
    unworthy:{ first:'Bring the feeling of unworthiness to Jesus — He calls you precious.', last:'Worthy in Christ — your value set by His love.', pool:['Precious and honored in His eyes','His workmanship, made on purpose','Chosen before the foundation of the world','Loved while still a sinner','Of more value than many sparrows'] },
    identity:{ first:'Bring your fractured sense of self to Jesus — He knows your true name.', last:'Whole in Christ — your identity given by God.', pool:['A new creation — the old gone','A child of God by right','Christ lives in you','Your life hidden with Christ','Called by name — you are His'] },
    lost:{ first:'Bring your lostness to Jesus — the Shepherd is already leading.', last:'Found and guided — led step by step.', pool:['He restores your soul','He makes your paths straight','My sheep hear my voice','He counsels you with His eye on you','His word a lamp to your feet'] },
    peoplepleasing:{ first:'Bring the fear of man to Jesus — whose approval have you been chasing?', last:'Free to obey God — living for an audience of One.', pool:['The fear of man is a snare; trusting God is safe','You serve Christ, not the crowd','Work as for the Lord, not for men','Seek the glory that comes from God','The LORD is on your side — what can man do?'] },
    betrayal:{ first:'Bring the betrayal to Jesus — name what was broken.', last:'Trusting again — healed and held by the One who stays.', pool:['He sees — your tears are in His bottle','Meant for evil, but God meant it for good','He takes you in when others forsake','A double portion instead of shame','He is near the brokenhearted'] },
    selfsabotage:{ first:'Bring the war within honestly to Jesus — no condemnation here.', last:'Walking in freedom — the good work being finished in you.', pool:['No condemnation — even for this','Sin has no dominion over you','He finishes what He started','He upholds you when you fall','For freedom you were set free'] },
    family:{ first:'Bring the family conflict to Jesus — not your case against them.', last:'A peacemaker — sowing peace where there was strife.', pool:['Blessed are the peacemakers','So far as it depends on you, live at peace','Bear with and forgive as you were forgiven','A soft answer turns away wrath','A harvest of righteousness sown in peace'] },
    overthinking:{ first:'Bring the racing mind to Jesus \u2014 name the loop you\u2019re stuck in.', last:'A steadfast mind \u2014 kept in His perfect peace.', pool:['Perfect peace for a mind stayed on Him','Take every thought captive to Christ','Dwell on what is true and good','His consolations cheer your soul','A renewed mind, not a spinning one'] },
    control:{ first:'Bring your grip to Jesus \u2014 name what you\u2019re trying to control.', last:'Surrendered trust \u2014 He holds what you let go.', pool:['Trust Him, not your own understanding','Be still and know He is God','You plan, but He establishes your steps','Cast the weight \u2014 He cares for you','Tomorrow is already in His hands'] },
    perfectionism:{ first:'Bring the pressure to be perfect to Jesus \u2014 He loves you already.', last:'Free in grace \u2014 faithful, not flawless.', pool:['His power perfected in your weakness','Grace is a gift, not a wage','He does not despise small beginnings','Complete in Him, nothing to prove','He finishes what He started'] },
    burnout:{ first:'Bring your exhaustion to Jesus \u2014 you\u2019re allowed to stop.', last:'His rest \u2014 restored in soul and body.', pool:['Come to Me and find rest','He leads you beside still waters','His presence goes with you and gives rest','He gives His beloved sleep','Come away and rest a while'] },
    dryness:{ first:'Bring your dry, distant soul to Jesus \u2014 your thirst is a sign of life.', last:'Living water \u2014 rivers flowing again.', pool:['Your soul thirsts \u2014 come and drink','Water poured on the thirsty land','A spring welling up within you','Seek Him in the dry and weary land','Planted by water, bearing fruit again'] },
    waiting:{ first:'Bring the long wait to Jesus \u2014 name what you\u2019re still waiting for.', last:'Strengthened hope \u2014 the waiting not wasted.', pool:['Those who wait renew their strength','Be strong, take courage, wait for Him','In His word I hope','He is good to those who wait','It will surely come; it will not delay'] },
    financial:{ first:'Bring the financial weight to Jesus \u2014 name the fear under it.', last:'God my Provider \u2014 every need supplied in Him.', pool:['He supplies every need from His riches','Seek first the kingdom \u2014 the rest is added','He feeds the birds; you are worth more','He will never leave nor forsake you','Grace abounding for every good work'] },
    drifting:{ first:'Bring the distance honestly to Jesus \u2014 it is not too late.', last:'Drawn back home \u2014 the Father running to you.', pool:['Draw near, and He draws near to you','The Father runs to the returning child','Return to the LORD \u2014 He will heal','Loved with an everlasting love','Remember your first love, and come back'] }
  };

  // ---- composed fallback plan: an on-brand 5-day deliverance for ANY struggle, ----
  // ---- using that struggle's own vetted verses + arc + identity (used offline / when AI is unavailable).
  var FB_FRUIT=[
    {n:'Honesty',  t:'You brought it into the light.'},
    {n:'Surrender',t:'You handed it to Jesus.'},
    {n:'Trust',    t:'You leaned on Him, not the lie.'},
    {n:'Renewal',  t:'The new is taking root in you.'},
    {n:'Freedom',  t:'You are walking out as someone new.'}
  ];
  function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }
  function fallbackPlan(o){
    o=o||{}; var sid=o.struggleId||'shame';
    var themes=arc(sid, o.seed), verses=verseList(sid, o.seed);
    var fromL=(o.fromLabel||'this struggle').toLowerCase();
    var to=o.toLabel||'who God says you are', toL=to.toLowerCase();
    return themes.map(function(theme, i){
      var v=verses[i % verses.length];
      var head=theme.split(' \u2014 ')[0].replace(/[.:\u2014]\s*$/,'');
      var move=theme.split(' \u2014 ')[1] || theme;
      var title = i===0 ? 'Bring It to Jesus' : i===4 ? 'Rooted in the New' : (head.length>30 ? head.slice(0,30) : head);
      var fr=FB_FRUIT[i % FB_FRUIT.length];
      return {
        title:title, fruit:fr.n, fruitTruth:fr.t,
        ref:v.ref, ver:v.ver, verse:v.text,
        insight:'The old voice still wants the last word about who you are. '+cap(move)+'. Sit with Jesus in this verse and let the Spirit speak the truer thing over you, gently and without rushing. He is not finished with you \u2014 He is making you '+toL+'.',
        prayerTitle:'A Prayer',
        pray:'Father, meet me here in my '+fromL+'. I bring You the part of me that still believes the old story, and I ask You to speak Your truth louder than it. In Jesus\u2019 name, Amen.',
        castOff:'The lie says my '+fromL+' is the truest thing about me \u2014 that this is just who I am, and it will never change.',
        repent:'Lord, I turn from agreeing with that lie. I lay it down, and I receive what You say about me instead.',
        declare:'I am not defined by my '+fromL+'. In Christ I am '+to+', and that is who I am becoming.',
        reflect:'Where did the old voice get loud today \u2014 and what is the truer word God is speaking in its place?',
        actionTitle:'Today\u2019s step',
        action:'Carry today\u2019s verse with you. When the old feeling rises, say your declaration out loud once, slowly, and breathe.'
      };
    });
  }

  function shuffle(a, rnd){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(rnd()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  function rng(seed){ var s=seed>>>0 || 1; return function(){ s^=s<<13; s^=s>>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }

  function arc(struggleId, seed){
    var A=ARC[struggleId]||ARC.shame; var rnd=rng(seed||Date.now());
    var mid=shuffle(A.pool, rnd).slice(0,3);
    return [A.first].concat(mid).concat([A.last]);
  }

  function verseList(struggleId, seed){
    var v=VERSES[struggleId]||VERSES.shame; var rnd=rng((seed||1)+7);
    return shuffle(v, rnd);
  }

  function parseJSON(text, lang){
    var es = lang === 'es';
    if(!text) return null;
    try{
      var a=text.indexOf('{'), b=text.lastIndexOf('}');
      if(a<0||b<0) return null;
      var obj=JSON.parse(text.slice(a,b+1));
      var core=['title','verse','ref','insight','castOff','repent','declare','reflect','action'];
      for(var i=0;i<core.length;i++){ if(!obj[core[i]] || typeof obj[core[i]]!=='string') return null; }
      // strip stray markdown emphasis the model sometimes leaves in prose
      function clean(s){ return typeof s==='string' ? s.replace(/\*\*?([^*]+)\*\*?/g,'$1').replace(/\s+/g,' ').trim() : s; }
      ['title','verse','insight','pray','castOff','repent','declare','reflect','action','prayerTitle','actionTitle','fruit','fruitTruth'].forEach(function(k){ if(obj[k]) obj[k]=clean(obj[k]); });
      if(!obj.ver) obj.ver = es ? 'RVR1909' : 'ESV';
      if(es) obj.ver='RVR1909';
      // the model sometimes folds the version into the reference ("Romans 8:1 ESV"); split it out
      if(obj.ref){ var vm=obj.ref.match(/\s+(ESV|NIV|NKJV|KJV|NLT|NASB|CSB|AMP|RVR1909|RVR)\s*$/i);
        if(vm){ obj.ver=vm[1].toUpperCase(); obj.ref=obj.ref.slice(0, vm.index).trim(); } }
      if(!obj.pray) obj.pray=obj.repent;
      if(!obj.prayerTitle || obj.prayerTitle.toLowerCase()===String(obj.title).toLowerCase()) obj.prayerTitle = es ? 'Una oración' : 'A Prayer';
      if(!obj.actionTitle) obj.actionTitle = es ? 'El paso de hoy' : 'Today\u2019s step';
      if(!obj.fruit) obj.fruit=obj.title;
      if(!obj.fruitTruth) obj.fruitTruth='';
      return obj;
    }catch(e){ return null; }
  }

  function buildPrompt(o){
    var struggleId=o.struggleId, vlist=verseList(struggleId, o.seed).slice(0,7);
    var verseLines=vlist.map(function(v){ return '- ['+v.ref+' '+v.ver+'] \u201c'+v.text+'\u201d'; }).join('\n');
    var sg = struggleId==='shame' ? '\nThis chip covers BOTH shame and guilt. Where it fits today, gently help them feel the difference (shame = \u201cI am bad\u201d; guilt = \u201cI did bad / I owe\u201d) without lecturing, and bring both to Jesus.' : '';
    if (o.language === 'es') {
      var sgEs = struggleId==='shame' ? '\nEste tema cubre TANTO la vergüenza como la culpa. Donde encaje hoy, ayúdalo con ternura a sentir la diferencia (vergüenza = \u201csoy malo\u201d; culpa = \u201chice mal / debo\u201d) sin sermonear, y lleva ambas a Jesús.' : '';
      return [
        'Eres la voz de Jesús, sentándote con ternura junto a alguien para ayudarlo a salir de '+o.fromLabel+' hacia ser '+o.toLabel+'. Este es el Día '+(o.dayIndex+1)+' de un camino de liberación de 5 días en la app Declare & Believe.',
        'Habla con calidez y de forma personal, en el estilo de enseñanza de la pastora Yesenia Then: formación por encima del sentimentalismo (despiertas convicción, formas carácter, ordenas el proceso interno de la persona), fundamento bíblico con aplicación práctica, lenguaje de propósito y proceso (\u201cpropósito\u201d, \u201cproceso\u201d, \u201ccarácter\u201d, \u201cfundamento\u201d, \u201cavanza con determinación\u201d, \u201clo que Dios depositó en ti\u201d), cálida pero directa, y siempre activando a la persona a avanzar en fe con determinación. Nunca clínico, nunca un sermón vacío, nunca relleno devocional genérico. Ve a la RAÍZ de lo que carga. Esto es transformación real, ser libre, un día a la vez. Responde TODO en español (tú); no uses ni una palabra en inglés.',
        '',
        'Sobre esta lucha (contexto interno para tu razonamiento, no lo cites literal): '+(BRIEF[struggleId]||BRIEF.shame),
        'El movimiento de hoy: '+o.theme+sgEs,
        '',
        'Elige exactamente UN versículo de esta lista (por su referencia) y cítalo en la Reina-Valera 1909 (RVR1909), con su texto EXACTO en RVR1909 (español antiguo: \u201cvosotros\u201d, \u201cá\u201d, \u201cJehová\u201d). El campo \u201cref\u201d va en español y \u201cver\u201d:\u201cRVR1909\u201d. NUNCA inventes el texto: si no recuerdas la RVR1909 con exactitud, elige otra referencia de la lista que sí conozcas con precisión.',
        verseLines,
        '',
        'Devuelve SOLO JSON minificado (sin markdown, sin comentarios) con estas claves de texto:',
        '{"title","ref","ver","verse","insight","prayerTitle","pray","castOff","repent","declare","reflect","actionTitle","action","fruit","fruitTruth"}',
        'Guía (TODO en español, en la voz descrita):',
        '- title: 2 a 4 palabras, el corazón de hoy.',
        '- prayerTitle: 2 a 4 palabras. pray: una oración corta y honesta en primera persona al Padre (1 a 2 frases).',
        '- ref / ver / verse: la referencia elegida (en español), \u201cRVR1909\u201d, y el texto EXACTO en RVR1909.',
        '- insight: 40 a 65 palabras. Primero nombra cómo la mentira habla POR DENTRO (la voz del mundo, el susurro del enemigo, la vergüenza que dice \u201csoy malo\u201d, la culpa que dice \u201cdebo\u201d, el orgullo que dice \u201casí soy\u201d). Que duela de verdad. Luego voltea a este versículo y al Espíritu Santo hablando con ternura su verdadera identidad, formando carácter y ordenando su proceso. Termina activándolo a avanzar con determinación.',
        '- castOff: la mentira en su propia voz cruda, en primera persona (1 a 2 frases).',
        '- repent: una oración corta en primera persona que se aparta de creer la mentira.',
        '- declare: una verdad en primera persona para declarar EN VOZ ALTA, las palabras del Espíritu sobre él/ella.',
        '- reflect: una pregunta tierna y profunda.',
        '- actionTitle: 2 a 3 palabras. action: un paso pequeño y concreto para llevar al día de hoy.',
        '- fruit: 1 a 3 palabras de lo que crece hoy en él/ella. fruitTruth: una línea de 4 a 8 palabras.',
        'Mantén TODA la respuesta compacta para que sea JSON válido y completo. Haz de hoy algo DISTINTO y fresco; evita frases y clichés de apps cristianas. Escribe como para esta única persona. Semilla de variación: '+o.seed+'.'
      ].join('\n');
    }
    return [
      'You are the voice of Jesus, gently sitting with someone and helping them walk out of '+o.fromLabel+' into being '+o.toLabel+'. This is Day '+(o.dayIndex+1)+' of a 5-day deliverance journey in the Declare & Believe app.',
      'Speak warmly and personally, the way Jesus would listen and help \u2014 tender, unhurried, full of grace. Never clinical, never a sermon, never generic devotional filler. Get to the ROOT of what they carry. This is about real transformation and being set free, one day at a time.',
      '',
      'About this struggle: '+(BRIEF[struggleId]||BRIEF.shame),
      'Today\u2019s movement: '+o.theme+sg,
      '',
      'Choose exactly ONE verse from this list and quote it EXACTLY as written (do not alter a single word). Use its reference and version exactly:',
      verseLines,
      '',
      'Return ONLY minified JSON (no markdown, no commentary) with these string keys:',
      '{"title","ref","ver","verse","insight","prayerTitle","pray","castOff","repent","declare","reflect","actionTitle","action","fruit","fruitTruth"}',
      'Guidance:',
      '- title: 2 to 4 words, the heart of today.',
      '- prayerTitle: 2 to 4 words. pray: a short, honest first-person prayer to the Father (1 to 2 sentences).',
      '- ref / ver / verse: the chosen verse\u2019s reference, version, and exact text.',
      '- insight: 40 to 65 words. First, name how the lie actually talks INSIDE them \u2014 the world\u2019s voice, the enemy\u2019s whisper, shame\u2019s \u201cI am bad,\u201d guilt\u2019s \u201cI owe,\u201d pride\u2019s \u201cthis is just who you are.\u201d Make it ache true. Then turn to this verse and the Holy Spirit gently speaking their real identity. End in hope.',
      '- castOff: the lie in their OWN raw, first-person voice (1 to 2 sentences).',
      '- repent: a short first-person prayer turning from agreeing with the lie.',
      '- declare: a first-person truth to speak ALOUD, the Spirit\u2019s words over them.',
      '- reflect: one tender, searching question.',
      '- actionTitle: 2 to 3 words. action: one small, embodied act to take into today.',
      '- fruit: 1 to 3 words for what grows in them today. fruitTruth: a 4 to 8 word line.',
      'Keep the WHOLE response compact so it is complete valid JSON. Make today DISTINCT and fresh \u2014 avoid stock Christian-app phrases and clich\u00e9s. Write as if for this one person. Variation seed: '+o.seed+'.'
    ].join('\n');
  }

  /* Live generation goes through the app's Cloudflare Worker (the same
     Anthropic proxy /today uses — the API key never touches the browser).
     Non-streaming: one POST, parse content[0].text. Any failure, slow
     response, or unparseable reply resolves null and the authored bank
     already sitting in PLAN carries the day. */
  var WORKER='https://hope-finder-worker.thinktoro.workers.dev';
  function generateDay(o){
    return new Promise(function(resolve){
      var done=false;
      var to=setTimeout(function(){ if(!done){ done=true; resolve(null); } }, o.timeout||13000);
      try{
        fetch(WORKER, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({
            model:'claude-sonnet-4-6', // Journey runs on Sonnet 4.6 for deeper transformation; revert to 'claude-haiku-4-5-20251001' to flip back
            max_tokens:1500,
            temperature:0.9,
            messages:[{role:'user', content:buildPrompt(o)}]
          })
        }).then(function(r){ return r.ok ? r.json() : null; })
          .then(function(data){
            if(done) return; done=true; clearTimeout(to);
            var text=data && data.content && data.content[0] && data.content[0].text;
            resolve(parseJSON(text||'', o.language));
          })
          .catch(function(){ if(done) return; done=true; clearTimeout(to); resolve(null); });
      }catch(e){ if(!done){ done=true; clearTimeout(to); resolve(null); } }
    });
  }

  window.JourneyEngine={ arc:arc, generateDay:generateDay, fallbackPlan:fallbackPlan, VERSES:VERSES };
})();
