import type { ProductContent } from "./types";

/**
 * PouncePop Smart Interactive Dog & Cat Ball: Kitvoy's name for CJdropshipping
 * product CJYD1693059 (variants: orange red 01AZ, purple 02BY, blue 03CX).
 *
 * SPEC AND POSITIONING: set by the store owner on 2026-11-12, and the page
 * follows them:
 *  - Sold for both dogs and cats.
 *  - USB-C fast recharging; smart obstacle avoidance (auto-reverses when it
 *    hits walls or furniture); motion/touch activation with automatic standby
 *    and wake-up cycles that save battery; two play modes (energetic bounce,
 *    erratic roll); LED light ring; durable, bite-resistant, pet-safe shell.
 *  - In the box: 1 PouncePop smart ball and 1 USB-C charging cable.
 *  - Free tracked shipping and a 30-Day Money-Back Guarantee. No customs, VAT
 *    or duty notes and no size warnings on the page.
 *
 * For the record, CJ's own listing (checked the same day) states less: a
 * self-rolling, jumping, bite-resistant plastic ball, 42 mm across, with a
 * built-in battery charged over "USB", listed for cats, packing list
 * "1* Elastic Ball". The points above that go beyond it rest on the owner's
 * confirmation, not on the listing.
 *
 * Still not stated anywhere, because nobody has given a figure: battery life,
 * charging time, noise level, any waterproof rating or certification.
 *
 * Standing rules for every product page: no strike-through or "was" prices,
 * no invented reviews, ratings or customer counts, no countdowns or stock
 * warnings, no competitor names, and American English.
 */
const base = "/products/pouncepop";

export const pouncepop: ProductContent = {
  slug: "pouncepop",
  name: "PouncePop Smart Interactive Dog & Cat Ball",
  eyebrow: "PouncePop Smart Interactive Dog & Cat Ball",
  headline: "You work. They play. Nobody feels guilty.",
  subheadline:
    "That look when you open the laptop? PouncePop answers it. A smart ball that rolls, bounces and reverses off furniture by itself, so your dog or cat stays happily busy.",
  benefits: [
    { icon: "paw", title: "Guilt-free workdays", text: "It plays by itself, so they get a real chase while you get through your inbox." },
    { icon: "zap", title: "Reverses off furniture", text: "Smart obstacle avoidance: it bumps a wall or a chair leg, backs up and plays on." },
    { icon: "hand", title: "Wakes at a touch", text: "Rests on standby to save battery, then springs back to life at a paw or a nose." },
    { icon: "shield", title: "Built for rough play", text: "A durable, bite-resistant, pet-safe shell made for pounces, paws and rough-and-tumble play." },
  ],
  // Five images at most: the hero, the chase, smart motion, the shell and the box
  gallery: [
    { src: `${base}/hero.webp`, alt: "PouncePop smart ball in orange with its LED light ring glowing", label: "PouncePop" },
    { src: `${base}/action-dog-cat.webp`, alt: "A Corgi puppy and a cat chasing the glowing PouncePop ball across a living-room floor", label: "The chase" },
    { src: `${base}/smart-motion.webp`, alt: "The PouncePop ball bouncing back off furniture and rolling away in a new direction", label: "Smart motion" },
    { src: `${base}/shell-detail.webp`, alt: "Close-up of the PouncePop's textured bite-resistant shell and LED light ring", label: "Shell & LED" },
    { src: `${base}/in-the-box.webp`, alt: "What's in the box: one PouncePop smart ball and one USB-C charging cable", label: "In the box" },
  ],
  // Stills stand in until real clips of the product are filmed; set `src` to bind one
  demoLoops: [
    { id: "play", title: "It plays by itself", caption: "One nudge and it's off across the floor, bouncing and rolling.", src: null, poster: `${base}/action-dog-cat.webp`, posterAlt: "A dog and a cat chasing the PouncePop ball as it rolls by itself" },
    { id: "reverse", title: "It reverses off furniture", caption: "Bumps into the sofa, backs up and rolls right back into the game.", src: null, poster: `${base}/smart-motion.webp`, posterAlt: "The PouncePop ball turning back from a piece of furniture" },
    { id: "wake", title: "It wakes at a touch", caption: "One nudge and the LED ring lights up for another round.", src: null, poster: `${base}/hero.webp`, posterAlt: "The PouncePop ball with its LED ring lit" },
  ],
  bundle: {
    heading: "One ball is fun. Two keeps the peace.",
    intro: "Pick your pack, then pick the color of every ball: orange, purple or blue. Free tracked shipping and a 30-Day Money-Back Guarantee on every order.",
    tierNotes: {
      1: "One ball to end the boredom.",
      2: "One each for the dog and the cat, or one in play while the other charges.",
      3: "One in every color: a ball for every pet and every room in the house.",
    },
  },
  howItWorks: {
    heading: "Playtime in three steps.",
    steps: [
      { icon: "battery", title: "Charge it up", text: "Plug in the included USB-C cable. Fast recharging has it ready to play." },
      { icon: "power", title: "Tap to wake", text: "Press the power button, then a touch from you or a nudge from your pet wakes it. The LED ring lights up and away it goes." },
      { icon: "play", title: "Let them chase", text: "It bounces, rolls and reverses off walls and furniture, then rests on standby until the next nudge." },
    ],
  },
  comparison: {
    heading: "PouncePop vs. an ordinary pet toy.",
    ours: "PouncePop",
    theirs: "An ordinary pet toy",
    rows: [
      { feature: "Who starts the game", ours: "Your pet, with a nudge or a tap", theirs: "You, one throw at a time" },
      { feature: "Movement", ours: "Two modes: energetic bounce and erratic roll", theirs: "Only moves when it's thrown" },
      { feature: "Walls and furniture", ours: "Auto-reverses and keeps playing", theirs: "Stops where it lands" },
      { feature: "When play pauses", ours: "Rests on standby, wakes at a touch", theirs: "Sits there until you pick it up" },
      { feature: "Catching their eye", ours: "LED light ring", theirs: "No light" },
      { feature: "Power", ours: "USB-C fast recharging, cable included", theirs: "Your throwing arm" },
    ],
  },
  included: {
    heading: "What's in the box.",
    items: ["1x PouncePop Smart Ball in the color you choose", "1x USB-C Charging Cable"],
    image: `${base}/in-the-box.webp`,
    imageAlt: "One PouncePop smart ball and one USB-C charging cable laid out on a plain surface",
  },
  story: [
    {
      heading: "The bored-pet guilt ends here.",
      text: "You know the look: toy at your feet, eyes on you, a meeting about to start. PouncePop takes the next round. It bounces and rolls by itself, so your dog or cat is off on a proper chase while you get your work done. Look up and they're busy, happy and far too occupied to sulk.",
      image: `${base}/action-dog-cat.webp`,
      imageAlt: "A dog and a cat busy chasing the PouncePop ball at home",
    },
    {
      heading: "Smart enough to back out of a corner.",
      text: "Most balls roll to a wall and stay there. PouncePop's smart obstacle avoidance feels the bump, reverses and heads back into the room. Two play modes, an energetic bounce and an erratic roll, keep the chase unpredictable, and one nudge wakes it from standby for the next game.",
      image: `${base}/smart-motion.webp`,
      imageAlt: "The PouncePop ball reversing away from furniture",
    },
    {
      heading: "Built for paws, pounces and evening zoomies.",
      text: "The durable, bite-resistant shell is pet-safe and made to be pounced on, batted around and wrestled across the rug. The LED light ring gives them a glow to stalk from across the room, and USB-C fast recharging has it charged for tonight's sprint down the hallway.",
      image: `${base}/shell-detail.webp`,
      imageAlt: "The textured shell and LED ring of the PouncePop ball up close",
    },
  ],
  faq: [
    {
      q: "Is it for dogs or cats?",
      a: "Both. PouncePop is made for dogs and cats alike, because it speaks to the instinct they share: if it moves, it needs chasing. Dogs nose it, herd it and pounce. Cats stalk it, bat it and ambush it from behind the sofa. At 42 mm across it's light and quick, easy to bat and chase. One of each at home? The 2-Pack gives everybody a ball of their own, in a color of their own.",
    },
    {
      q: "How does it work?",
      a: "Charge it with the included USB-C cable, switch it on and give it a tap. The LED ring lights up and the ball starts moving by itself in two play modes: an energetic bounce and an erratic roll. Between rounds it slips into standby automatically to save battery, and the next touch from a paw or a nose starts the game again.",
    },
    {
      q: "Will it get stuck against walls or furniture?",
      a: "No. PouncePop has smart obstacle avoidance: when it hits a wall, a table leg or the side of the sofa, it automatically reverses and rolls back into open floor. The chase keeps going, and you stay in your chair.",
    },
    {
      q: "Will it stand up to teeth and rough play?",
      a: "Yes. The shell is durable, bite-resistant and pet-safe, built for the way dogs and cats really play: pouncing, batting, grabbing and wrestling it across the floor. It takes the rough stuff and rolls straight back into the game.",
    },
    {
      q: "Where can it play, and is it noisy?",
      a: "Set it down wherever your pet plays. PouncePop bounces and rolls across the room, and smart obstacle avoidance reverses it off walls and furniture so the game keeps going. As for noise, it sounds like playtime: a small ball bouncing and rolling. When the game stops it rests on standby, still and quiet, until a paw wakes it.",
    },
    {
      q: "How do I charge it?",
      a: "Plug in the USB-C cable that comes in the box and PouncePop fast-charges, ready for the next game. There are no batteries to buy or swap. It looks after its own charge too: it rests on standby between rounds and wakes at a touch, so the battery is saved for the chase.",
    },
    {
      q: "How do I clean it?",
      a: "A quick wipe with a soft, slightly damp cloth keeps the shell looking fresh. It takes a few seconds, and then it's ready for the next round.",
    },
    {
      q: "What's in the box?",
      a: "One PouncePop Smart Ball in the color you choose and one USB-C charging cable. With a 2-Pack or 3-Pack you pick the color of each ball: orange, purple or blue.",
    },
    {
      q: "What are the specifications?",
      a: "PouncePop is a smart interactive ball for dogs and cats. It has USB-C fast recharging, smart obstacle avoidance, motion/touch activation with automatic standby, two play modes (bounce and roll), an LED light ring and a bite-resistant, pet-safe shell. It measures 42 mm across and comes in orange, purple and blue. The box holds one ball and one USB-C charging cable.",
    },
  ],
  seo: {
    pageTitle: "PouncePop Smart Interactive Dog & Cat Ball | Kitvoy",
    description:
      "PouncePop is a smart ball for dogs and cats that bounces, rolls and reverses off furniture by itself. USB-C fast recharging. Free tracked shipping.",
    summary:
      "PouncePop is a smart interactive ball for dogs and cats, sold by Kitvoy. It moves by itself in two play modes (energetic bounce and erratic roll), reverses automatically when it hits walls or furniture, wakes at a touch or movement and goes into standby to save battery. It has an LED light ring, a durable bite-resistant pet-safe shell and USB-C fast recharging. It is 42 mm across and comes in orange, purple and blue. Each box holds one ball and one USB-C charging cable.",
    category: "Pet Supplies > Dog & Cat Toys > Interactive Pet Toys",
    googleCategory: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Toys",
    material: "Plastic",
    // Every fact here is also said in the "What are the specifications?" answer
    facts: [
      { name: "For", value: "Dogs and cats" },
      { name: "Play modes", value: "Two: bounce and roll" },
      { name: "Obstacle avoidance", value: "Reverses off walls and furniture" },
      { name: "Activation", value: "Motion/touch, with automatic standby" },
      { name: "Light", value: "LED light ring" },
      { name: "Shell", value: "Bite-resistant, pet-safe" },
      { name: "Charging", value: "USB-C fast recharging" },
      { name: "Diameter", value: "42 mm" },
      { name: "Colors", value: "Orange, purple, blue" },
      { name: "In the box", value: "1 ball, 1 USB-C charging cable" },
    ],
    lastModified: "2026-11-12",
  },
  merchant: {
    inFeed: false,
    title: "Kitvoy PouncePop Smart Interactive Dog & Cat Ball – Self-Moving Pet Toy with Obstacle Avoidance, LED Light Ring, USB-C Rechargeable",
    description:
      "The Kitvoy PouncePop is a smart interactive ball for dogs and cats that moves by itself, so pets can chase it during solo play without anyone throwing a toy. It has two play modes, an energetic bounce and an erratic roll, which keep its movement unpredictable. Smart obstacle avoidance makes the ball reverse automatically when it hits a wall or a piece of furniture, so it rolls back into open floor and play continues. Motion and touch activation wakes the ball when a pet nudges it, and automatic standby and wake-up cycles conserve battery between play sessions. An LED light ring makes the ball easy to follow across the floor. The shell is durable, bite-resistant and pet-safe. The built-in battery recharges quickly over USB-C. The ball measures 42 mm across and is available in orange, purple and blue. Each box contains one PouncePop Smart Ball and one USB-C charging cable.",
    highlights: [
      "Self-moving smart ball for dogs and cats, made for solo indoor play",
      "Smart obstacle avoidance: reverses automatically when it hits walls or furniture",
      "Motion and touch activation with automatic standby and wake-up to conserve battery",
      "Two play modes: energetic bounce and erratic roll",
      "LED light ring that is easy to follow across the floor",
      "Durable, bite-resistant, pet-safe shell",
      "USB-C fast recharging, with a USB-C charging cable in the box",
      "Available in orange, purple and blue",
    ],
    weightGrams: 59,
  },
  database: {
    name: "PouncePop Smart Interactive Dog & Cat Ball",
    sku: "PET-001",
    price: 29.99,
    shortDescription: "A smart ball for dogs and cats that bounces, rolls and reverses off furniture by itself, with an LED light ring and USB-C fast recharging.",
    description:
      "PouncePop keeps dogs and cats busy when your hands are full. It moves by itself in two play modes, an energetic bounce and an erratic roll, and smart obstacle avoidance reverses it whenever it hits a wall or furniture. A nudge or a tap wakes it, and it rests on standby between plays to save battery. The LED light ring holds their attention, the durable bite-resistant shell is pet-safe, and the battery recharges fast over USB-C with the included cable. Choose orange, purple or blue.",
    details:
      "• For dogs and cats\n• Two play modes: energetic bounce and erratic roll\n• Smart obstacle avoidance: auto-reverses off walls and furniture\n• Motion/touch activation with automatic standby\n• LED light ring\n• Durable, bite-resistant, pet-safe shell\n• USB-C fast recharging\n• 42 mm across\n• Colors: orange, purple, blue\n• In the box: 1x PouncePop Smart Ball, 1x USB-C Charging Cable",
    categorySlug: "pet-care",
    categoryName: "Pet Care",
    stock: 200,
  },
};
