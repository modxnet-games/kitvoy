import type { ProductEntry } from "./types";

/**
 * The store's one product: a wireless support bra.
 *
 * It has no product name of its own (the owner's choice, 2026-11-23): customers
 * see it as a soutien-gorge / حمّالة صدر from Chrilik. "sanadi" is only its
 * internal id (database slug, photo folder, SKU prefix SND), left from the name
 * it had at launch; customers never read it.
 *
 * Product facts, from the supplier's listing the owner chose (2026-11-22):
 * seamless nylon, no underwire, thin 3/4 moulded cups, wide non-adjustable
 * straps, a wide back with a hook closure, and an elastic band that wraps to
 * the front and fastens there with three hooks; sizes S to XXXL; black, beige
 * and leopard; hand wash. Selling points as the supplier states them: soft
 * support, lift and shaping, breathable fabric, an adjustable secure fit.
 *
 * Offer, set by the owner: cash on delivery in Morocco, free delivery in 24 to
 * 72 hours, size exchange within 7 days.
 */
const photo = (name: string) => `/products/sanadi/${name}.webp`;

export const sanadi: ProductEntry = {
  slug: "sanadi",
  // The supplier's chart (US band and cup) in the French sizes Moroccan shops use: band + 15 cm naming, DD = E
  sizeGuide: {
    rows: [
      { size: "S", usual: ["85B", "85C", "85D", "90A", "90B"] },
      { size: "M", usual: ["85E", "90C", "90D", "95A", "95B"] },
      { size: "L", usual: ["90E", "95C", "95D", "100B", "100C"] },
      { size: "XL", usual: ["95E", "100D", "105B", "105C"] },
      { size: "XXL", usual: ["100E", "105D", "110B", "110C"] },
      { size: "XXXL", usual: ["105E", "110D", "115B", "115C"] },
    ],
    bands: [
      { band: "85", underbust: "69–74" },
      { band: "90", underbust: "74–79" },
      { band: "95", underbust: "79–84" },
      { band: "100", underbust: "84–89" },
      { band: "105", underbust: "89–94" },
      { band: "110", underbust: "94–99" },
      { band: "115", underbust: "99–104" },
    ],
  },
  lastModified: "2026-11-23",
  content: {
    fr: {
      name: "Soutien-gorge de maintien sans armatures Chrilik",
      eyebrow: "Soutien-gorge sans armatures",
      tagline: "Le maintien qui se règle sur vous.",
      description:
        "Sans armatures, avec un dos large et une bande élastique qui s'agrafe devant : il soutient et galbe la poitrine, et c'est vous qui choisissez le serrage.",
      features: [
        "Sans armatures : aucun fil métallique, aucune marque sur la peau",
        "Bande de maintien réglable qui s'agrafe devant, à votre mesure",
        "Effet galbant : la poitrine est soutenue, remontée et bien tenue",
        "Dos large et bretelles larges, pour un confort toute la journée",
        "Tissu fin, sans coutures et respirant, invisible sous les vêtements",
        "Du S au XXXL, en noir, beige et léopard",
      ],
      trust: "Sans armatures, maintien réglable",
      gallery: [
        { src: photo("hero"), alt: "Soutien-gorge noir porté, vu de face, avec sa bande agrafée devant", badge: { icon: "support", title: "Sans armatures", sub: "Maintien réglable devant" } },
        { src: photo("back"), alt: "Soutien-gorge noir vu de dos : dos large et bretelles larges", badge: { icon: "back", title: "Dos large", sub: "Bretelles confort" } },
        { src: photo("bands"), alt: "Les deux côtés de la bande élastique du soutien-gorge beige, tirés avant d'être agrafés devant", badge: { icon: "adjust", title: "Bande réglable", sub: "Vous choisissez le serrage" } },
        { src: photo("detail"), alt: "Gros plan sur les agrafes avant et la bande côtelée du soutien-gorge beige" },
        { src: photo("colours"), alt: "Les trois couleurs du soutien-gorge posées à plat : beige, noir et léopard" },
        // Shown only while one of the five above is missing (the page keeps the first five photos that exist)
        { src: photo("colour-nude"), alt: "Soutien-gorge beige porté, vu de face" },
        { src: photo("colour-leopard"), alt: "Soutien-gorge léopard porté, vu de face" },
      ],
      transformation: {
        eyebrow: "La différence",
        heading: "Avant, après.",
        lede: "Même tee-shirt, même journée. Seul le soutien-gorge change.",
        before: { src: photo("before"), alt: "Sous un tee-shirt gris, avec un soutien-gorge ordinaire" },
        after: { src: photo("after"), alt: "Sous le même tee-shirt gris, avec le soutien-gorge Chrilik" },
        beforeLabel: "Avant",
        afterLabel: "Avec Chrilik",
      },
      howItWorks: {
        heading: "Trois gestes, et c'est réglé.",
        steps: [
          { title: "Enfilez-le", text: "Mettez-le comme un soutien-gorge classique et fermez les agrafes dans le dos." },
          { title: "Ramenez la bande", text: "Tirez les deux côtés de la bande élastique vers l'avant, sous la poitrine." },
          { title: "Agrafez devant", text: "Fermez les agrafes à l'avant, au serrage qui vous convient. C'est tout." },
        ],
      },
      included: ["Un soutien-gorge par pièce commandée, dans la couleur et la taille que vous avez choisies"],
      facts: [
        { name: "Type", value: "Soutien-gorge sans armatures, sans coutures" },
        { name: "Matière", value: "Nylon (polyamide) extensible" },
        { name: "Bonnets", value: "3/4, fins et moulés" },
        { name: "Maintien", value: "Bande élastique réglable, agrafes devant" },
        { name: "Fermeture", value: "Agrafes au dos" },
        { name: "Bretelles", value: "Larges, non réglables" },
        { name: "Tailles", value: "S, M, L, XL, XXL, XXXL" },
        { name: "Couleurs", value: "Noir, beige, léopard" },
        { name: "Entretien", value: "Lavage à la main" },
      ],
      faq: [
        {
          q: "Comment choisir ma taille ?",
          a: "Regardez le guide des tailles sur cette page : il part de votre taille de soutien-gorge habituelle. Entre deux tailles, ou avec une poitrine généreuse, prenez la taille au-dessus.",
        },
        { q: "Est-ce qu'il se voit sous les vêtements ?", a: "Le tissu est fin et sans coutures, et les bonnets sont lisses : il reste discret sous un tee-shirt ou une robe." },
        { q: "Peut-on le porter toute la journée ?", a: "Oui. Il n'a pas d'armatures, le dos et les bretelles sont larges, et vous réglez vous-même le serrage de la bande." },
        { q: "Comment le laver ?", a: "À la main, à l'eau froide ou tiède, puis séchage à l'air libre. Évitez la machine et le sèche-linge pour garder son élasticité." },
      ],
      closing: { heading: "Un pour aujourd'hui, un pour demain.", cta: "Commander maintenant" },
      seo: {
        pageTitle: "Soutien-gorge de maintien sans armatures",
        description: "Soutien-gorge sans armatures avec bande de maintien réglable, du S au XXXL. Paiement à la livraison et livraison gratuite partout au Maroc en 24 à 72 h.",
        category: "Lingerie > Soutiens-gorge",
        material: "Nylon",
      },
    },
    ar: {
      name: "حمّالة صدر داعمة بدون سلك من شري ليك",
      eyebrow: "سوتيان بدون سلك",
      tagline: "دعمٌ تتحكّمين فيه بنفسك.",
      description: "بدون سلك، بظهر عريض وحزام مطاطي يُغلق من الأمام: تدعم الصدر وتمنحه شكلاً متناسقاً، وأنتِ من تختارين درجة الشدّ.",
      features: [
        "بدون سلك: لا أسلاك معدنية ولا علامات على البشرة",
        "حزام دعم قابل للتعديل يُغلق من الأمام على مقاسك",
        "تشدّ الصدر وترفعه وتمنحه شكلاً متناسقاً",
        "ظهر عريض وحمّالات عريضة لراحة طوال اليوم",
        "قماش رقيق بدون خياطة يسمح بمرور الهواء ولا يظهر تحت الملابس",
        "من S إلى XXXL، بالأسود والبيج والنمري",
      ],
      trust: "بدون سلك، دعم قابل للتعديل",
      gallery: [
        { src: photo("hero"), alt: "حمّالة الصدر باللون الأسود من الأمام مع الحزام المغلق من الأمام", badge: { icon: "support", title: "بدون سلك", sub: "دعم قابل للتعديل من الأمام" } },
        { src: photo("back"), alt: "حمّالة الصدر باللون الأسود من الخلف: ظهر عريض وحمّالات عريضة", badge: { icon: "back", title: "ظهر عريض", sub: "حمّالات مريحة" } },
        { src: photo("bands"), alt: "طرفا الحزام المطاطي لحمّالة الصدر باللون البيج قبل إغلاقهما من الأمام", badge: { icon: "adjust", title: "حزام قابل للتعديل", sub: "أنتِ تختارين درجة الشدّ" } },
        { src: photo("detail"), alt: "صورة مقرّبة للمشابك الأمامية والحزام المضلّع لحمّالة الصدر باللون البيج" },
        { src: photo("colours"), alt: "الألوان الثلاثة لحمّالة الصدر: بيج، أسود ونمري" },
        { src: photo("colour-nude"), alt: "حمّالة الصدر باللون البيج من الأمام" },
        { src: photo("colour-leopard"), alt: "حمّالة الصدر باللون النمري من الأمام" },
      ],
      transformation: {
        eyebrow: "الفرق",
        heading: "قبل وبعد.",
        lede: "نفس القميص ونفس اليوم. الذي تغيّر هو حمّالة الصدر فقط.",
        before: { src: photo("before"), alt: "تحت قميص رمادي، بحمّالة صدر عادية" },
        after: { src: photo("after"), alt: "تحت نفس القميص الرمادي، مع حمّالة صدر شري ليك" },
        beforeLabel: "قبل",
        afterLabel: "مع شري ليك",
      },
      howItWorks: {
        heading: "ثلاث خطوات وتكونين جاهزة.",
        steps: [
          { title: "البسيها", text: "البسيها كأي حمّالة صدر عادية وأغلقي المشابك من الخلف." },
          { title: "اسحبي الحزام", text: "اسحبي طرفي الحزام المطاطي إلى الأمام، تحت الصدر." },
          { title: "أغلقي من الأمام", text: "أغلقي المشابك الأمامية على درجة الشدّ التي تريحك. هذا كل شيء." },
        ],
      },
      included: ["حمّالة صدر واحدة عن كل قطعة تطلبينها، باللون والمقاس الذي اخترته"],
      facts: [
        { name: "النوع", value: "حمّالة صدر بدون سلك وبدون خياطة" },
        { name: "الخامة", value: "نايلون (بولي أميد) مطاطي" },
        { name: "الأكواب", value: "3/4، رقيقة ومقولبة" },
        { name: "الدعم", value: "حزام مطاطي قابل للتعديل بمشابك أمامية" },
        { name: "الإغلاق", value: "مشابك من الخلف" },
        { name: "الحمّالات", value: "عريضة، غير قابلة للتعديل" },
        { name: "المقاسات", value: "S، M، L، XL، XXL، XXXL" },
        { name: "الألوان", value: "أسود، بيج، نمري" },
        { name: "العناية", value: "غسل يدوي" },
      ],
      faq: [
        {
          q: "كيف أختار مقاسي؟",
          a: "راجعي دليل المقاسات في هذه الصفحة: يعتمد على مقاس حمّالة الصدر الذي تلبسينه عادة. إذا كنتِ بين مقاسين، أو كان الصدر ممتلئاً، فاختاري المقاس الأكبر.",
        },
        { q: "هل تظهر تحت الملابس؟", a: "القماش رقيق وبدون خياطة والأكواب ملساء، لذلك تبقى غير ظاهرة تحت القميص أو الفستان." },
        { q: "هل يمكن لبسها طوال اليوم؟", a: "نعم. ليس فيها سلك، والظهر والحمّالات عريضة، وأنتِ من تضبطين شدّ الحزام." },
        { q: "كيف أغسلها؟", a: "باليد، بماء بارد أو فاتر، ثم تُترك لتجفّ في الهواء. تجنّبي الغسالة والمجفّف للحفاظ على مطاطيتها." },
      ],
      closing: { heading: "واحدة لليوم، وواحدة للغد.", cta: "اطلبي الآن" },
      seo: {
        pageTitle: "حمّالة صدر داعمة بدون سلك",
        description: "حمّالة صدر (سوتيان) بدون سلك بحزام دعم قابل للتعديل، من S إلى XXXL. الدفع عند الاستلام والتوصيل مجاني لجميع مدن المغرب خلال 24 إلى 72 ساعة.",
        category: "ملابس داخلية > حمّالات الصدر",
        material: "نايلون",
      },
    },
  },
  database: {
    // Order lines, the admin, the owner's email and the delivery slip read this: "Soutien-gorge (Noir, L)"
    name: "Soutien-gorge",
    sku: "SND-001",
    price: 199,
    shortDescription: "Soutien-gorge de maintien sans armatures, bande réglable agrafée devant.",
    description: "Soutien-gorge sans armatures et sans coutures, avec un dos large, des bretelles larges et une bande élastique réglable qui s'agrafe devant. Du S au XXXL, en noir, beige et léopard.",
    details: "Nylon extensible. Bonnets 3/4 fins et moulés. Agrafes au dos, bande de maintien agrafée devant. Lavage à la main.",
    categorySlug: "lingerie",
    categoryName: "Lingerie",
    stock: 300,
  },
};
