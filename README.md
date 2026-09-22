# Freedom Of Movement

Write games with save/load with just some text files.

A nostalgic romp through TI-83 Plus UI and a classifier model binding for open-ended gameplay.  Play via localstorage on [https://fm.discoverywritten.com](https://fm.discoverywritten.com).

## About

This is a pure React javascript application that loads static text files as the starting state and then presumes your game state overrides the default data.  Interactions in the world issue DOM events scoped to the targets, and the React components carry out the operation and let reactivity update the game map.

There is no state architecture beyond `useState()` and localstorage, somewhat as a proof that state management is about designing to your task, and may not require selector/mutation bloat to express itself in the clearest way.  We're also trusting naïve DOM events here to bus our data, but hackability is the proximate cause of what lies below the fold.  If you can throw events from the console, you might be able to make the game do stuff, and I hope that's fun to experience.

The main map files are basically text art, with a table of special coordinates and sprite names.  Using these hints, the game parses the flat map into solid, passable, and interactable layers, and then draws it like a TI-83 Plus with ASM-style greyscale might. Because of this conceit, the coordinate system from top to bottom is in a 1-based row/column format.

Following, as a happy accident, this means your text editor's cursor position is the actual coordinate, which makes the use of coordinates in sprite data less traumatic.

## Game
The current font is not a full clone of the TI-83 Plus, but it is easy to load and has most of the glyphs that enable this concept.

There are 3 displays, and all are active at all times, and have their own select/cancel mechanisms:

1. Status area (wasd, spacebar, escape)
2. World area (arrows, bumping into things selects, moving away implicitly deselects)
3. Menu area (jk, numbers, paging, enter, backspace)
4. (The bottom of this graphic features the inert message bar that will be re-enabled for communication with the classifier model soon.  If you want to picture what it's for, imagine the old Ultima games and you'll be on the right track.)

NPCs can offer a "Save" option and some flavor text, which uses localstorage on the character's name (Hero by default, but will appear `null` until saved).

Your most recent save will load automatically.  To Load some other save, you must talk with a Bard specifically, so good luck with that intentional game design.

<img width="1153" alt="Three displays: status, world, menu" src="https://github.com/user-attachments/assets/9d1119cc-a57d-4654-b30a-b5903e03b725">

This means that in the middle of Buying or Selling via the menu screen with an NPC you bumped on the world screen, you can browse your equipment or recent logs in the status screen without interrupting anything else going on.

## Visuals

Scrollable sub-menus help you make selections, while the menu system obstinately embraces TI calculator menu design language.

| Status Demo | Menu Demo |
| -- | -- |
| ![equipment-demo](https://github.com/user-attachments/assets/b8c5f93d-fbed-4221-99c4-0de3373f475c) | ![menu-demo](https://github.com/user-attachments/assets/1464b969-f020-42a8-80e6-a0fb7c821d72) |


The overlays in the game provide a kind of weather system with offset-based tiled animation and random chance to change to something else.  Overlays can also provide interior ambience.

| Interior zone | Global zones changing | Big |
| -- | -- | -- |
| ![interior (1)](https://github.com/user-attachments/assets/ca355e12-c90c-408c-b0bf-e5fd2756fc39) | ![exterior (1)](https://github.com/user-attachments/assets/23494421-096a-4a53-ae0f-e7ec8868ac08) | ![big (1)](https://github.com/user-attachments/assets/beeaedbe-1bc7-4389-a587-df9a7defb242) |


For whatever reason, I let you change the viewport dimensions. It'll probably break map design eventually.

The game is presently dumping its text and calculated values below the game panels as a demonstration of the static data system:

<img width="2320" alt="image" src="https://github.com/user-attachments/assets/5b6655a5-8b12-4e6f-ac21-64eb5c6e0915">

### Future goals

The in-memory classifier model is loaded but not currently receiving queries.  Before it can be enabled for any use, the classifier labels need to be honed in order to raise the model's clarity on intended effects:

- Positive/Negative effects brought on by weather, state of equipment, time of day
- NPC mood reactions to player actions
- Wear or unwear things as asked, including recent items, and quality/value comparisons for resolving decisions
- Offer hypothetical insights about targets that the game doesn't even track, to allow the player to invent the rules of success during play
- Drive additional player choices based on NPC description info, etc
- (TBD)

React application:

- The display buffer code was ["write-only"](https://7c0h.com/blog/new/write_only_code.html), suited to no one's brain but mine at the time, and not much longer.  I'm happy with my ideas but they must be re-expressed with tests, tasteful typing, and more comments that matter.
- Learn why [@welldone-software/why-did-you-render](https://github.com/welldone-software/why-did-you-render) got hard to use with my vite config
- Memoize components
- Maps and Story
- Magic skills cost HP
- No max HP, but the quality of the bed you use determines your HP when you wake up (This already works, but isn't widely deployed)
- Do better with the fight mode.  Right now it's a flattened eye-level view of the same space with contextual background, but there aren't attack options, and fighting a moving enemy is like chasing a caribou through a shopping mall.
- Add spells and targeting.  Magic is enabled by rings, which you can wear plenty of, but there are no spells yet
- Make the map visualizer editable locally, so that it becomes its own map builder
- Chests that contain items
- MULTIPLAYER???  DO I HAVE YOUR ATTENTION?  Let me know.
- It's not lost on me that for as many buttons as there are to push, it might map to a controller without hassle.
- I 'unno the first thing about talking to a TI calculator on modern hardware anymore, but it would be funny if I could push these game screens to the device and you use the calc hardware for the OG tactile experience.  The calculator has enough buttons on offer that it can switch between active screens.

### Static Format

Still tweaking things but the working examples are the templates I expand.

- [public/equipment/{kind}/{templateName}.txt](https://github.com/tiliv/fm/tree/main/public/equipment)
  - Equipment templates only supply a weapon class and sprite.  Templates have no rarity, power, or value assigned until they are referenced in an inventory list that relates that information.
- [public/interactions/{npcClass}/{npcId}.txt](https://github.com/tiliv/fm/tree/main/public/interactions)
  - Interactions are usually NPCs, but in the game core, fancy coordinates with events attached become interactions too.  Interaction tiles become full text files here to get the full set of actions, like Buy/Sell, which have custom formats that don't fit in the #key=value schema available to pure map tiles.  For example, the `Fight` block allows for current hp thresholds to activate different movement strategies, `Buy` determines an inventory list, and `Sell` determines which categories of items you can sell to that NPC.
  - There is currently no net loss of currency when you buy an item and sell it back (if you can sell it back, that is).
  - Action block names that are prefixed by `?` incidate a reactive event, i.e., they catch YOUR event with that name and hijack the response.  This may put you into a conversation state with someone you have not bumped against for typical interactions.
- [public/overlays/{overlayId}.txt](https://github.com/tiliv/fm/tree/main/public/overlays)
  - Overlays can be referenced in world files, either as a global default, or at specific [r1, c1, r2, c2] rectangles, and with an offset animation sequence that loops forever.  The text files are just the full overlay art to be tiled and scrolled over the world display.  The world file supplies the colors and animation.
- [public/world/{worldId}.txt](https://github.com/tiliv/fm/tree/main/public/world)
  - Worlds use a YAML-like multi-doc marker to separate the map art from the coordinate definitions.
  - Overlays are designated with their animation loop (if any), applicable area (or else implicitly global), color, and probability of triggering a different overlay as a replacement.  When overlay zones overlap, the most specific one should be last (i.e., global first, smallest last)
  - NPCs are baked into the static map art, and then that coordinate is used to associate an NPC data file containing its menu actions.
  - Objects can have idle animations, including specific movements for various ai states the NPC can be in.
  - Objects can have custom actions defined inline without (or in addition to) a text file.  All (most) menu actions dispatch an event named after them, with their menu data as context.  Nothing responds to most events yet (but the classifier model will help soon!), but the "Climb" (`Climb.player`) event was added to prove that only a coordinate and event name + message text are required to create dynamic interactivity.
  - Objects with names prefixed by `~` are considered "short", allowing them to act as pass-through tiles for talking to npcs across the other side.  In addition, you can climb short tiles.
  - Doors declare a second coordinate.  If a door has a `key` attribute, you need to be wearing that key as an equipped "ring" to bypass the lockout.
  - World Doors are just doors that also provide a new map id, meaning that the destination coordinate it gives should be in the row-column space of that new map.
  
### Developer docs

See [docs/](docs/README.md) for the architecture, the exact grammar of every text file, the weather/zone internals, known issues, and deployment notes.

## Who?

I'm Autumn, and I don't know why I do anything but I know when I'm having fun.

Hire me to write better code than this with you.  My address is all over these commits.
