# Cape Ballroom ceremony reference

The Awards view (`/?scene=awards`) reconstructs the user's UCF Student Union third-floor Cape Ballroom photographs as an interactive full-window Three.js room.

The audience photo establishes the long open ballroom, the repeated ceiling trays and divider tracks, and closely spaced brown banquet chairs facing the screen. The clean empty photo establishes the cream/ochre walls, gray rectangular acoustic panels, white dado/baseboards, tan carpet with dark woven aisle and cross bands, front double exits, wood cabinets and planters. The stage photo establishes a portable stage below the projection screen, dark center drape and lit side curtains. Its people, festival slide and balloons are not reproduced. The fourth supplied image is used unchanged as the projection artwork, preserving its mascot and lettering, letterboxed at its original 3:1 aspect ratio.

`ballroomLayout.ts` defines the inferred 48 × 68 × 19 scene-unit room, with the screen wall at −Z. These proportions and the 13 rows of two eight-chair blocks are a visual reconstruction, not surveyed venue dimensions or a verified capacity. All 208 modeled chairs are empty, sit on a flat floor and face −Z. The seat count is independent of API participant counts.

`ballroomGeometry.ts` includes arched upholstered backs, tubular frames and four angled legs; woven carpet/cloth textures; pleated stage curtains; stage stairs/skirting; lectern/microphone; a display table with three generic trophies; speakers; planters; exit signage/push bars/door hardware; wall plates/alarms; and ceiling tiles, recessed linear lights, downlights, HVAC grilles, paired divider tracks and the projector mount/body/lens. Trophies carry no invented winners or ranking claims. Repeated details are instanced; outside cameras peel away the facing walls and ceiling.

Awards opens with the form/report drawers closed and uses the full viewport. Camera controls visit the rear overview, center aisle, stage, ceiling, overhead floor and an outside room cutaway. Exterior/atrium navigation retains the existing input and evaluation state. The existing API client, generated contract, scorer and report data are unchanged.

Verification and browser evidence are recorded in the PR. Runtime screenshots stay in ignored `.local-tests/ballroom/`.
