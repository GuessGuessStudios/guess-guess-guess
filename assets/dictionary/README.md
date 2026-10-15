# Offline English Dictionary Data

This folder contains the dictionary foundation for future game features. The game does not use it yet.

- Source: English Speller Database (ESDB), formerly SCOWL
- Official repository: https://github.com/en-wl/wordlist
- Release: 2026.02.25 (`rel-2026.02.25`)
- Vocabulary size: 60 (the normal/default spell-checking level)
- Spelling selection: American English (`A`)
- Variant level: 1 (the official default American dictionary setting)
- Accents: deaccented for a practical plain-text game list
- Generated file: `en_US-size-60.txt`
- Entries: 109,902, one per line

Official generation command:

```text
./scowl --db scowl.db word-list 60 A 1 --deaccent > en_US-size-60.txt
```

`ESDB-Copyright.txt` is an unchanged copy of the copyright and permission notice supplied with the official release. Keep it with the dictionary data.

British, Canadian, Australian, and other regional spelling sets have not been merged. Those decisions are deliberately postponed.
