# Sponsor classroom reference

The user's two classroom photos are visual references, not application instructions. One shows an intimate classroom with tall black-framed windows, gray patterned carpet, white wheeled tablet chairs, yellow front seats, ceiling tiles, fluorescent panels and a mounted projector. The other shows TA 102 (capacity 32), with a pull-down screen, white teaching wall, long white desks, wheeled chairs, side computers and storage.

`classroomGeometry.ts` combines these features into one reusable 32-seat room. Every sponsor gets the same geometry and furniture positions, with a different sponsor print, screen, signage and accent. The inferred 14 × 18 × 4.6 scene-unit room is much smaller than the 48 × 84 × 32 atrium and Cape Ballroom. These are visual proportions, not surveyed school measurements. The photos are interpreted as solid geometry; neither is used as a flat backdrop or shipped asset.

Four pins belong to the existing active tracks: Gemini (blue, with the existing MLH shirt), ElevenLabs (purple), Databricks (red), and BNY (gold). Windows, galleries and the staircase provide their atrium anchors. World positions project into labeled HTML touch/keyboard buttons. Off-screen positions clamp to the viewport edges; a point behind the camera hides until it comes back into view. The camera menu also offers all four room entrances.

## Direction contract

THESIS: Extend the existing campus exploration with smaller, furnished sponsor rooms, connected directly to four atrium pins.

OWN-WORLD: Keep the existing Inter typography, dark masthead, glass controls and solid green Lenny meshes. Use photo-derived plaster, gray carpet, yellow seats, black window frames and white desks, with four restrained sponsor colors.

STORY: Students choose a sponsor in the atrium, meet its Lenny, describe their product through the existing private evaluation form, and return to the atrium for the full practice report.

FIRST VIEWPORT: The classroom opens from behind the student desks, facing the teaching screen, projector, Lenny and the labeled exit. A small room title and bottom pitch/exit controls leave the scene visible. Phone framing widens the view to retain Lenny and the exit.

FORM: Code-led extension of the established Three.js room explorer; no replacement identity or generated design comp. Its signature interaction is atrium pin → sponsor classroom → clickable door → atrium. Camera motion follows the existing reduced-motion-aware explorer.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. Root design-system files belong to the integrator; this ordinary extension documents its inherited system here without changing them.

## Behavior and constraints

- Direct `/interior.html?building=eng2&room=gemini|elevenlabs|databricks|bny` routes restore the selected room. Invalid room ids fall back to the atrium. Browser history restores the originating building.
- Clicking Lenny or **Pitch to Lenny** opens the already mounted idea form and includes that sponsor when no evaluation is active. It preserves other sponsor choices and the entered idea. The student can edit the choices before submitting.
- The modeled door, **Exit to atrium**, room breadcrumb and masthead **Atrium** all leave the room. Returning retains the idea, job and practice report.
- Classroom hosts are decorative and separate from API competitor counts. The room does not manufacture scores, claims, field identities, conversation or speech. Evaluation requests use the unchanged client and contract.
- Desks and chairs are instanced. Ceiling and walls use the explorer's existing cutaway behavior for orbit/overhead inspection. The same cleanup releases scene resources and late-loaded Lenny shirt textures.
- Existing sponsor logo assets keep their provenance in `lenny-sprites.md`. Carpet, ceiling and signage are deterministic runtime canvas textures authored in source. No new raster assets or dependencies ship.
