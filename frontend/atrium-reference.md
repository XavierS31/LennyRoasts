# Engineering II atrium reference map

The six user-supplied photographs describe the same long, tall room. Orientation is inferred from shared landmarks, not surveyed dimensions.

| Photo | View and shared landmarks | Model interpretation |
| --- | --- | --- |
| 1 | Stair/gallery side looking toward the tall glass entrance; brick window bands on the left; fluted columns, gold crowns and white tables | Glass entrance at the north end; brick on the west wall; long table lanes |
| 2 | Higher, wider view toward that same entrance; cream wall on the right; full floor and roof exposed | Opposing cream wall; repeated column bays; red terrazzo ribbons; central skylights |
| 3 | Upward view facing toward the gallery/stair side; brick on the right | Reverse direction explains the apparent wall swap; crowns connect to the corrugated roof and beams |
| 4 | Close view of the switchback stair and perforated gallery railings | Stairs and three open gallery levels at the opposite end from the glass wall |
| 5 | Low view near the entrance looking back toward stairs; brick window wall on the right | Confirms stair/entrance opposition and full-height column sequence |
| 6 | Wide floor-level view of stairs, cream wall on the left, brick on the right | Opposing walls; workstation edge, collaboration tables, stairs and roof visible in one volume |

`atriumLayout.ts` fixes the shared orientation: glass at −Z, stairs at +Z, brick at −X, cream at +X. The inferred model is 48 × 84 × 32 scene units. Two rows of four fluted columns establish its bays. Gold arrow-shaped foliage extends the original Make canopies. Procedural masonry, terrazzo, perforated railing and locally drawn banners provide detail without projecting people or perspective distortion from the photos onto surfaces. Banner graphics are representative; exact text/portraits are not reconstructed.

The atrium opens with the full window devoted to the room. The preserved judging report opens in a glass drawer. The Room map relates the photographs and marks table locations; camera presets visit the gallery, floor, stairs, roof and entrance. API-returned project names and scores occupy collaboration bays; selecting a placard or result card moves to that project’s table. Other figures are anonymous representatives of the returned eligible-competitor count, capped at 200. The API does not supply full-field identities/ranks, so those are not invented.
