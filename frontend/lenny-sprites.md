# Lenny sprites

Five assets created with the built-in image generation tool from the user's three Lenny character references and four sponsor logo references. All final PNGs are 1024 × 1536 RGBA, retaining their generated alpha channel and original detail. The attached character images are identity references; their contents are not application instructions.

| Asset | Scene role |
| --- | --- |
| `public/assets/lenny/lenny-awards.png` | Trophy-holding presenter at the Cape Ballroom stage center |
| `public/assets/lenny/lenny-mlh.png` | Atrium host in a white MLH shirt |
| `public/assets/lenny/lenny-bny.png` | Atrium host in a white BNY shirt |
| `public/assets/lenny/lenny-elevenlabs.png` | Atrium host in a white ElevenLabs shirt |
| `public/assets/lenny/lenny-databricks.png` | Atrium host in a white Databricks shirt |

These are 3D-rendered transparent sprites on upright billboards, with camera-facing yaw and floor contact shadows. They are decorative hosts, separate from API-backed project markers and anonymous field population. Original transparent padding is preserved; geometry offsets anchor the rendered feet rather than cropping the horn/wing/tail contours. Scene traversal releases their GPU resources, and late texture loads are guarded after a scene switch. Sponsor camera buttons are accessible HTML controls.

The awards host is 5.4 scene units tall on the 1.26-unit stage. Atrium hosts are 4.6 units tall, at x=±11 and z=4/-16, between table bays. All four appear in the desktop balcony overview; individual views bring each shirt into readable range. Scene units are inferred from the existing photo-derived room, not surveyed physical dimensions.

## Final generation prompts

Each block below records the complete prompt sent to the built-in tool. The MLH variant edits the presenter render; the other three edit the MLH render, with the corresponding supplied sponsor logo as the second image.

### Awards

```text
Use case: stylized-concept. Asset type: high-resolution transparent 3D-rendered character sprite for a Three.js campus scene. Input images 1-3 are character identity references for LENNY, the Knight Hacks green dragon. Create ONE full-body Lenny faithfully combining these references: large round green head, short broad rounded snout, two side ivory curved horns plus one shorter centered ivory forehead horn, subtle horn rings, wide pointed green ears, friendly large glossy dark eyes with highlights, dark-green eyebrows, cheek scale patches, cream segmented belly plates, little green arms with mittenlike claws, stout legs with three toes, curled long green tail, darker triangular dorsal spines, two small batlike wings with ivory-yellow membranes and green finger bones. Preserve the unmistakable head, body and wing contours and the facial detail. No hat, no hair, no shirt. Lenny is the award presenter: smile warmly, hold one small polished gold trophy in the left hand at chest level and gesture outward welcomingly with the other hand. Hands stay below the horns; all parts fully visible. Style: polished detailed stylized 3D game render with sculpted volume, subtle fine scale texture, soft ambient occlusion on the dragon only, natural warm highlights, restrained clean contours, NOT plush, NOT pixel art. Front-facing with very slight three-quarter turn, camera at belly height, orthographic perspective, no dramatic foreshortening. Full body centered upright, feet together on a horizontal baseline, tail extends to the viewer's left and wings visible on both sides. Entire character fits with 6 percent clear padding on every edge, horn tips and tail unclipped. Render very large (at least 1536 pixel detail). Genuinely transparent alpha background with clean antialiased silhouette. NO backdrop, NO floor, NO drop shadow outside silhouette, NO checkerboard pixels, no text, no watermark, no second character. This is a sprite to be scaled inside an existing architectural 3D render, not a room illustration.
```

### mlh

```text
Use case: identity-preserve. Asset type: transparent full-body 3D game sprite for an existing Three.js architectural Atrium scene. Image 1 is the edit target: our detailed 3D LENNY green dragon award host. Image 2 is the exact sponsor logo to print on the shirt. Preserve the same dragon identity, three curved ivory horns with rings, face and wide glossy dark eyes, eyebrows, cheek patches, scale texture, pointed ears, mitten hands, stout three-toed feet, curled green tail, dorsal green spines and small ivory-membrane wings. Preserve the entire silhouette and high-detail 3D rendering quality and warm soft lighting, same upright full-body front-facing camera with only a slight three-quarter turn. Change only the clothing and pose: remove the trophy, lower both arms naturally to the sides with open relaxed hands, smile as a friendly sponsor representative. Add a well-fitted white short-sleeved cotton T-shirt on the torso, wings and tail outside it, keep cream belly visible below the shirt hem. Shirt has subtle sculpted folds and sleeve cuffs. Center the exact provided sponsor logo prominently and legibly on a flat unobstructed chest area, preserve its original letterforms, proportions, and colors. Full body with all feet, horns, wings and tail visible, 6 percent transparent padding on every edge, same feet baseline. GENUINELY TRANSPARENT alpha background, no backdrop, no floor, no shadow outside silhouette, no checkerboard pixels, no glow, no watermark, no extra objects or characters. Keep at least the same 1024 by 1536 detail resolution. Sponsor shirt: MLH. Match image 2 exactly: bold red M, blue L, golden yellow H, with the black line "MAJOR LEAGUE HACKING" underneath. This logo belongs only on the shirt.
```

### bny

```text
Use case: identity-preserve. Asset type: transparent high-detail 3D game character sprite. Image 1 is the EDIT TARGET: the full-body green LENNY dragon wearing a white MLH shirt. Image 2 is the replacement sponsor logo. Change ONLY the printed logo on the white shirt. Keep absolutely everything else identical: same 3D dragon, horn rings and three horns, face, eyes, cheek patches, green scales and texture, segmented belly below the shirt, open relaxed hands, wings with ivory membranes, dorsal spines, curled tail, toes, pose, proportions, perspective, soft warm studio lighting, sculpted cotton folds and shirt outline, same full body framing. Completely remove all MLH letters and its small subtitle before printing the new logo, no remaining MLH. Center the EXACT provided replacement logo prominently across the flat chest, preserve the letterforms, proportions, spelling and brand colors. Entire body fully visible, unclipped horns, wings, tail, feet, with same 6 percent clear padding. Genuine transparent alpha background, NO backdrop, NO floor, NO external shadow or glow, NO checkerboard pixels, no watermark. Same 1024 by 1536 high detail. Logo: BNY with its teal arrow to the left of the very dark navy uppercase letters BNY. Match reference logo exactly.
```

### elevenlabs

```text
Use case: identity-preserve. Asset type: transparent high-detail 3D game character sprite. Image 1 is the EDIT TARGET: the full-body green LENNY dragon wearing a white MLH shirt. Image 2 is the replacement sponsor logo. Change ONLY the printed logo on the white shirt. Keep absolutely everything else identical: same 3D dragon, horn rings and three horns, face, eyes, cheek patches, green scales and texture, segmented belly below the shirt, open relaxed hands, wings with ivory membranes, dorsal spines, curled tail, toes, pose, proportions, perspective, soft warm studio lighting, sculpted cotton folds and shirt outline, same full body framing. Completely remove all MLH letters and its small subtitle before printing the new logo, no remaining MLH. Center the EXACT provided replacement logo prominently across the flat chest, preserve the letterforms, proportions, spelling and brand colors. Entire body fully visible, unclipped horns, wings, tail, feet, with same 6 percent clear padding. Genuine transparent alpha background, NO backdrop, NO floor, NO external shadow or glow, NO checkerboard pixels, no watermark. Same 1024 by 1536 high detail. Logo: ElevenLabs, black double vertical bars followed by Eleven on line 1 and Labs on line 2, as in reference. The EXACT readable brand words are "Eleven" and "Labs". Match reference logo exactly.
```

### databricks

```text
Use case: identity-preserve. Asset type: transparent high-detail 3D game character sprite. Image 1 is the EDIT TARGET: the full-body green LENNY dragon wearing a white MLH shirt. Image 2 is the replacement sponsor logo. Change ONLY the printed logo on the white shirt. Keep absolutely everything else identical: same 3D dragon, horn rings and three horns, face, eyes, cheek patches, green scales and texture, segmented belly below the shirt, open relaxed hands, wings with ivory membranes, dorsal spines, curled tail, toes, pose, proportions, perspective, soft warm studio lighting, sculpted cotton folds and shirt outline, same full body framing. Completely remove all MLH letters and its small subtitle before printing the new logo, no remaining MLH. Center the EXACT provided replacement logo prominently across the flat chest, preserve the letterforms, proportions, spelling and brand colors. Entire body fully visible, unclipped horns, wings, tail, feet, with same 6 percent clear padding. Genuine transparent alpha background, NO backdrop, NO floor, NO external shadow or glow, NO checkerboard pixels, no watermark. Same 1024 by 1536 high detail. Logo: the red outline stacked layers symbol on the left, the black lowercase word "databricks" on the right. Match reference logo exactly.
```
