// The story is two parallel histories that scroll together: glass as a
// material, and design as a discipline. Glass runs the full length of the
// timeline; design starts sparse (there is no "design" in antiquity) and grows
// until the two meet. Each beat wears one accent from its own movement (a
// period display face, an era colour) over the Natural Design base language.

export type EraFontKey = 'roman' | 'gothic' | 'renaissance' | 'victorian' | 'sans'

export const ERA_FONT: Record<EraFontKey, string> = {
  roman: 'var(--font-roman)',
  gothic: 'var(--font-gothic)',
  renaissance: 'var(--font-renaissance)',
  victorian: 'var(--font-victorian)',
  sans: 'var(--font-sans)',
}

export interface Beat {
  year: string
  title: string
  font: EraFontKey
  upper?: boolean
  accent: string
  body: string
}

// Glass — a continuous thread from antiquity to the screen.
export const GLASS_BEATS: Beat[] = [
  {
    year: 'c. 100 CE',
    title: 'Roman glass',
    font: 'roman',
    upper: true,
    accent: '#b0742b',
    body: 'Syrian workshops master glassblowing. Cups, bottles and the first clear window panes travel the length of the empire. Glass becomes the first material you can look straight through.',
  },
  {
    year: '1144',
    title: 'Gothic light',
    font: 'gothic',
    accent: '#6657c4',
    body: 'Abbot Suger glazes Saint-Denis and the Gothic cathedral is born. Walls give way to stained glass, and architecture is built out of coloured light.',
  },
  {
    year: '1450',
    title: 'Murano cristallo',
    font: 'renaissance',
    accent: '#a87f22',
    body: 'Glassmakers on Murano perfect cristallo, clear enough for true mirrors. The same clarity gives Europe its spectacles and its first optical lenses.',
  },
  {
    year: '1608',
    title: 'The lens',
    font: 'renaissance',
    accent: '#b0612b',
    body: 'Ground glass becomes the telescope and the microscope. Galileo maps the heavens and van Leeuwenhoek finds the very small. Glass now extends human sight.',
  },
  {
    year: '1851',
    title: 'Plate glass',
    font: 'victorian',
    accent: '#2f9e8f',
    body: 'Cast plate glass and iron raise the Crystal Palace for the Great Exhibition. Glass leaves the cathedral for the arcade, the factory and the shop window.',
  },
  {
    year: '1959',
    title: 'Float glass',
    font: 'sans',
    accent: '#2592fe',
    body: 'Pilkington floats molten glass on tin to make it flawless and cheap. Within a lifetime the same glass becomes the screen: a surface you look at, not through.',
  },
]

// Design — begins faint and late, then grows into a discipline of its own.
export const DESIGN_BEATS: Beat[] = [
  {
    year: 'antiquity',
    title: 'Before design',
    font: 'sans',
    accent: '#8d8d85',
    body: 'There is craft, ornament and ritual, but no discipline called design. Objects are made by hand, one at a time, and their authorship is anonymous.',
  },
  {
    year: '1100s',
    title: 'The illuminated page',
    font: 'gothic',
    accent: '#6657c4',
    body: 'In the scriptorium, word and image are laid down by hand. The manuscript is the first place hierarchy, layout and the marriage of type and picture are practised.',
  },
  {
    year: '1450',
    title: 'Movable type',
    font: 'renaissance',
    accent: '#a87f22',
    body: 'Gutenberg sets movable type and form becomes reproducible. A design can now be drawn once and issued by the thousand. Design begins as a discipline of its own.',
  },
  {
    year: '1700s',
    title: 'The specimen book',
    font: 'renaissance',
    accent: '#b0612b',
    body: 'Caslon and Baskerville cut type into families and publish specimen books. The printed page becomes a system of sizes, weights and rules, not a single object.',
  },
  {
    year: '1851',
    title: 'Arts & Crafts',
    font: 'victorian',
    accent: '#2f9e8f',
    body: 'Mass production splits taste from making. William Morris answers the machine by insisting on the hand, and the first modern design reform movement is born.',
  },
  {
    year: '1919',
    title: 'Bauhaus & Swiss',
    font: 'sans',
    upper: true,
    accent: '#d2382a',
    body: 'The Bauhaus declares that form follows function. Swiss typography then gives the century its grid, its sans-serif and the idea of design as a repeatable system.',
  },
]

export interface MergeBeat {
  title: string
  accent: string
  body: string
}

// Where the two threads meet: glass you look through becomes glass you look at.
export const MERGE_BEAT: MergeBeat = {
  title: 'OpenGlass',
  accent: '#2592fe',
  body: 'Glass you look through became glass you look at. The screen is a sheet of glass, and the interface is drawn on it. OpenGlass is that material, made portable, from Natural Design.',
}
