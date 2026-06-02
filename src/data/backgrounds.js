/* Declare & Believe — curated Unsplash banner backgrounds.
   Hotlinkable images.unsplash.com photos grouped by theme. No API key needed
   for direct photo URLs; swap for the Unsplash Search API when you add a key. */
  const base = (id, w, q) => 'https://images.unsplash.com/photo-' + id + '?auto=format&fit=crop&w=' + w + '&q=' + q;
  const photo = (id, by) => ({ id, by, full: base(id, 1000, 75), thumb: base(id, 360, 60) });

  export const DB_BACKGROUNDS = [
    {
      cat: 'Light & Sky',
      photos: [
        photo('1419242902214-272b3f66ee7a', 'Greg Rakozy'),
        photo('1444703686981-a3abbc4d4fe3', 'Jeremy Bishop'),
        photo('1502790671504-542ad42d5189', 'Sergei Akulich'),
        photo('1490730141103-6cac27aaab94', 'Aaron Burden'),
        photo('1495616811223-4d98c6e9c869', 'Ian Espinosa'),
        photo('1507400492013-162706c8c05e', 'Davide Cantelli'),
      ],
    },
    {
      cat: 'Mountains',
      photos: [
        photo('1506905925346-21bda4d32df4', 'Kalen Emsley'),
        photo('1469474968028-56623f02e42e', 'Joshua Earle'),
        photo('1472214103451-9374bd1c798e', 'Sven Scheuermeier'),
        photo('1454496522488-7a8e488e8606', 'Tim Stief'),
        photo('1426604966848-d7adac402bff', 'Bailey Zindel'),
        photo('1483728642387-6c3bdd6c93e5', 'Jonatan Pie'),
      ],
    },
    {
      cat: 'Forest',
      photos: [
        photo('1441974231531-c6227db76b6e', 'Sergei Akulich'),
        photo('1470071459604-3b5ec3a7fe05', 'David Marcu'),
        photo('1447752875215-b2761acb3c5d', 'Lukasz Szmigiel'),
        photo('1500382017468-9049fed747ef', 'Federico Respini'),
        photo('1448375240586-882707db888b', 'Casey Horner'),
        photo('1511497584788-876760111969', 'Sebastian Unrau'),
      ],
    },
    {
      cat: 'Ocean',
      photos: [
        photo('1507525428034-b723cf961d3e', 'Sean O. '),
        photo('1505118380757-91f5f5632de0', 'Shifaaz Shamoon'),
        photo('1518837695005-2083093ee35b', 'Silas Baisch'),
        photo('1439405326854-014607f694d7', 'Matt Hardy'),
        photo('1493558103817-58b2924bce98', 'Joseph Barrientos'),
        photo('1471922694854-ff1b63b20054', 'Linus Nylund'),
      ],
    },
    {
      cat: 'Calm & Abstract',
      photos: [
        photo('1490750967868-88aa4486c946', 'Annie Spratt'),
        photo('1500964757637-c85e8a162699', 'Joel Filipe'),
        photo('1462331940025-496dfbfc7564', 'NASA'),
        photo('1504333638930-c8787321eee0', 'Pawel Czerwinski'),
        photo('1517483000871-1dbf64a6e1c6', 'Sime Basioli'),
        photo('1508739773434-c26b3d09e071', 'Aaron Burden'),
      ],
    },
  ];
