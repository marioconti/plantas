# tools

## Icons

`src/components/icon-data.ts` holds Phosphor Icons (MIT) as inline SVG markup. To add one,
download its SVG for each weight and regenerate:

```sh
for n in drop leaf; do for w in bold fill; do
  curl -sfL "https://raw.githubusercontent.com/phosphor-icons/core/main/assets/$w/$n-$w.svg" -o "ph-$n-$w.svg"
done; done
```

Then strip the outer `<svg>` and the transparent `<rect>` and add the entry to `ICONS`, keyed
`<name>-<weight>`. The full list of names is at https://phosphoricons.com.

## Species photos

`node tools/species-photos.mjs` asks Wikipedia for the lead photo of every species in
`src/data/species.json` and writes `src/data/species-photos.json` (URL, author, licence).
Run it after adding species.
