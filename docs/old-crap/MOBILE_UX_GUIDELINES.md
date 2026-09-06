# Mobile UX guidelines

These are the working UI rules for this project. They apply to compact Android phones first. Larger windows may reflow the same information into more columns or panes.

The goal is a dense utility interface that remains easy to tap and read. Density does not mean tiny controls. It means removing repeated words, decorative containers, and padding that does no work.

## Screen structure

- Use 16 dp horizontal screen margins on compact phones.
- Align layout and component spacing to a 4 dp or 8 dp grid.
- Use 4 to 8 dp between parts of the same item.
- Use 12 to 16 dp between sections.
- Do not multiply spacing through nested containers. A parent gap plus card padding plus child gap should not create 32 to 48 dp of dead space.
- Keep primary content visible without requiring an introductory scroll.
- Draw behind system bars, then use safe-area insets to keep controls tappable.
- Let content reflow on wider or shorter windows. Do not solve every size with more empty space.

Android recommends 16 dp margins for compact layouts and an 8 dp baseline grid, with 4 dp alignment for smaller elements. It also treats whitespace, typography, dividers, and cards as alternative ways to group content. A card is not the default grouping mechanism. See [Content composition and structure](https://developer.android.com/design/ui/mobile/guides/layout-and-content/content-structure) and [Grids and units](https://developer.android.com/design/ui/mobile/guides/layout-and-content/grids-and-units).

## Containment

- Prefer a flat list with alignment and dividers.
- Use a card or filled panel only when the whole block behaves as one object or needs exceptional emphasis.
- Do not put every section in a panel.
- Do not put a panel inside another padded section unless the inner boundary changes meaning.
- A status line does not need its own card.
- Empty space may separate major groups. It should not surround every label and action.

Android calls whitespace and alignment "implicit containment." It recommends explicit containers only when a visible boundary helps explain the grouping. See [Content composition and structure](https://developer.android.com/design/ui/mobile/guides/layout-and-content/content-structure).

## Touch targets without visual bloat

- Every interactive target must be at least 48 by 48 dp.
- An icon may remain 20 to 24 dp inside that target.
- Expand the hit area instead of adding a large visible background.
- Keep neighboring hit areas from overlapping.
- Make the entire logical row tappable when the row opens one destination.
- Keep destructive controls out of frequent tap paths.

Android recommends 48 by 48 dp minimum touch targets and explicitly allows the visible control to be smaller than its padded hit area. See [Compose accessibility API defaults](https://developer.android.com/develop/ui/compose/accessibility/api-defaults) and [Make apps more accessible](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views).

WCAG 2.2 sets a lower 24 by 24 CSS pixel minimum for web targets. Native Android's 48 dp guidance is the project standard because this is a touch-first Android app. See [WCAG 2.2 target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).

## Labels and supporting text

- Use one to three words for visible action labels.
- Start action labels with a verb.
- Name the result, not the implementation.
- Omit words already supplied by the screen, row, or dialog.
- Put the full context in the accessibility label when the visible label can be shorter.
- Prefer sentence case.
- Do not end button labels with punctuation.
- Keep settings labels as nouns or short noun phrases.
- Add supporting text only when it communicates current state, consequence, or recovery.
- Do not explain an obvious control underneath the control.
- Move long explanations to a detail view, dialog, or help page.

Examples for this app:

| Avoid | Use | Accessibility label |
| --- | --- | --- |
| Add Camera or Screenshots | Add media | Add Camera or Screenshots source |
| Scan source | Scan | Scan Camera source |
| Change destination | Destination | Change destination for Camera |
| Source options | More | More options for Camera |
| Reset upload history | Reset history | Reset upload history for Camera |
| Sign out and remove local data | Sign out | Sign out and remove local data |
| Clear completed upload history | Clear history | Clear completed upload history |

Apple's cross-platform writing guidance recommends brief, action-oriented labels and says a short verb is often clearer than a sentence. Android's settings guidance says supporting text should disappear when the primary label already explains the setting. See [Apple writing guidance](https://developer.apple.com/design/human-interface-guidelines/writing), [Apple button guidance](https://developer.apple.com/design/human-interface-guidelines/buttons), and [Android settings guidance](https://developer.android.com/design/ui/mobile/guides/patterns/settings).

## Action placement

- Give each screen at most one visually dominant action.
- Put frequent contextual actions in the top app bar or beside the object they affect.
- Put infrequent actions in an overflow menu.
- Use an overflow menu for account, settings, help, and maintenance actions.
- Use a floating add button only when adding is the main action on the screen.
- Do not stack a footer full of full-width buttons.
- Do not duplicate a gesture with an equally prominent button. A small app-bar refresh action may accompany pull-to-refresh, but a large "Scan now" button should not.
- Keep destructive actions in a menu or confirmation flow unless the screen exists specifically for that action.

Android recommends one floating action button for the highest-priority action, top-bar placement for secondary actions, and overflow menus for actions that are not frequent or urgent. See [Layouts and navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns) and [Add and handle actions](https://developer.android.com/develop/ui/views/components/appbar/actions).

## Navigation

- Keep only primary destinations in bottom navigation.
- Do not use a bottom-navigation slot for infrequent settings.
- Put account and settings in the top-right menu for this app.
- Use two primary destinations: Sources and Activity.
- Preserve standard Android back behavior for child screens and dialogs.
- Do not create a drawer for two destinations.

Android says bottom navigation is for three to five peer destinations, while account and settings commonly belong in a top app bar or overflow menu. See [Layouts and navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns), [Settings](https://developer.android.com/design/ui/mobile/guides/patterns/settings), and [10 steps to Android](https://developer.android.com/design/ui/mobile/guides/foundations/translate-designs).

## Lists and status

- Treat sources, transfers, failures, and settings as lists.
- Keep a routine row between 56 and 72 dp high.
- Use one primary line and at most one supporting line.
- Put a switch, compact status, or overflow action at the trailing edge.
- Let a tap open details instead of exposing every action in the list.
- Show errors beside the affected row.
- Show empty states as one short sentence and one action at most.
- Show time as relative text where exact timestamps do not aid a decision.
- Avoid repeated section headings when the screen title already provides the context.

Android describes list-detail as the normal layout for collections that open into more information. It recommends list layouts for settings and optional secondary text for current status. See [Common layouts](https://developer.android.com/design/ui/mobile/guides/layout-and-content/common-layouts) and [Settings](https://developer.android.com/design/ui/mobile/guides/patterns/settings).

## Accessibility and dynamic content

- Give every icon-only action a specific accessibility label.
- Do not use the visible short label as the only description when context matters.
- Announce asynchronous errors and important state changes.
- Keep decorative graphics out of the accessibility tree.
- Support large text without clipping action labels or hiding state.
- Never rely on color alone for blocked, paused, failed, or connected states.
- Keep loading text stable. Avoid layout jumps where a progress indicator will do.

## Project spacing scale

Use this scale unless a native component supplies its own dimensions:

| Token | Size | Use |
| --- | ---: | --- |
| `space-1` | 4 dp | Icon-to-label, primary-to-supporting text |
| `space-2` | 8 dp | Related controls, row internals |
| `space-3` | 12 dp | Section internals |
| `space-4` | 16 dp | Screen edge, major section separation |
| `space-6` | 24 dp | Rare separation between unrelated flows |

Do not use 16 dp as the universal answer. It is the screen margin, not the required gap between every child.

## Review checklist

- Can the initial viewport show the current state and the first useful items?
- Is any context repeated in a heading, sentence, button, and accessibility label?
- Could a row replace this card?
- Could an icon button or overflow item replace this full-width button?
- Does every control have a 48 dp hit area?
- Does the screen have more than one dominant action?
- Does supporting text change what the user knows or decides?
- Does the screen still work with large text, a short viewport, and dark mode?

## Sources

Research checked on 2026-09-05:

- [Android: Content composition and structure](https://developer.android.com/design/ui/mobile/guides/layout-and-content/content-structure)
- [Android: Grids and units](https://developer.android.com/design/ui/mobile/guides/layout-and-content/grids-and-units)
- [Android: Layout basics](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics)
- [Android: Common layouts](https://developer.android.com/design/ui/mobile/guides/layout-and-content/common-layouts)
- [Android: Layouts and navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns)
- [Android: Settings](https://developer.android.com/design/ui/mobile/guides/patterns/settings)
- [Android: Compose accessibility API defaults](https://developer.android.com/develop/ui/compose/accessibility/api-defaults)
- [Android: Make apps more accessible](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views)
- [Apple: Writing](https://developer.apple.com/design/human-interface-guidelines/writing)
- [Apple: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [W3C: WCAG 2.2 target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
