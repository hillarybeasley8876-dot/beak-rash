# BEAK RASH — art prompts (assets unit)

Single source of truth for `tools/gen-image.mjs`: every `### <file> · <aspect> · <mode>` section below
is one generated image (`<file>` is relative to `public/assets/`, without extension). `{TOKENS}` expand
from the list below. Lines starting with `>` are review notes and are not sent to the model;
`> cutout: --hole X,Y,R` lines pass extra arguments to `tools/cutout.py` for that file (hole circles
are in raw-image pixels of the picked candidate: update them after a re-roll); `--frame CX,CY,S`
re-centres an eyes strip so the eyes sit on the middle line the HUD bands show; `--tint X,Y,RX,RY`
repaints an orange beak tip crimson where a roll forgot the pelican's red hooked tip.
Modes: `cut` = transparent cut-out (PNG + WebP, ≤ 900 px tall) · `full` = full-bleed 16:9 art ·
`strip` = full-bleed eyes strip · `bill` = billboard WebP · `+flip` mirrors the image.
Model: nano_banana via the internal ys-api (IOA). Raw downloads are kept in `shots/assets/raw/`.

## Tokens
- `{STYLE}` Bold sticker comic illustration, thick black ink outlines, flat cel shading, limited palette crimson red, pure black and white plus the character's own colours, halftone shading, jagged starburst background shapes, high contrast, no text, no letters, no watermark, plain white outer background. No die-cut sticker border and no white outline around the design; the character and the starburst fit completely inside the frame with a plain white margin on every side.
- `{STYLE_STRIP}` Bold comic illustration, thick black ink outlines, flat cel shading, limited palette crimson red, pure black and white plus the character's own colours, halftone shading, dramatic speed lines, high contrast, no text, no letters, no watermark, full-bleed composition filling the frame edge to edge, no border.
- `{STYLE_FULL}` Bold comic illustration, thick black ink outlines, flat cel shading, limited palette crimson red, pure black and white plus the characters' own colours, halftone shading, jagged starburst shapes, high contrast, no text, no letters, no logo, no watermark, full-bleed composition, no border.
- `{STYLE_BILL}` Retro comic advertising poster illustration, thick black ink outlines, flat cel shading, halftone shading, bold saturated colours, one big clear central subject on a simple uncluttered background, high contrast, no text, no letters, no numbers, no logos, no watermark, a wide landscape scene that fills the entire 16:9 frame edge to edge, no white margins, no frame, no border.
- `{COAST_PAL}` Sunny seaside palette: turquoise sea, sky blue, cream sand, white and coral red accents.
- `{CITY_PAL}` Night-time neon palette: deep navy and purple background with glowing magenta, cyan and yellow neon light and crimson red accents.
- `{MOUNTAIN_PAL}` Sunset mountain palette: golden orange and pink sunset sky, layered purple mountain ridges, dark green pines.
- `{MAIN}` dynamic three-quarter front view, riding toward the viewer and slightly to the left of the frame, full body and the entire bicycle visible including both wheels, in front of a huge jagged crimson red and black starburst centred on the bicycle that is larger than the rider and the bicycle and extends past the wheels on every side, so red and black shows through the spokes of both wheels and between the legs, no white gaps inside the silhouette, no ground shadow
- `{BUST}` head-and-shoulders bust portrait facing slightly to the left, the head large in the frame, no bicycle, in front of a huge jagged crimson red and black starburst that is larger than the bust and backs the entire figure
- `{DIZZY}` comedic dazed knocked-silly expression with spiral swirly eyes and the tongue sticking out, little yellow stars and tiny cartoon birds circling the head, a bandage plaster on the head, cartoon slapstick, no blood, no injury
- `{EYES}` Extreme close-up of the eyes of
- `{EYES_CROP}` Cropped tightly on the eyes and brows so they fill the middle band of the wide frame from left to right, crimson red and black speed lines at the edges.
- `{PELICAN}` a chunky cartoon white pelican with a round white body, pale grey-tinted wings with black primary feather tips, a long S-curved neck, a small head with a spiky white crest tuft, a HUGE long orange-yellow beak whose very tip is a bright crimson red downward hook (the red hooked beak tip is clearly visible), with a stretchy pink-orange throat pouch underneath, a glossy red cycling helmet with clear goggles, big expressive eyes with white sclera, black pupils and a shiny highlight, orange webbed feet
- `{GOOSE}` a big white domestic goose with a long upright neck, an orange beak with a black nail at the tip, furious slanted ANGRY black eyebrows and a menacing glare, a black bandana tied on its head instead of a helmet, orange webbed feet
- `{CAPYBARA}` a chubby brown capybara with a barrel-shaped body, a big boxy head with a blunt square snout, sleepy half-closed eyes, tiny round ears, short legs, a small amber-yellow cycling helmet with one round yellow yuzu citrus fruit balanced on top of the helmet, an utterly calm unbothered face
- `{CAT}` an orange tabby cat with darker orange stripes, a round head, a cream muzzle and chest, big green eyes, a cheeky open-mouthed grin showing tiny fangs, a red cycling helmet, a long striped tail
- `{SHIBA}` a tan shiba inu dog with cream cheeks, muzzle and chest, pointy ears, a curled fluffy tail, black pixel-art 8-bit 'deal with it' sunglasses, the classic doge side-eye smirk, a black cycling helmet
- `{PIGEON}` a plump grey city pigeon with an iridescent green and purple sheen on the neck, round orange eyes with small black pupils, a short dark beak with a white cere, pink feet, a teal-green cycling helmet
- `{PENGUIN}` a round chubby penguin with a black back and head, a big white belly, a yellow beak, yellow feet, small black flippers, a yellow cycling helmet
- `{SEAGULL}` a white seagull with grey wings with black tips, a yellow beak with a red spot near the tip, shifty narrowed suspicious eyes, one golden french fry held in its beak, a yellow cycling helmet, yellow legs
- `{SLOTH}` a shaggy brown three-toed sloth with long scruffy fur, a pale beige face, dark brown eye patches, an eternal gentle smile, slow half-blinking eyes, long curved claws, a dark brown cycling helmet
- `{CORGI}` an orange and white Pembroke corgi dog with huge upright ears, a white muzzle and chest, very short stubby legs, a blue police cap, a blue police vest with a gold star badge (no text), a silver whistle on a cord

## Portraits

### portraits/pelican_main · 3:4 · cut
{PELICAN}, racing a red and white carbon road bike with drop handlebars at full speed, {MAIN}, leaning into a turn, wings gripping the handlebars, webbed feet on the pedals, fierce confident grin. {STYLE}
> cutout: --hole 315,838,95,128 --hole 552,815,70,100 --hole 556,884,30,44

### portraits/pelican_smug · 3:4 · cut
{PELICAN}, {BUST}, smug cocky smirk with one eyebrow raised and half-lidded eyes, a fish tail poking out of the side of the bulging throat pouch, goggles pushed up on the helmet. {STYLE}

### portraits/pelican_hurt · 3:4 · cut
{PELICAN}, {BUST}, {DIZZY}, helmet knocked crooked, cracked goggles, a few white feathers flying off. {STYLE}
> cutout: --flip

### portraits/pelican_eyes · 16:9 · strip
{EYES} a cartoon white pelican hero: just the two fierce determined eyes glaring straight at the viewer under the rim of a glossy red cycling helmet with clear goggles pushed up on it, white feathers, the top of the huge orange-yellow beak at the bottom edge, the eyes exactly at the vertical centre of the frame. {EYES_CROP} {STYLE_STRIP}

### portraits/goose_main · 3:4 · cut
{GOOSE}, riding a heavy classic black vintage roadster bicycle with a long top tube, rod brakes, a chain guard, a rear rack, a front lamp and a bell, {MAIN}, charging forward and honking furiously with the beak wide open and the long neck stretched out like a weapon. {STYLE}
> cutout: --hole 255,915,140,170 --hole 595,805,92,172

### portraits/goose_smug · 3:4 · cut
{GOOSE}, {BUST}, evil smug grin looking down its beak at the viewer, eyebrows furrowed, chin raised, chest puffed out, wings folded neatly at its sides like a bird (no arms, no hands). {STYLE}

### portraits/goose_hurt · 3:4 · cut
{GOOSE}, {BUST}, {DIZZY}, the bandana slipped over one eye, a few white feathers flying off, still trying to look angry. {STYLE}

### portraits/goose_eyes · 16:9 · strip
{EYES} {GOOSE}: two furious glaring eyes under thick angry slanted eyebrows, the edge of the black bandana above, the top of the orange beak with its black nail at the bottom edge. {EYES_CROP} {STYLE_STRIP}

### portraits/capybara_main · 3:4 · cut
{CAPYBARA}, riding a chunky bright yellow shared rental bicycle with a front basket and thick solid tyres, {MAIN}, pedalling calmly with half-closed eyes as if nothing in the world matters. {STYLE}
> cutout: --hole 330,815,75,105 --hole 530,795,62,95

### portraits/capybara_smug · 3:4 · cut
{CAPYBARA}, {BUST}, serene unbothered smile with eyes closed, totally zen, the yuzu still perfectly balanced on the helmet. {STYLE}

### portraits/capybara_hurt · 3:4 · cut
{CAPYBARA}, {BUST}, {DIZZY}, the yuzu bouncing off the helmet, still oddly calm. {STYLE}

### portraits/capybara_eyes · 16:9 · strip
{EYES} a brown capybara: two sleepy half-closed eyes glinting with sudden menacing calm, brown fur, the rim of an amber-yellow cycling helmet at the top edge, the eyes exactly at the vertical centre of the frame, crimson red background. {EYES_CROP} {STYLE_STRIP}
> cutout: --frame 0.5,0.42,0.84

### portraits/cat_main · 3:4 · cut
{CAT}, riding a neon fixie bicycle with bullhorn handlebars, one hot pink and one mint green deep rim and no brakes, {MAIN}, pedalling with a cheeky grin, tail held high. {STYLE}
> cutout: --hole 307,800,80,118 --hole 540,752,62,118

### portraits/cat_smug · 3:4 · cut
{CAT}, {BUST}, smug cat grin with half-lidded eyes, one paw raised to its chin, mischievous. {STYLE}

### portraits/cat_hurt · 3:4 · cut
{CAT}, {BUST}, {DIZZY}, fur frazzled and sticking out, whiskers bent. {STYLE}

### portraits/cat_eyes · 16:9 · strip
{EYES} {CAT}: two big green eyes with narrow slit pupils and a cheeky glint, orange tabby stripes on the forehead, the rim of the red helmet above. {EYES_CROP} {STYLE_STRIP}
> cutout: --frame 0.5,0.55,0.9

### portraits/shiba_main · 3:4 · cut
{SHIBA}, riding an orange mountain bike with fat knobbly tyres and a front suspension fork, {MAIN}, pedalling with a smug side-eye, tongue slightly out. {STYLE}
> cutout: --hole 258,810,108,150 --hole 578,778,70,130

### portraits/shiba_smug · 3:4 · cut
{SHIBA}, {BUST}, the classic doge side-eye smirk, the pixel sunglasses slid down the nose, eyebrows raised. {STYLE}

### portraits/shiba_hurt · 3:4 · cut
{SHIBA}, {BUST}, {DIZZY}, the pixel sunglasses cracked and hanging crooked off one ear. {STYLE}

### portraits/shiba_eyes · 16:9 · strip
{EYES} {SHIBA}: black pixel-art sunglasses across the eyes, one eye side-eyeing over the top of the glasses, tan fur and cream eyebrow spots. {EYES_CROP} {STYLE_STRIP}

### portraits/pigeon_main · 3:4 · cut
{PIGEON}, riding a sleek teal-green racing road bike with drop handlebars, {MAIN}, pedalling fast with its head thrust forward mid head-bob, beady determined stare. {STYLE}
> cutout: --hole 285,815,112,165 --hole 555,788,75,140

### portraits/pigeon_smug · 3:4 · cut
{PIGEON}, {BUST}, shrugging both wings with a smug 'maybe next time' look, one eye half closed. {STYLE}

### portraits/pigeon_hurt · 3:4 · cut
{PIGEON}, {BUST}, {DIZZY}, grey feathers puffed up and flying off. {STYLE}

### portraits/pigeon_eyes · 16:9 · strip
{EYES} {PIGEON}: two round orange eyes with tiny black pupils staring blankly and intensely, iridescent green and purple neck feathers below, the rim of the teal helmet above. {EYES_CROP} {STYLE_STRIP}
> cutout: --frame 0.5,0.41,0.84

### portraits/penguin_main · 3:4 · cut
{PENGUIN}, riding a tiny pastel blue children's balance bike with no pedals and colourful streamers on the grips, {MAIN}, paddling along with its little yellow feet, belly forward, determined. {STYLE}
> cutout: --hole 313,820,72,100 --hole 538,788,50,75

### portraits/penguin_smug · 3:4 · cut
{PENGUIN}, {BUST}, cool smug look with half-lidded eyes, one flipper giving a thumbs up. {STYLE}

### portraits/penguin_hurt · 3:4 · cut
{PENGUIN}, {BUST}, {DIZZY}, helmet tilted, little ice crystals flying. {STYLE}

### portraits/penguin_eyes · 16:9 · strip
{EYES} {PENGUIN}: two intense determined eyes in the black head feathers, the top of the yellow beak at the bottom edge, the rim of the yellow helmet above. {EYES_CROP} {STYLE_STRIP}
> cutout: --frame 0.5,0.55,0.9

### portraits/seagull_main · 3:4 · cut
{SEAGULL}, riding a yellow racing road bike with drop handlebars, {MAIN}, pedalling while clutching a stolen paper cone of french fries under one wing, sneaky sideways glance. {STYLE}
> cutout: --hole 328,803,95,160 --hole 550,762,58,128

### portraits/seagull_smug · 3:4 · cut
{SEAGULL}, {BUST}, smug sneaky grin while dangling a stolen french fry, shifty eyes looking sideways. {STYLE}

### portraits/seagull_hurt · 3:4 · cut
{SEAGULL}, {BUST}, {DIZZY}, the french fry snapped in half, grey and white feathers flying off. {STYLE}

### portraits/seagull_eyes · 16:9 · strip
{EYES} {SEAGULL}: two shifty narrowed suspicious eyes glancing sideways, white feathers, the rim of the yellow helmet above, the yellow beak with a fry at the bottom edge. {EYES_CROP} {STYLE_STRIP}
> cutout: --frame 0.5,0.45,0.9

### portraits/sloth_main · 3:4 · cut
{SLOTH}, riding the front seat of a long dark brown two-seat tandem bicycle with a grumpy dried salted fish strapped onto the rear seat as a passenger, {MAIN}, pedalling slowly with a serene smile. {STYLE}
> cutout: --hole 248,788,100,135 --hole 650,790,65,110 --hole 476,828,35,15 --hole 466,792,30,22 --hole 638,700,42,18

### portraits/sloth_smug · 3:4 · cut
{SLOTH}, {BUST}, slow smug smile with half-closed eyes, giving a lazy thumbs up with one long claw. {STYLE}

### portraits/sloth_hurt · 3:4 · cut
{SLOTH}, {BUST}, {DIZZY}, shaggy fur messed up, still smiling slowly. {STYLE}

### portraits/sloth_eyes · 16:9 · strip
{EYES} {SLOTH}: two eyes inside dark brown eye patches snapping wide open with tiny yellow lightning sparks, shaggy brown fur, the rim of the dark brown helmet above. {EYES_CROP} {STYLE_STRIP}
> cutout: --frame 0.5,0.36,0.72

### portraits/corgi_main · 3:4 · cut
{CORGI}, riding a blue and white police mountain bike with a small red and blue siren light on the handlebars, {MAIN}, chasing at full speed with very short legs barely reaching the pedals, blowing the whistle, stern face. {STYLE}
> cutout: --hole 300,848,88,140 --hole 560,805,55,88

### portraits/corgi_smug · 3:4 · cut
{CORGI}, {BUST}, stern smug police officer look with one eyebrow raised, front paws crossed over the vest. {STYLE}

### portraits/corgi_hurt · 3:4 · cut
{CORGI}, {BUST}, {DIZZY}, the police cap knocked sideways over one huge ear, the whistle tangled. {STYLE}

### portraits/corgi_eyes · 16:9 · strip
{EYES} {CORGI}: two stern narrowed eyes under the brim of a blue police cap with a gold star badge, orange fur, huge ear tips at the edges. {EYES_CROP} {STYLE_STRIP}
> cutout: --frame 0.5,0.44,0.88

## Key art

### art/title · 16:9 · full
Epic video game title key art: {PELICAN}, charging straight at the viewer on a red and white road bike with dramatic fisheye foreshortening, the front wheel and the huge beak bursting toward the camera, wings gripping the drop handlebars, fierce grin; close behind it a chasing pack of rival animal cyclists: an angry white goose in a black bandana, a calm capybara with a yuzu on its helmet, an orange tabby cat, a shiba inu in pixel sunglasses, a grey pigeon, a penguin on a tiny bike, a seagull with a french fry and a smiling sloth on a tandem; giant jagged crimson red and black starburst rays explode from behind the pelican, speed lines, flying feathers and little fish; the pelican is placed right of centre and the left third of the image is bold red and black burst rays without characters. {STYLE_FULL}
> cutout: --tint 1242,352,50,62

### art/menu · 3:4 · cut
{PELICAN}, heroic pose popping a wheelie on its red and white road bike, standing on the pedals, one wing pointing forward at the viewer and the other gripping the handlebar, beak open in a confident laugh, full body and the entire bicycle visible, in front of a huge jagged crimson red and black starburst that is larger than the rider and the bicycle and backs the entire figure, red and black shows through the spokes of both wheels, no ground shadow. {STYLE}
> cutout: --hole 617,825,100,128 --hole 375,950,85,122
> cutout: --tint 752,222,30,30

### art/loading_1 · 16:9 · cut
A funny comic vignette: {PELICAN}, at a seaside fish market stall, stuffing a whole salted fish into its stretchy throat pouch with cheeks bulging, while a sneaky white seagull with a yellow beak tries to snatch a fish out of the pouch; crates of fish on ice; in front of a huge jagged crimson red and black starburst that backs the whole scene. {STYLE}
> cutout: --tint 895,282,26,26

### art/loading_2 · 16:9 · cut
A funny comic vignette: a furious white goose in a black bandana honking and chasing a panicking white pelican with a huge orange beak and a red cycling helmet who pedals a red road bike for its life, sweat drops, feathers flying, dust clouds, in front of a huge jagged crimson red and black starburst that backs the whole scene. {STYLE}
> cutout: --hole 812,617,64,85 --hole 660,585,60,75
> cutout: --tint 1006,330,20,28

### art/loading_3 · 16:9 · cut
A funny comic vignette: a chubby brown capybara with a yuzu on its head soaking blissfully with closed eyes in a round wooden hot spring tub, while a white pelican, an orange cat and a grey pigeon on bicycles zoom past behind it in a blur of speed lines, steam swirls, in front of a huge jagged crimson red and black starburst that backs the whole scene. {STYLE}
> cutout: --tint 374,274,13,14

### art/results · 16:9 · cut
A champion celebration: {PELICAN}, standing on top of a tall stack of plain unmarked wooden fish crates like a winner's stand, raising a golden fish-shaped trophy high with both wings, beak wide open cheering; an annoyed white goose in a black bandana stands on a lower stack of crates on the left and a calm capybara with a yuzu on its helmet sits on a single crate on the right; confetti and little fish raining down, in front of a huge jagged crimson red and black starburst that backs the whole scene. {STYLE}
> cutout: --tint 466,130,22,20

### art/garage · 16:9 · full
A stylised bicycle workshop interior as a video game menu background: a pegboard wall with hanging wrenches and tools, spare wheels and tyres, a bike repair stand, a workbench with a toolbox, fish-shaped stickers and a pelican silhouette poster, dramatic crimson red and black lighting, strong dark vignette so the centre of the image is calm, darker and empty for a 3D bicycle to be shown on top, no characters, no bicycle in the centre. {STYLE_FULL}

## Billboards
Roadside posters (track unit draws them in its sign atlas and overlays Chinese meme text from
`src/data/memes.ts`, so every poster keeps a calm plain band at the top). 16:9, WebP ≤ 576 px tall.

### billboards/coast_1 · 16:9 · bill
A giant opened sardine tin can with the lid rolled back, shiny silver sardines packed neatly inside, one sardine winking, a hungry cartoon white pelican with a huge orange beak and a red cycling helmet peeking over the rim and drooling, the tin label is plain blank coral red with no writing, the upper part of the poster is plain turquoise sky. {COAST_PAL} {STYLE_BILL}

### billboards/coast_2 · 16:9 · bill
A cheerful seaside fish market stall under a red and white striped awning, a big heap of fresh fish, prawns and squid on crushed ice in wooden crates, a hanging fishmonger's scale, one fish leaping out with a startled face, the upper part of the poster is plain sky blue. {COAST_PAL} {STYLE_BILL}

### billboards/coast_3 · 16:9 · bill
A cool cartoon white pelican with a huge orange beak wearing heart-shaped sunglasses, lounging on a striped beach towel under a beach umbrella and squeezing a big orange sunscreen bottle with a plain blank label, a dollop of white sunscreen on its beak, blazing cartoon sun, the upper part of the poster is plain sky blue. {COAST_PAL} {STYLE_BILL}

### billboards/coast_4 · 16:9 · bill
A plump cartoon penguin in a yellow helmet surfing a huge curling turquoise wave on a red surfboard, arms out for balance, big splash and spray, a few seashells and a starfish on the beach, the upper part of the poster is plain sky blue. {COAST_PAL} {STYLE_BILL}

### billboards/coast_5 · 16:9 · bill
A huge menacing cartoon seagull swooping down with wings spread and a wild greedy grin, snatching a red paper cone of golden french fries out of the air, fries flying everywhere, a blank bright yellow warning triangle shape behind it with no symbol and no writing, the upper part of the poster is plain sky blue. {COAST_PAL} {STYLE_BILL}

### billboards/coast_6 · 16:9 · bill
A giant swirly soft-serve ice cream cone in turquoise and white with a little fish-shaped wafer cookie stuck in the top and a cherry, melting drips running down the crispy cone, sprinkles flying, a sandy beach and calm sea behind, the upper part of the poster is plain sky blue. {COAST_PAL} {STYLE_BILL}

### billboards/city_1 · 16:9 · bill
A giant cup of bubble milk tea with chewy black tapioca pearls and a fat pink straw, condensation drops, glowing neon outline, a cute cartoon pigeon peeking from behind the cup, the upper part of the poster is plain dark navy. {CITY_PAL} {STYLE_BILL}

### billboards/city_2 · 16:9 · bill
An orange tabby cat in a red cycling helmet singing passionately into a karaoke microphone with eyes closed and mouth wide open, under purple and magenta neon spotlights, glowing musical notes floating around, the upper part of the poster is plain dark navy. {CITY_PAL} {STYLE_BILL}

### billboards/city_3 · 16:9 · bill
A glowing neon arcade claw machine packed with plush toy pelicans with big orange beaks, the metal claw lifting one plush pelican out, magenta and cyan neon lights, the upper part of the poster is plain dark navy. {CITY_PAL} {STYLE_BILL}

### billboards/city_4 · 16:9 · bill
A glowing energy drink can shaped like a fish tin standing upright with yellow lightning bolts crackling around it and a fish skeleton icon on its plain label, electric cyan sparks, the upper part of the poster is plain dark navy. {CITY_PAL} {STYLE_BILL}

### billboards/city_5 · 16:9 · bill
A tan shiba inu dog in black pixel-art 8-bit sunglasses DJing at two glowing turntables, one paw raised in the air, big headphones around its neck, cyan and magenta laser beams, the upper part of the poster is plain dark navy. {CITY_PAL} {STYLE_BILL}

### billboards/city_6 · 16:9 · bill
A giant steaming cup of instant noodles with a fork twirling the noodles, a soft-boiled egg and a fish cake slice on top, wisps of steam glowing under neon light, the upper part of the poster is plain dark navy. {CITY_PAL} {STYLE_BILL}

### billboards/mountain_1 · 16:9 · bill
A chubby brown capybara with a yellow yuzu fruit on its head soaking blissfully with closed eyes in a steaming rocky outdoor hot spring, more yuzu fruits floating in the water, swirls of steam, the upper part of the poster is plain sunset sky. {MOUNTAIN_PAL} {STYLE_BILL}

### billboards/mountain_2 · 16:9 · bill
A shaggy brown sloth with dark eye patches and a gentle smile hanging lazily by one long claw from the cable of a little red mountain cable car gondola, dangling over pine-covered peaks, the upper part of the poster is plain sunset sky. {MOUNTAIN_PAL} {STYLE_BILL}

### billboards/mountain_3 · 16:9 · bill
A dried salted fish wearing tiny sunglasses lying flat and relaxing in a hammock strung between two pine trees, a mountain lake and ridges behind, utterly lazy, the upper part of the poster is plain sunset sky. {MOUNTAIN_PAL} {STYLE_BILL}

### billboards/mountain_4 · 16:9 · bill
A gigantic angry white goose in a black bandana towering over a winding mountain road like a kaiju monster, wings spread, honking, tiny cartoon cyclists fleeing down the switchbacks, the upper part of the poster is plain sunset sky. {MOUNTAIN_PAL} {STYLE_BILL}

### billboards/mountain_5 · 16:9 · bill
A bubbling copper hot pot of red spicy broth on a little stove with chilli peppers, mushrooms and fish balls, chopsticks lifting a fish ball, rising steam, a mountain inn window with pine-covered peaks behind, the upper part of the poster is plain sunset sky. {MOUNTAIN_PAL} {STYLE_BILL}

### billboards/mountain_6 · 16:9 · bill
A cosy camping scene: a small orange tent, a crackling campfire with a fish roasting on a stick, a pot of tea, a sleeping pigeon in a tiny sleeping bag, pine trees and a pagoda silhouette on a far ridge, the upper part of the poster is plain sunset sky. {MOUNTAIN_PAL} {STYLE_BILL}
