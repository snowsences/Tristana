# Header background compatibility

Audited 272 header scenes across all twelve themes, including the original seven weekday scenes in every theme. Every scene retains its detailed source artwork and existing curved fade. The prior 254 installed scenes are unchanged.

These assets use opaque, theme-colored fades. Their `background` value is sampled from the blank paper area, and both app header renderers use that value for the page background. This preserves subtle per-image paper tones within each theme’s palette. They do not support an arbitrary replacement background through alpha transparency.

March uses cool blue-white fades. April uses green-white fades. Three newly completed April scenes were corrected from warm cream to green-white before inclusion. All 24 NYC scenes retain May’s warm paper tones, alongside its seven original window scenes. June now contains 30 Oregon coast scenes, including Newport sea lions amongst fishing boats, with cool blue-white paper tones. July now contains 31 alpine summer scenes with its original detailed painting style and warm-neutral ivory paper tones. The transparent experiments that altered the edges are excluded.

For future artwork, keep the original detailed rendering and curved, gradual fade. Match the theme’s existing paper palette rather than applying warm cream to every month. Sample the finished image’s actual blank background into its scene metadata; keep the same color for Today, Memories, Settings, and the bottom navigation. Verify the full and small exports against that color before including the scene.


August now includes 31 glacier-lake scenes. Its 19 additions retain the detailed rendering and pale green-white fades, with actual blank-corner color sampled per scene. Full and small exports were checked against the sampled page color. Total audited scenes: 291.



September now includes 30 alpine-autumn scenes. Its 23 additions preserve the detailed painting style and smooth warm-ivory fades. Each full and small export has its actual blank-corner tone measured and recorded for the page background. Total audited scenes: 314.

October now includes 31 distinct orchard/autumn scenes. Its 14 additions retain the detailed painting style, curved terrain-following fades, natural foliage, and warm ivory paper tones. Apple orchards contain apples only. Actual blank-corner background colors were measured on both full and small exports. All 17 previous October scenes remain unchanged. Total audited scenes: 328.

November now includes 30 distinct Rainwood scenes. Its 19 additions retain the detailed natural painting style, broad curved fades, subdued wet-forest greens and blue-gray light, and pale neutral/green-ivory paper tones. Actual blank-corner background colors were measured on both full and small exports. All 11 previous November scenes remain unchanged. Total audited scenes: 347.

December now includes 31 distinct Alpine-Winter scenes. Its 19 additions retain the detailed natural painting style, broad curved fades, winter landscapes, plus the Shore Acres storm-watching scene, and cool blue-white paper tones. Actual blank-corner background colors were measured on both full and small exports. All 12 previous December scenes remain unchanged. Total audited scenes: 366.

2026-10-14 curation: 104 rejected scenes and their responsive exports were removed. The active collection now contains 262 scenes; `background-audit.json` covers only retained artwork. Replacement needs are recorded by month in `replacement-counts.json`, with subjects to be chosen independently later. Earlier totals above describe historical releases.
