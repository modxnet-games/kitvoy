import type { ProductContent } from "./types";

/**
 * PouncePop: Kitvoy's name for CJdropshipping product CJYD1693059, "Smart
 * Rolling Ball Pet Cat Toy Ball Bite-resistant Elastic Ball" (variants: orange
 * red, purple, blue; all "USB").
 *
 * VERIFIED on 2026-11-12, from CJ's written listing and its own photos. Only
 * these may be stated:
 *  - It rolls and hops by itself ("smart rolling ball", "automatic jumping
 *    ball"; the retail box says "Smart Jumping Ball"). A photo labels the hop
 *    at about 3 cm.
 *  - The ring around the power button lights up when it is on (photos).
 *  - "Bite-resistant" shell (supplier's product name).
 *  - 42 mm across (photo label). 42–59 g product weight (listing).
 *  - Built-in battery, charges over USB (listing: battery attribute, "USB").
 *  - Material: plastic (listing).
 *  - Listed for cats ("Applicable object: Cat").
 *  - Packing list, word for word: "1* Elastic Ball". Nothing else.
 *
 * NOT VERIFIED, so not claimed anywhere on the page: USB-C or any connector
 * type, an included charging cable, obstacle avoidance, motion or touch
 * wake-up, automatic standby or a timer, play modes, battery life, charging
 * time, waterproofing or washability, noise level, any safety certification
 * or "non-toxic" claim, and suitability for medium or large dogs. At 42 mm it
 * is small enough for a bigger dog to swallow, which the page says plainly.
 *
 * To unlock a claim: get it in writing from CJ, or test a sample, then add it
 * here and to the facts below in the same change.
 */
const base = "/products/pouncepop";

export const pouncepop: ProductContent = {
  slug: "pouncepop",
  name: "PouncePop Self-Rolling Cat Ball",
  eyebrow: "PouncePop · self-rolling cat ball",
  headline: "The little ball that plays back.",
  subheadline:
    "PouncePop rolls and hops by itself, so your cat gets a real chase even when your hands are busy. Switch it on, set it down and watch the stalking start.",
  benefits: [
    { icon: "sparkles", title: "Moves by itself", text: "It rolls and makes little hops with nobody throwing it." },
    { icon: "zap", title: "Glows as it goes", text: "The ring around the button lights up while it's on, easy to track across the floor." },
    { icon: "shield", title: "Bite-resistant shell", text: "Made for batting, pouncing and being carried off in triumph." },
    { icon: "battery", title: "Rechargeable", text: "A built-in battery that charges over USB. No button cells to buy." },
  ],
  gallery: [
    { src: `${base}/hero.webp`, alt: "PouncePop self-rolling cat ball in orange, showing its power button and clear ring", label: "PouncePop" },
    { src: `${base}/lifestyle-cat.webp`, alt: "A cat crouched to pounce on the glowing orange PouncePop ball on a living-room floor", label: "The chase" },
    { src: `${base}/play-motion.webp`, alt: "The PouncePop ball mid-hop above the floor as a cat's paw reaches for it", label: "Roll and hop" },
    { src: `${base}/texture-macro.webp`, alt: "Close-up of the PouncePop's grooved shell and the clear ring around its power button", label: "The shell" },
    { src: `${base}/scale-hand.webp`, alt: "A purple PouncePop ball resting in an open palm to show its 42 mm size", label: "Actual size" },
    { src: `${base}/in-the-box.webp`, alt: "What comes in the box: one PouncePop ball", label: "In the box" },
  ],
  // Stills stand in until real clips of the product are filmed; set `src` to bind one
  demoLoops: [
    { id: "roll", title: "It rolls by itself", caption: "Set it down and it's off across the floor.", src: null, poster: `${base}/lifestyle-cat.webp`, posterAlt: "A cat watching the PouncePop ball roll across the floor" },
    { id: "hop", title: "Then it hops", caption: "Little jumps, a few centimetres high, that are hard to ignore.", src: null, poster: `${base}/play-motion.webp`, posterAlt: "The PouncePop ball in the air mid-hop" },
    { id: "glow", title: "And it glows", caption: "The ring lights up while it's switched on.", src: null, poster: `${base}/hero.webp`, posterAlt: "The PouncePop ball with its ring lit" },
  ],
  bundle: {
    heading: "One for now. One for under the sofa.",
    intro: "Small balls go missing, and two cats rarely share. Every pack ships free, and you pick the colour of each ball.",
    tierNotes: {
      1: "One ball to start the chase.",
      2: "One each for two pets, or a spare for when the first rolls under the sofa.",
      3: "A full set: one in every colour, or a ball for each room.",
    },
  },
  fitNote:
    "Made for cats, and fine for toy-size dogs with you in the room. It is 42 mm across, about the size of a golf ball, so it is not for medium or large dogs, who could swallow it.",
  howItWorks: {
    heading: "Playtime in three steps.",
    steps: [
      { icon: "battery", title: "Charge it", text: "Top up the built-in battery over USB before the first play." },
      { icon: "power", title: "Switch it on", text: "Press the power button in the middle of the ring. The ring lights up." },
      { icon: "paw", title: "Set it down", text: "Put it on the floor and step back. It rolls and hops; your cat does the rest." },
    ],
    tip: "It's a chase toy, not a chew toy. Put it away when playtime is over, and stop using it if the shell gets damaged.",
  },
  comparison: {
    heading: "PouncePop vs. an ordinary toy ball.",
    ours: "PouncePop",
    theirs: "Ordinary toy ball",
    rows: [
      { feature: "Who moves it", ours: "It rolls and hops by itself", theirs: "You throw it, or it sits there" },
      { feature: "Catching the eye", ours: "A ring that lights up while it's on", theirs: "No light" },
      { feature: "Power", ours: "Built-in battery, recharged over USB", theirs: "None" },
      { feature: "Shell", ours: "Bite-resistant, grooved for grip", theirs: "Varies" },
      { feature: "Colours", ours: "Orange, purple or blue", theirs: "Varies" },
    ],
  },
  included: {
    heading: "What's in the box.",
    items: ["1 PouncePop ball in the colour you chose (one per ball ordered)"],
    notIncluded: ["A USB wall charger"],
    image: `${base}/in-the-box.webp`,
    imageAlt: "One orange PouncePop ball on a plain background: the full contents of the box",
  },
  story: [
    {
      heading: "A chase that doesn't need your hands.",
      text: "Indoor cats have energy to burn and you have a day to get through. PouncePop keeps moving by itself, rolling one way and then hopping, so there's something to stalk while you cook, work or finally sit down.",
      image: `${base}/banner-lifestyle.webp`,
      imageAlt: "A cat stalking the glowing PouncePop ball across a sunny living-room floor",
    },
    {
      heading: "Small enough to bat. Tough enough to pounce on.",
      text: "At 42 mm it's sized for paws: easy to swat, trap and carry. The grooved shell is bite-resistant and the ring around the button lights up while it's on, so it stays easy to follow.",
      image: `${base}/texture-macro.webp`,
      imageAlt: "The grooved shell and clear ring of the PouncePop ball up close",
    },
  ],
  faq: [
    {
      q: "Which pets is it for?",
      a: "PouncePop is made for cats. It also suits toy-size dogs as long as you're in the room. It is 42 mm across, about the size of a golf ball, so please don't give it to a medium or large dog: a ball this small can be swallowed.",
    },
    {
      q: "How does it work?",
      a: "Press the power button in the middle of the ring and put the ball on the floor. It rolls and makes little hops by itself, and the ring lights up while it's on.",
    },
    {
      q: "Will my cat chew through it?",
      a: "The shell is bite-resistant and made for batting, pouncing and carrying. It is a chase toy rather than a chew toy, though: put it away after play, and stop using it if the shell is cracked or damaged.",
    },
    {
      q: "Does it work on carpet?",
      a: "It has the most room to move on hard, smooth floors and low-pile rugs. A ball this small slows down in deep or shaggy carpet, so expect shorter runs there.",
    },
    {
      q: "Is it noisy?",
      a: "There's a small motor inside, so you'll hear it roll and tap along on a hard floor. We don't quote a decibel figure because we don't have a measured one. If your cat plays at night, a rug softens the sound.",
    },
    {
      q: "How long does the battery last?",
      a: "It has a built-in rechargeable battery that charges over USB, so there are no batteries to replace. We don't publish hours per charge yet: the maker doesn't state a figure and we would rather not guess. Switch it off after play to save the charge.",
    },
    {
      q: "How do I clean it?",
      a: "Wipe it with a slightly damp cloth and dry it. Don't rinse or soak it: there are electronics and a charging port inside, and it isn't rated as waterproof.",
    },
    {
      q: "What are the specifications?",
      a: "A self-rolling, self-hopping ball 42 mm across, with a plastic bite-resistant shell, a light-up ring, and a built-in battery that charges over USB. It comes in orange, purple and blue. Each box holds one ball.",
    },
  ],
  seo: {
    pageTitle: "PouncePop Self-Rolling Cat Ball – Smart Hopping Cat Toy | Kitvoy",
    description:
      "PouncePop is a small self-rolling, hopping ball for cats with a light-up ring and a USB-rechargeable battery. Orange, purple or blue. Free tracked shipping.",
    summary:
      "A 42 mm self-rolling, self-hopping toy ball for cats, with a bite-resistant plastic shell, a ring that lights up while it is on and a built-in battery that charges over USB. Sold in orange, purple and blue. Each box holds one ball.",
    category: "Pet Supplies > Cat Supplies > Cat Toys > Interactive Cat Toys",
    googleCategory: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Toys",
    material: "Plastic",
    facts: [
      { name: "Diameter", value: "42 mm" },
      { name: "Movement", value: "Rolls and hops by itself" },
      { name: "Light", value: "Light-up ring" },
      { name: "Shell", value: "Bite-resistant plastic" },
      { name: "Power", value: "Built-in battery, USB charging" },
      { name: "In the box", value: "1 ball" },
    ],
    lastModified: "2026-11-12",
  },
  merchant: {
    inFeed: false,
    title: "Kitvoy PouncePop Self-Rolling Cat Ball – Interactive Hopping Cat Toy with Light-Up Ring, USB Rechargeable",
    description:
      "The Kitvoy PouncePop is a small interactive ball for cats that rolls and hops by itself, so your cat has something to stalk and chase without anyone throwing it. The ring around its power button lights up while it is on, which makes it easy to follow across the floor. The shell is bite-resistant plastic, grooved for grip and sized for paws at 42 mm across. A built-in battery charges over USB, so there are no batteries to replace. Made for cats; it also suits toy-size dogs under supervision. Because it is 42 mm across, it is not suitable for medium or large dogs. Each box contains one ball.",
    highlights: [
      "Rolls and hops by itself for solo chase play",
      "Ring around the power button lights up while it is on",
      "Bite-resistant plastic shell, grooved for grip",
      "42 mm across, sized for cats' paws",
      "Built-in battery that charges over USB",
      "Made for cats; not for medium or large dogs",
    ],
    weightGrams: 59,
  },
  database: {
    name: "PouncePop Self-Rolling Cat Ball",
    sku: "PET-001",
    price: 29.99,
    shortDescription: "A small ball for cats that rolls and hops by itself, with a light-up ring and a USB-rechargeable battery.",
    description:
      "PouncePop rolls and hops by itself, so your cat gets a chase without anyone throwing it. The ring around the power button lights up while it is on, the shell is bite-resistant, and the built-in battery charges over USB. It is 42 mm across: made for cats, fine for toy-size dogs under supervision, and not for medium or large dogs.",
    details: "• Rolls and hops by itself\n• Light-up ring\n• Bite-resistant plastic shell\n• 42 mm across\n• Built-in battery, USB charging\n• In the box: 1 ball",
    categorySlug: "pet-care",
    categoryName: "Pet Care",
    stock: 200,
  },
};
