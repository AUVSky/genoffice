# Fonts

## The font lists

The font controls live on each editor's Home tab (below: the font group in Slides):

![The font group in the Slides ribbon](img/fonts.png)

Each editor's font picker merges: locally installed fonts + platform-common candidates (the usual Windows and macOS families, Western and CJK, including the localized names CJK fonts report on their home systems). When the system can enumerate local fonts the list groups by what actually exists; otherwise it degrades to the full candidate list.

## CJK typography

- CJK fonts in Docs get Word-aligned punctuation compression and kinsoku line rules (see the Docs chapter).
- The candidate list covers Simplified/Traditional Chinese, Japanese and Korean, serif and sans.

## Local fonts

- The install-local-font-files entry loads .ttf/.otf files from disk into the app font store.
- The store archives by family; multiple weights of one family coexist.
- This build has no online font catalog: every face comes from the system or from a file you install yourself.
