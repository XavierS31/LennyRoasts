# Engineering II exterior reference pass

The five supplied photos describe the same corner from different positions:

- Photos 1 and 3 look toward the signed, shorter front wing, with the tower at its left and the white-framed glass wing at its right.
- Photo 2 looks across the pond, lawn and road. It establishes the long left wing, its tall cream circulation bay and four circular openings in the lower brick end wall.
- Photos 4 and 5 show the tower corner, recessed glass entrance, broad concrete forecourt, grass islands and bordering planting beds.

The tower silhouette, tall faceted glazing, pale roof and two brick stories were already developed well. This pass retains those features, raises and extends the left wing, enlarges its repeated windows, adds the round end openings, narrows the signed front panel to five bays, and details the white-framed glass wing. Brick and limestone use physical-scale UVs.

The site now has a continuous curved curbside sidewalk, a forecourt reaching the recessed Engineering II door, and an unobstructed left-wing door spur. Concrete expansion joints, asphalt grain, faded lane markings, curb drains, textured grass, pond shoreline, mulch beds, layered tree canopies, hedges and disc-headed lamps replace the generic paths and landscaping.

Use **Left wing**, **Tower detail** and **Entrance walk** to inspect the changes. The default view shows the corner and both wings. Narrow screens use a three-column camera toolbar without overlapping the building-entry controls.

Dimensions and ground layout are estimates from the photographs, not survey measurements. The obscured rear volumes remain approximate. Procedural textures stay local; the reference photos are not bundled into the app. Repeated window details remain batched into three material meshes, and trees and hedges use instancing.

Validation: 11 existing frontend tests, TypeScript/Vite production build, browser inspection of the left wing, tower, entrance and wider facade, desktop and 390px controls, plus a local geometry audit for clear tower frontage, exposed ground-floor glass, seven entrance-walk samples, left-door spur coverage, the pond cutout and finite vertices. API contracts and fixture behavior are unchanged.
