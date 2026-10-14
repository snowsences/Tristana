# Header background compatibility

Audited 272 header scenes across all twelve themes, including the original seven weekday scenes in every theme. Every scene retains its detailed source artwork and existing curved fade. The prior 254 installed scenes are unchanged.

These assets use opaque, theme-colored fades. Their `background` value is sampled from the blank paper area, and both app header renderers use that value for the page background. This preserves subtle per-image paper tones within each theme’s palette. They do not support an arbitrary replacement background through alpha transparency.

March uses cool blue-white fades. April uses green-white fades. Three newly completed April scenes were corrected from warm cream to green-white before inclusion. All 24 NYC scenes retain May’s warm paper tones, alongside its seven original window scenes. June now contains 30 Oregon coast scenes, including Newport sea lions amongst fishing boats, with cool blue-white paper tones. July now contains 31 alpine summer scenes with its original detailed painting style and warm-neutral ivory paper tones. The transparent experiments that altered the edges are excluded.

For future artwork, keep the original detailed rendering and curved, gradual fade. Match the theme’s existing paper palette rather than applying warm cream to every month. Sample the finished image’s actual blank background into its scene metadata; keep the same color for Today, Memories, Settings, and the bottom navigation. Verify the full and small exports against that color before including the scene.
